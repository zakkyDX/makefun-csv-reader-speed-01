// A faster drop-in for csv-reader 1.0.0: returns exactly its answer for every input
// {text, header} -> {columns, rows, errors}, under the same broken-row policy:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a quoted field runs to the next quote that is not doubled, "" inside it is one quote,
//     and each CRLF or lone CR inside it is read as LF; what follows its closing quote, up
//     to the next comma or line break, is appended as it stands (quote_junk, when the field
//     ends); a quote that never closes is a literal character and the text after it is read
//     again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings;
//   - columns is the first record when header is true, else null; rows are padded with ""
//     (short_row) or cut (long_row) to the first record's width;
//   - each error is {code, line, row} in the order met.
// Where the reference reads one character at a time, this reads slice by slice, jumping
// between the only characters that can change the reading: , " CR LF.
// Pure: no clock, no randomness, nothing kept from one call to the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes.
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Returns the field, how it ended, and how many
  // characters were kept (`added`, which the quote_junk check reads).
  function readUnquoted(value) {
    let added = 0;
    let start = pos;
    while (pos < n) {
      let i = text.indexOf(',', pos);
      const j = text.indexOf('\n', pos);
      if (j !== -1 && (i === -1 || j < i)) i = j;
      const k = text.indexOf('\r', pos);
      if (k !== -1 && (i === -1 || k < i)) i = k;
      if (i === -1) {
        value += text.slice(start);
        added += n - start;
        pos = n;
        return { value, ended: END, added };
      }
      const c = text[i];
      if (c === ',') {
        value += text.slice(start, i);
        added += i - start;
        pos = i + 1;
        return { value, ended: COMMA, added };
      }
      if (c === '\n') {
        value += text.slice(start, i);
        added += i - start;
        pos = i + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // c === '\r'
      if (text[i + 1] === '\n') {
        value += text.slice(start, i);
        added += i - start;
        pos = i + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // A lone CR is dropped; the field continues after it.
      value += text.slice(start, i);
      added += i - start;
      error('stray_cr');
      pos = i + 1;
      start = pos;
    }
    return { value, ended: END, added };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    const parts = [];
    pos += 1;
    let seg = pos;
    let closed = false;
    while (pos < n) {
      let i = text.indexOf('"', pos);
      const j = text.indexOf('\r', pos);
      if (j !== -1 && (i === -1 || j < i)) i = j;
      const k = text.indexOf('\n', pos);
      if (k !== -1 && (i === -1 || k < i)) i = k;
      if (i === -1) break;
      const c = text[i];
      if (c === '"') {
        if (text[i + 1] === '"') {
          parts.push(text.slice(seg, i), '"');
          pos = i + 2;
          seg = pos;
          continue;
        }
        parts.push(text.slice(seg, i));
        pos = i + 1;
        closed = true;
        break;
      }
      if (c === '\r') {
        // CRLF and a lone CR inside quotes are each one LF.
        parts.push(text.slice(seg, i), '\n');
        line += 1;
        pos = text[i + 1] === '\n' ? i + 2 : i + 1;
        seg = pos;
        continue;
      }
      // c === '\n': it stays in the current segment; only the line count moves.
      line += 1;
      pos = i + 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is
      // read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    const value = parts.length === 1 ? parts[0] : parts.join('');
    if (pos >= n) return { value, ended: END };
    const c = text[pos];
    if (c === ',') {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === '\n') {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === '\r' && text[pos + 1] === '\n') {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  // Applies the width, header and short/long rules to one read record.
  function finishRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      if (text[pos] === '\n') {
        pos += 1;
        line += 1;
      } else if (text[pos] === '\r' && text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: a record that sits on one line holding no quote and no CR (past the
    // CR of its CRLF) reads exactly as splitting that line on commas reads it: no
    // field in it opens with a quote, and no stray CR can occur.
    const eol = text.indexOf('\n', pos);
    const lineEnd = eol === -1 ? n : eol;
    let contentEnd = lineEnd;
    if (eol !== -1 && contentEnd > pos && text[contentEnd - 1] === '\r') contentEnd -= 1;
    const q = text.indexOf('"', pos);
    const r = text.indexOf('\r', pos);
    if ((q === -1 || q >= contentEnd) && (r === -1 || r >= contentEnd)) {
      const fields = text.slice(pos, contentEnd).split(',');
      pos = eol === -1 ? n : eol + 1;
      if (eol !== -1) line += 1;
      finishRecord(fields);
      continue;
    }

    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text[pos] === '"';
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    finishRecord(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
