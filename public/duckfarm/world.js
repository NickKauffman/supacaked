// Duck Farm — a connected universe of areas (towns, routes, caves, underwater
// cities) generated from compact specs, plus enterable building interiors.
import { TILE } from './art.js';

export const SOLID = new Set(['water', 'tree', 'fence', 'cavewall', 'intwall', 'snowtree']);

// biome → base/border tiles + decor flavour
const BIOME = {
  grass:      { base: 'grass', border: 'tree' },
  forest:     { base: 'grass', border: 'tree' },
  beach:      { base: 'sand', border: 'water' },
  desert:     { base: 'sand', border: 'cavewall' },
  cave:       { base: 'cavefloor', border: 'cavewall' },
  mountain:   { base: 'grass', border: 'tree' },
  snow:       { base: 'snow', border: 'tree' },
  underwater: { base: 'seafloor', border: 'cavewall' },
};

// shared NPC palettes
const P = {
  rose: { hair: '#7a4a2a', shirt: '#3f9e54', shirtL: '#7fcf8a', shirtD: '#2c7340' },
  blue: { hair: '#2b2433', shirt: '#4f78c4', shirtL: '#7fa8e6', shirtD: '#39579e' },
  orange: { hair: '#5a3d20', shirt: '#e8842a', shirtL: '#ffc07a', shirtD: '#b8631a' },
  purple: { hair: '#d8d2c8', shirt: '#9a5fc4', shirtL: '#caa0e0', shirtD: '#71409e', hat: '#5d3f8f', hatL: '#8a63b8', hatD: '#42286a' },
  red: { hair: '#d24a3e', shirt: '#e0504a', shirtL: '#f0867a', shirtD: '#9c2f25' },
  pink: { hair: '#3f9e54', shirt: '#ff8fc8', shirtL: '#ffc7e2', shirtD: '#e87aac', skinL: '#e8b48a', skin: '#cf9764', skinD: '#a8784a' },
  grey: { hair: '#d6d0c8', shirt: '#8a8f98', shirtL: '#b3b8c0', shirtD: '#646a73' },
  teal: { hair: '#2b2433', shirt: '#2fa3a0', shirtL: '#6fd0cd', shirtD: '#1f7a78' },
  sun: { hair: '#6b4f3a', shirt: '#ffd24a', shirtL: '#fff3a0', shirtD: '#caa12e' },
  snow: { hair: '#3a4658', shirt: '#bcd0e8', shirtL: '#e6f0fa', shirtD: '#8aa0bc', skin: '#f0d8c0' },
};

const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };
const SHOP_TYPES = new Set(['store', 'emporium', 'cafe', 'barn', 'tackle', 'icecream']);
const ACTION = { store: 'store', emporium: 'emporium', hall: 'hall', cafe: 'cafe', barn: 'barnshop', museum: 'museum' };

// world-map layout: [col,row] on a small grid (for the M map screen)
export const MAP_LAYOUT = {
  farm: [2, 0], quack: [2, 1], meadow: [3, 1], sunny: [4, 1], dunes: [4, 0], bubble: [4, 2],
  maple: [2, 2], cave: [2, 3], pinnacle: [2, 4], frost: [3, 4], glacier: [3, 5],
};

const BUILDING_INDEX = {};   // gid -> interior def, filled as areas build

const dims = (id) => { const s = AREA_DEFS[id]; return [s.w || 34, s.h || 26]; };
function entrance(id, dir) {
  const [w, h] = dims(id);
  if (dir === 'north') return [Math.floor(w / 2), 1];
  if (dir === 'south') return [Math.floor(w / 2), h - 2];
  if (dir === 'west') return [1, Math.floor(h / 2)];
  return [w - 2, Math.floor(h / 2)];
}

