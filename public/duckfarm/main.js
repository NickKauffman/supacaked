// Duck Farm — cozy world-builder. Farm + town, quests, shops, NPCs, day/night.
import { buildArt, TILE, BREEDS, BREED_BY_ID, personFrames } from './art.js';
import { rawArea, AREA_DEFS, areaTitle, SOLID, MAP_LAYOUT } from './world.js';
import { CROPS, CROP_ORDER, QUESTS, xpForLevel, FISH, FISH_ORDER, FISH_POOLS, biomePool } from './data.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
let VIEW_W = canvas.width / TILE, VIEW_H = canvas.height / TILE;
const SAVE_KEY = 'duckfarm.save.v3';
const DAY_LEN = 150, EGG_PRICE = 5, DUCK_PRICE = 20;
const EMPORIUM = { classic: 15, pekin: 22, mallard: 26, slate: 40, rosy: 70 };
const MOUNT_SPEED = { pelican: 3.0, ostrich: 2.6, penguin: 1.7 };
const RIDE_LIFT = { pelican: 5, ostrich: 10, penguin: 4 };
const MOUNT_H = { pelican: 16, ostrich: 22, penguin: 16 };
const MOUNT_PRICE = { ostrich: 60, penguin: 50 };
const MOUNT_NAME = { pelican: 'Pelican', ostrich: 'Ostrich', penguin: 'Penguin' };
const AGE_PELICAN = 50;
const FOLLOW_GAP = 9, MAX_FOLLOWERS = 16;
const $ = (id) => document.getElementById(id);

const art = buildArt();
const resolveBuilding = (key) => art.buildings[key] || art[key];

// ---------- state ----------
let areaCache, area, current;
let crops, groundEggs, ducks;                 // farm-only entities
let mounts, walking;                          // mounts (pelican/ostrich/penguin) + flock-follow toggle
let coins, eggs, inv, level, xp, discovered, stats, questIndex, selectedCrop, lastStipendDay;
let fishInv, fishSeen, fishDonated;            // fishing inventory + collection + museum
let player, player2, clock, tod;
const bothPlayers = () => [player, player2];
let state = 'title';
let toast = '', toastT = 0;
let dlg = null, dlgI = 0;                      // active dialogue
let fishing = null;                            // active fishing minigame
let muted = false;

function prepArea(a) {
  a.blocked = new Set();
  for (const b of a.buildings) for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) a.blocked.add(x + ',' + y);
  for (const p of a.props) if (p.solid) for (let y = p.ty; y < p.ty + p.h; y++) for (let x = p.tx; x < p.tx + p.w; x++) a.blocked.add(x + ',' + y);
  for (const n of a.npcs) { n.frames = personFrames(n.pal); n.x = n.tx * TILE; n.y = n.ty * TILE; n.home = { x: n.x, y: n.y }; n.frame = 0; n.flip = false; n.vx = 0; n.vy = 0; n.think = Math.random() * 60; }
  return a;
}
function getArea(id) { if (!areaCache[id]) areaCache[id] = prepArea(rawArea(id)); return areaCache[id]; }

function freshState() {
  areaCache = {}; current = 'farm'; area = getArea('farm');
  crops = new Map(); groundEggs = []; ducks = []; mounts = []; walking = false;
  coins = 10; eggs = 0; inv = {}; level = 1; xp = 0; discovered = new Set();
  stats = { planted: 0, harvested: 0, fed: 0, eggsCollected: 0, sold: 0, berryHarvest: 0, caught: 0, donated: 0 };
  fishInv = {}; fishSeen = new Set(); fishDonated = new Set();
  questIndex = 0; selectedCrop = 'wheat'; lastStipendDay = -1; fishing = null;
  player = { name: 'Haley', sprite: 'player', x: 16 * TILE, y: 16 * TILE, dir: 'down', flip: false, speed: 1.4, moving: false, step: 0, mount: null, hist: [] };
  player2 = { name: 'Nick', sprite: 'player2', x: 18 * TILE, y: 16 * TILE, dir: 'down', flip: false, speed: 1.4, moving: false, step: 0, mount: null, hist: [] };
  clock = 0; tod = 0.25;
  [['classic', 9, 13], ['classic', 12, 13], ['mallard', 7, 4], ['pekin', 26, 9], ['classic', 29, 10]].forEach(([b, x, y]) => spawnDuck(x, y, b));
}
function spawnDuck(tx, ty, breed = 'classic') {
  ducks.push({ x: tx * TILE, y: ty * TILE, breed, flip: false, frame: 0, frameT: 0, vx: 0, vy: 0, think: 0, full: 60, lay: 6 + Math.random() * 6, mate: 8, age: Math.random() * 25 });
  discovered.add(breed);
}
function spawnMount(kind, tx, ty, areaName = current) {
  mounts.push({ kind, x: tx * TILE, y: ty * TILE, area: areaName, flip: false, frame: 0, frameT: 0, vx: 0, vy: 0, think: Math.random() * 60, ridden: false });
}

// ---------- save / load ----------
function save() {
  if (state === 'title') return;
  try {
    const cur = current.startsWith('int:') ? (area.warps[0]?.to || 'farm') : current;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      current: cur, farmMap: areaCache.farm?.map, crops: [...crops.entries()], groundEggs,
      coins, eggs, inv, level, xp, discovered: [...discovered], stats, questIndex, selectedCrop, lastStipendDay, clock, tod, walking,
      fishInv, fishSeen: [...fishSeen], fishDonated: [...fishDonated],
      player: { x: player.x, y: player.y, dir: player.dir, flip: player.flip },
      player2: { x: player2.x, y: player2.y, dir: player2.dir, flip: player2.flip },
      ducks: ducks.map((d) => ({ x: d.x, y: d.y, breed: d.breed, full: d.full, flip: d.flip, age: d.age })),
      mounts: mounts.map((m) => ({ kind: m.kind, x: m.x, y: m.y, area: m.area })),
    }));
  } catch (e) {}
}
const hasSave = () => !!localStorage.getItem(SAVE_KEY);
function load() {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  areaCache = {}; getArea('farm'); if (s.farmMap) areaCache.farm.map = s.farmMap;
  current = (s.current && AREA_DEFS[s.current]) ? s.current : 'farm'; area = getArea(current);
  crops = new Map(s.crops); groundEggs = s.groundEggs; coins = s.coins; eggs = s.eggs; inv = s.inv || {};
  level = s.level || 1; xp = s.xp || 0; discovered = new Set(s.discovered); stats = s.stats; questIndex = s.questIndex || 0;
  selectedCrop = s.selectedCrop || 'wheat'; lastStipendDay = s.lastStipendDay ?? -1; clock = s.clock || 0; tod = s.tod ?? 0.25;
  fishInv = s.fishInv || {}; fishSeen = new Set(s.fishSeen || []); fishDonated = new Set(s.fishDonated || []); fishing = null;
  if (!stats.caught) stats.caught = 0; if (!stats.donated) stats.donated = 0;
  player = { name: 'Haley', sprite: 'player', ...s.player, speed: 1.4, moving: false, step: 0, mount: null, hist: [] };
  player2 = { name: 'Nick', sprite: 'player2', x: 18 * TILE, y: 16 * TILE, dir: 'down', flip: false, ...(s.player2 || {}), speed: 1.4, moving: false, step: 0, mount: null, hist: [] };
  walking = s.walking || false;
  ducks = s.ducks.map((d) => ({ ...d, frame: 0, frameT: 0, vx: 0, vy: 0, think: 0, lay: 4 + Math.random() * 8, mate: 8, age: d.age || 0 }));
  mounts = (s.mounts || []).map((m) => ({ ...m, flip: false, frame: 0, frameT: 0, vx: 0, vy: 0, think: Math.random() * 60, ridden: false }));
}
addEventListener('beforeunload', save); setInterval(save, 5000);

// ---------- sound ----------
let actx = null;
function beep(f, dur = 0.08, type = 'square', vol = 0.05) {
  if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
}
const sfx = {
  plant: () => beep(330, 0.07, 'sine'), harvest: () => { beep(620, 0.06); beep(880, 0.09); },
  feed: () => beep(500, 0.06, 'triangle'), egg: () => { beep(740, 0.05); setTimeout(() => beep(990, 0.06), 50); },
  coin: () => { beep(880, 0.05); setTimeout(() => beep(1175, 0.07), 55); }, buy: () => { beep(523, 0.07); setTimeout(() => beep(784, 0.1), 70); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'square', 0.06), i * 80)),
  breed: () => { beep(660, 0.07); setTimeout(() => beep(990, 0.1), 90); }, talk: () => beep(440, 0.04, 'sine', 0.03),
  warp: () => { beep(392, 0.08); setTimeout(() => beep(587, 0.1), 80); }, nope: () => beep(170, 0.1, 'sawtooth', 0.03),
};

