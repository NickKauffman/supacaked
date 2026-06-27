// Duck Farm — pixel art engine.
// Two techniques:
//  • ground tiles: pixel-fill + dithering for texture.
//  • characters/props: a tiny "shaded blob" framework — crisp filled ellipses with a
//    consistent top-left light source and an auto-generated outline. Gives rounded,
//    shaded, outlined sprites (Pokémon-ish) that are easy to recolor per duck breed.

export const TILE = 16;

/* ---------------- pixel buffer framework ---------------- */
function buf(w = TILE, h = TILE) { return { w, h, d: new Array(w * h).fill(null) }; }
function set(b, x, y, c) { if (x >= 0 && y >= 0 && x < b.w && y < b.h && c) b.d[(y | 0) * b.w + (x | 0)] = c; }
function get(b, x, y) { return (x < 0 || y < 0 || x >= b.w || y >= b.h) ? null : b.d[y * b.w + x]; }
const ein = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// shaded ellipse: light to top-left, dark rim to bottom-right.
function blob(b, cx, cy, rx, ry, light, mid, dark) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!ein(x, y, cx, cy, rx, ry)) continue;
      const inLight = ein(x, y, cx - rx * 0.32, cy - ry * 0.34, rx * 0.74, ry * 0.74);
      const inCore = ein(x, y, cx + rx * 0.18, cy + ry * 0.22, rx * 0.9, ry * 0.9);
      set(b, x, y, inLight ? light : (!inCore ? dark : mid));
    }
}
function disc(b, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (ein(x, y, cx, cy, rx, ry)) set(b, x, y, c);
}
function rect(b, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(b, x, y, c); }
// add a 1px outline around the silhouette
function outline(b, col = '#2b2433') {
  const add = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (get(b, x, y)) continue;
    if (get(b, x - 1, y) || get(b, x + 1, y) || get(b, x, y - 1) || get(b, x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) set(b, x, y, col);
}
function toCanvas(b) {
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(b.w, b.h); const px = img.data;
  for (let i = 0; i < b.d.length; i++) {
    const hex = b.d[i]; if (!hex) { px[i * 4 + 3] = 0; continue; }
    px[i * 4] = parseInt(hex.slice(1, 3), 16);
    px[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
    px[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
// lighten/darken a #rrggbb by factor f (auto-derive shading tones from one base colour)
function shade(hex, f) {
  const v = (i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)));
  return '#' + [v(1), v(3), v(5)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/* ---------------- palette ---------------- */
const C = {
  g1: '#a6e276', g2: '#8ed159', g3: '#72bd46', g4: '#5aa238',
  w1: '#c2f1ff', w2: '#8adef4', w3: '#54bce0', w4: '#3a9bc6',
  s1: '#f3e7bd', s2: '#e4d39a', s3: '#cbb476', s4: '#b39a63',
  d1: '#c89a6a', d2: '#ad7c4e', d3: '#8c6038', d4: '#6e4a2a',
  e1: '#83d56e', e2: '#5fb854', e3: '#44953f', e4: '#2f7233',
  t1: '#aa7b4c', t2: '#855c34', t3: '#5d3f22',
  f1: '#e3c486', f2: '#c89a5c', f3: '#9a6f37',
  ink: '#2b2433',
  beakA: '#ffc24a', beakB: '#ef9a2a',
  eyeW: '#ffffff',
  skinL: '#ffdcae', skin: '#eebb86', skinD: '#cf9764',
  hatL: '#ff8a78', hat: '#e0504a', hatD: '#b8362f',
  shirtL: '#7fb0ec', shirt: '#4f86cc', shirtD: '#39629e',
  pants: '#5b4636', pantsD: '#3f3024',
  coinL: '#ffe79a', coin: '#f4c42e', coinD: '#c88a18',
  eggL: '#fbf7ec', egg: '#ece1c8',
  barnL: '#e35d4f', barn: '#c23f33', barnD: '#8f2a22',
  roofL: '#e9e3d6', roof: '#c3bcab', roofD: '#9a9384',
  trim: '#f4efe2',
  // town
  cob1: '#b9b6c0', cob2: '#a09da9', cob3: '#86838f', cob4: '#6f6c78',
  stoneL: '#d8d3c4', stone: '#bdb7a6', stoneD: '#948e7e',
  glass: '#bfe6f0', glassD: '#7fb8c8',
  wood: '#b07f4e', woodD: '#7d5630',
  lamp: '#3a3340', lampGlow: '#ffe7a0',
  fountW: '#8adef4', fountWd: '#54bce0',
  // building accent palettes
  rRoofL: '#f0867a', rRoof: '#d24a3e', rRoofD: '#9c2f25',
  bRoofL: '#7fa8e6', bRoof: '#4f78c4', bRoofD: '#39579e',
  gRoofL: '#7fcf8a', gRoof: '#3f9e54', gRoofD: '#2c7340',
  oRoofL: '#ffc07a', oRoof: '#e8842a', oRoofD: '#b8631a',
  pRoofL: '#caa0e0', pRoof: '#9a5fc4', pRoofD: '#71409e',
  wallL: '#f3e9d6', wall: '#e3d4ba', wallD: '#bfae90',
  doorBrown: '#7d5630', doorBrownD: '#5a3d20',
  // mounts / creatures
  pelL: '#ffffff', pel: '#e7ecf3', pelD: '#c4ccd8', pouch: '#ffd06a',
  ostL: '#6b6675', ost: '#47434f', ostD: '#2b2932', ostNeck: '#e8c8a0', ostNeckD: '#cfa67e',
  penL: '#52555d', pen: '#34363d', penD: '#1f2026', penBelly: '#f5f7fb',
  // biomes
  sand1: '#efe0b0', sand2: '#e0cd92', sand3: '#ccb574',
  snow1: '#f2f6ff', snow2: '#dde6f4', snow3: '#c4d2e8',
  ice1: '#c4ecf6', ice2: '#97d7ec', ice3: '#6fb8d6',
  cf1: '#585463', cf2: '#45414e', cf3: '#33303a',
  cw1: '#6f6a7c', cw2: '#494552', cw3: '#2e2b36',
  sfa: '#bfe2d2', sfb: '#9fd0bd', sfc: '#82b8a6',
  sea: '#3aa0c4', seaD: '#2b7fa0',
  // interiors
  wf1: '#caa06a', wf2: '#b0844e', wf3: '#8a5e36',
  iw1: '#efe3c8', iw2: '#d4c098', iw3: '#a88a5e',
  rugA: '#d2607a', rugB: '#b0455f', matA: '#b08a55', matB: '#8a6a3f',
  // Haley
  hHair: '#8a4a26', hHairD: '#673317', hDress: '#e3637e', hDressD: '#c2455f', hDressL: '#f29bb0', hShoe: '#5a4636', bow: '#ffd24a',
};

/* ---------------- ground tiles ---------------- */
function rng(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
function grass(seed = 7, flowers = false) {
  const b = buf();
  rect(b, 0, 0, TILE, TILE, C.g2);
  const r = rng(seed);
  for (let i = 0; i < TILE * TILE; i++) { const x = i % TILE, y = (i / TILE) | 0; if ((x + y) % 2 === 0 && r() < 0.18) set(b, x, y, C.g1); }
  for (let i = 0; i < 22; i++) { const x = (r() * TILE) | 0, y = (r() * TILE) | 0; set(b, x, y, C.g3); if (r() < 0.5) set(b, x, y + 1, C.g4); }
  if (flowers) {
    const spots = [[4, 5], [11, 9], [7, 12]];
    const cols = ['#ff8fc8', '#ffe25a', '#ff8fc8'];
    spots.forEach(([x, y], i) => { set(b, x, y, cols[i]); set(b, x - 1, y, '#ffffff'); set(b, x + 1, y, '#ffffff'); set(b, x, y - 1, '#ffffff'); set(b, x, y + 1, '#ffffff'); set(b, x, y, cols[i]); });
  }
  return toCanvas(b);
}
function water(frame = 0) {
  const b = buf();
  rect(b, 0, 0, TILE, TILE, C.w3);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (((x + y + frame * 2) % 6) === 0) set(b, x, y, C.w4);
  const rows = frame === 0 ? [2, 7, 12] : [4, 9, 14];
  for (const ry of rows) for (let x = 0; x < TILE; x++) { if ((x + ry) % 3 !== 0) set(b, (x + frame) % TILE, ry, C.w2); if (x % 5 === (frame ? 2 : 0)) set(b, x, ry - 1 < 0 ? 0 : ry - 1, C.w1); }
  return toCanvas(b);
}
function path() {
  const b = buf(); rect(b, 0, 0, TILE, TILE, C.s2);
  const r = rng(5);
  for (let i = 0; i < TILE * TILE; i++) { const x = i % TILE, y = (i / TILE) | 0; if (r() < 0.12) set(b, x, y, C.s1); }
  for (let i = 0; i < 5; i++) { const x = (r() * 14 + 1) | 0, y = (r() * 14 + 1) | 0; set(b, x, y, C.s4); set(b, x + 1, y, C.s3); set(b, x, y + 1, C.s3); }
  return toCanvas(b);
}
function dirt() {
  const b = buf(); rect(b, 0, 0, TILE, TILE, C.d2);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    if (y % 4 === 0) set(b, x, y, C.d1);
    else if (y % 4 === 3) set(b, x, y, C.d4);
    else if ((x + y) % 5 === 0) set(b, x, y, C.d3);
  }
  return toCanvas(b);
}
function tree() {
  const b = buf();
  rect(b, 6, 11, 4, 4, C.t2); rect(b, 6, 11, 1, 4, C.t1); rect(b, 9, 11, 1, 4, C.t3);
  blob(b, 8, 6, 7, 6, C.e1, C.e2, C.e3);
  blob(b, 4, 8, 3.4, 3, C.e1, C.e2, C.e3);
  blob(b, 12, 8, 3.4, 3, C.e2, C.e3, C.e4);
  // a few leaf speckles
  [[6, 3], [10, 4], [8, 8], [5, 6], [11, 7]].forEach(([x, y]) => set(b, x, y, C.e1));
  outline(b, '#234a26');
  return toCanvas(b);
}
function fence() {
  const b = buf();
  const post = (x) => { rect(b, x, 2, 3, 12, C.f2); rect(b, x, 2, 1, 12, C.f1); rect(b, x + 2, 2, 1, 12, C.f3); rect(b, x, 2, 3, 1, C.f1); };
  post(2); post(11);
  rect(b, 0, 5, TILE, 2, C.f2); rect(b, 0, 5, TILE, 1, C.f1);
  rect(b, 0, 9, TILE, 2, C.f2); rect(b, 0, 9, TILE, 1, C.f1);
  outline(b, '#6b4d27');
  return toCanvas(b);
}

/* ---------------- duck (per breed) ---------------- */
export const BREEDS = [
  { id: 'classic', name: 'Sunny',   weight: 40, light: '#ffe487', mid: '#ffd24a', dark: '#f0b528', belly: '#fff3cf' },
  { id: 'pekin',   name: 'Pekin',   weight: 24, light: '#fbf7ee', mid: '#e7e1d1', dark: '#cbc3ad', belly: '#ffffff' },
  { id: 'mallard', name: 'Mallard', weight: 20, light: '#b89160', mid: '#9c7544', dark: '#79572f', belly: '#d9c39a' },
  { id: 'slate',   name: 'Slate',   weight: 12, light: '#b9c6d4', mid: '#94a5b5', dark: '#6f8090', belly: '#dde6ee' },
  { id: 'rosy',    name: 'Rosy',    weight: 4,  light: '#ffc9e3', mid: '#ff9fcb', dark: '#e87aac', belly: '#ffe3f1' },
];
export const BREED_BY_ID = Object.fromEntries(BREEDS.map((b) => [b.id, b]));

function duck(breed, frame) {
  const b = buf();
  blob(b, 8, 8.5, 6, 6, breed.light, breed.mid, breed.dark);   // round chibi body
  disc(b, 8, 11.5, 4.2, 3, breed.belly);                        // belly highlight
  // wing hint
  set(b, 3, 9, breed.dark); set(b, 4, 10, breed.dark); set(b, 13, 9, breed.dark); set(b, 12, 10, breed.dark);
  // eyes
  set(b, 6, 7, C.ink); set(b, 5, 6, C.eyeW);
  set(b, 10, 7, C.ink); set(b, 9, 6, C.eyeW);
  // beak (faces down)
  set(b, 7, 11, C.beakA); set(b, 8, 11, C.beakA); set(b, 7, 12, C.beakB); set(b, 8, 12, C.beakB);
  // feet waddle
  if (frame === 0) { rect(b, 4, 14, 2, 2, C.beakB); rect(b, 10, 14, 2, 2, C.beakB); }
  else { rect(b, 5, 14, 2, 2, C.beakB); rect(b, 9, 14, 2, 2, C.beakB); }
  outline(b);
  return toCanvas(b);
}

/* ---------------- people (farmer + NPCs) ---------------- */
// A parametric character. Pass a palette to make distinct townsfolk.
// No default hat: townsfolk show their own hair colour for variety. A pal that
// wants a hat (e.g. the purple mayor) sets one explicitly.
const FARMER = { skinL: C.skinL, skin: C.skin, skinD: C.skinD, hair: '#6b4f3a',
  shirtL: C.shirtL, shirt: C.shirt, shirtD: C.shirtD, pants: C.pants, pantsD: C.pantsD };
// A detailed 16x20 character (feet at the bottom). One palette → distinct townsfolk.
// dir: 'down' | 'up' | 'side' (side faces RIGHT; the draw code flips for left).
function person(p, dir, frame) {
  const b = buf(16, 20);
  const sk = p.skin, skL = p.skinL || shade(sk, 1.16), skD = p.skinD || shade(sk, 0.82);
  const hr = p.hair, hrL = p.hairL || shade(hr, 1.32), hrD = p.hairD || shade(hr, 0.66);
  const sh = p.shirt, shL = p.shirtL || shade(sh, 1.3), shD = p.shirtD || shade(sh, 0.72);
  const pa = p.pants || C.pants, paD = p.pantsD || shade(pa, 0.72);
  const shoe = p.shoe || '#3f342a';
  // ---- legs: stride by alternating which foot reaches lower ----
  const lB = frame === 1 ? 19 : frame === 2 ? 17 : 18;
  const rB = frame === 2 ? 19 : frame === 1 ? 17 : 18;
  rect(b, 5, 15, 2, lB - 15, pa); rect(b, 5, 15, 1, lB - 15, paD);
  rect(b, 9, 15, 2, rB - 15, pa); rect(b, 10, 15, 1, rB - 15, paD);
  rect(b, 5, lB - 1, 2, 1, shoe); rect(b, 9, rB - 1, 2, 1, shoe);
  // ---- arms (down both sides; hands in skin) ----
  rect(b, 3, 10, 2, 4, sh); rect(b, 3, 10, 1, 4, shD); set(b, 3, 14, skD); set(b, 4, 14, sk);
  rect(b, 11, 10, 2, 4, sh); rect(b, 12, 10, 1, 4, shD); set(b, 11, 14, sk); set(b, 12, 14, skD);
  // ---- torso ----
  blob(b, 8, 12.5, 3.6, 2.9, shL, sh, shD);
  rect(b, 5, 10, 6, 1, shD);                                  // shoulder seam
  // ---- head ----
  blob(b, 8, 6, 4, 4.1, skL, sk, skD);
  if (dir === 'up') {                                         // back of the head: all hair
    rect(b, 4, 2, 8, 7, hr); rect(b, 4, 2, 8, 1, hrL); rect(b, 5, 3, 3, 1, hrL);
  } else if (dir === 'side') {                                // profile facing right
    rect(b, 4, 2, 7, 3, hr); rect(b, 4, 2, 3, 7, hr); set(b, 5, 3, hrL);
    set(b, 10, 7, C.ink); set(b, 12, 7, skD); set(b, 9, 8, '#ff9db0');
  } else {                                                    // facing the camera
    rect(b, 4, 2, 8, 2, hr); set(b, 3, 4, hr); set(b, 12, 4, hr);
    rect(b, 4, 4, 1, 3, hr); rect(b, 11, 4, 1, 3, hr); rect(b, 5, 2, 4, 1, hrL);
    set(b, 6, 7, C.ink); set(b, 10, 7, C.ink);               // eyes
    set(b, 5, 8, '#ff9db0'); set(b, 11, 8, '#ff9db0');       // cheeks
    set(b, 8, 9, skD);                                       // mouth
  }
  if (p.hat) {                                               // cap over the hair
    const htL = p.hatL || shade(p.hat, 1.3), htD = p.hatD || shade(p.hat, 0.7);
    blob(b, 8, 3.2, 3.9, 1.9, htL, p.hat, htD);
    if (dir !== 'up') rect(b, 3, 4, 10, 1, htD);             // front brim
  }
  outline(b); return toCanvas(b);
}
const walkSet = (p, dir) => [person(p, dir, 1), person(p, dir, 0), person(p, dir, 2), person(p, dir, 0)];
export function personFrames(p) {
  const pal = { ...FARMER, ...p };
  return { down: walkSet(pal, 'down'), up: walkSet(pal, 'up'), side: walkSet(pal, 'side') };
}

// Haley — our heroine: auburn ponytail, rosy dress (16x20, feet at bottom).
function haley(dir, frame) {
  const b = buf(16, 20);
  const sk = C.skinL, skM = C.skin, skD = C.skinD;
  const hr = C.hHair, hrD = C.hHairD, hrL = shade(C.hHair, 1.3);
  const dr = C.hDress, drL = C.hDressL, drD = C.hDressD;
  const lB = frame === 1 ? 19 : frame === 2 ? 17 : 18;
  const rB = frame === 2 ? 19 : frame === 1 ? 17 : 18;
  // bare legs + shoes
  rect(b, 6, 16, 2, lB - 16, skM); rect(b, 9, 16, 2, rB - 16, skM);
  rect(b, 6, lB - 1, 2, 1, C.hShoe); rect(b, 9, rB - 1, 2, 1, C.hShoe);
  // flared dress
  rect(b, 6, 11, 4, 1, dr); rect(b, 5, 12, 6, 1, dr); rect(b, 4, 13, 8, 1, drD); rect(b, 4, 14, 8, 2, drD);
  set(b, 6, 14, dr); set(b, 9, 14, dr);
  blob(b, 8, 11, 3.2, 2.5, drL, dr, drD);                     // bodice
  set(b, 4, 11, skM); set(b, 4, 12, skD); set(b, 11, 11, skM); set(b, 11, 12, skD); // arms
  blob(b, 8, 6, 4, 4.1, sk, skM, skD);                        // head
  if (dir === 'up') { rect(b, 4, 2, 8, 7, hr); rect(b, 5, 2, 4, 1, hrL); }
  else if (dir === 'side') { rect(b, 4, 2, 7, 3, hr); rect(b, 4, 2, 3, 7, hr); set(b, 10, 7, C.ink); set(b, 12, 7, skD); set(b, 9, 8, '#ff9db0'); }
  else { rect(b, 4, 2, 8, 2, hr); set(b, 3, 4, hr); set(b, 12, 4, hr); rect(b, 4, 4, 1, 4, hr); rect(b, 11, 4, 1, 4, hr); rect(b, 5, 2, 4, 1, hrL);
    set(b, 6, 7, C.ink); set(b, 10, 7, C.ink); set(b, 5, 8, '#ff9db0'); set(b, 11, 8, '#ff9db0'); set(b, 8, 9, drD); }
  rect(b, 11, 4, 2, 7, hr); rect(b, 11, 4, 1, 7, hrD); set(b, 12, 11, hrD);  // ponytail
  set(b, 11, 3, C.bow); set(b, 12, 3, C.bow);                 // bow
  outline(b); return toCanvas(b);
}
const haleyWalk = (dir) => [haley(dir, 1), haley(dir, 0), haley(dir, 2), haley(dir, 0)];

/* ---------------- crops, egg, coin, barn ---------------- */
function sprout(big) {
  const b = buf();
  rect(b, 7, big ? 7 : 10, 1, big ? 6 : 3, C.e3);
  set(b, 6, big ? 8 : 11, C.e2); set(b, 8, big ? 8 : 11, C.e2);
  if (big) { set(b, 5, 9, C.e2); set(b, 10, 9, C.e2); set(b, 6, 7, C.e1); set(b, 9, 7, C.e1); }
  outline(b, '#2f7233'); return toCanvas(b);
}
function cropRipe(crop) {
  const b = buf();
  rect(b, 7, 8, 1, 6, crop.c || C.e3); rect(b, 6, 11, 3, 1, crop.c || C.e3);
  // fruit cluster
  disc(b, 6, 6, 2, 2, crop.a); disc(b, 10, 7, 2, 2, crop.b); disc(b, 8, 4, 2, 2, crop.a);
  set(b, 5, 5, '#ffffff'); set(b, 9, 6, '#ffffff');
  outline(b, '#2f7233'); return toCanvas(b);
}
function egg() { const b = buf(); blob(b, 8, 8, 3.4, 4.4, C.eggL, C.egg, C.egg); outline(b); return toCanvas(b); }
function coin() {
  const b = buf(); blob(b, 8, 8, 4, 4, C.coinL, C.coin, C.coinD);
  set(b, 6, 6, '#ffffff'); rect(b, 7, 6, 2, 5, C.coinD); rect(b, 7, 6, 1, 5, C.coinL); outline(b, '#8a5e10'); return toCanvas(b);
}
function barn() {
  const b = buf(32, 32);
  rect(b, 4, 14, 24, 16, C.barn); rect(b, 4, 14, 24, 2, C.barnL); rect(b, 4, 28, 24, 2, C.barnD);
  rect(b, 4, 14, 2, 16, C.barnL); rect(b, 26, 14, 2, 16, C.barnD);
  // roof
  for (let i = 0; i < 12; i++) rect(b, 2 + i, 14 - i, 28 - i * 2, 1, i < 2 ? C.roofL : C.roof);
  rect(b, 14, 2, 4, 4, C.roofD);
  // door
  rect(b, 13, 20, 6, 10, C.t3); rect(b, 13, 20, 3, 10, C.t2); rect(b, 16, 18, 0, 0, C.trim);
  rect(b, 13, 19, 6, 1, C.trim);
  // white cross trim
  rect(b, 8, 17, 1, 9, C.trim); rect(b, 23, 17, 1, 9, C.trim);
  outline(b, '#5a1f18');
  // a little sign heart
  set(b, 15, 16, C.trim); set(b, 16, 16, C.trim);
  return toCanvas(b);
}

/* ---------------- town tiles ---------------- */
function cobble() {
  const b = buf(); rect(b, 0, 0, TILE, TILE, C.cob2);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const ox = (y % 8 < 4) ? x : x + 2;
    if (ox % 4 === 0 || y % 4 === 0) set(b, x, y, C.cob4);
    else set(b, x, y, (x + y) % 3 === 0 ? C.cob1 : C.cob2);
  }
  const r = rng(11); for (let i = 0; i < 6; i++) set(b, (r() * TILE) | 0, (r() * TILE) | 0, C.cob3);
  return toCanvas(b);
}

/* ---------------- grass fringe (autotile edges) ---------------- */
// a strip of grass tufts overhanging one edge, blended onto path/cobble tiles.
function fringe(side) {
  const b = buf();
  const r = rng({ top: 1, right: 2, bottom: 3, left: 4 }[side] * 7 + 3);
  const put = (i, d, c) => {
    if (side === 'top') set(b, i, d, c); else if (side === 'bottom') set(b, i, 15 - d, c);
    else if (side === 'left') set(b, d, i, c); else set(b, 15 - d, i, c);
  };
  for (let i = 0; i < 16; i++) {
    const depth = 2 + (r() < 0.4 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
    for (let d = 0; d < depth; d++) put(i, d, d === 0 ? C.g2 : d >= depth - 1 ? C.g4 : C.g3);
    if (r() < 0.22) put(i, depth, C.g3);
    if (r() < 0.12) put(i, 0, C.g1);
  }
  return toCanvas(b);
}

/* ---------------- buildings ---------------- */
function building(rl, r, rd, opt = {}) {
  const w = opt.w || 3, h = opt.h || 2, W = w * 16, H = h * 16 + 14, top = 14;
  const b = buf(W, H);
  rect(b, 1, top, W - 2, H - top, C.wall);
  rect(b, 1, top, 2, H - top, C.wallL); rect(b, W - 3, top, 2, H - top, C.wallD);
  rect(b, 1, H - 3, W - 2, 3, C.wallD);
  const peak = W / 2;
  for (let y = 0; y <= top; y++) {
    const half = peak * (1 - (top - y) / (top + 7));
    const x0 = Math.round(peak - half), x1 = Math.round(peak + half);
    rect(b, x0, y, x1 - x0, 1, y < 3 ? rl : r);
  }
  rect(b, 0, top, W, 2, rd);
  const winY = top + 6, wW = 6, wH = 6;
  const drawWin = (wx) => { rect(b, wx, winY, wW, wH, C.glass); rect(b, wx, winY, wW, 2, C.glassD); rect(b, wx, winY, 1, wH, C.wallD); rect(b, wx + wW - 1, winY, 1, wH, C.wallD); set(b, (wx + wW / 2) | 0, winY, C.trim); rect(b, wx, (winY + wH / 2) | 0, wW, 1, C.wallD); };
  drawWin(4); drawWin(W - 4 - wW);
  const dw = 8, dx = Math.round((W - dw) / 2), dy = H - 14;
  rect(b, dx, dy, dw, 14, C.doorBrown); rect(b, dx, dy, dw, 2, C.doorBrownD);
  rect(b, dx, dy, 1, 14, C.doorBrownD); rect(b, dx + dw - 1, dy, 1, 14, C.doorBrownD);
  rect(b, dx, dy, dw, 1, rd); set(b, dx + dw - 2, dy + 7, C.coin);
  rect(b, dx - 2, dy - 3, dw + 4, 3, rd); rect(b, dx - 2, dy - 3, dw + 4, 1, rl);   // door awning
  rect(b, dx - 2, H - 2, dw + 4, 2, C.stoneD); rect(b, dx - 2, H - 2, dw + 4, 1, C.stone); // step
  rect(b, 3, 2, 3, top, '#8a5a3a'); rect(b, 3, 2, 1, top, '#a8744e'); rect(b, 2, 1, 5, 2, '#6e4530'); // chimney
  if (opt.sign) { rect(b, dx - 2, top + 1, dw + 4, 4, opt.sign); rect(b, dx - 2, top + 1, dw + 4, 1, '#ffffff'); rect(b, dx - 2, top + 4, dw + 4, 1, C.ink); }
  outline(b, '#3a2e3f');
  return toCanvas(b);
}

/* ---------------- decor props ---------------- */
function fountain() {
  const b = buf(32, 28);
  disc(b, 16, 20, 14, 7, C.stoneD); disc(b, 16, 20, 12, 6, C.stone); disc(b, 16, 19, 12, 5.4, C.stoneL);
  disc(b, 16, 19, 9.5, 4.6, C.fountWd); disc(b, 16, 18.5, 8, 3.8, C.fountW);
  rect(b, 14, 8, 4, 11, C.stone); rect(b, 14, 8, 1, 11, C.stoneL); rect(b, 17, 8, 1, 11, C.stoneD);
  disc(b, 16, 7, 3, 2, C.stoneL);
  set(b, 13, 11, C.fountW); set(b, 19, 12, C.fountW); set(b, 12, 14, C.fountW); set(b, 20, 15, C.fountW);
  outline(b, '#5a5560'); return toCanvas(b);
}
function lamp() {
  const b = buf(16, 30);
  rect(b, 7, 8, 2, 21, C.lamp); rect(b, 7, 8, 1, 21, '#55505f'); rect(b, 4, 28, 8, 2, C.lamp);
  disc(b, 8, 5, 3.2, 3.4, C.lampGlow); rect(b, 5, 2, 6, 1, C.lamp); rect(b, 5, 8, 6, 1, C.lamp);
  outline(b, '#26222e'); return toCanvas(b);
}
function bench() {
  const b = buf(20, 16);
  rect(b, 2, 7, 16, 3, C.wood); rect(b, 2, 7, 16, 1, '#c99a63'); rect(b, 3, 10, 2, 4, C.woodD); rect(b, 15, 10, 2, 4, C.woodD);
  rect(b, 2, 3, 16, 2, C.wood); outline(b, '#5a3d20'); return toCanvas(b);
}
function signpost() {
  const b = buf(16, 24);
  rect(b, 7, 6, 2, 18, C.woodD); rect(b, 2, 6, 12, 5, C.wood); rect(b, 2, 6, 12, 1, '#c99a63');
  // little arrow
  set(b, 11, 8, C.trim); set(b, 12, 8, C.trim); set(b, 10, 7, C.trim); set(b, 10, 9, C.trim);
  rect(b, 4, 8, 6, 1, C.trim);
  outline(b, '#5a3d20'); return toCanvas(b);
}
function flowerpot() {
  const b = buf(16, 16);
  rect(b, 5, 10, 6, 5, '#c2674a'); rect(b, 5, 10, 6, 1, '#d98a6a'); rect(b, 4, 9, 8, 2, '#a8543a');
  ['#ff8fc8', '#ffe25a', '#ff8fc8'].forEach((c, i) => { const x = 5 + i * 2; set(b, x, 7, c); set(b, x, 6, '#ffffff'); set(b, x - 0, 8, C.e2); });
  set(b, 6, 5, C.e2); set(b, 9, 5, C.e2); outline(b, '#7a3f2a'); return toCanvas(b);
}
function bush() { const b = buf(); blob(b, 8, 9, 6.5, 5, C.e1, C.e2, C.e3); blob(b, 5, 8, 3, 2.4, C.e1, C.e2, C.e3); blob(b, 11, 9, 3, 2.4, C.e2, C.e3, C.e4); [[6, 7], [10, 8], [8, 10]].forEach(([x, y]) => set(b, x, y, '#ffe25a')); outline(b, '#234a26'); return toCanvas(b); }
function rock() { const b = buf(); blob(b, 8, 10, 6, 4, '#c7c2cb', '#a7a2ad', '#827d89'); outline(b, '#5a5560'); return toCanvas(b); }
function stall() {
  const b = buf(32, 28);
  // posts
  rect(b, 3, 10, 2, 16, C.woodD); rect(b, 27, 10, 2, 16, C.woodD);
  // counter
  rect(b, 2, 20, 28, 6, C.wood); rect(b, 2, 20, 28, 1, '#c99a63');
  // striped awning
  for (let x = 0; x < 32; x += 4) rect(b, x, 6, 2, 5, '#e0504a'), rect(b, x + 2, 6, 2, 5, C.trim);
  rect(b, 0, 11, 32, 1, C.woodD);
  // goods
  set(b, 8, 19, '#ff9a3c'); set(b, 9, 19, '#ff9a3c'); set(b, 14, 19, '#ff5a6a'); set(b, 20, 19, '#ffe25a'); set(b, 24, 19, C.e2);
  outline(b, '#5a3d20'); return toCanvas(b);
}

/* ---------------- mounts (pelican / ostrich / penguin) ---------------- */
function pelican(frame) {
  const b = buf();
  blob(b, 8, 8, 6, 5.4, C.pelL, C.pel, C.pelD);     // round white body
  disc(b, 8, 10, 4, 3.3, C.pelL);                    // bright belly
  // wings flap
  if (frame === 1) { set(b, 2, 6, C.pelD); set(b, 3, 5, C.pelD); set(b, 13, 6, C.pelD); set(b, 12, 5, C.pelD); }
  else { set(b, 2, 9, C.pelD); set(b, 3, 10, C.pelD); set(b, 13, 9, C.pelD); set(b, 12, 10, C.pelD); }
  set(b, 6, 6, C.ink); set(b, 5, 5, '#fff'); set(b, 10, 6, C.ink); set(b, 9, 5, '#fff');  // eyes
  rect(b, 6, 11, 4, 1, C.beakA); rect(b, 6, 12, 4, 2, C.pouch); rect(b, 7, 14, 2, 1, C.beakB); // big beak + pouch
  outline(b); return toCanvas(b);
}
function ostrich(frame) {
  const b = buf(16, 22);
  const a = frame === 1;
  rect(b, 6, 16, 2, a ? 6 : 4, C.ostNeck); rect(b, 9, 16, 2, a ? 4 : 6, C.ostNeck);  // striding legs
  rect(b, 5, a ? 21 : 19, 3, 1, C.ostNeckD); rect(b, 9, a ? 19 : 21, 3, 1, C.ostNeckD); // feet
  blob(b, 8, 13, 5.6, 4.6, C.ostL, C.ost, C.ostD);    // fluffy body
  set(b, 13, 11, C.ost); set(b, 14, 12, C.ostD);       // tail plume
  rect(b, 8, 5, 1, 8, C.ostNeck); rect(b, 9, 6, 1, 7, C.ostNeckD);  // long neck
  disc(b, 8, 4, 2, 2, C.ostNeck);                      // head
  set(b, 9, 4, C.ink); set(b, 10, 4, C.beakA); set(b, 11, 4, C.beakB); // eye + beak
  outline(b); return toCanvas(b);
}
function penguin(frame) {
  const b = buf();
  blob(b, 8, 9, 5, 6.2, C.penL, C.pen, C.penD);        // black body
  disc(b, 8, 10.5, 3.2, 4, C.penBelly);                // white belly
  set(b, 6, 6, '#fff'); set(b, 6, 6, C.ink); set(b, 10, 6, C.ink); set(b, 9, 5, '#fff'); // eyes
  set(b, 7, 8, C.beakA); set(b, 8, 8, C.beakA); set(b, 7, 9, C.beakB);  // beak
  if (frame === 1) { set(b, 2, 8, C.penD); set(b, 13, 8, C.penD); } else { set(b, 2, 10, C.penD); set(b, 13, 10, C.penD); } // flippers
  rect(b, 5, 15, 2, 1, C.beakB); rect(b, 9, 15, 2, 1, C.beakB);  // feet
  outline(b); return toCanvas(b);
}

/* ---------------- biome tiles ---------------- */
function sand(seed = 4) { const b = buf(); rect(b, 0, 0, TILE, TILE, C.sand2); const r = rng(seed); for (let i = 0; i < TILE * TILE; i++) { const x = i % TILE, y = (i / TILE) | 0; if (r() < 0.12) set(b, x, y, C.sand1); } for (let i = 0; i < 6; i++) set(b, (r() * 14 + 1) | 0, (r() * 14 + 1) | 0, C.sand3); return toCanvas(b); }
function snow() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.snow1); const r = rng(8); for (let i = 0; i < TILE * TILE; i++) { const x = i % TILE, y = (i / TILE) | 0; if ((x + y) % 2 === 0 && r() < 0.16) set(b, x, y, C.snow2); } for (let i = 0; i < 4; i++) set(b, (r() * TILE) | 0, (r() * TILE) | 0, '#ffffff'); return toCanvas(b); }
function ice() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.ice1); rect(b, 0, 0, TILE, 1, '#ffffff'); rect(b, 2, 3, 5, 1, C.ice2); rect(b, 9, 9, 4, 1, C.ice2); set(b, 12, 4, C.ice3); set(b, 4, 12, C.ice3); return toCanvas(b); }
function cavefloor() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.cf2); const r = rng(15); for (let i = 0; i < TILE * TILE; i++) { const x = i % TILE, y = (i / TILE) | 0; if (r() < 0.16) set(b, x, y, (x + y) % 2 ? C.cf1 : C.cf3); } return toCanvas(b); }
function cavewall() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.cw2); for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const ox = (y % 8 < 4) ? x : x + 3; if (ox % 5 === 0 || y % 5 === 0) set(b, x, y, C.cw3); else if ((x + y) % 4 === 0) set(b, x, y, C.cw1); } return toCanvas(b); }
function seafloor() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.sfb); const r = rng(21); for (let i = 0; i < TILE * TILE; i++) { const x = i % TILE, y = (i / TILE) | 0; if (r() < 0.13) set(b, x, y, (x + y) % 2 ? C.sfa : C.sfc); } return toCanvas(b); }
function woodfloor() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.wf2); for (let y = 0; y < TILE; y++) { if (y % 4 === 0) rect(b, 0, y, TILE, 1, C.wf3); if (y % 4 === 1) rect(b, 0, y, TILE, 1, C.wf1); } for (let x = 0; x < TILE; x += 8) rect(b, x, 0, 1, TILE, C.wf3); return toCanvas(b); }
function intwall() { const b = buf(); rect(b, 0, 0, TILE, TILE, C.iw2); rect(b, 0, 0, TILE, 3, C.iw1); rect(b, 0, TILE - 2, TILE, 2, C.iw3); for (let x = 0; x < TILE; x += 4) set(b, x, 7, C.iw3); return toCanvas(b); }
function rug() { const b = buf(); rect(b, 1, 2, 14, 12, C.rugA); rect(b, 2, 3, 12, 10, C.rugB); rect(b, 4, 5, 8, 6, C.rugA); return toCanvas(b); }
function mat() { const b = buf(); rect(b, 2, 5, 12, 7, C.matA); rect(b, 2, 5, 12, 1, C.matB); rect(b, 2, 11, 12, 1, C.matB); rect(b, 5, 8, 6, 1, C.matB); return toCanvas(b); }