/* ---------------- generic exterior area ---------------- */
export function buildArea(id) {
  const s = AREA_DEFS[id];
  const w = s.w || 34, h = s.h || 26, bi = BIOME[s.biome];
  const map = []; for (let y = 0; y < h; y++) { const r = []; for (let x = 0; x < w; x++) r.push(bi.base); map.push(r); }
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) map[y][x] = t; };
  const rect = (x0, y0, ww, hh, t) => { for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) set(x, y, t); };
  // scatter accents on grassy/sandy biomes
  if (s.biome === 'grass' || s.biome === 'meadow' || s.biome === 'mountain') for (let i = 0; i < w * h * 0.04; i++) set(1 + (Math.random() * (w - 2)) | 0, 1 + (Math.random() * (h - 2)) | 0, 'flower');
  // border
  for (let x = 0; x < w; x++) { set(x, 0, bi.border); set(x, h - 1, bi.border); }
  for (let y = 0; y < h; y++) { set(0, y, bi.border); set(w - 1, y, bi.border); }

  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const pathTile = s.biome === 'cave' || s.biome === 'underwater' ? bi.base : (s.biome === 'beach' || s.biome === 'desert' ? 'sand' : (s.biome === 'snow' ? 'snow' : 'path'));
  const carve = (x0, y0, x1, y1) => { let x = x0, y = y0; while (x !== x1) { set(x, y, pathTile); set(x, y + 1, pathTile); x += x < x1 ? 1 : -1; } while (y !== y1) { set(x, y, pathTile); set(x + 1, y, pathTile); y += y < y1 ? 1 : -1; } set(x1, y1, pathTile); };

  if (s.water) rect(s.water[0], s.water[1], s.water[2], s.water[3], 'water');   // fishing pond
  if (s.plaza) rect(s.plaza[0], s.plaza[1], s.plaza[2], s.plaza[3], s.plazaTile || 'cobble');

  const warps = [];
  for (const [dir, to] of Object.entries(s.exits || {})) {
    const [ex, ey] = entrance(id, dir);
    // open a 2-wide gap in the border + path inward, warp tiles on the rim
    if (dir === 'north' || dir === 'south') { const ry = dir === 'north' ? 0 : h - 1; set(ex, ry, pathTile); set(ex - 1, ry, pathTile); warps.push({ x: ex, y: ry, to, tx: entrance(to, OPP[dir])[0], ty: entrance(to, OPP[dir])[1] }); warps.push({ x: ex - 1, y: ry, to, tx: entrance(to, OPP[dir])[0], ty: entrance(to, OPP[dir])[1] }); }
    else { const rx = dir === 'west' ? 0 : w - 1; set(rx, ey, pathTile); set(rx, ey - 1, pathTile); warps.push({ x: rx, y: ey, to, tx: entrance(to, OPP[dir])[0], ty: entrance(to, OPP[dir])[1] }); warps.push({ x: rx, y: ey - 1, to, tx: entrance(to, OPP[dir])[0], ty: entrance(to, OPP[dir])[1] }); }
    carve(ex, ey, cx, cy);
  }

  const buildings = [];
  for (const b of s.buildings || []) {
    const gid = id + '.' + b.id;
    buildings.push({ id: b.id, gid, name: b.name, art: b.art, tx: b.tx, ty: b.ty, w: b.w, h: b.h, action: 'enter' });
    // clear a yard + path to plaza/center
    for (let y = b.ty - 1; y < b.ty + b.h + 1; y++) for (let x = b.tx - 1; x < b.tx + b.w + 1; x++) if (map[y]?.[x] === bi.border) set(x, y, bi.base);
    const door = [b.tx + Math.floor(b.w / 2), b.ty + b.h];
    set(door[0], door[1], pathTile); carve(door[0], door[1] + 1, cx, cy);
    BUILDING_INDEX[gid] = { name: b.name, type: b.type, action: ACTION[b.type] || 'house',
      npc: b.npc || { name: b.name, pal: P.grey, lines: ['...'] }, returnArea: id, returnTile: door };
  }

  for (const l of s.links || []) { warps.push({ x: l.x, y: l.y, to: l.to, tx: l.tx, ty: l.ty }); if (l.walk) set(l.x, l.y, l.walk); }

  const props = (s.decor || []).map((d) => ({ art: d.art, tx: d.tx, ty: d.ty, w: d.w || 1, h: d.h || 1, solid: d.solid !== false }));
  const npcs = (s.npcs || []).map((n) => ({ ...n }));

  if (s.custom) s.custom({ map, set, rect, carve, w, h, cx, cy });

  return { name: id, w, h, map, biome: s.biome, base: bi.base, buildings, npcs, props, warps, entrance: s.entrance };
}