// ---------- progression ----------
const day = () => Math.floor(clock / DAY_LEN);
const unlockedCrops = () => CROP_ORDER.filter((id) => CROPS[id].level <= level);
function say(m) { toast = m; toastT = 2; }
function addXP(n) {
  xp += n;
  while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++; sfx.level();
    const nu = CROP_ORDER.find((id) => CROPS[id].level === level); say(nu ? `⭐ Level ${level}! Unlocked ${CROPS[nu].name}` : `⭐ Level ${level}!`); }
}
function statVal(s) { return s === 'ducks' ? ducks.length : s === 'level' ? level : s === 'coins' ? coins : s === 'breeds' ? discovered.size : (stats[s] || 0); }
function checkQuests() {
  while (questIndex < QUESTS.length) { const q = QUESTS[questIndex]; if (statVal(q.stat) < q.goal) break;
    coins += q.reward.coins; if (q.reward.xp) addXP(q.reward.xp); say(`✅ ${q.text}! +${q.reward.coins}🪙`); sfx.coin(); questIndex++; }
}

// ---------- input ----------
const keys = {};
const touchDir = { p1: { u: 0, d: 0, l: 0, r: 0 }, p2: { u: 0, d: 0, l: 0, r: 0 } };
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (state === 'title') { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (k === ' ' || k === 'enter') { e.preventDefault(); startGame(hasSave()); } else if (k === 'n') { localStorage.removeItem(SAVE_KEY); startGame(false); } return; }
  if (state === 'dialogue') { if (k === ' ' || k === 'enter' || k === 'escape') { e.preventDefault(); advanceDialogue(); } return; }
  if (state === 'modal') { if (k === 'escape' || k === ' ') closeModal(); return; }
  if (state === 'fishing') { if (k === ' ' || k === 'enter') { e.preventDefault(); hookFish(); } else if (k === 'escape') { fishing = null; state = 'play'; } return; }
  if (state === 'map') { if (k === 'm' || k === 'escape') state = 'play'; return; }
  if (k === 'm' && !e.repeat) { state = 'map'; return; }
  if (k === 'b' && current === 'farm') buildMode = !buildMode;
  if (e.key >= '1' && e.key <= '7' && buildMode) buildIdx = +e.key - 1;
  if (k === 'q' && buildMode) buildIdx = (buildIdx + BUILD_TILES.length - 1) % BUILD_TILES.length;
  if (k === 'e' && buildMode) buildIdx = (buildIdx + 1) % BUILD_TILES.length;
  if (k === 'c' && !buildMode) cycleSeed();
  if (k === 'r' && !e.repeat) toggleRide(player);
  if (k === 'f' && !e.repeat) toggleWalk();
  if (k === 'p' && !e.repeat) { muted = !muted; say(muted ? '🔇 music off' : '🔊 music on'); }
  if (k === ' ' && !e.repeat) { e.preventDefault(); interact(player); }
  if ((k === 'enter') && !e.repeat) { e.preventDefault(); interact(player2); }     // P2 (Nick) act
  if ((k === '/' || k === 'shift') && !e.repeat) toggleRide(player2);              // P2 ride
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
function startGame(cont) { if (cont && hasSave()) { try { load(); } catch { freshState(); } } else freshState(); buildMode = false; if ($('dialogue')) $('dialogue').style.display = 'none'; if ($('modal')) $('modal').style.display = 'none'; state = 'play'; }
function cycleSeed() { const u = unlockedCrops(), i = u.indexOf(selectedCrop); selectedCrop = u[(i + 1) % u.length]; say(`seed: ${CROPS[selectedCrop].name}`); }

// ---------- build ----------
const BUILD_TILES = ['dirt', 'path', 'grass', 'flower', 'water', 'fence', 'tree'];
let buildIdx = 0, buildMode = false;
canvas.addEventListener('mousedown', paintAt); canvas.addEventListener('mousemove', (e) => { if (e.buttons & 1) paintAt(e); });
function paintAt(e) {
  if (state !== 'play' || !buildMode || current !== 'farm') return;
  const r = canvas.getBoundingClientRect();
  const tx = Math.floor(((e.clientX - r.left) * (canvas.width / r.width) + camX) / TILE);
  const ty = Math.floor(((e.clientY - r.top) * (canvas.height / r.height) + camY) / TILE);
  if (tx > 0 && ty > 0 && tx < area.w - 1 && ty < area.h - 1 && !area.blocked.has(tx + ',' + ty)) {
    area.map[ty][tx] = BUILD_TILES[buildIdx]; if (BUILD_TILES[buildIdx] !== 'dirt') crops.delete(tx + ',' + ty);
  }
}

// ---------- collision ----------
function solidAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= area.w || ty >= area.h) return true;
  if (area.blocked.has(tx + ',' + ty)) return true;
  return SOLID.has(area.map[ty][tx]);
}
function canMove(nx, ny) { const p = 2, w = TILE - 4, h = TILE - 4; return !(solidAt(nx + p, ny + p) || solidAt(nx + p + w, ny + p) || solidAt(nx + p, ny + p + h) || solidAt(nx + p + w, ny + p + h)); }
// nearest on-foot-walkable tile (spiral search) — un-sticks the player after a water dismount
function nearestWalkable(px, py) {
  const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
  for (let r = 1; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = (cx + dx) * TILE, y = (cy + dy) * TILE;
    if (canMove(x, y)) return { x, y };
  }
  return { x: px, y: py };
}
function cropStage(c) { const g = CROPS[c.type].grow, a = clock - c.t; return a >= g ? 2 : a >= g * 0.5 ? 1 : 0; }

// mount-aware collision: pelican flies over water/trees/fences; penguin swims water.
function solidForMount(px, py, kind) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= area.w || ty >= area.h) return true;
  if (area.blocked.has(tx + ',' + ty)) return true;           // buildings/props always block
  const t = area.map[ty][tx];
  if (!SOLID.has(t)) return false;
  if (kind === 'pelican') return false;                       // fly over everything natural
  if (kind === 'penguin' && t === 'water') return false;      // dive into water
  return true;
}
function canRide(nx, ny, kind) { const p = 2, w = TILE - 4, h = TILE - 4; return !(solidForMount(nx + p, ny + p, kind) || solidForMount(nx + p + w, ny + p, kind) || solidForMount(nx + p, ny + p + h, kind) || solidForMount(nx + p + w, ny + p + h, kind)); }
const onWaterP = (p) => area.map[Math.floor((p.y + TILE / 2) / TILE)]?.[Math.floor((p.x + TILE / 2) / TILE)] === 'water';
const onWater = () => onWaterP(player) || onWaterP(player2);

function toggleRide(p = player) {
  if (p.mount) { const m = p.mount; m.ridden = false; m.area = current; p.mount = null;
    if (solidAt(p.x + 8, p.y + 8)) { const w = nearestWalkable(p.x, p.y); p.x = w.x; p.y = w.y; } // don't strand on water
    m.x = p.x; m.y = p.y; sfx.warp(); say(`${p.name} hopped off the ${MOUNT_NAME[m.kind].toLowerCase()}`); return; }
  let best = null, bd = 26 * 26;
  for (const m of mounts) { if (m.ridden || m.area !== current) continue; const d = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d < bd) { bd = d; best = m; } }
  if (best) { p.mount = best; best.ridden = true; if (p === player) walking = false; sfx.warp();
    say(best.kind === 'pelican' ? `🦅 ${p.name} takes flight!` : best.kind === 'penguin' ? `🐧 ${p.name} dives in!` : `🏃 ${p.name} rides the ostrich!`); }
  else say(`no mount near ${p.name}`);
}
function toggleWalk() {
  if (player.mount) { say('hop off your mount first'); return; }
  if (current !== 'farm') { say('your ducks are back at the farm'); return; }
  walking = !walking; sfx.talk(); say(walking ? '🦆 the flock follows you!' : 'the flock waddles off');
}

// ---------- fishing ----------
function startFishing(p = player) {
  if (p.mount) { say('hop off to fish'); return; }
  const pool = FISH_POOLS[biomePool(area.biome)] || FISH_POOLS.default;
  fishing = { phase: 'wait', t: 1.1 + Math.random() * 2.6, fish: pool[(Math.random() * pool.length) | 0], owner: p };
  state = 'fishing'; sfx.plant();
}
function hookFish() {
  if (!fishing) return;
  if (fishing.phase === 'bite') {
    const f = fishing.fish; fishInv[f] = (fishInv[f] || 0) + 1; const isNew = !fishSeen.has(f); fishSeen.add(f);
    stats.caught++; addXP(2 + FISH[f].tier); sfx.harvest();
    fishing = { phase: 'done', t: 1.5, msg: `${isNew ? '✨ NEW! ' : ''}Caught a ${FISH[f].name}! (worth ${FISH[f].value}🪙)` }; checkQuests();
  } else if (fishing.phase === 'wait') { fishing = { phase: 'done', t: 1.0, msg: 'Too early — it got away!' }; sfx.nope(); }
}
function updateFishing(dt) {
  if (!fishing) return; fishing.t -= dt;
  if (fishing.phase === 'wait' && fishing.t <= 0) { fishing.phase = 'bite'; fishing.t = 0.85; sfx.egg(); }
  else if (fishing.phase === 'bite' && fishing.t <= 0) { fishing = { phase: 'done', t: 1.0, msg: 'It got away...' }; sfx.nope(); }
  else if (fishing.phase === 'done' && fishing.t <= 0) { fishing = null; state = 'play'; }
}
const fishCount = () => FISH_ORDER.reduce((s, id) => s + (fishInv[id] || 0), 0);
const fishValue = () => FISH_ORDER.reduce((s, id) => s + (fishInv[id] || 0) * FISH[id].value, 0);