/* ---------------- outdoor + interior props ---------------- */
function palm() { const b = buf(16, 24); rect(b, 7, 8, 2, 14, C.t2); rect(b, 7, 8, 1, 14, C.t1); blob(b, 8, 6, 6, 3, C.e1, C.e2, C.e3); set(b, 2, 5, C.e2); set(b, 14, 5, C.e2); set(b, 8, 2, C.e1); set(b, 8, 8, C.t3); outline(b, '#234a26'); return toCanvas(b); }
function snowtree() { const b = buf(16, 20); rect(b, 7, 14, 2, 6, C.t2); for (let i = 0; i < 3; i++) { const w = 10 - i * 2, y = 4 + i * 3; rect(b, (16 - w) / 2 | 0, y, w, 3, C.e3); rect(b, (16 - w) / 2 | 0, y, w, 1, '#eef6ff'); } outline(b, '#234a26'); return toCanvas(b); }
// tall leafy decor tree (16x26) — used as a PROP in forests/mountains (tiles.tree is the small map tile)
function forestTree() {
  const b = buf(16, 26);
  rect(b, 7, 17, 3, 9, C.t2); rect(b, 7, 17, 1, 9, C.t1); rect(b, 9, 17, 1, 9, C.t3);   // trunk
  blob(b, 8, 10, 7.6, 7, C.e1, C.e2, C.e3);                                              // main canopy
  blob(b, 4, 12, 3.6, 3.2, C.e1, C.e2, C.e3); blob(b, 12, 12, 3.6, 3.2, C.e2, C.e3, C.e4);
  blob(b, 8, 5, 4.6, 3.8, C.e1, C.e2, C.e3);                                             // crown
  [[6, 4], [10, 5], [8, 9], [5, 8], [11, 9], [8, 13]].forEach(([x, y]) => set(b, x, y, C.e1));
  outline(b, '#234a26'); return toCanvas(b);
}
function cactus() { const b = buf(); rect(b, 7, 3, 3, 12, '#4f9e4a'); rect(b, 7, 3, 1, 12, '#6fc06a'); rect(b, 4, 7, 3, 5, '#4f9e4a'); rect(b, 4, 7, 1, 5, '#6fc06a'); rect(b, 10, 9, 3, 4, '#4f9e4a'); set(b, 8, 5, '#ffd24a'); outline(b, '#2c6e30'); return toCanvas(b); }
function gem() { const b = buf(); blob(b, 8, 9, 3.5, 4, '#9fe0ff', '#5bb6dc', '#3a8fc0'); set(b, 6, 6, '#ffffff'); outline(b, '#2a5a78'); return toCanvas(b); }
function coral() { const b = buf(); rect(b, 7, 8, 2, 7, '#ff8a6a'); rect(b, 5, 9, 2, 5, '#ff8a6a'); rect(b, 9, 7, 2, 7, '#ffb06a'); set(b, 5, 8, '#ffb0c8'); set(b, 11, 6, '#ffb0c8'); set(b, 7, 7, '#ffd0d8'); outline(b, '#a0463a'); return toCanvas(b); }
function snowman() { const b = buf(); disc(b, 8, 12, 4, 3, '#ffffff'); disc(b, 8, 6, 3, 2.6, '#ffffff'); set(b, 6, 5, C.ink); set(b, 10, 5, C.ink); set(b, 8, 6, C.beakA); rect(b, 7, 2, 3, 1, C.ink); rect(b, 6, 3, 5, 1, C.ink); set(b, 8, 11, '#3a2e3f'); set(b, 8, 13, '#3a2e3f'); outline(b, '#bcd0e0'); return toCanvas(b); }
function shell() { const b = buf(); blob(b, 8, 11, 3, 2.4, '#ffd0c0', '#f2a890', '#d88a70'); rect(b, 7, 9, 2, 3, '#f2a890'); set(b, 8, 8, '#f2a890'); outline(b, '#b06a55'); return toCanvas(b); }
function fish() { const b = buf(); blob(b, 7, 8, 3.5, 2.4, '#ffb24a', '#f0902a', '#d0741a'); set(b, 11, 6, '#f0902a'); set(b, 11, 10, '#f0902a'); set(b, 12, 8, '#f0902a'); set(b, 5, 7, C.ink); outline(b, '#a85a14'); return toCanvas(b); }
function counter() { const b = buf(32, 16); rect(b, 1, 6, 30, 9, C.wf2); rect(b, 1, 6, 30, 2, C.wf1); rect(b, 1, 13, 30, 2, C.wf3); rect(b, 2, 4, 28, 2, C.iw1); outline(b, '#5a3d20'); return toCanvas(b); }
function shelf() { const b = buf(); rect(b, 1, 1, 14, 14, C.wf3); rect(b, 2, 2, 12, 12, C.wf2); rect(b, 2, 6, 12, 1, C.wf3); rect(b, 2, 10, 12, 1, C.wf3); set(b, 4, 4, '#e0504a'); set(b, 7, 4, '#4f86cc'); set(b, 10, 4, '#3f9e54'); set(b, 4, 8, '#ffd24a'); set(b, 9, 8, '#ff8fc8'); set(b, 6, 12, '#9a5fc4'); outline(b, '#5a3d20'); return toCanvas(b); }
function table() { const b = buf(); rect(b, 2, 6, 12, 3, C.wf2); rect(b, 2, 6, 12, 1, C.wf1); rect(b, 3, 9, 2, 5, C.wf3); rect(b, 11, 9, 2, 5, C.wf3); set(b, 8, 4, '#ff8fc8'); set(b, 8, 5, C.e3); outline(b, '#5a3d20'); return toCanvas(b); }
function bed() { const b = buf(16, 24); rect(b, 2, 4, 12, 18, '#c2455f'); rect(b, 2, 4, 12, 5, '#f2f2f0'); rect(b, 3, 5, 4, 3, '#e8eef6'); rect(b, 2, 4, 12, 1, '#fff'); rect(b, 2, 21, 12, 1, '#8a2f44'); outline(b, '#5a1f30'); return toCanvas(b); }
function painting() { const b = buf(); rect(b, 2, 2, 12, 10, '#8a5e36'); rect(b, 3, 3, 10, 8, '#7fc6e8'); rect(b, 3, 8, 10, 3, '#7cc457'); disc(b, 11, 5, 1.5, 1.5, '#ffe25a'); outline(b, '#5a3d20'); return toCanvas(b); }
function barrel() { const b = buf(); blob(b, 8, 9, 4, 5, C.wf1, C.wf2, C.wf3); rect(b, 4, 7, 8, 1, C.wf3); rect(b, 4, 11, 8, 1, C.wf3); outline(b, '#5a3d20'); return toCanvas(b); }
// ---- richer interior furnishings (purpose-built rooms) ----
function chair() { const b = buf(); rect(b, 4, 3, 8, 5, '#9a5fc4'); rect(b, 4, 3, 8, 1, '#caa0e0'); rect(b, 4, 3, 1, 5, '#71409e'); rect(b, 4, 8, 8, 2, C.wf2); rect(b, 4, 8, 8, 1, C.wf1); rect(b, 5, 10, 1, 4, C.wf3); rect(b, 10, 10, 1, 4, C.wf3); outline(b, '#3a2a4a'); return toCanvas(b); }
function teacup() { const b = buf(16, 13); set(b, 7, 2, '#e8dcc8'); set(b, 9, 1, '#e8dcc8'); set(b, 8, 4, '#d8ccb8'); blob(b, 8, 9, 3.4, 2.6, '#ffffff', '#eef0f2', '#cfd2d6'); rect(b, 5, 7, 7, 1, '#b08a55'); set(b, 12, 9, '#cfd2d6'); rect(b, 5, 11, 6, 1, '#8a6a3f'); outline(b, '#8a8f98'); return toCanvas(b); }
function plant() { const b = buf(16, 20); rect(b, 5, 14, 6, 5, C.t2); rect(b, 5, 14, 6, 1, C.t1); rect(b, 5, 18, 6, 1, C.t3); blob(b, 8, 9, 4.6, 5, C.e1, C.e2, C.e3); blob(b, 4, 11, 2.4, 2.4, C.e1, C.e2, C.e3); blob(b, 12, 11, 2.4, 2.4, C.e2, C.e3, C.e4); set(b, 8, 5, C.e1); set(b, 6, 7, C.e1); set(b, 10, 8, C.e1); outline(b, '#234a26'); return toCanvas(b); }
function bookshelf() { const b = buf(16, 22); rect(b, 1, 1, 14, 21, C.wf3); rect(b, 2, 2, 12, 19, C.wf2); const cols = ['#e0504a', '#4f86cc', '#3f9e54', '#ffd24a', '#9a5fc4', '#2fa3a0', '#e8842a']; for (const sy of [2, 8, 14]) { for (let i = 0; i < 6; i++) rect(b, 3 + i * 2, sy, 1, 5, cols[(i + sy) % 7]); rect(b, 2, sy + 5, 12, 1, C.wf3); } outline(b, '#5a3d20'); return toCanvas(b); }
function fireplace() { const b = buf(16, 20); rect(b, 1, 4, 14, 16, C.stone); rect(b, 1, 4, 14, 1, C.stoneL); for (let y = 5; y < 9; y += 2) for (let x = 2; x < 15; x += 3) set(b, x, y, C.stoneD); rect(b, 0, 2, 16, 2, C.wf2); rect(b, 0, 2, 16, 1, C.wf1); rect(b, 3, 9, 10, 9, '#241a22'); blob(b, 8, 15, 3, 3.4, '#ffe25a', '#ff8a2a', '#e0504a'); blob(b, 8, 13, 1.5, 2, '#fff3a0', '#ffd24a', '#ff8a2a'); rect(b, 4, 18, 8, 1, '#8a5a3a'); outline(b, '#5a4636'); return toCanvas(b); }
function exhibit() { const b = buf(16, 20); rect(b, 3, 14, 10, 5, C.stone); rect(b, 3, 14, 10, 1, C.stoneL); rect(b, 2, 18, 12, 1, C.stoneD); blob(b, 8, 9, 4.4, 5, '#d8f4ff', '#bfe6f0', '#9fd0e0'); set(b, 6, 6, '#ffffff'); blob(b, 8, 10, 2, 1.4, '#ffb24a', '#f0902a', '#d0741a'); set(b, 10, 9, '#f0902a'); set(b, 6, 10, '#f0902a'); outline(b, '#7d7468'); return toCanvas(b); }
function haybale() { const b = buf(16, 14); blob(b, 8, 8, 6, 5, C.f1, C.f2, C.f3); for (let x = 3; x < 13; x += 2) { set(b, x, 6, C.f3); set(b, x + 1, 9, C.f3); } rect(b, 4, 5, 8, 1, '#a8763a'); rect(b, 4, 11, 8, 1, '#a8763a'); outline(b, '#7a5a2a'); return toCanvas(b); }
function feedsack() { const b = buf(16, 14); blob(b, 8, 9, 4.6, 4.5, '#e8dcc0', '#cfc0a0', '#a89878'); rect(b, 5, 3, 6, 3, '#cfc0a0'); set(b, 6, 3, '#a89878'); set(b, 9, 3, '#a89878'); set(b, 7, 9, '#8a6a3f'); set(b, 9, 10, '#8a6a3f'); set(b, 8, 8, '#8a6a3f'); outline(b, '#7a6648'); return toCanvas(b); }
function nestbox() { const b = buf(16, 14); blob(b, 8, 10, 5, 3.6, C.f1, C.f2, C.f3); disc(b, 8, 10, 3.4, 2, C.f3); disc(b, 7, 9, 1.4, 1.2, C.eggL); disc(b, 10, 10, 1.4, 1.2, C.eggL); set(b, 7, 9, '#ffffff'); outline(b, '#7a5a2a'); return toCanvas(b); }
function crate() { const b = buf(); rect(b, 2, 4, 12, 11, C.wf2); rect(b, 2, 4, 12, 1, C.wf1); rect(b, 2, 4, 1, 11, C.wf3); rect(b, 13, 4, 1, 11, C.wf3); rect(b, 2, 9, 12, 1, C.wf3); rect(b, 2, 14, 12, 1, C.wf3); set(b, 3, 5, C.wf3); set(b, 12, 5, C.wf3); set(b, 3, 13, C.wf3); set(b, 12, 13, C.wf3); outline(b, '#5a3d20'); return toCanvas(b); }
function banner() { const b = buf(16, 18); rect(b, 3, 1, 10, 14, '#9a5fc4'); rect(b, 3, 1, 10, 2, '#caa0e0'); rect(b, 3, 1, 1, 14, '#71409e'); disc(b, 8, 7, 2.4, 2.4, '#ffd24a'); set(b, 10, 6, C.beakB); set(b, 7, 6, C.ink); set(b, 4, 15, '#9a5fc4'); set(b, 8, 16, '#9a5fc4'); set(b, 12, 15, '#9a5fc4'); outline(b, '#4a2a6a'); return toCanvas(b); }

