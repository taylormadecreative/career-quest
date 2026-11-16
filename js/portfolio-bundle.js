// A deterministic, uncompressed ZIP writer for learner-owned portfolio files.
// It packages supplied text only. It never creates biographical content.
const encoder = new TextEncoder();
const encoderText = (value, name) => {
  if (typeof value !== "string") throw new TypeError(`${name} must be text`);
  return encoder.encode(value);
};

const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c >>> 0;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function put16(view, at, value) { view.setUint16(at, value, true); }
function put32(view, at, value) { view.setUint32(at, value >>> 0, true); }

/**
 * Create a valid ZIP without compression and with a fixed timestamp.
 * themes is an optional object mapping simple theme names (or .css filenames)
 * to CSS text; themePages similarly maps names to standalone HTML text. Entries
 * appear under themes/. The optional pages object maps names to standalone
 * HTML files under pages/. starterPython is optional text saved as starter.py.
 * No caller-supplied paths are accepted.
 */
export function buildPortfolioBundle({ player, html, python, starterPython, readme, report, tailoredHtml, themes, themePages, pages } = {}) {
  // player is for the caller's download filename; it is deliberately not inserted
  // into any file or path, since the caller's supplied text is authoritative.
  void player;
  const entries = [
    ["portfolio.html", html],
    ["portfolio.py", python],
    ["README.txt", readme],
    ["test-report.txt", report],
  ];
  if (starterPython !== undefined && starterPython !== null) entries.push(["starter.py", starterPython]);
  if (tailoredHtml !== undefined && tailoredHtml !== null) entries.push(["tailored.html", tailoredHtml]);
  if (themes !== undefined && themes !== null) {
    if (typeof themes !== "object" || Array.isArray(themes)) throw new TypeError("themes must be an object mapping names to CSS text");
    for (const name of Object.keys(themes).sort()) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}(?:\.css)?$/i.test(name)) throw new TypeError(`Invalid theme name: ${name}`);
      const filename = /\.css$/i.test(name) ? name : `${name}.css`;
      entries.push([`themes/${filename}`, themes[name]]);
    }
  }
  if (themePages !== undefined && themePages !== null) {
    if (typeof themePages !== "object" || Array.isArray(themePages)) throw new TypeError("themePages must be an object mapping names to HTML text");
    for (const name of Object.keys(themePages).sort()) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}(?:\.html)?$/i.test(name)) throw new TypeError(`Invalid theme page name: ${name}`);
      const filename = /\.html$/i.test(name) ? name : `${name}.html`;
      entries.push([`themes/${filename}`, themePages[name]]);
    }
  }
  if (pages !== undefined && pages !== null) {
    if (typeof pages !== "object" || Array.isArray(pages)) throw new TypeError("pages must be an object mapping names to HTML text");
    for (const name of Object.keys(pages).sort()) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}(?:\.html)?$/i.test(name)) throw new TypeError(`Invalid page name: ${name}`);
      const filename = /\.html$/i.test(name) ? name : `${name}.html`;
      entries.push([`pages/${filename}`, pages[name]]);
    }
  }
  const seen = new Set();
  const encoded = entries.map(([name, value]) => {
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) throw new TypeError(`Duplicate file: ${name}`);
    seen.add(normalized);
    const filename = encoder.encode(name), data = encoderText(value, name);
    if (filename.length > 0xffff || data.length > 0xffffffff) throw new RangeError(`File is too large for ZIP: ${name}`);
    return { filename, data, crc: crc32(data) };
  });
  if (encoded.length > 0xffff) throw new RangeError("Too many files for ZIP");
  const localSize = encoded.reduce((n, f) => n + 30 + f.filename.length + f.data.length, 0);
  const centralSize = encoded.reduce((n, f) => n + 46 + f.filename.length, 0);
  if (localSize > 0xffffffff || centralSize > 0xffffffff || localSize + centralSize + 22 > 0xffffffff) throw new RangeError("Bundle is too large for ZIP");
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  // DOS 1980-01-01 00:00. Using a fixed timestamp makes identical inputs reproducible.
  for (const f of encoded) {
    f.offset = offset;
    put32(view, offset, 0x04034b50); put16(view, offset + 4, 20); put16(view, offset + 6, 0x0800);
    put16(view, offset + 8, 0); put16(view, offset + 10, 0); put16(view, offset + 12, 33);
    put32(view, offset + 14, f.crc); put32(view, offset + 18, f.data.length); put32(view, offset + 22, f.data.length);
    put16(view, offset + 26, f.filename.length); put16(view, offset + 28, 0);
    offset += 30; bytes.set(f.filename, offset); offset += f.filename.length; bytes.set(f.data, offset); offset += f.data.length;
  }
  const centralOffset = offset;
  for (const f of encoded) {
    put32(view, offset, 0x02014b50); put16(view, offset + 4, 20); put16(view, offset + 6, 20);
    put16(view, offset + 8, 0x0800); put16(view, offset + 10, 0); put16(view, offset + 12, 0); put16(view, offset + 14, 33);
    put32(view, offset + 16, f.crc); put32(view, offset + 20, f.data.length); put32(view, offset + 24, f.data.length);
    put16(view, offset + 28, f.filename.length); put16(view, offset + 30, 0); put16(view, offset + 32, 0);
    put16(view, offset + 34, 0); put16(view, offset + 36, 0); put32(view, offset + 38, 0); put32(view, offset + 42, f.offset);
    offset += 46; bytes.set(f.filename, offset); offset += f.filename.length;
  }
  put32(view, offset, 0x06054b50); put16(view, offset + 4, 0); put16(view, offset + 6, 0);
  put16(view, offset + 8, encoded.length); put16(view, offset + 10, encoded.length);
  put32(view, offset + 12, centralSize); put32(view, offset + 16, centralOffset); put16(view, offset + 20, 0);
  return bytes;
}
