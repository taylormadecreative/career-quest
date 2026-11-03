// Glossy toy buildings and the floating island scene for the portfolio city.
// One silhouette per portfolio section. Colors come from CSS variables (--b body, --bs side,
// --br roof, --bw windows, --bf flag/emblem), so the same drawing is the grey stone "locked"
// building and the glossy "earned" one. Shading comes from shared gradients in index.html
// (#g-sheen, #g-side, #g-top, #g-glass, #g-dome), which are color-free light and shadow overlays.
const SK = 0.55; // how steeply the 3D side and top faces slant
const f = (n) => +n.toFixed(1);

function block(x, y, w, h, d = 12, r = 3) {
  const t = d * SK;
  const side = `M${x + w} ${y}L${x + w + d} ${y - t}V${y + h - t}L${x + w} ${y + h}Z`;
  const top = `M${x} ${y}L${x + d} ${y - t}H${x + w + d}L${x + w} ${y}Z`;
  return `<path d="${side}" fill="var(--bs)"/><path d="${side}" fill="url(#g-side)"/>`
    + `<path d="${top}" fill="var(--br)"/><path d="${top}" fill="url(#g-top)"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="var(--b)"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#g-sheen)"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#g-sheen-x)"/>`
    + `<path d="M${x + r} ${y + 1.2}H${x + w - r}" stroke="var(--hi)" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>`
    + `<path d="M${x + w + 0.8} ${y + 1}L${x + w + d - 0.6} ${y - t + 0.8}" stroke="var(--hi)" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>`;
}
// Window grid that always fits its wall exactly (no half rows): glass with a reflection and a sill.
function windows(x, y, w, h, cols, rows, size = 11) {
  const gx = (w - cols * size) / (cols + 1), gy = (h - rows * size) / (rows + 1);
  let s = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = f(x + gx + c * (size + gx)), wy = f(y + gy + r * (size + gy));
    s += `<rect x="${wx}" y="${wy}" width="${size}" height="${size}" rx="2.5" fill="var(--bw)"/>`
      + `<rect x="${wx}" y="${wy}" width="${size}" height="${size}" rx="2.5" fill="url(#g-glass)"/>`
      + `<rect x="${f(wx - 1)}" y="${f(wy + size - 0.5)}" width="${size + 2}" height="2.4" rx="1.2" fill="var(--bs)" opacity="0.8"/>`;
  }
  return s;
}
const door = (x, w, h, base = 172) => `<path d="M${x} ${base}V${base - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${base}Z" fill="var(--bs)"/>`
  + `<path d="M${x} ${base}V${base - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${base}Z" fill="url(#g-side)"/>`
  + `<circle cx="${x + w - 5}" cy="${base - h / 2 + 2}" r="1.6" fill="var(--bf)"/>`;
// Every building stands on a little toy sidewalk.
const plinth = (x1, x2) => `<ellipse cx="${(x1 + x2) / 2}" cy="178" rx="${(x2 - x1) / 2 + 6}" ry="4.5" fill="var(--shadow)"/>`
  + `<rect x="${x1}" y="170" width="${x2 - x1}" height="8" rx="4" fill="var(--plinth-d)"/><rect x="${x1}" y="168" width="${x2 - x1}" height="6" rx="3" fill="var(--plinth)"/>`;
const lock = (cx, cy) => `<g class="b-lock" transform="translate(${cx - 13} ${cy - 16})"><path d="M7 13V9a6 6 0 0 1 12 0v4" fill="none" stroke="var(--lock-edge)" stroke-width="6" stroke-linecap="round"/><path d="M7 13V9a6 6 0 0 1 12 0v4" fill="none" stroke="var(--lock)" stroke-width="3" stroke-linecap="round"/><rect x="1.5" y="12.5" width="23" height="18" rx="4" fill="var(--lock)" stroke="var(--lock-edge)" stroke-width="2.5"/><rect x="1.5" y="12.5" width="23" height="18" rx="4" fill="url(#g-sheen)"/><circle cx="13" cy="20.5" r="2.6" fill="var(--lock-edge)"/></g>`;