/* ---------------- unique building exteriors ---------------- */
function museum() {
  const W = 64, H = 62, top = 16, b = buf(W, H);
  rect(b, 2, top, W - 4, H - top, C.stone); rect(b, 2, top, 2, H - top, C.stoneL); rect(b, W - 4, top, 2, H - top, C.stoneD); rect(b, 2, H - 3, W - 4, 3, C.stoneD);
  for (let i = 0; i < 4; i++) { const cx = 7 + i * 15; rect(b, cx, top + 4, 3, H - top - 8, C.stoneL); rect(b, cx + 2, top + 4, 1, H - top - 8, C.stoneD); }
  for (let y = 0; y <= top; y++) { const half = (W / 2) * (y / top); rect(b, (W / 2 - half) | 0, top - y, (half * 2) | 0, 1, y > top - 3 ? C.stoneD : C.stoneL); }
  rect(b, 0, top - 1, W, 2, C.stoneD);
  const dw = 10, dx = (W - dw) / 2 | 0, dy = H - 14; rect(b, dx, dy, dw, 14, C.doorBrown); rect(b, dx, dy, dw, 2, C.doorBrownD); rect(b, dx + dw / 2 | 0, dy, 1, 14, C.doorBrownD);
  rect(b, dx - 3, H - 2, dw + 6, 2, C.stoneL); rect(b, dx - 2, H - 4, dw + 4, 2, C.stone);
  outline(b, '#6b6658'); return toCanvas(b);
}
function shack() {
  const W = 48, H = 44, top = 12, b = buf(W, H);
  rect(b, 1, top, W - 2, H - top, C.wood); for (let y = top; y < H; y += 4) rect(b, 1, y, W - 2, 1, C.woodD); rect(b, 1, top, 2, H - top, '#c99a63');
  rect(b, 0, top - 5, W, 6, '#a8814f'); rect(b, 0, top - 5, W, 1, '#c99a63'); rect(b, 0, top, W, 1, C.woodD);
  const dw = 8, dx = (W - dw) / 2 | 0, dy = H - 12; rect(b, dx, dy, dw, 12, C.doorBrownD); rect(b, dx, dy, dw, 1, '#5a3d20');
  rect(b, dx - 3, top - 3, dw + 6, 3, '#4f86cc'); rect(b, dx - 3, top - 3, dw + 6, 1, '#fff');
  outline(b, '#5a3d20'); return toCanvas(b);
}
function pagoda() {
  const W = 64, H = 66, top = 18, b = buf(W, H);
  rect(b, 4, top, W - 8, H - top, C.wall); rect(b, 4, top, 2, H - top, C.wallL); rect(b, W - 6, top, 2, H - top, C.wallD); rect(b, 4, H - 3, W - 8, 3, C.wallD);
  const tier = (yBase, wid) => { for (let i = 0; i < 5; i++) { const ww = wid - i * 4; rect(b, (W - ww) / 2 | 0, yBase - i, ww, 1, i < 1 ? C.rRoofL : C.rRoof); } rect(b, (W - wid) / 2 | 0, yBase, wid, 1, C.rRoofD); };
  tier(top, W); tier(top - 8, W - 14);
  const dw = 10, dx = (W - dw) / 2 | 0, dy = H - 14; rect(b, dx, dy, dw, 14, C.doorBrown); rect(b, dx, dy, dw, 2, C.doorBrownD); rect(b, dx + dw / 2 | 0, dy, 1, 14, C.doorBrownD);
  outline(b, '#3a2e3f'); return toCanvas(b);
}