/* ---------------- generic interior ---------------- */
export function buildInterior(gid) {
  const d = BUILDING_INDEX[gid] || { name: 'Room', type: 'house', action: 'house', npc: { name: '?', pal: P.grey, lines: ['...'] }, returnArea: 'farm', returnTile: [16, 18] };
  const w = 13, h = 9, midx = 6;
  // refine the generic 'house' type into purpose-specific rooms by name
  const nm = (d.name || '').toLowerCase();
  let kind = d.type;
  if (kind === 'house') kind = nm.includes('dojo') ? 'dojo' : nm.includes('tackle') ? 'tackle'
    : (nm.includes('inn') || nm.includes('igloo')) ? 'inn' : 'home';
  const floor = kind === 'barn' ? 'dirt' : (kind === 'hall' || kind === 'museum') ? 'cobble' : 'woodfloor';

  const map = []; for (let y = 0; y < h; y++) { const r = []; for (let x = 0; x < w; x++) r.push(floor); map.push(r); }
  for (let x = 0; x < w; x++) { map[0][x] = 'intwall'; map[h - 1][x] = 'intwall'; }
  for (let y = 0; y < h; y++) { map[y][0] = 'intwall'; map[y][w - 1] = 'intwall'; }
  if (kind === 'hall' || kind === 'museum') for (let y = 3; y <= 6; y++) map[y][midx] = 'rug';   // grand runner
  map[h - 2][midx] = 'mat';                                                                       // doormat at entrance

  // furnish: keep the central column (x=6) clear of SOLID props so the keeper stays reachable.
  const props = [];
  const add = (art, tx, ty, solid = true, ww = 1, hh = 1) => props.push({ art, tx, ty, w: ww, h: hh, solid });
  const ns = (art, tx, ty) => add(art, tx, ty, false);                  // wall hanging (non-blocking)
  const tall = (art, tx, ty) => add(art, tx, ty, true, 1, 2);           // bed / bookshelf / fireplace
  const desk = () => { add('counter', 4, 2, true, 2); add('counter', 7, 2, true, 2); };  // keeper's service counter
  switch (kind) {
    case 'store':
      desk(); add('shelf', 1, 1); add('shelf', 2, 1); add('shelf', 10, 1); add('shelf', 11, 1);
      add('crate', 1, 6); add('barrel', 2, 6); add('crate', 10, 6); add('plant', 11, 6); break;
    case 'cafe':
      desk(); ns('teacup', 4, 1); ns('teacup', 8, 1); ns('painting', 6, 1);
      add('table', 2, 5); add('chair', 2, 6); add('table', 10, 5); add('chair', 10, 6);
      add('plant', 1, 6); add('plant', 11, 6); break;
    case 'hall':
      desk(); ns('banner', 2, 1); ns('banner', 10, 1); tall('bookshelf', 1, 1); tall('bookshelf', 11, 1);
      ns('painting', 3, 1); ns('painting', 9, 1); add('plant', 1, 6); add('plant', 11, 6); break;
    case 'museum':
      add('exhibit', 2, 4); add('exhibit', 4, 4); add('exhibit', 8, 4); add('exhibit', 10, 4);
      ns('painting', 2, 1); ns('painting', 4, 1); ns('painting', 8, 1); ns('painting', 10, 1);
      add('plant', 1, 6); add('plant', 11, 6); break;
    case 'emporium':
      desk(); add('nestbox', 1, 1); add('nestbox', 2, 1); add('nestbox', 10, 1); add('nestbox', 11, 1);
      add('feedsack', 1, 6); add('crate', 2, 6); add('crate', 10, 6); add('feedsack', 11, 6); break;
    case 'barn':
      desk(); add('haybale', 1, 1); add('haybale', 2, 1); add('feedsack', 10, 1); add('haybale', 11, 1);
      add('nestbox', 1, 6); add('nestbox', 2, 6); add('haybale', 10, 6); add('haybale', 11, 6); break;
    case 'tackle':
      desk(); add('shelf', 1, 1); add('shelf', 2, 1); add('shelf', 10, 1); add('shelf', 11, 1);
      add('barrel', 1, 6); add('crate', 2, 6); ns('painting', 6, 1); add('plant', 11, 6); break;
    case 'dojo':
      tall('bookshelf', 1, 1); tall('bookshelf', 11, 1); ns('banner', 3, 1); ns('banner', 9, 1);
      add('table', 2, 5); add('crate', 10, 5); add('plant', 1, 6); add('plant', 11, 6); break;
    case 'inn':
      tall('bed', 1, 1); tall('bed', 1, 4); tall('fireplace', 11, 1); add('table', 9, 5); add('chair', 9, 6);
      add('plant', 11, 6); ns('painting', 4, 1); break;
    default: // home
      tall('bed', 1, 1); tall('fireplace', 11, 1); tall('bookshelf', 1, 4);
      add('table', 9, 5); add('chair', 9, 6); add('chair', 8, 5); add('flowerpot', 2, 6);
      add('plant', 11, 6); ns('painting', 4, 1);
  }

  const npcs = [{ name: d.npc.name, tx: midx, ty: 2, dir: 'down', pal: d.npc.pal, lines: d.npc.lines, action: d.action !== 'house' ? d.action : null, shopTitle: d.name }];
  const warps = [{ x: midx, y: h - 2, to: d.returnArea, tx: d.returnTile[0], ty: d.returnTile[1] }];
  return { name: gid + '(in)', w, h, map, biome: 'interior', interiorName: d.name, buildings: [], npcs, props, warps, entrance: [midx, h - 3] };
}