// ---------- warps ----------
let warpCooldown = 0;
function checkWarp() {
  if (warpCooldown > 0) return;
  for (const p of bothPlayers()) { const tx = Math.floor((p.x + TILE / 2) / TILE), ty = Math.floor((p.y + TILE / 2) / TILE);
    for (const wrp of area.warps) if (wrp.x === tx && wrp.y === ty) { warpTo(wrp.to, wrp.tx, wrp.ty); return; } }
}
function placeP(p, tx, ty) { p.x = tx * TILE; p.y = ty * TILE; p.moving = false; p.hist = []; if (p.mount) { p.mount.area = current; p.mount.x = p.x; p.mount.y = p.y; } }
function warpTo(name, tx, ty) {
  current = name; area = getArea(name);
  const ent = area.entrance || [Math.floor(area.w / 2), Math.floor(area.h / 2)];
  const bx = (tx ?? ent[0]), by = (ty ?? ent[1]);
  placeP(player, bx, by);
  const spot = nearestWalkable((bx + 1) * TILE, by * TILE); placeP(player2, Math.floor(spot.x / TILE), Math.floor(spot.y / TILE));
  player.dir = player2.dir = area.biome === 'interior' ? 'up' : 'down';
  warpCooldown = 0.5; zoomInit = false;   // snap zoom to the new area, and don't instantly re-trigger a warp
  buildMode = false; sfx.warp();
  const t = areaTitle(name);
  say(area.biome === 'interior' ? `🚪 ${t}` : area.biome === 'underwater' ? `🌊 ${t}` : area.biome === 'cave' ? `🕯️ ${t}` : `📍 ${t}`);
  if (name === 'quack' && festivalDay()) say('🎉 The Quacksborough Festival is on today!');
}
function enterInterior(gid) { if (player.mount) toggleRide(player); if (player2.mount) toggleRide(player2); warpTo('int:' + gid); }
// where bought mounts should appear: just outside, if we're in a shop interior
function exitSpot() {
  if (current.startsWith('int:') && area.warps[0]) return { area: area.warps[0].to, tx: area.warps[0].tx, ty: area.warps[0].ty };
  return { area: current, tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
}

// ---------- interaction ----------
function frontTile(p = player) {
  const cx = Math.floor((p.x + TILE / 2) / TILE), cy = Math.floor((p.y + TILE / 2) / TILE);
  if (p.dir === 'down') return [cx, cy + 1]; if (p.dir === 'up') return [cx, cy - 1]; return [cx + (p.flip ? -1 : 1), cy];
}
function nearestBuilding(p = player) {
  let best = null, bd = 24 * 24;
  for (const b of area.buildings) { const dx = (b.tx + b.w / 2) * TILE, dy = (b.ty + b.h) * TILE; const d = (dx - p.x - 8) ** 2 + (dy - p.y - 8) ** 2; if (d < bd) { bd = d; best = b; } }
  return best;
}
function nearestNPC(p = player) {
  let best = null, bd = 22 * 22;
  for (const n of area.npcs) { const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
function interact(p = player) {
  actingPlayer = p;
  const b = nearestBuilding(p); if (b) { if (b.action === 'enter') enterInterior(b.gid); else BUILDING_ACTIONS[b.action]?.(b); return; }
  const n = nearestNPC(p); if (n) { n.dir = p.y < n.y ? 'up' : p.x < n.x ? 'side' : 'down'; n.flip = p.x < n.x;
    if (n.action && BUILDING_ACTIONS[n.action]) BUILDING_ACTIONS[n.action](n); else openDialogue(n.name, n.lines); return; }
  const ft = frontTile(p); if (area.map[ft[1]]?.[ft[0]] === 'water') { startFishing(p); return; }
  if (current !== 'farm') { say('nothing here — cast at water, or find a door'); return; }
  const [fx, fy] = ft; if (fx < 0 || fy < 0 || fx >= area.w || fy >= area.h) return;
  const key = fx + ',' + fy;
  if (crops.has(key) && cropStage(crops.get(key)) === 2) { const t = crops.get(key).type; crops.delete(key); inv[t] = (inv[t] || 0) + 1; stats.harvested++; if (t === 'berry') stats.berryHarvest++; addXP(CROPS[t].xp); sfx.harvest(); say(`${p.name} harvested ${CROPS[t].name}`); checkQuests(); return; }
  if (area.map[fy][fx] === 'dirt' && !crops.has(key)) { const cost = CROPS[selectedCrop].cost; if (coins < cost) { sfx.nope(); say(`need ${cost}🪙 for ${CROPS[selectedCrop].name} seed`); return; } coins -= cost; crops.set(key, { t: clock, type: selectedCrop }); stats.planted++; sfx.plant(); say(`planted ${CROPS[selectedCrop].name}`); checkQuests(); return; }
  const have = CROP_ORDER.find((id) => (inv[id] || 0) > 0);
  if (have) { let best = null, bd = 26 * 26; for (const d of ducks) { const dist = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (d.full < 90 && dist < bd) { bd = dist; best = d; } } if (best) { inv[have]--; best.full = Math.min(100, best.full + 45); stats.fed++; sfx.feed(); say('fed a duck 💛'); checkQuests(); return; } }
  say('nothing to do here');
}

// ---------- dialogue ----------
function openDialogue(name, lines) { dlg = { name, lines }; dlgI = 0; sfx.talk(); state = 'dialogue'; renderDialogue(); }
function advanceDialogue() { dlgI++; if (!dlg || dlgI >= dlg.lines.length) { $('dialogue').style.display = 'none'; dlg = null; state = 'play'; return; } sfx.talk(); renderDialogue(); }
function renderDialogue() { $('dlgName').textContent = dlg.name; $('dlgText').textContent = dlg.lines[dlgI]; $('dlgHint').textContent = dlgI < dlg.lines.length - 1 ? '▸ SPACE' : '✓ SPACE'; $('dialogue').style.display = 'block'; }

// ---------- modal / shops ----------
let modalRefresh = null, modalOwner = 0, actingPlayer = null;
function openModal(title, sub, buttons) {
  state = 'modal'; modalRefresh = null; if ($('dialogue')) $('dialogue').style.display = 'none';
  modalOwner = actingPlayer === player2 ? 1 : 0;
  $('modalTitle').textContent = title; $('modalSub').innerHTML = sub;
  const box = $('modalBtns'); box.innerHTML = '';
  for (const bt of buttons) { const el = document.createElement('button'); el.textContent = bt.label; el.disabled = !!bt.disabled; if (!bt.disabled) el.onclick = () => { bt.onClick(); }; box.appendChild(el); }
  $('modal').style.display = 'flex';
}
// phone picks a modal option (or closes) — drives the TV's modal buttons
function dfMenu(payload) {
  if (state !== 'modal') return;
  if (payload && payload.close) { closeModal(); return; }
  const i = payload && payload.index; const b = $('modalBtns').children[i]; if (b && !b.disabled) b.click();
}
// snapshot the parts a phone needs (so it can show & pick modal choices)
function controllerSnapshot() {
  let modal = null;
  if (state === 'modal') modal = { title: $('modalTitle').textContent, sub: $('modalSub').innerHTML, owner: modalOwner,
    options: [...$('modalBtns').children].map((b) => ({ label: b.textContent, disabled: b.disabled })) };
  return { modal, dialogue: state === 'dialogue' ? { name: $('dlgName').textContent, text: $('dlgText').textContent } : null, map: state === 'map' };
}
function closeModal() { $('modal').style.display = 'none'; state = 'play'; }
const cropCount = () => CROP_ORDER.reduce((s, id) => s + (inv[id] || 0), 0);
const cropValue = (mult = 1) => Math.floor(CROP_ORDER.reduce((s, id) => s + (inv[id] || 0) * CROPS[id].sell, 0) * mult);
const fMult = () => festivalDay() ? 1.25 : 1;
function doSellEggs(price) { if (!eggs) return; coins += Math.round(eggs * price * fMult()); eggs = 0; stats.sold++; sfx.coin(); checkQuests(); }
function doSellCrops(mult) { const v = cropValue(mult); if (!v) return; coins += Math.round(v * fMult()); CROP_ORDER.forEach((id) => inv[id] = 0); stats.sold++; sfx.coin(); checkQuests(); }
function doSellFish() { const v = fishValue(); if (!v) return; coins += Math.round(v * fMult()); FISH_ORDER.forEach((id) => fishInv[id] = 0); stats.sold++; sfx.coin(); checkQuests(); }

const BUILDING_ACTIONS = {
  barnshop: (src) => openModal(`🛖 ${src?.shopTitle || 'The Barn'}`, `You have <b>${coins}</b> 🪙${festivalDay() ? ' — <i>festival +25%!</i>' : ''}`, [
    { label: `Sell ${eggs} eggs  →  +${Math.round(eggs * EGG_PRICE * fMult())} 🪙`, disabled: !eggs, onClick: () => { doSellEggs(EGG_PRICE); BUILDING_ACTIONS.barnshop(src); } },
    { label: `Sell ${cropCount()} crops  →  +${Math.round(cropValue() * fMult())} 🪙`, disabled: !cropCount(), onClick: () => { doSellCrops(1); BUILDING_ACTIONS.barnshop(src); } },
    { label: `Sell ${fishCount()} fish  →  +${Math.round(fishValue() * fMult())} 🪙`, disabled: !fishCount(), onClick: () => { doSellFish(); BUILDING_ACTIONS.barnshop(src); } },
    { label: `Buy a random duck  →  −${DUCK_PRICE} 🪙`, disabled: coins < DUCK_PRICE, onClick: () => { coins -= DUCK_PRICE; const br = pickBreed(); spawnDuck(17, 12, br); sfx.buy(); say(`🦆 a ${BREED_BY_ID[br].name} for the farm!`); checkQuests(); BUILDING_ACTIONS.barnshop(src); } },
  ]),
  store: (src) => openModal(`🏪 ${src?.shopTitle || 'General Store'}`, `You have <b>${coins}</b> 🪙 — <i>premium prices${festivalDay() ? ' +25%' : ''}!</i>`, [
    { label: `Sell ${eggs} eggs  →  +${Math.round(eggs * 6 * fMult())} 🪙  (6 each)`, disabled: !eggs, onClick: () => { doSellEggs(6); BUILDING_ACTIONS.store(src); } },
    { label: `Sell ${cropCount()} crops  →  +${Math.round(cropValue(1.3) * fMult())} 🪙  (+30%)`, disabled: !cropCount(), onClick: () => { doSellCrops(1.3); BUILDING_ACTIONS.store(src); } },
    { label: `Sell ${fishCount()} fish  →  +${Math.round(fishValue() * fMult())} 🪙`, disabled: !fishCount(), onClick: () => { doSellFish(); BUILDING_ACTIONS.store(src); } },
  ]),
  museum: (src) => { const newSpecies = [...fishSeen].filter((f) => !fishDonated.has(f));
    openModal(`🏛️ ${src?.shopTitle || 'Museum'}`, `Exhibits filled: <b>${fishDonated.size}/${FISH_ORDER.length}</b> fish<br>${newSpecies.length ? `You have <i>${newSpecies.length}</i> new species to donate!` : 'Catch new kinds of fish to donate.'}`, [
      { label: `Donate ${newSpecies.length} new fish  →  +${newSpecies.length * 10} 🪙`, disabled: !newSpecies.length, onClick: () => { newSpecies.forEach((f) => fishDonated.add(f)); stats.donated += newSpecies.length; coins += newSpecies.length * 10; addXP(newSpecies.length * 4); sfx.coin(); say(`donated ${newSpecies.length} fish! the exhibits grow`); checkQuests(); BUILDING_ACTIONS.museum(src); } },
    ]); },
  emporium: (src) => {
    const e = exitSpot();
    const breedBtns = BREEDS.map((br) => ({
      label: `${br.name}${br.id === 'rosy' ? ' ✨' : ''}  →  −${EMPORIUM[br.id]} 🪙`, disabled: coins < EMPORIUM[br.id],
      onClick: () => { coins -= EMPORIUM[br.id]; const isNew = !discovered.has(br.id); spawnDuck(17, 12, br.id); sfx.buy(); say(isNew ? `✨ NEW: ${br.name}!` : `🦆 a ${br.name} joins the farm!`); checkQuests(); BUILDING_ACTIONS.emporium(src); },
    }));
    const mountBtns = [
      { label: `🏃 Ostrich — ride on land  →  −${MOUNT_PRICE.ostrich} 🪙`, disabled: coins < MOUNT_PRICE.ostrich,
        onClick: () => { coins -= MOUNT_PRICE.ostrich; spawnMount('ostrich', e.tx, e.ty, e.area); sfx.buy(); say('🏃 an ostrich waits outside — press R beside it!'); BUILDING_ACTIONS.emporium(src); } },
      { label: `🐧 Penguin — dive & swim  →  −${MOUNT_PRICE.penguin} 🪙`, disabled: coins < MOUNT_PRICE.penguin,
        onClick: () => { coins -= MOUNT_PRICE.penguin; spawnMount('penguin', e.tx, e.ty, e.area); sfx.buy(); say('🐧 a penguin waits outside — press R, then dive!'); BUILDING_ACTIONS.emporium(src); } },
    ];
    openModal(`🦆 ${src?.shopTitle || 'Duck Emporium'}`, `You have <b>${coins}</b> 🪙 — ducks & exotic mounts:`, [...breedBtns, ...mountBtns]);
  },
  hall: (src) => { const q = QUESTS[questIndex]; const canClaim = day() > lastStipendDay;
    openModal(`🏛️ ${src?.shopTitle || 'Town Hall'}`, `Reputation: <b>${questIndex}</b> tasks done<br>${q ? `Current task: <i>${q.text}</i> (${Math.min(statVal(q.stat), q.goal)}/${q.goal})` : '<i>All tasks complete — magnificent!</i>'}`, [
      { label: canClaim ? 'Claim daily stipend  →  +15 🪙' : 'Daily stipend (come back tomorrow)', disabled: !canClaim, onClick: () => { coins += 15; lastStipendDay = day(); sfx.coin(); say('🪙 +15 stipend'); BUILDING_ACTIONS.hall(src); } },
    ]); },
  cafe: (src) => { const hungry = ducks.some((d) => d.full < 100);
    openModal(`☕ ${src?.shopTitle || 'The Cozy Café'}`, `You have <b>${coins}</b> 🪙`, [
      { label: 'Duck Treat — feed ALL ducks  →  −8 🪙', disabled: coins < 8 || !hungry, onClick: () => { coins -= 8; ducks.forEach((d) => d.full = 100); sfx.coin(); say('💛 the whole flock is full!'); BUILDING_ACTIONS.cafe(src); } },
      { label: 'Order a treat (free flavour)', onClick: () => { closeModal(); openDialogue(src?.name || 'Server', ['*slides you something warm* On the house, Haley.', 'Come back when your ducks are peckish!']); } },
    ]); },
};
function pickBreed() { const total = BREEDS.reduce((s, b) => s + b.weight, 0); let r = Math.random() * total; for (const b of BREEDS) if ((r -= b.weight) < 0) return b.id; return 'classic'; }
if ($('modalClose')) $('modalClose').onclick = closeModal;

// ---------- updates ----------
const MAXSEP = 150;   // co-op leash so both players stay on the shared screen
function playerInput(p) {
  const t = p === player ? touchDir.p1 : touchDir.p2;
  if (p === player) return { u: keys['w'] || t.u, d: keys['s'] || t.d, l: keys['a'] || t.l, r: keys['d'] || t.r };
  return { u: keys['arrowup'] || t.u, d: keys['arrowdown'] || t.d, l: keys['arrowleft'] || t.l, r: keys['arrowright'] || t.r };
}
function withinTether(p, nx, ny) { const o = p === player ? player2 : player; const cur = (p.x - o.x) ** 2 + (p.y - o.y) ** 2; const nd = (nx - o.x) ** 2 + (ny - o.y) ** 2; return nd <= MAXSEP * MAXSEP || nd <= cur; }
function updateOne(p, dt) {
  const inp = playerInput(p); let dx = (inp.l ? -1 : 0) + (inp.r ? 1 : 0), dy = (inp.u ? -1 : 0) + (inp.d ? 1 : 0);
  if (dx) { p.dir = 'side'; p.flip = dx < 0; } else if (dy < 0) p.dir = 'up'; else if (dy > 0) p.dir = 'down';
  p.moving = dx !== 0 || dy !== 0;
  const kind = p.mount?.kind, speed = kind ? MOUNT_SPEED[kind] : p.speed;
  const stuck = !kind && solidAt(p.x + 8, p.y + 8);
  const ok = (nx, ny) => kind ? canRide(nx, ny, kind) : (stuck || canMove(nx, ny));   // no leash — camera zooms to keep both in view
  if (p.moving) {
    const len = Math.hypot(dx, dy) || 1, sx = (dx / len) * speed, sy = (dy / len) * speed;
    if (ok(p.x + sx, p.y)) p.x += sx; if (ok(p.x, p.y + sy)) p.y += sy;
    p.step += kind ? 0.28 : 0.18; checkWarp();
    if (p === player) { p.hist.unshift({ x: p.x, y: p.y }); if (p.hist.length > MAX_FOLLOWERS * FOLLOW_GAP + 4) p.hist.length = MAX_FOLLOWERS * FOLLOW_GAP + 4; }
  }
  if (p.mount) { p.mount.x = p.x; p.mount.y = p.y; p.mount.flip = p.flip; }
  if (current === 'farm') for (let i = groundEggs.length - 1; i >= 0; i--) { const g = groundEggs[i]; if ((g.x - p.x) ** 2 + (g.y - p.y) ** 2 < 12 * 12) { groundEggs.splice(i, 1); eggs++; stats.eggsCollected++; addXP(1); sfx.egg(); say('🥚 +1 egg'); checkQuests(); } }
}
function updatePlayers(dt) { updateOne(player, dt); updateOne(player2, dt); }
const isNight = () => tod > 0.62 && tod < 0.92;
function updateNPCs(dt) {
  for (const n of area.npcs) { if (!n.wander) continue; n.think -= dt * 60;
    if (n.think <= 0) { n.think = 60 + Math.random() * 90; if (Math.random() < 0.5) { n.vx = 0; n.vy = 0; } else { const a = Math.random() * Math.PI * 2; n.vx = Math.cos(a) * 0.4; n.vy = Math.sin(a) * 0.4; n.flip = n.vx < 0; n.dir = Math.abs(n.vx) > Math.abs(n.vy) ? 'side' : n.vy < 0 ? 'up' : 'down'; } }
    if (n.vx || n.vy) { const nx = n.x + n.vx, ny = n.y + n.vy; if ((nx - n.home.x) ** 2 + (ny - n.home.y) ** 2 < 40 * 40 && canMove(nx, ny)) { n.x = nx; n.y = ny; n.frame = (clock * 6 | 0) % 2; } else { n.vx = -n.vx; n.vy = -n.vy; } } else n.frame = 1; }
}
function updateDucks(dt) {
  const night = isNight();
  // aging: well-fed ducks mature into rideable pelicans (keep at least 2 ducks)
  for (let i = ducks.length - 1; i >= 0; i--) {
    const d = ducks[i];
    d.age += dt * (d.full > 60 ? 2.0 : d.full > 20 ? 0.6 : 0.15);
    if (d.age > AGE_PELICAN && ducks.length > 2) {
      ducks.splice(i, 1); spawnMount('pelican', Math.floor(d.x / TILE), Math.floor(d.y / TILE), 'farm');
      sfx.breed(); say('🦆→🦅 a duck grew into a pelican! (stand by it, press R to fly)');
    }
  }
  // flock parade — ducks trail the player along their path
  if (walking) {
    ducks.slice(0, MAX_FOLLOWERS).forEach((d, i) => {
      const idx = Math.min((i + 1) * FOLLOW_GAP, player.hist.length - 1);
      const t = player.hist[idx]; if (!t) return;
      const next = player.hist[Math.max(idx - 1, 0)] || t;
      if (next.x - t.x < -0.1) d.flip = true; else if (next.x - t.x > 0.1) d.flip = false;
      d.frame = player.moving ? (clock * 8 | 0) % 2 : 0; d.x = t.x; d.y = t.y;
    });
    return; // while parading, ducks just follow (no wander/lay/breed)
  }
  for (const d of ducks) {
    d.think -= dt * 60;
    if (d.think <= 0) { d.think = 40 + Math.random() * 80; if (Math.random() < (night ? 0.8 : 0.35)) { d.vx = 0; d.vy = 0; } else { const a = Math.random() * Math.PI * 2; d.vx = Math.cos(a) * 0.5; d.vy = Math.sin(a) * 0.5; d.flip = d.vx < 0; } }
    if (d.vx || d.vy) { if (canMove(d.x + d.vx, d.y)) d.x += d.vx; else d.vx = -d.vx; if (canMove(d.x, d.y + d.vy)) d.y += d.vy; else d.vy = -d.vy; d.frameT += Math.hypot(d.vx, d.vy); if (d.frameT > 6) { d.frameT = 0; d.frame ^= 1; } } else d.frame = 0;
    d.full = Math.max(0, d.full - dt * (night ? 1.2 : 2.5));
    if (d.full > 40) { d.lay -= dt; if (d.lay <= 0) { d.lay = 9 + Math.random() * 7; d.full -= 15; groundEggs.push({ x: d.x, y: d.y }); } }
  }
  for (let i = 0; i < ducks.length; i++) { const a = ducks[i]; if (a.full < 65) { a.mate = 8; continue; } let near = null;
    for (let j = i + 1; j < ducks.length; j++) { const b = ducks[j]; if (b.full >= 65 && (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 20 * 20) { near = b; break; } }
    if (near && ducks.length < 40) { a.mate -= dt; if (a.mate <= 0) { a.mate = 18; near.mate = 18; a.full -= 25; near.full -= 25; const breed = Math.random() < 0.12 ? pickBreed() : (Math.random() < 0.5 ? a.breed : near.breed); const wasNew = !discovered.has(breed); spawnDuck(Math.floor(a.x / TILE), Math.floor(a.y / TILE), breed); sfx.breed(); say(wasNew ? '✨ a rare duckling hatched!' : '🐣 a duckling hatched!'); checkQuests(); } } else a.mate = 8; }
}

function updateMounts(dt) {
  for (const m of mounts) {
    if (m.ridden || m.area !== current) continue;
    m.think -= dt * 60;
    if (m.think <= 0) { m.think = 60 + Math.random() * 90; if (Math.random() < 0.55) { m.vx = 0; m.vy = 0; } else { const a = Math.random() * Math.PI * 2; m.vx = Math.cos(a) * 0.45; m.vy = Math.sin(a) * 0.45; m.flip = m.vx < 0; } }
    if (m.vx || m.vy) {
      // mounts roam with their own movement rules (penguins can wade, others stay on land)
      const ok = (nx, ny) => canRide(nx, ny, m.kind === 'pelican' ? 'ostrich' : m.kind);
      if (ok(m.x + m.vx, m.y)) m.x += m.vx; else m.vx = -m.vx;
      if (ok(m.x, m.y + m.vy)) m.y += m.vy; else m.vy = -m.vy;
      m.frameT += Math.hypot(m.vx, m.vy); if (m.frameT > 6) { m.frameT = 0; m.frame ^= 1; }
    } else m.frame = 0;
  }
}

// ---------- draw ----------
// Small fixed canvas backing (crisp pixel UI), CSS-stretched to fill the screen.
// The WORLD is zoomed smoothly with a ctx.scale transform; UI stays in backing px.
let camX = 0, camY = 0, zoom = 1.4, zoomTarget = 1.4, zoomInit = false;
function resizeCanvas() {
  const asp = (window.innerWidth || 16) / (window.innerHeight || 9);
  const W = 360, H = Math.max(160, Math.round(W / asp));
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  ctx.imageSmoothingEnabled = false;
}
resizeCanvas(); addEventListener('resize', resizeCanvas);
const sx = (wx) => (wx - camX) * zoom, sy = (wy) => (wy - camY) * zoom;   // world px → screen px
function fitView(dt) {
  const CW = canvas.width, CH = canvas.height;
  const midX = (player.x + player2.x) / 2 + 8, midY = (player.y + player2.y) / 2 + 8;
  const base = CW / (17 * TILE);                                          // base view ≈ 17 tiles across
  const fitX = CW / (Math.abs(player.x - player2.x) + 11 * TILE);         // zoom out to fit the pair (+margin)
  const fitY = CH / (Math.abs(player.y - player2.y) + 9 * TILE);
  const areaMin = Math.max(CW / (area.w * TILE), CH / (area.h * TILE));   // never zoom out past the whole area
  zoomTarget = Math.max(areaMin, Math.min(base, fitX, fitY));
  if (!zoomInit) { zoom = zoomTarget; zoomInit = true; }
  else zoom += (zoomTarget - zoom) * Math.min(1, dt * 4.5);               // smooth, frame-rate independent
  const vw = CW / zoom, vh = CH / zoom;
  camX = (area.w * TILE <= vw) ? (area.w * TILE - vw) / 2 : Math.max(0, Math.min(midX - vw / 2, area.w * TILE - vw));
  camY = (area.h * TILE <= vh) ? (area.h * TILE - vh) / 2 : Math.max(0, Math.min(midY - vh / 2, area.h * TILE - vh));
  VIEW_W = Math.ceil(vw / TILE); VIEW_H = Math.ceil(vh / TILE);
}
function shadow(x, y, rx = 5) { ctx.save(); ctx.fillStyle = 'rgba(20,16,30,0.22)'; ctx.beginPath(); ctx.ellipse(Math.round(x - camX + 8), Math.round(y - camY + 14), rx, rx * 0.42, 0, 0, 7); ctx.fill(); ctx.restore(); }
function blit(img, x, y, flip = false) { const sx = Math.round(x - camX), sy = Math.round(y - camY); if (flip) { ctx.save(); ctx.translate(sx + TILE, sy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); } else ctx.drawImage(img, sx, sy); }
function drawCharacter(p) {
  const set = art[p.sprite] || art.player;
  const f = p.moving ? set[p.dir][Math.floor(p.step) % 4] : set[p.dir][1];
  if (p.mount) { const k = p.mount.kind, lift = k === 'pelican' ? 4 : 0;
    shadow(p.x, p.y, k === 'ostrich' ? 6 : 5); blit(art[k][Math.floor(p.step) % 2], p.x, p.y - (MOUNT_H[k] - 16) - lift, p.flip); blit(f, p.x, p.y - RIDE_LIFT[k] - lift, p.flip);
  } else { shadow(p.x, p.y); blit(f, p.x, p.y, p.flip); }
  ctx.font = '6px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = p === player ? '#ffc7e0' : '#bcd8ff';
  ctx.fillText(p.name, Math.round(p.x - camX + 8), Math.round(p.y - camY - (p.mount ? 16 : 5))); ctx.textAlign = 'left';
}
function ambient() { const t = tod; if (t < 0.05) return lerp(t / 0.05, [20, 22, 60, 0.42], [255, 180, 120, 0.16]); if (t < 0.45) return null; if (t < 0.62) return lerp((t - 0.45) / 0.17, [255, 160, 110, 0.16], [40, 30, 70, 0.3]); if (t < 0.92) return { r: 16, g: 20, b: 58, a: 0.44 }; return lerp((t - 0.92) / 0.08, [16, 20, 58, 0.44], [20, 22, 60, 0.42]); }
function lerp(p, a, b) { const L = (i) => a[i] + (b[i] - a[i]) * p; return { r: L(0) | 0, g: L(1) | 0, b: L(2) | 0, a: L(3) }; }

function bubbles() { ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 16; i++) { const bx = (i * 47 + clock * 18) % canvas.width; const by = canvas.height - ((clock * 26 + i * 37) % (canvas.height + 8)); ctx.fillRect(bx | 0, by | 0, 2, 2); } }
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.scale(zoom, zoom);   // smooth world zoom; UI drawn after restore() in backing px
  const wf = art.waterFrames[(clock * 2 | 0) % 2];
  const t0x = Math.floor(camX / TILE), t0y = Math.floor(camY / TILE);
  for (let y = t0y; y <= t0y + VIEW_H + 1; y++) for (let x = t0x; x <= t0x + VIEW_W + 1; x++) {
    if (x < 0 || y < 0 || x >= area.w || y >= area.h) continue;
    const t = area.map[y][x], px = Math.round(x * TILE - camX), py = Math.round(y * TILE - camY);
    if (t === 'tree' || t === 'fence') ctx.drawImage(art.tiles[area.base] || art.tiles.grass, px, py);
    ctx.drawImage(t === 'water' ? wf : (art.tiles[t] || art.tiles[area.base] || art.tiles.grass), px, py);
    if (t === 'water') { ctx.fillStyle = 'rgba(40,120,150,0.5)';
      if (area.map[y - 1]?.[x] !== 'water') ctx.fillRect(px, py, TILE, 1); if (area.map[y + 1]?.[x] !== 'water') ctx.fillRect(px, py + TILE - 1, TILE, 1);
      if (area.map[y]?.[x - 1] !== 'water') ctx.fillRect(px, py, 1, TILE); if (area.map[y]?.[x + 1] !== 'water') ctx.fillRect(px + TILE - 1, py, 1, TILE); }
    if (t === 'path' || t === 'cobble') { // grass fringe overhang on borders
      const grassy = (tt) => tt === 'grass' || tt === 'flower';
      if (grassy(area.map[y - 1]?.[x])) ctx.drawImage(art.fringe.top, px, py);
      if (grassy(area.map[y + 1]?.[x])) ctx.drawImage(art.fringe.bottom, px, py);
      if (grassy(area.map[y]?.[x - 1])) ctx.drawImage(art.fringe.left, px, py);
      if (grassy(area.map[y]?.[x + 1])) ctx.drawImage(art.fringe.right, px, py);
    }
    if (current === 'farm') { const c = crops.get(x + ',' + y); if (c) ctx.drawImage(art.crops[c.type][cropStage(c)], px, py); }
  }

  // depth-sorted entities: props, buildings, npcs, ducks, player, eggs
  const ents = [];
  for (const p of area.props) ents.push({ sy: (p.ty + p.h) * TILE, draw: () => { if (p.solid) shadow(p.tx * TILE + (p.w - 1) * 8, (p.ty + p.h - 1) * TILE, 4 + p.w * 2); const img = art.props[p.art]; ctx.drawImage(img, Math.round(p.tx * TILE - camX), Math.round((p.ty + p.h) * TILE - img.height - camY)); } });
  for (const b of area.buildings) ents.push({ sy: (b.ty + b.h) * TILE - 2, draw: () => { const img = resolveBuilding(b.art); shadow(b.tx * TILE + (b.w - 1) * 8, (b.ty + b.h - 1) * TILE, 6 + b.w * 3); ctx.drawImage(img, Math.round(b.tx * TILE - camX), Math.round((b.ty + b.h) * TILE - img.height - camY)); } });
  for (const n of area.npcs) ents.push({ sy: n.y + 14, draw: () => { shadow(n.x, n.y); blit(n.frames[n.dir][n.frame % n.frames[n.dir].length] || n.frames[n.dir][1], n.x, n.y, n.flip); } });
  for (const m of mounts) if (m.area === current && !m.ridden) ents.push({ sy: m.y + 14, draw: () => { shadow(m.x, m.y, m.kind === 'ostrich' ? 6 : 5); blit(art[m.kind][m.frame], m.x, m.y - (MOUNT_H[m.kind] - 16), m.flip); } });
  if (current === 'farm') { for (const g of groundEggs) ents.push({ sy: g.y + 14, draw: () => { shadow(g.x, g.y, 4); blit(art.egg, g.x, g.y); } });
    for (const d of ducks) ents.push({ sy: d.y + 14, draw: () => { shadow(d.x, d.y); blit(art.ducks[d.breed][d.frame], d.x, d.y, d.flip); if (d.full < 25) { ctx.fillStyle = '#ffd95a'; ctx.fillRect(Math.round(d.x - camX + 11), Math.round(d.y - camY - 3), 3, 3); } } }); }
  for (const p of bothPlayers()) ents.push({ sy: p.y + 14, draw: () => drawCharacter(p) });
  ents.sort((a, b) => a.sy - b.sy); for (const e of ents) e.draw();
  if (festivalDay() && current === 'quack') drawFestivalProps();
  ctx.restore();   // ---- end world transform; everything below is screen-space UI ----

  // biome-aware atmosphere
  if (area.biome === 'underwater') {
    ctx.fillStyle = 'rgba(30,98,150,0.34)'; ctx.fillRect(0, 0, canvas.width, canvas.height); bubbles();
  } else if (area.biome === 'cave') {
    const gx = sx(player.x + 8), gy = sy(player.y + 8), R = canvas.height * 0.55;
    const grd = ctx.createRadialGradient(gx, gy, R * 0.22, gx, gy, R);
    grd.addColorStop(0, 'rgba(8,6,16,0)'); grd.addColorStop(1, 'rgba(8,6,16,0.82)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (area.biome !== 'interior') {
    const amb = ambient(); if (amb) { ctx.fillStyle = `rgba(${amb.r},${amb.g},${amb.b},${amb.a})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (tod > 0.5 || tod < 0.08) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of area.props) if (p.art === 'lamp') { const gx = sx(p.tx * TILE + 8), gy = sy(p.ty * TILE - 4), R = 34 * zoom; const grd = ctx.createRadialGradient(gx, gy, 1, gx, gy, R); grd.addColorStop(0, 'rgba(255,224,150,0.55)'); grd.addColorStop(0.5, 'rgba(255,210,120,0.22)'); grd.addColorStop(1, 'rgba(255,210,120,0)'); ctx.fillStyle = grd; ctx.fillRect(gx - R, gy - R, R * 2, R * 2); }
      ctx.restore(); }
  }
  // penguin diving in surface water (on land maps)
  if (player.mount?.kind === 'penguin' && onWater()) { ctx.fillStyle = 'rgba(38,116,176,0.42)'; ctx.fillRect(0, 0, canvas.width, canvas.height); bubbles(); }
  if (festivalDay() && current === 'quack') drawFestivalBanner();
  drawLabels(); drawTopHUD();
}
function drawTopHUD() {
  ctx.fillStyle = 'rgba(18,26,38,0.82)'; ctx.fillRect(0, 0, canvas.width, 12);
  ctx.font = '8px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText(`🪙${coins}  🥚${eggs}  🐟${fishCount()}  🦆${ducks.length}  ${todIcon()}`, 3, 6);
  const q = QUESTS[questIndex];
  if (q) { const tx = `★ ${q.text}  ${Math.min(statVal(q.stat), q.goal)}/${q.goal}`; const w = ctx.measureText(tx).width + 8;
    ctx.fillStyle = 'rgba(18,26,38,0.82)'; ctx.fillRect(0, canvas.height - 11, w, 11); ctx.fillStyle = '#cfe6d0'; ctx.fillText(tx, 3, canvas.height - 5); }
}

function label(text, cx, baseTopPx, color = '#fffdf0') {
  ctx.font = '7px monospace'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = 'rgba(30,24,38,0.72)'; ctx.fillRect(cx - w / 2, baseTopPx, w, 10);
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, baseTopPx + 5); ctx.textAlign = 'left';
}

// ---------- fishing UI ----------
function drawFishing() {
  const fp = fishing.owner || player;
  const ft = frontTile(fp); const bx = sx(ft[0] * TILE + 8), by = sy(ft[1] * TILE + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx(fp.x + 8), sy(fp.y + 2)); ctx.lineTo(bx, by); ctx.stroke();
  const bob = fishing.phase === 'bite' ? Math.sin(clock * 30) * 2 : 0;
  ctx.fillStyle = fishing.phase === 'bite' ? '#ff5a5a' : '#fff'; ctx.fillRect(bx - 1, by - 1 + bob, 3, 3);
  const msg = fishing.phase === 'wait' ? 'Waiting for a bite…' : fishing.phase === 'bite' ? '❗ A bite! Press SPACE!' : (fishing.msg || '');
  ctx.font = '8px monospace'; ctx.textAlign = 'center'; const w = ctx.measureText(msg).width + 16;
  ctx.fillStyle = 'rgba(18,28,42,0.92)'; ctx.fillRect(canvas.width / 2 - w / 2, canvas.height - 24, w, 15);
  ctx.fillStyle = fishing.phase === 'bite' ? '#ffd24a' : '#dfffe6'; ctx.textBaseline = 'middle'; ctx.fillText(msg, canvas.width / 2, canvas.height - 16); ctx.textAlign = 'left';
}

// ---------- world map ----------
function drawMap() {
  ctx.fillStyle = 'rgba(10,16,26,0.95)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fffdf0'; ctx.font = 'bold 11px monospace'; ctx.textBaseline = 'middle'; ctx.fillText('WORLD MAP', canvas.width / 2, 12);
  const pad = 22, cw = (canvas.width - 2 * pad) / 2, ch = (canvas.height - 46) / 5;
  const pos = (id) => { const [c, r] = MAP_LAYOUT[id]; return [pad + (c - 2) * cw, 28 + r * ch]; };
  ctx.strokeStyle = 'rgba(150,170,190,0.5)'; ctx.lineWidth = 1;
  for (const id in MAP_LAYOUT) { const def = AREA_DEFS[id]; if (!def) continue; const a = pos(id);
    for (const to of [...Object.values(def.exits || {}), ...(def.links || []).map((l) => l.to)]) { if (!MAP_LAYOUT[to]) continue; const b = pos(to); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
  const curId = current.startsWith('int:') ? (area.warps[0]?.to || 'farm') : current;
  ctx.font = '7px monospace';
  for (const id in MAP_LAYOUT) { const [x, y] = pos(id); const here = id === curId; const name = areaTitle(id); const w = Math.max(30, ctx.measureText(name).width + 8);
    ctx.fillStyle = here ? '#3f9e54' : '#26323e'; ctx.fillRect(x - w / 2, y - 7, w, 14);
    ctx.strokeStyle = here ? '#aef0c0' : '#4a5a68'; ctx.strokeRect(x - w / 2, y - 7, w, 14);
    ctx.fillStyle = here ? '#fff' : '#cdd8e0'; ctx.fillText(name, x, y); }
  ctx.fillStyle = '#8fa6b5'; ctx.fillText('M / Esc to close', canvas.width / 2, canvas.height - 8); ctx.textAlign = 'left';
}

// ---------- festival ----------
const festivalDay = () => day() % 3 === 2;
function drawFestivalProps() {
  const spots = [[12, 12], [25, 12], [12, 20], [25, 20], [18, 11]];
  const cols = ['balloonR', 'balloonB', 'balloonY', 'balloonR', 'balloonB'];
  spots.forEach(([tx, ty], i) => { const img = art.props[cols[i]]; ctx.drawImage(img, Math.round(tx * TILE - camX), Math.round((ty + 1) * TILE - img.height - camY + Math.sin(clock + i) * 2)); });
  // lanterns on the lamp posts
  for (const p of area.props) if (p.art === 'lamp') ctx.drawImage(art.props.lantern2, Math.round(p.tx * TILE - camX), Math.round(p.ty * TILE - camY - 18));
}
function drawFestivalBanner() {
  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const t = '✦ QUACKSBOROUGH FESTIVAL ✦'; const w = ctx.measureText(t).width + 16;
  ctx.fillStyle = 'rgba(150,40,90,0.9)'; ctx.fillRect(canvas.width / 2 - w / 2, 16, w, 14);
  ctx.fillStyle = '#ffe25a'; ctx.fillText(t, canvas.width / 2, 23); ctx.textAlign = 'left';
  if (tod > 0.6 || tod < 0.05) for (let i = 0; i < 3; i++) { // fireworks at night
    const seed = Math.floor(clock / 1.3) + i * 7; const rnd = (n) => ((Math.sin(seed * 9.7 + n * 3.1) + 1) / 2);
    const fx = rnd(1) * canvas.width, fy = rnd(2) * 70 + 10, rad = ((clock * 1.3) % 1.3) / 1.3 * 22;
    ctx.strokeStyle = `hsla(${(seed * 47) % 360},90%,70%,${1 - rad / 22})`; ctx.lineWidth = 1;
    for (let a = 0; a < 8; a++) { const ang = a / 8 * 6.28; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(ang) * rad, fy + Math.sin(ang) * rad); ctx.stroke(); }
  }
}

// ---------- music ----------
// ---- lo-fi chill: a maj7 / m7 progression with soft pads, warm bass & a sparse melody ----
// Cmaj7 → Am7 → Fmaj7 → G7  (semitones from C, played around C3)
const CHORDS = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 5], [-5, -1, 2, 5]];
const MEL = [11, 7, 4, 9, 12, 7]; // gentle maj7-color melody notes
let mBar = 0, mC3 = 130.81;
function softNote(freq, dur, type, vol, when) { // a pad-ish note with slow attack
  if (!actx) return; const t0 = actx.currentTime + (when || 0); const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function playBar() {
  if (!actx || muted) return; const ch = CHORDS[mBar % CHORDS.length];
  ch.forEach((s) => softNote(mC3 * Math.pow(2, s / 12), 2.4, 'sine', 0.02));      // warm pad
  softNote(mC3 / 2 * Math.pow(2, ch[0] / 12), 2.2, 'triangle', 0.03);            // mellow bass
  const m = MEL[mBar % MEL.length];
  softNote(mC3 * 2 * Math.pow(2, m / 12), 0.7, 'triangle', 0.014, 0.55);          // sparse melody
  if (mBar % 2 === 1) softNote(mC3 * 2 * Math.pow(2, (m - 5) / 12), 0.5, 'sine', 0.01, 1.4);
  mBar++;
}
setInterval(() => { if (actx && !muted && state !== 'title') playBar(); }, 2400);
function drawLabels() {
  for (const b of area.buildings) { const img = resolveBuilding(b.art); const cx = sx((b.tx + b.w / 2) * TILE); const topY = sy((b.ty + b.h) * TILE - img.height) - 11; if (cx > -40 && cx < canvas.width + 40 && topY > -12) label(b.name, cx, topY, '#ffe9b0'); }
  for (const n of area.npcs) { const d2 = (n.x - player.x) ** 2 + (n.y - player.y) ** 2; if (d2 < 40 * 40) label(n.name, sx(n.x + 8), sy(n.y) - 12, '#cfe6ff'); }
  // interaction prompt
  const b = nearestBuilding(), n = !b && nearestNPC();
  if ((b || n) && state === 'play') { ctx.font = '8px monospace'; ctx.textAlign = 'center'; const tx = 'SPACE'; const w = ctx.measureText(tx).width + 10; ctx.fillStyle = 'rgba(40,30,50,0.85)'; ctx.fillRect(canvas.width / 2 - w / 2, 18, w, 12); ctx.fillStyle = '#ffe25a'; ctx.textBaseline = 'middle'; ctx.fillText(tx, canvas.width / 2, 24); ctx.textAlign = 'left'; }
  if (!player.mount && state === 'play') { let nm = null, nd = 22 * 22; for (const m of mounts) { if (m.ridden || m.area !== current) continue; const d = (m.x - player.x) ** 2 + (m.y - player.y) ** 2; if (d < nd) { nd = d; nm = m; } } if (nm) label('R ride', nm.x - camX + 8, nm.y - camY - (MOUNT_H[nm.kind] - 16) - 12, '#ffe25a'); }
  if (toastT > 0) { ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(40,30,50,0.85)'; ctx.fillRect(canvas.width / 2 - 70, canvas.height - 16, 140, 12); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(toast, canvas.width / 2, canvas.height - 10); ctx.textAlign = 'left'; }
}

// ---------- side panel ----------
const todIcon = () => (tod < 0.05 || tod >= 0.92) ? '🌙' : tod < 0.45 ? '🌞' : tod < 0.62 ? '🌆' : '🌙';
function updatePanel() {
  if (!$('coins')) return;
  $('coins').textContent = coins; $('eggsN').textContent = eggs; $('cropsN').textContent = cropCount();
  $('ducksN').textContent = ducks.length; $('breedsN').textContent = `${discovered.size}/${BREEDS.length}`;
  if ($('fishN')) { $('fishN').textContent = fishCount(); $('fishDexN').textContent = `${fishDonated.size}/${FISH_ORDER.length}`; }
  $('lvl').textContent = level; $('clock').textContent = todIcon(); $('place').textContent = areaTitle(current);
  $('xpfill').style.width = Math.round(100 * xp / xpForLevel(level)) + '%';
  $('seed').textContent = CROPS[selectedCrop].name + (CROPS[selectedCrop].cost ? ` (${CROPS[selectedCrop].cost}🪙)` : ' (free)');
  const q = QUESTS[questIndex];
  if (q) { $('quest').textContent = q.text; $('questprog').textContent = `${Math.min(statVal(q.stat), q.goal)} / ${q.goal}`; $('questfill').style.width = Math.round(100 * Math.min(1, statVal(q.stat) / q.goal)) + '%'; }
  else { $('quest').textContent = '🎉 All quests done!'; $('questprog').textContent = ''; $('questfill').style.width = '100%'; }
  $('mode').textContent = player.mount ? `🐎 riding the ${MOUNT_NAME[player.mount.kind].toLowerCase()} — R to hop off`
    : walking ? '🦆 walking the flock — F to stop'
    : buildMode ? `BUILD: ${BUILD_TILES[buildIdx]}`
    : (current === 'farm' ? '' : (current.startsWith('int:') ? '🚪 indoors' : '🧭 exploring — build is farm-only'));
}

// ---------- title ----------
function drawTitle(now) {
  ctx.fillStyle = '#27506a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8ed159'; ctx.beginPath(); ctx.moveTo(0, 130); ctx.quadraticCurveTo(canvas.width / 2, 108, canvas.width, 132); ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.fill();
  const by = 92 + Math.sin(now / 350) * 3; ctx.drawImage(art.ducks.classic[(now / 250 | 0) % 2], canvas.width / 2 - 12, by, 28, 28);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fffdf0'; ctx.font = 'bold 20px monospace'; ctx.fillText('DUCK FARM', canvas.width / 2, 46);
  ctx.fillStyle = '#bfe0c8'; ctx.font = '8px monospace'; ctx.fillText("Haley & Nick · 2-player co-op", canvas.width / 2, 60);
  ctx.font = '8px monospace'; if ((now / 600 | 0) % 2 === 0) { ctx.fillStyle = '#dfffd0'; ctx.fillText(hasSave() ? 'SPACE — continue' : 'SPACE — start', canvas.width / 2, 150); }
  ctx.fillStyle = '#9fbecb'; ctx.fillText(hasSave() ? 'N — new game' : 'a cozy world to explore', canvas.width / 2, 166); ctx.textAlign = 'left';
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'title') { drawTitle(now); requestAnimationFrame(loop); return; }
  if (state === 'map') { draw(); drawMap(); requestAnimationFrame(loop); return; }
  if (state === 'play') { clock += dt; tod = (tod + dt / DAY_LEN) % 1; if (toastT > 0) toastT -= dt; if (warpCooldown > 0) warpCooldown -= dt; updatePlayers(dt); updateNPCs(dt); if (current === 'farm') updateDucks(dt); updateMounts(dt); checkQuests(); fitView(dt); }
  if (state === 'fishing') { updateFishing(dt); updateNPCs(dt); }
  draw(); if (state === 'fishing') drawFishing(); updatePanel(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- touch controls ----------
function primaryAction(p) {
  actingPlayer = p;
  if (state === 'title') { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); startGame(hasSave()); return; }
  if (state === 'dialogue') { advanceDialogue(); return; }
  if (state === 'fishing') { hookFish(); return; }
  if (state === 'map') { state = 'play'; return; }
  if (state === 'modal') return;
  if (buildMode && current === 'farm') { placeTileFront(p); return; }   // phone-friendly building
  interact(p);
}
function placeTileFront(p) {
  const [fx, fy] = frontTile(p);
  if (fx > 0 && fy > 0 && fx < area.w - 1 && fy < area.h - 1 && !area.blocked.has(fx + ',' + fy)) {
    area.map[fy][fx] = BUILD_TILES[buildIdx]; if (BUILD_TILES[buildIdx] !== 'dirt') crops.delete(fx + ',' + fy); sfx.plant();
  }
}
// relay input API: a phone (idx 0=Haley, 1=Nick) drives its character
function ctrlInput(idx, type, payload) {
  const p = idx === 0 ? player : player2; if (!p) return;
  if (type === 'move') { const t = idx === 0 ? touchDir.p1 : touchDir.p2; t.u = payload.u ? 1 : 0; t.d = payload.d ? 1 : 0; t.l = payload.l ? 1 : 0; t.r = payload.r ? 1 : 0; }
  else if (type === 'act') primaryAction(p);
  else if (type === 'ride') toggleRide(p);
  else if (type === 'meta') {
    const m = payload;
    if (m === 'seed') cycleSeed();
    else if (m === 'build') { if (current === 'farm') buildMode = !buildMode; else say('build is farm-only'); }
    else if (m === 'tile') { if (buildMode) buildIdx = (buildIdx + 1) % BUILD_TILES.length; }
    else if (m === 'flock') toggleWalk();
    else if (m === 'map') state = state === 'map' ? 'play' : (state === 'play' ? 'map' : state);
    else if (m === 'music') muted = !muted;
  }
}
canvas.addEventListener('pointerdown', (e) => {
  if (state === 'title') { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); startGame(hasSave()); return; }
  if (state === 'dialogue') { advanceDialogue(); return; }
  if (state === 'fishing') { hookFish(); return; }
  if (state === 'map') { state = 'play'; return; }
  if (buildMode && current === 'farm') paintAt(e);
});
function setupTouch() {
  const root = document.createElement('div'); root.id = 'touch';
  const mk = (label, cls, down, up) => {
    const b = document.createElement('div'); b.className = 'tcbtn ' + (cls || ''); b.textContent = label;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); down && down(); });
    const u = (e) => { e.preventDefault(); up && up(); };
    b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u);
    return b;
  };
  const sp = () => { const s = document.createElement('div'); s.className = 'sp'; return s; };
  const dpad = (pp) => { const g = document.createElement('div'); g.className = 'dpad';
    const d = (lab, key) => mk(lab, '', () => pp[key] = 1, () => pp[key] = 0);
    g.append(sp(), d('▲', 'u'), sp(), d('◀', 'l'), sp(), d('▶', 'r'), sp(), d('▼', 'd'), sp()); return g; };
  const labeled = (cls, name, node) => { const w = document.createElement('div'); w.className = 'stack'; const l = document.createElement('div'); l.className = 'lbl ' + cls; l.textContent = name; w.append(l, node); return w; };

  const meta = document.createElement('div'); meta.className = 'meta';
  meta.append(
    mk('🌱', 'meta', () => cycleSeed()),
    mk('🔨', 'meta', () => { if (current === 'farm') buildMode = !buildMode; else say('build is farm-only'); }),
    mk('▦', 'meta', () => { if (buildMode) buildIdx = (buildIdx + 1) % BUILD_TILES.length; }),
    mk('🦆', 'meta', () => toggleWalk()),
    mk('🗺️', 'meta', () => { state = state === 'map' ? 'play' : (state === 'play' ? 'map' : state); }),
    mk('🔊', 'meta', () => { muted = !muted; say(muted ? '🔇 music off' : '🔊 music on'); }),
  );

  const row = document.createElement('div'); row.className = 'row';
  const left = document.createElement('div'); left.className = 'side';
  const lActs = document.createElement('div'); lActs.className = 'acts'; lActs.append(mk('🐎', 'sm', () => toggleRide(player)), mk('A', 'big', () => primaryAction(player)));
  left.append(labeled('h', 'Haley', dpad(touchDir.p1)), lActs);
  const right = document.createElement('div'); right.className = 'side';
  const rActs = document.createElement('div'); rActs.className = 'acts'; rActs.append(mk('🐎', 'sm', () => toggleRide(player2)), mk('A', 'big', () => primaryAction(player2)));
  right.append(rActs, labeled('n', 'Nick', dpad(touchDir.p2)));
  row.append(left, right);
  root.append(meta, row); document.body.appendChild(root);
}
setupTouch();

// debug
window.__DF = {
  get s() { return { state, current, coins, eggs, inv, level, xp, ducks, mounts, walking, crops, groundEggs, discovered, stats, questIndex, selectedCrop, player, player2, clock, tod, area, fishInv, fishSeen, fishDonated, fishing }; },
  startGame, freshState, interact, openModal, closeModal, openDialogue, warpTo, cycleSeed, addXP, checkQuests, BUILDING_ACTIONS,
  spawnMount, spawnDuck, toggleRide, toggleWalk, startFishing, hookFish, touchDir,
  ctrl: ctrlInput, primaryAction, hasSave, dfMenu, snapshot: controllerSnapshot, get state() { return state; },
  setCoins: (v) => { coins = v; }, setEggs: (v) => { eggs = v; }, setInv: (o) => { inv = o; }, setLevel: (v) => { level = v; },
  set tod(v) { tod = v; }, get tod() { return tod; }, set clock(v) { clock = v; }, get clock() { return clock; },
};