const ART = {
  // Skills and Experience: a town hall
  summary: () => plinth(8, 116)
    + block(14, 84, 86, 86)
    + `<path d="M57 44L69 37L117 78L104 86Z" fill="var(--bs)"/><path d="M57 44L69 37L117 78L104 86Z" fill="url(#g-side)"/>`
    + `<path d="M8 86L57 44L106 86Z" fill="var(--br)"/><path d="M8 86L57 44L106 86Z" fill="url(#g-top)"/><path d="M8 86L57 44L106 86" fill="none" stroke="var(--hi)" stroke-width="1.6" stroke-linejoin="round" opacity="0.7"/>`
    + `<rect x="6" y="84" width="102" height="5" rx="2.5" fill="var(--bs)"/>`
    + `<circle cx="57" cy="70" r="8.5" fill="var(--bw)"/><circle cx="57" cy="70" r="8.5" fill="url(#g-glass)"/><circle cx="57" cy="70" r="8.5" fill="none" stroke="var(--bs)" stroke-width="2"/>`
    + windows(14, 92, 86, 44, 3, 2) + door(46, 22, 30),
  // Career Explorer: an observatory with a telescope
  explorer: () => plinth(10, 112)
    + block(18, 96, 78, 74)
    + `<path d="M22 96a35 32 0 0 1 70 0Z" fill="var(--br)"/><path d="M22 96a35 32 0 0 1 70 0Z" fill="url(#g-dome)"/><path d="M53 66h8v30h-8z" fill="var(--bs)" opacity="0.55"/>`
    + `<rect x="18" y="94" width="78" height="5" rx="2.5" fill="var(--bs)"/>`
    + `<g transform="rotate(-30 66 70)"><rect x="58" y="63" width="50" height="14" rx="7" fill="var(--bs)"/><rect x="58" y="63" width="50" height="14" rx="7" fill="url(#g-dome)"/><circle cx="107" cy="70" r="8" fill="var(--bf)"/><circle cx="107" cy="70" r="8" fill="url(#g-dome)"/></g>`
    + windows(18, 104, 78, 34, 3, 1, 12) + door(46, 22, 28),
  // Skills Demand Chart: three towers stepped like a bar chart
  chart: () => plinth(6, 118)
    + block(10, 132, 30, 38, 9) + block(44, 102, 30, 68, 9) + block(78, 60, 30, 110, 9)
    + windows(10, 132, 30, 30, 1, 2, 10) + windows(44, 102, 30, 58, 1, 4, 10) + windows(78, 60, 30, 98, 1, 6, 10)
    + `<path d="M93 56V38M85 45l8 -8l8 8" fill="none" stroke="var(--bf)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Career Strategy: a tall tower with a flag
  strategy: () => plinth(26, 100)
    + block(36, 52, 50, 118, 11) + block(42, 40, 38, 12, 9)
    + `<rect x="59.5" y="6" width="3" height="36" rx="1.5" fill="var(--bs)"/><path d="M62 7Q76 4 90 14Q76 18 62 22Z" fill="var(--bf)"/><path d="M62 7Q76 4 90 14Q76 18 62 22Z" fill="url(#g-top)"/>`
    + `<circle cx="61" cy="72" r="11" fill="var(--bs)" opacity="0.35"/><path d="M61 62l3.5 7l7.7 1.1l-5.6 5.4l1.3 7.6l-6.9 -3.6l-6.9 3.6l1.3 -7.6l-5.6 -5.4l7.7 -1.1Z" fill="var(--bf)"/>`
    + windows(36, 88, 50, 56, 2, 3, 11) + door(50, 22, 24),
  // How I Built This: a workshop with a crane
  built: () => plinth(4, 120)
    + `<g opacity="0.95"><rect x="103" y="34" width="8" height="136" fill="var(--bs)"/><path d="M103 40l8 12M111 52l-8 12M103 64l8 12M111 76l-8 12M103 88l8 12" stroke="var(--b)" stroke-width="1.5" opacity="0.7"/>`
    + `<rect x="64" y="31" width="62" height="7" rx="2" fill="var(--br)"/><rect x="64" y="31" width="62" height="7" rx="2" fill="url(#g-top)"/>`
    + `<rect x="72.5" y="38" width="2" height="22" fill="var(--bs)"/><rect x="66" y="60" width="15" height="11" rx="2" fill="var(--bf)"/><rect x="66" y="60" width="15" height="11" rx="2" fill="url(#g-sheen)"/></g>`
    + block(10, 110, 84, 60, 13)
    + `<path d="M10 110V95L38 110V95L66 110V95L94 110Z" fill="var(--br)"/><path d="M10 110V95L38 110V95L66 110V95L94 110Z" fill="url(#g-top)"/>`
    + `<g fill="var(--bs)">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="28.5" y="123" width="7" height="7" rx="1.5" transform="rotate(${a} 32 138)"/>`).join("")}<circle cx="32" cy="138" r="11"/></g>`
    + `<circle cx="32" cy="138" r="11" fill="url(#g-dome)"/><circle cx="32" cy="138" r="4.5" fill="var(--b)"/>`
    + `<rect x="54" y="128" width="32" height="42" rx="3" fill="var(--bs)"/><rect x="54" y="128" width="32" height="42" rx="3" fill="url(#g-side)"/><path d="M56 137H84M56 145H84M56 153H84M56 161H84" stroke="var(--b)" stroke-width="2" opacity="0.45"/>`,
};
const LOCK_AT = { summary: [57, 118], explorer: [57, 122], chart: [93, 112], strategy: [61, 112], built: [52, 124] };