export function rawArea(id) { return id.startsWith('int:') ? buildInterior(id.slice(4)) : buildArea(id); }
export function areaTitle(id) { if (id.startsWith('int:')) return (BUILDING_INDEX[id.slice(4)]?.name) || 'Inside'; return AREA_DEFS[id]?.name || id; }
export function pixelToTile(px) { return Math.floor(px / TILE); }

/* ============================ THE WORLD ============================ */
const npc = (name, tx, ty, pal, lines, wander = false) => ({ name, tx, ty, pal, lines, dir: 'down', wander });
const bld = (id, type, name, art, tx, ty, w, h, npcDef) => ({ id, type, name, art, tx, ty, w, h, npc: npcDef });

export const AREA_DEFS = {
  // ---- HOME FARM (custom gameplay layout) ----
  farm: {
    name: 'Haley\'s Farm', biome: 'grass', w: 40, h: 30,
    exits: { south: 'quack' },
    buildings: [bld('barn', 'barn', 'Barn', 'barn', 17, 10, 2, 2, { name: 'Barn Keeper', pal: P.orange, lines: ['Welcome to your barn! Sell your eggs and crops, or buy a duck here.'] })],
    npcs: [npc('Old Sage', 11, 16, P.grey, ['Mornin\'! Your crop field is fenced off to the east — stand on the soil and press A to plant a seed.', 'Feed your ducks and they\'ll lay eggs; sell eggs and crops at the Barn for coins.', 'When you\'re ready, follow the road south to Quacksborough and the wider world!'])],
    decor: [{ art: 'signpost', tx: 21, ty: 27, solid: false }, { art: 'bush', tx: 3, ty: 5, solid: false }, { art: 'rock', tx: 35, ty: 9, solid: false }],
    custom: ({ set, rect }) => {
      rect(6, 6, 9, 6, 'water'); for (let x = 5; x < 16; x++) { set(x, 5, 'path'); set(x, 12, 'path'); } for (let y = 5; y < 13; y++) { set(5, y, 'path'); set(15, y, 'path'); }
      rect(24, 7, 8, 6, 'dirt');
      for (let x = 22; x <= 34; x++) { set(x, 6, 'fence'); set(x, 14, 'fence'); } for (let y = 6; y <= 14; y++) { set(22, y, 'fence'); set(34, y, 'fence'); } set(28, 14, 'path');
      rect(16, 9, 4, 5, 'grass'); for (let x = 17; x < 19; x++) set(x, 12, 'path'); set(17, 13, 'path'); set(18, 13, 'path');
      for (const gx of [19, 20]) for (let y = 22; y < 30; y++) set(gx, y, 'path');
    },
  },

  // ---- QUACKSBOROUGH (town hub) ----
  quack: {
    name: 'Quacksborough', biome: 'grass', w: 38, h: 30, exits: { north: 'farm', south: 'maple', east: 'meadow' },
    plaza: [12, 12, 14, 9], plazaTile: 'cobble',
    buildings: [
      bld('store', 'store', 'General Store', 'store', 5, 7, 3, 2, { name: 'Mabel', pal: P.rose, lines: ['Welcome in! I pay a premium for your eggs and crops.', 'A growing girl needs coins — sell to me anytime, dear.'] }),
      bld('emporium', 'emporium', 'Duck Emporium', 'emporium', 30, 7, 3, 2, { name: 'Quill', pal: P.blue, lines: ['Ducks of every feather — and a few exotic mounts besides!', 'A Rosy duck is a rare beauty. So is the price, I\'m afraid.'] }),
      bld('hall', 'hall', 'Town Hall', 'hall', 16, 4, 4, 3, { name: 'Mayor Pomp', pal: P.purple, lines: ['Welcome to Quacksborough, Haley! Loveliest town by the pond.', 'Do good deeds and the whole region will flourish.'] }),
      bld('cafe', 'cafe', 'The Cozy Café', 'cafe', 6, 20, 3, 2, { name: 'Biscuit', pal: P.orange, lines: ['Café\'s open! A Duck Treat feeds your whole flock at once.', 'Rest your feet, Haley. The cocoa\'s on the house.'] }),
      bld('house1', 'house', 'Pip\'s House', 'houseRed', 28, 20, 3, 2, { name: 'Pip', pal: P.red, lines: ['You came to visit! Fed ducks lay more eggs, you know.', 'When my duck got old it turned into a PELICAN. I flew on it!'] }),
      bld('house2', 'house', 'Juniper\'s Place', 'housePurple', 16, 24, 3, 2, { name: 'Juniper', pal: P.pink, lines: ['Two well-fed ducks side by side might just make a duckling!', 'Berries take an age to grow, but oh, the coins they fetch.'] }),
      bld('museum', 'museum', 'Quack Museum', 'museum', 26, 3, 4, 3, { name: 'Curator Plume', pal: P.grey, lines: ['Welcome to the Museum! We collect fish from across the land.', 'Catch a fish and donate it — help us fill every exhibit!'] }),
    ],
    npcs: [npc('Bramble', 19, 16, P.sun, ['Wanna race to the fountain? Aw, grown-ups never play.', 'The lamps glow at night. It\'s so pretty when it\'s dark!'], true)],
    decor: [{ art: 'fountain', tx: 18, ty: 15, w: 2, h: 2 }, { art: 'lamp', tx: 12, ty: 13 }, { art: 'lamp', tx: 25, ty: 13 }, { art: 'lamp', tx: 12, ty: 19 }, { art: 'lamp', tx: 25, ty: 19 }, { art: 'bench', tx: 15, ty: 18 }, { art: 'bench', tx: 22, ty: 18 }, { art: 'flowerpot', tx: 4, ty: 9 }, { art: 'flowerpot', tx: 33, ty: 9 }, { art: 'signpost', tx: 20, ty: 22, solid: false }],
  },

  // ---- SUNNY MEADOW (grass route) ----
  meadow: {
    name: 'Sunny Meadow', biome: 'grass', w: 30, h: 22, exits: { west: 'quack', east: 'sunny' }, water: [18, 5, 4, 3],
    npcs: [npc('Wandering Wren', 14, 11, P.teal, ['Lovely day for a stroll! East lies the seaside town of Sandyshores.', 'Mind the flowers — bees love this meadow.'], true)],
    decor: [{ art: 'bench', tx: 8, ty: 8 }, { art: 'bush', tx: 20, ty: 14, solid: false }, { art: 'bush', tx: 6, ty: 15, solid: false }, { art: 'flowerpot', tx: 22, ty: 6 }, { art: 'rock', tx: 24, ty: 16, solid: false }],
  },

  // ---- SANDYSHORES (beach town) ----
  sunny: {
    name: 'Sandyshores', biome: 'beach', w: 34, h: 26, exits: { west: 'meadow', north: 'dunes' },
    buildings: [
      bld('store', 'store', 'Beach Bazaar', 'store', 5, 8, 3, 2, { name: 'Coral', pal: P.teal, lines: ['Fresh wares by the sea! I\'ll buy your eggs and crops.', 'Heard there\'s a whole city under the waves out there...'] }),
      bld('tackle', 'house', 'Tackle Shack', 'shack', 26, 8, 3, 2, { name: 'Marlin', pal: P.blue, lines: ['Face the surf and press SPACE to cast a line — fishing\'s the best!', 'Dive at the jetty to reach Bubbletown. The sea\'s full of secrets.'] }),
    ],
    npcs: [npc('Sandy', 17, 18, P.sun, ['The ocean goes on forever. Dive in and explore!', 'Penguins love it down there in Bubbletown.'], true)],
    decor: [{ art: 'palm', tx: 4, ty: 16, h: 1 }, { art: 'palm', tx: 28, ty: 17, h: 1 }, { art: 'shell', tx: 12, ty: 20, solid: false }, { art: 'shell', tx: 22, ty: 21, solid: false }, { art: 'signpost', tx: 17, ty: 20, solid: false }],
    // a dive spot into the underwater city
    links: [{ x: 17, y: 22, to: 'bubble', tx: 16, ty: 3, walk: 'sand' }],
    custom: ({ set, rect, w, h }) => { rect(2, h - 4, w - 4, 3, 'water'); for (let x = 14; x <= 19; x++) set(x, h - 4, 'sand'); set(17, h - 4, 'sand'); }, // a beach with surf + a little jetty to the dive spot
  },

  // ---- DUSTY GULCH (desert town) ----
  dunes: {
    name: 'Dusty Gulch', biome: 'desert', w: 30, h: 24, exits: { south: 'sunny' },
    buildings: [bld('store', 'store', 'Cactus Trading Post', 'store', 6, 9, 3, 2, { name: 'Sage Dunes', pal: P.orange, lines: ['Welcome to the driest town around! Water\'s worth more than gold.', 'I\'ll trade you fair for eggs and crops, traveler.'] }),
    bld('inn', 'house', 'The Oasis Inn', 'housePurple', 21, 9, 3, 2, { name: 'Mirage', pal: P.purple, lines: ['Rest here, weary wanderer. The desert sun is fierce.', 'They say an ostrich can cross these sands faster than anything.'] })],
    npcs: [npc('Tumble', 15, 16, P.sun, ['Yeehaw! Ride an ostrich and you\'ll zip across the dunes!', 'It never rains here. Not once. Not ever.'], true)],
    decor: [{ art: 'cactus', tx: 4, ty: 6 }, { art: 'cactus', tx: 26, ty: 7 }, { art: 'cactus', tx: 9, ty: 18 }, { art: 'rock', tx: 22, ty: 17, solid: false }, { art: 'rock', tx: 6, ty: 14, solid: false }, { art: 'signpost', tx: 15, ty: 19, solid: false }],
  },

  // ---- MAPLE FOREST (forest route) ----
  maple: {
    name: 'Maple Forest', biome: 'forest', w: 28, h: 26, exits: { north: 'quack', south: 'cave' }, water: [5, 16, 4, 3],
    npcs: [npc('Fern', 13, 13, P.rose, ['The forest path leads down to Mossy Cavern. Bring a brave heart!', 'Listen... you can hear the ducks of the wild quacking.'], true)],
    decor: [{ art: 'tree', tx: 5, ty: 6 }, { art: 'tree', tx: 22, ty: 8 }, { art: 'tree', tx: 8, ty: 18 }, { art: 'tree', tx: 20, ty: 19 }, { art: 'bush', tx: 12, ty: 9, solid: false }, { art: 'bush', tx: 17, ty: 16, solid: false }, { art: 'flowerpot', tx: 6, ty: 14 }],
  },

  // ---- MOSSY CAVERN (cave) ----
  cave: {
    name: 'Mossy Cavern', biome: 'cave', w: 28, h: 24, exits: { north: 'maple', south: 'pinnacle' },
    npcs: [npc('Spelunky Sam', 13, 12, P.grey, ['Careful in the dark! Those crystals are worth a fortune.', 'Keep going south — there\'s a mountain village past these caves.'])],
    decor: [{ art: 'gem', tx: 6, ty: 7 }, { art: 'gem', tx: 21, ty: 9 }, { art: 'gem', tx: 9, ty: 17 }, { art: 'gem', tx: 19, ty: 16 }, { art: 'rock', tx: 14, ty: 8 }, { art: 'rock', tx: 11, ty: 14 }, { art: 'rock', tx: 17, ty: 13 }],
  },

  // ---- PINNACLE (mountain town) ----
  pinnacle: {
    name: 'Pinnacle Village', biome: 'mountain', w: 30, h: 24, exits: { north: 'cave', east: 'frost' }, water: [22, 16, 4, 3],
    buildings: [bld('store', 'store', 'Summit Supplies', 'store', 6, 8, 3, 2, { name: 'Rens', pal: P.red, lines: ['Highest shop in the land! I\'ll buy whatever you\'ve grown.', 'The snow town of Frostfall is just east of here.'] }),
    bld('dojo', 'house', 'Mountain Dojo', 'pagoda', 18, 6, 4, 3, { name: 'Master Quack', pal: P.purple, lines: ['A true farmer trains body AND duck. Hwah!', 'Discipline, patience, and plenty of feed — that\'s the way.'] })],
    npcs: [npc('Pebble', 13, 16, P.grey, ['The air\'s thin up here, but the view is something else.', 'Frostfall, to the east, is the coolest town around. Literally.'], true)],
    decor: [{ art: 'rock', tx: 4, ty: 6 }, { art: 'rock', tx: 26, ty: 8 }, { art: 'rock', tx: 8, ty: 18 }, { art: 'tree', tx: 23, ty: 17 }, { art: 'signpost', tx: 15, ty: 18, solid: false }],
    // frozen bridge to Frostfall: an ice lane (you slide, can't stop) flanked by chasm
    custom: ({ set }) => { for (let x = 22; x <= 28; x++) { set(x, 12, 'ice'); set(x, 11, 'water'); set(x, 13, 'water'); } set(21, 12, 'path'); },
  },

  // ---- FROSTFALL (snow town — club-penguin vibes) ----
  frost: {
    name: 'Frostfall', biome: 'snow', w: 32, h: 26, exits: { west: 'pinnacle' }, plaza: [12, 12, 9, 7], plazaTile: 'snow',
    buildings: [
      bld('icecream', 'cafe', 'Frosty Treats', 'cafe', 5, 8, 3, 2, { name: 'Sherbet', pal: P.snow, lines: ['Cold treats for cold days! A Duck Treat warms their hearts.', 'Brrr — keep moving and you\'ll stay toasty.'] }),
      bld('igloo', 'house', 'The Big Igloo', 'housePurple', 24, 8, 3, 2, { name: 'Waddles', pal: P.blue, lines: ['Welcome to my igloo! Penguins are the best swimmers, you know.', 'Dive through the ice hole to reach Glacier Depths!'] }),
    ],
    npcs: [npc('Frostbite', 16, 18, P.snow, ['Snowball fight? No? Suit yourself, Haley!', 'There\'s a sparkly city deep under the ice.'], true)],
    decor: [{ art: 'snowman', tx: 9, ty: 16 }, { art: 'snowman', tx: 22, ty: 17 }, { art: 'snowtree', tx: 4, ty: 6, h: 1 }, { art: 'snowtree', tx: 27, ty: 7, h: 1 }, { art: 'signpost', tx: 16, ty: 20, solid: false }],
    links: [{ x: 16, y: 15, to: 'glacier', tx: 16, ty: 3, walk: 'water' }],   // a hole in the ice — only a penguin can dive in
  },

  // ---- BUBBLETOWN (underwater city) ----
  bubble: {
    name: 'Bubbletown', biome: 'underwater', w: 32, h: 24,
    buildings: [bld('store', 'store', 'Pearl Market', 'store', 7, 9, 3, 2, { name: 'Nemo', pal: P.teal, lines: ['Glub glub! Even underwater, a girl\'s gotta shop.', 'I\'ll buy your land-goods — they\'re a novelty down here!'] })],
    npcs: [npc('Bubbles', 16, 14, P.blue, ['Welcome to Bubbletown! Mind the jellyfish.', 'Swim up to the surface marker to head back to the beach.'], true), npc('Finn', 22, 11, P.teal, ['Down here, everyone swims. No penguin required!', 'The coral gardens are the prettiest in the seven seas.'], true)],
    decor: [{ art: 'coral', tx: 5, ty: 7 }, { art: 'coral', tx: 25, ty: 9 }, { art: 'coral', tx: 10, ty: 18 }, { art: 'coral', tx: 20, ty: 17 }, { art: 'fish', tx: 14, ty: 8, solid: false }, { art: 'fish', tx: 24, ty: 15, solid: false }, { art: 'shell', tx: 8, ty: 14, solid: false }],
    links: [{ x: 16, y: 2, to: 'sunny', tx: 17, ty: 21, walk: 'seafloor' }],
  },

  // ---- GLACIER DEPTHS (underwater city) ----
  glacier: {
    name: 'Glacier Depths', biome: 'underwater', w: 30, h: 24,
    buildings: [bld('store', 'store', 'Frozen Treasures', 'store', 6, 9, 3, 2, { name: 'Floe', pal: P.snow, lines: ['Treasures frozen for a thousand years — and a shop besides!', 'It\'s colder than Bubbletown down here. Wrap up warm.'] })],
    npcs: [npc('Glint', 15, 13, P.snow, ['These ice caverns sparkle like diamonds, don\'t they?', 'Swim to the surface marker to climb back to Frostfall.'], true)],
    decor: [{ art: 'gem', tx: 6, ty: 7 }, { art: 'gem', tx: 23, ty: 8 }, { art: 'coral', tx: 11, ty: 17 }, { art: 'fish', tx: 19, ty: 12, solid: false }, { art: 'shell', tx: 9, ty: 15, solid: false }, { art: 'gem', tx: 20, ty: 16 }],
    links: [{ x: 16, y: 2, to: 'frost', tx: 16, ty: 14, walk: 'seafloor' }],
  },
};