/* ---------------- festive props ---------------- */
function balloon(c) { const b = buf(16, 24); blob(b, 8, 6, 4, 5, '#ffffff', c, c); set(b, 6, 4, '#ffffff'); rect(b, 8, 11, 1, 12, '#8a7a6a'); outline(b, '#3a2e3f'); return toCanvas(b); }
function lantern() { const b = buf(16, 20); rect(b, 7, 2, 2, 3, '#8a5a3a'); rect(b, 4, 5, 8, 9, '#e0504a'); rect(b, 4, 5, 8, 1, '#ffd24a'); rect(b, 4, 13, 8, 1, '#ffd24a'); rect(b, 4, 5, 1, 9, '#9c2f25'); set(b, 8, 14, '#ffd24a'); outline(b, '#7a2f25'); return toCanvas(b); }

import { CROPS, CROP_ORDER } from './data.js';

export function buildArt() {
  const ducks = Object.fromEntries(BREEDS.map((br) => [br.id, [duck(br, 0), duck(br, 1)]]));
  const crops = {};
  for (const id of CROP_ORDER) crops[id] = [sprout(false), sprout(true), cropRipe(CROPS[id])];
  return {
    tiles: {
      grass: grass(7), flower: grass(3, true), water: water(0), path: path(), dirt: dirt(), tree: tree(), fence: fence(), cobble: cobble(),
      sand: sand(), snow: snow(), ice: ice(), cavefloor: cavefloor(), cavewall: cavewall(), seafloor: seafloor(),
      woodfloor: woodfloor(), intwall: intwall(), rug: rug(), mat: mat(),
    },
    waterFrames: [water(0), water(1)],
    ducks, duck: ducks.classic,
    player: { down: haleyWalk('down'), up: haleyWalk('up'), side: haleyWalk('side') },
    player2: personFrames({ hair: '#2b2433', hat: '#4f86cc', hatL: '#7fb0ec', hatD: '#39629e', shirt: '#3f9e54', shirtL: '#7fcf8a', shirtD: '#2c7340' }),
    crops, egg: egg(), coin: coin(), barn: barn(),
    pelican: [pelican(0), pelican(1)], ostrich: [ostrich(0), ostrich(1)], penguin: [penguin(0), penguin(1)],
    fringe: { top: fringe('top'), right: fringe('right'), bottom: fringe('bottom'), left: fringe('left') },
    buildings: {
      store: building(C.gRoofL, C.gRoof, C.gRoofD, { w: 3, h: 2, sign: '#2c7340' }),
      emporium: building(C.bRoofL, C.bRoof, C.bRoofD, { w: 3, h: 2, sign: '#39579e' }),
      hall: building(C.stoneL, C.stone, C.stoneD, { w: 4, h: 3, sign: '#7d7468' }),
      cafe: building(C.oRoofL, C.oRoof, C.oRoofD, { w: 3, h: 2, sign: '#b8631a' }),
      houseRed: building(C.rRoofL, C.rRoof, C.rRoofD, { w: 3, h: 2 }),
      housePurple: building(C.pRoofL, C.pRoof, C.pRoofD, { w: 3, h: 2 }),
      museum: museum(), shack: shack(), pagoda: pagoda(),
    },
    props: {
      fountain: fountain(), lamp: lamp(), bench: bench(), signpost: signpost(), flowerpot: flowerpot(), bush: bush(), rock: rock(), stall: stall(),
      palm: palm(), snowtree: snowtree(), tree: forestTree(), cactus: cactus(), gem: gem(), coral: coral(), snowman: snowman(), shell: shell(), fish: fish(),
      counter: counter(), shelf: shelf(), table: table(), bed: bed(), painting: painting(), barrel: barrel(),
      chair: chair(), teacup: teacup(), plant: plant(), bookshelf: bookshelf(), fireplace: fireplace(),
      exhibit: exhibit(), haybale: haybale(), feedsack: feedsack(), nestbox: nestbox(), crate: crate(), banner: banner(),
      balloonR: balloon('#e0504a'), balloonB: balloon('#4f86cc'), balloonY: balloon('#ffd24a'), lantern2: lantern(),
    },
  };
}