export function buildingSvg(key, { locked } = {}) {
  return `<svg viewBox="0 0 130 182" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">${ART[key]()}${locked ? lock(...LOCK_AT[key]) : ""}</svg>`;
}

/* ---------- island props ---------- */
const filler = (w, h, cols, rows) => `<svg viewBox="0 0 ${w + 14} ${h + 12}" aria-hidden="true" focusable="false">${block(2, 10, w, h, 10)}${windows(2, 10, w, h - 6, cols, rows, 7)}</svg>`;
const PROP = {
  round: `<svg viewBox="0 0 40 54" aria-hidden="true" focusable="false"><ellipse cx="20" cy="51" rx="12" ry="3" fill="var(--shadow)"/><rect x="17" y="32" width="6" height="19" rx="2" fill="var(--dirt-d)"/><circle cx="20" cy="22" r="18" fill="var(--tree)"/><circle cx="20" cy="22" r="18" fill="url(#g-ball)"/></svg>`,
  pine: `<svg viewBox="0 0 34 60" aria-hidden="true" focusable="false"><ellipse cx="17" cy="57" rx="10" ry="3" fill="var(--shadow)"/><rect x="14.5" y="44" width="5" height="13" rx="2" fill="var(--dirt-d)"/><path d="M17 2L31 30H24L32 46H2L10 30H3Z" fill="var(--tree-d)"/><path d="M17 2L31 30H24L32 46H2L10 30H3Z" fill="url(#g-ball)"/></svg>`,
  bush: `<svg viewBox="0 0 44 24" aria-hidden="true" focusable="false"><ellipse cx="22" cy="22" rx="18" ry="3" fill="var(--shadow)"/><circle cx="13" cy="14" r="9" fill="var(--tree)"/><circle cx="26" cy="11" r="11" fill="var(--tree)"/><circle cx="34" cy="16" r="7" fill="var(--tree)"/><path d="M4 14a18 12 0 0 1 37 0v8H4Z" fill="url(#g-ball)"/><circle cx="12" cy="10" r="1.8" fill="var(--c-yellow)"/><circle cx="29" cy="7" r="1.8" fill="var(--sum-r)"/><circle cx="35" cy="13" r="1.6" fill="var(--paper)"/></svg>`,
  lamp: `<svg viewBox="0 0 16 56" aria-hidden="true" focusable="false"><ellipse cx="8" cy="54" rx="6" ry="2" fill="var(--shadow)"/><rect x="6.5" y="12" width="3" height="42" rx="1.5" fill="var(--ink-2)"/><circle cx="8" cy="9" r="6" fill="var(--c-yellow)"/><circle cx="8" cy="9" r="6" fill="url(#g-ball)"/><rect x="3" y="2" width="10" height="3" rx="1.5" fill="var(--ink-2)"/></svg>`,
  fillerA: filler(40, 70, 2, 4),
  fillerB: filler(34, 52, 2, 3),
  fillerC: filler(46, 40, 3, 2),
  crates: `<svg viewBox="0 0 40 30" aria-hidden="true" focusable="false"><ellipse cx="20" cy="28" rx="18" ry="2.5" fill="var(--shadow)"/><rect x="3" y="12" width="16" height="15" rx="2" fill="var(--dirt-l)"/><rect x="3" y="12" width="16" height="15" rx="2" fill="url(#g-sheen)"/><rect x="20" y="7" width="17" height="20" rx="2" fill="var(--c-orange)"/><rect x="20" y="7" width="17" height="20" rx="2" fill="url(#g-sheen)"/><rect x="11" y="2" width="12" height="10" rx="2" fill="var(--c-blue)"/><rect x="11" y="2" width="12" height="10" rx="2" fill="url(#g-sheen)"/></svg>`,
};
// [kind, left %, bottom (fraction of the island height), width % of the scene, layer]
const PROPS = [
  ["fillerA", 13, 0.9, 7, "back", "a"], ["fillerC", 30, 0.91, 7.5, "back", "b"], ["fillerB", 47, 0.92, 6, "back", "a"], ["fillerA", 64, 0.91, 6.5, "back", "b"], ["fillerC", 80, 0.9, 7, "back", "a"],
  ["pine", 2.5, 0.70, 5.5, "back"], ["round", 6.5, 0.72, 6.5, "back"], ["pine", 23, 0.95, 4, "back"], ["round", 40, 0.9, 5, "back"], ["pine", 57, 0.93, 4.5, "back"], ["round", 74, 0.9, 5.5, "back"], ["pine", 88, 0.9, 4, "back"], ["pine", 92, 0.72, 5.5, "back"],
  ["round", 14, 0.5, 4, "front"], ["pine", 87, 0.5, 3.6, "front"],
  ["round", -0.5, 0.66, 5.5, "front"], ["bush", 9, 0.47, 6, "front"], ["lamp", 22.5, 0.5, 2.2, "front"], ["bush", 31, 0.47, 5.5, "front"],
  ["lamp", 61, 0.5, 2.2, "front"], ["bush", 67, 0.47, 5.5, "front"], ["crates", 82, 0.48, 5.5, "front"], ["round", 95, 0.66, 5.5, "front"],
];
const propsHtml = (layer) => PROPS.filter((p) => p[4] === layer)
  .map(([k, l, b, w, , tone]) => `<span class="prop${tone ? ` filler filler-${tone}` : ""}" style="left:${l}%;bottom:calc(var(--isle-h) * ${b});width:${w}%">${PROP[k]}</span>`).join("");

// The floating island: grass top, a ring road, layered rock underneath with hanging stones.
const ISLAND_SVG = `<svg class="island-svg" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path d="M30 128C120 240 300 300 420 352C470 374 500 414 530 410C580 404 600 360 660 330C800 262 920 220 972 128Z" fill="var(--dirt-d)"/>
  <path d="M60 136C160 220 320 268 440 316C490 336 520 360 546 356C590 350 620 316 680 290C800 238 900 204 942 136Z" fill="var(--dirt)"/>
  <path d="M110 150C220 214 360 246 470 270C520 280 560 280 610 262C720 222 830 196 890 150Z" fill="var(--dirt-l)"/>
  <path d="M30 128C120 240 300 300 420 352C470 374 500 414 530 410C580 404 600 360 660 330C800 262 920 220 972 128Z" fill="url(#g-rock)"/>
  <ellipse cx="500" cy="136" rx="486" ry="88" fill="var(--grass-d)"/>
  <ellipse cx="500" cy="118" rx="480" ry="80" fill="var(--grass)"/>
  <ellipse cx="500" cy="118" rx="480" ry="80" fill="url(#g-grass)"/>
  <ellipse cx="500" cy="124" rx="420" ry="52" fill="none" stroke="var(--road-edge)" stroke-width="30"/>
  <ellipse cx="500" cy="124" rx="420" ry="52" fill="none" stroke="var(--road)" stroke-width="24"/>
  <ellipse cx="500" cy="124" rx="420" ry="52" fill="none" stroke="var(--paper)" stroke-width="2.4" stroke-dasharray="16 18" opacity="0.8"/>
</svg>`;

// A whole scene: island, props behind and in front, and the building row.
export function sceneHtml(islandInner = "", { id = "", label = "" } = {}) {
  return ISLAND_SVG
    + `<div class="props props-back">${propsHtml("back")}</div>`
    + `<div class="island"${id ? ` id="${id}" role="group" aria-label="${label}"` : ""}>${islandInner}</div>`
    + `<div class="props props-front">${propsHtml("front")}</div>`
    + `<span class="mini-isle m1" aria-hidden="true"></span><span class="mini-isle m2" aria-hidden="true"></span>`;
}
