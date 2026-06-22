/*
 * Poltergeist balance simulator
 * ------------------------------
 * Headless model of the hunt with simple AI on both sides, used to find how map
 * size + furniture should scale with player count for an even (~50%) game.
 *
 * It mirrors the real mechanics: inset hunter stations, count-scaled torch reach,
 * cone width, furniture occlusion, exposure gain/decay, footprint trails (the only
 * thing hunters can track), flashes, and scares. AIs are "competent but not perfect":
 *   - Hunters slew their beam toward the freshest footprint of the nearest ghost and
 *     flash when a ghost is in the cone.
 *   - Ghosts flee lit/threatened spots toward the darkest direction, hide behind
 *     furniture, hold still in safe dark to stop leaving prints, and scare when pinned.
 *
 * Absolute win-rates are a model estimate; the *trends* (more hunters → ghost dies more,
 * bigger map / more furniture → ghost survives more) are what we calibrate on.
 */
'use strict';

// ---- mechanics (mirrors poltergeist.html) ----
const GHOST_SPEED = 410, ROUND_SECONDS = 80, HALF = 0.40, DECAY = 20;
const CAUGHT = 100, GHOST_R = 15, STATION_INSET = 0.66;
const FLASH_CD = 3.0, FLASH_DUR = 0.45, FLASH_BURST = 22, FLASH_REACH = 1.15;
const SCARE_CD = 9.0, SCARE_RADIUS = 560, STUN_DUR = 1.6;
const FOOT_INTERVAL = 0.4, FOOT_LIFE = 2.2;
const reachFor = (n) => Math.max(690, Math.min(1050, 1050 - (n - 1) * 58));
const GHOST_AT = +(process.env.GHOST_AT || 6);     // players needed for a 2nd ghost
const TRIPLE_AT = +(process.env.TRIPLE_AT || 99);  // players needed for a 3rd ghost
const numGhostsFor = (P) => Math.max(1, Math.min(P >= TRIPLE_AT ? 3 : P >= GHOST_AT ? 2 : 1, P - 1));

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
function angDiff(a, b) { let d = Math.abs(a - b) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d; return d; }
function rnd(a, b) { return a + Math.random() * (b - a); }

function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(d) < 1e-9) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
function segHitsRect(x1, y1, x2, y2, r) {
  if (x2 > r.x && x2 < r.x + r.w && y2 > r.y && y2 < r.y + r.h) return true;
  return segSeg(x1, y1, x2, y2, r.x, r.y, r.x + r.w, r.y) ||
         segSeg(x1, y1, x2, y2, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
         segSeg(x1, y1, x2, y2, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
         segSeg(x1, y1, x2, y2, r.x, r.y + r.h, r.x, r.y);
}

function makeArena(scale) {
  // base play area inside a 1920x1080 screen; scale grows the *world* (zoom-to-fit on the TV)
  const w = 1804 * scale, h = 926 * scale;
  return { x0: 0, y0: 0, x1: w, y1: h, w, h, cx: w / 2, cy: h / 2 };
}
function stationFor(i, n, A) {
  const rx = A.w / 2 * STATION_INSET, ry = A.h / 2 * STATION_INSET;
  const ang = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
  return { x: A.cx + Math.cos(ang) * rx, y: A.cy + Math.sin(ang) * ry };
}
function genFurniture(A, stations, spawns, want) {
  const T = [
    [0.15,0.18,250,64],[0.50,0.12,72,210],[0.85,0.20,230,64],[0.27,0.40,64,230],[0.73,0.40,230,64],
    [0.50,0.50,170,120],[0.15,0.66,64,250],[0.85,0.68,64,250],[0.50,0.88,250,64],[0.32,0.74,150,64],
    [0.68,0.74,150,64],[0.37,0.27,120,120],[0.63,0.27,120,120],[0.50,0.66,92,92],[0.23,0.88,150,60],[0.77,0.88,150,60],
  ];
  const order = T.slice().sort(() => Math.random() - 0.5);
  const F = [];
  const hitsPts = (r, arr, gap) => arr.some(s => s.x > r.x - gap && s.x < r.x + r.w + gap && s.y > r.y - gap && s.y < r.y + r.h + gap);
  for (const t of order) {
    if (F.length >= want) break;
    const w = t[2] * rnd(0.85, 1.2), h = t[3] * rnd(0.85, 1.2);
    let x = A.x0 + A.w * t[0] - w / 2 + rnd(-46, 46), y = A.y0 + A.h * t[1] - h / 2 + rnd(-46, 46);
    x = clamp(x, A.x0 + 14, A.x1 - 14 - w); y = clamp(y, A.y0 + 14, A.y1 - 14 - h);
    const r = { x, y, w, h };
    if (hitsPts(r, spawns, 84)) continue;
    if (hitsPts(r, stations, 48)) continue;
    if (F.some(f => !(r.x > f.x + f.w + 22 || r.x + r.w < f.x - 22 || r.y > f.y + f.h + 22 || r.y + r.h < f.y - 22))) continue;
    F.push(r);
  }
  return F;
}
function inFurn(F, x, y, pad) { for (const f of F) if (x > f.x - pad && x < f.x + f.w + pad && y > f.y - pad && y < f.y + f.h + pad) return true; return false; }

function lit(h, F, gx, gy) {
  if (h.stun > 0) return false;
  const reach = h.flashT > 0 ? h.reach * FLASH_REACH : h.reach;
  const dx = gx - h.x, dy = gy - h.y, dist = Math.hypot(dx, dy);
  if (dist > reach) return false;
  if (angDiff(Math.atan2(dy, dx), h.aim) > HALF) return false;
  for (const f of F) if (segHitsRect(h.x, h.y, gx, gy, f)) return false;
  return true;
}

// One round; returns fraction of ghosts that survived to the timer.
function simRound(P, scale, furnCount) {
  const A = makeArena(scale);
  const nG = numGhostsFor(P), nH = P - nG;
  const reach = reachFor(nH);
  const stations = []; for (let i = 0; i < nH; i++) stations.push(stationFor(i, nH, A));
  const spawns = nG === 1 ? [{ x: A.cx, y: A.cy }]
    : [{ x: A.x0 + A.w * 0.26, y: A.cy }, { x: A.x0 + A.w * 0.74, y: A.cy }];
  const F = genFurniture(A, stations, spawns, furnCount);
  const hunters = stations.map(s => ({ x: s.x, y: s.y, aim: Math.atan2(A.cy - s.y, A.cx - s.x), reach, flashCd: 0, flashT: 0, stun: 0 }));
  const ghosts = spawns.slice(0, nG).map(s => {
    let x = s.x, y = s.y; if (inFurn(F, x, y, GHOST_R)) { y -= 120; if (inFurn(F, x, y, GHOST_R)) y += 240; }
    return { x, y, exposure: 0, scareCd: 0, footT: 0, caught: false, foot: null };
  });

  const dt = 1 / 15;
  const AIM_SLEW = 2.6;                 // hunter beam turn rate (rad/s) — human-ish
  for (let t = 0; t < ROUND_SECONDS; t += dt) {
    // hunter cooldowns
    for (const h of hunters) { h.flashCd = Math.max(0, h.flashCd - dt); h.flashT = Math.max(0, h.flashT - dt); h.stun = Math.max(0, h.stun - dt); }
    // ghosts
    for (const g of ghosts) {
      if (g.caught) continue;
      g.scareCd = Math.max(0, g.scareCd - dt);
      // assess threat
      let litNow = 0; for (const h of hunters) if (lit(h, F, g.x, g.y)) litNow++;
      // candidate flee dirs
      let bestDir = null, bestScore = Infinity, threatened = false;
      for (const h of hunters) { if (h.stun > 0) continue; const d = Math.hypot(g.x - h.x, g.y - h.y);
        if (d < h.reach && angDiff(Math.atan2(g.y - h.y, g.x - h.x), h.aim) < HALF * 1.8) threatened = true; }
      if (litNow > 0 || threatened) {
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * Math.PI * 2;
          const lx = g.x + Math.cos(ang) * 90, ly = g.y + Math.sin(ang) * 90;
          if (lx < A.x0 + GHOST_R || lx > A.x1 - GHOST_R || ly < A.y0 + GHOST_R || ly > A.y1 - GHOST_R) continue;
          if (inFurn(F, lx, ly, GHOST_R)) continue;
          let sc = 0;
          for (const h of hunters) {
            if (h.stun > 0) continue;
            if (lit(h, F, lx, ly)) sc += 100;
            const d = Math.hypot(lx - h.x, ly - h.y);
            if (d < h.reach) { const e = angDiff(Math.atan2(ly - h.y, lx - h.x), h.aim); sc += Math.max(0, (1 - e / (HALF * 2)) * (1 - d / h.reach)) * 40; }
          }
          if (sc < bestScore) { bestScore = sc; bestDir = ang; }
        }
        if (bestDir != null) { g.x += Math.cos(bestDir) * GHOST_SPEED * dt; g.y += Math.sin(bestDir) * GHOST_SPEED * dt; g.moving = true; }
        // scare when pinned
        if (litNow >= 2 && g.scareCd <= 0) { g.scareCd = SCARE_CD; for (const h of hunters) if (Math.hypot(h.x - g.x, h.y - g.y) < SCARE_RADIUS) h.stun = STUN_DUR; }
      } else {
        // safe: edge deeper into dark a little, else hold still (stop leaving prints)
        let nearest = null, nd = Infinity; for (const h of hunters) { const d = Math.hypot(g.x - h.x, g.y - h.y); if (d < nd) { nd = d; nearest = h; } }
        if (nearest && nd < nearest.reach * 0.8) {
          const ang = Math.atan2(g.y - nearest.y, g.x - nearest.x);
          const lx = g.x + Math.cos(ang) * 60, ly = g.y + Math.sin(ang) * 60;
          if (lx > A.x0 + GHOST_R && lx < A.x1 - GHOST_R && ly > A.y0 + GHOST_R && ly < A.y1 - GHOST_R && !inFurn(F, lx, ly, GHOST_R)) {
            g.x = lx; g.y = ly; g.moving = true;
          } else g.moving = false;
        } else g.moving = false;
      }
      g.x = clamp(g.x, A.x0 + GHOST_R, A.x1 - GHOST_R); g.y = clamp(g.y, A.y0 + GHOST_R, A.y1 - GHOST_R);
      // footprints
      g.footT -= dt;
      if (g.footT <= 0 && g.moving) { g.footT = FOOT_INTERVAL; g.foot = { x: g.x, y: g.y, age: 0 }; }
      if (g.foot) { g.foot.age += dt; if (g.foot.age > FOOT_LIFE) g.foot = null; }
      // exposure
      let lc = 0; for (const h of hunters) if (lit(h, F, g.x, g.y)) lc++;
      if (lc > 0) g.exposure = Math.min(CAUGHT, g.exposure + dt * (20 + 12 * lc));
      else g.exposure = Math.max(0, g.exposure - dt * DECAY);
      if (g.exposure >= CAUGHT) g.caught = true;
    }
    // hunters: track freshest footprint of nearest live ghost; flash when a ghost is in cone
    for (const h of hunters) {
      if (h.stun > 0) continue;
      let target = null, td = Infinity;
      for (const g of ghosts) {
        if (g.caught) continue;
        const aim = g.foot ? g.foot : null;       // hunters only know footprints
        if (aim) { const d = Math.hypot(aim.x - h.x, aim.y - h.y); if (d < td) { td = d; target = aim; } }
      }
      if (target) {
        const want = Math.atan2(target.y - h.y, target.x - h.x);
        let dd = ((want - h.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        h.aim += clamp(dd, -AIM_SLEW * dt, AIM_SLEW * dt);
      } else {
        h.aim += Math.sin(t * 0.9 + h.x) * AIM_SLEW * dt * 0.5;   // idle sweep
      }
      // flash if a ghost is in the cone
      if (h.flashCd <= 0) for (const g of ghosts) { if (!g.caught && lit(h, F, g.x, g.y)) { h.flashCd = FLASH_CD; h.flashT = FLASH_DUR; g.exposure = Math.min(CAUGHT, g.exposure + FLASH_BURST); if (g.exposure >= CAUGHT) g.caught = true; break; } }
    }
    if (ghosts.every(g => g.caught)) break;
  }
  const survived = ghosts.filter(g => !g.caught).length;
  return survived / ghosts.length;
}

// fraction of the arena that no torch can ever reach (raw dark space, furniture aside)
function darkFraction(P, scale) {
  const A = makeArena(scale), nG = numGhostsFor(P), nH = P - nG, reach = reachFor(nH);
  const stations = []; for (let i = 0; i < nH; i++) stations.push(stationFor(i, nH, A));
  let dark = 0, total = 0;
  for (let gx = 0; gx < 40; gx++) for (let gy = 0; gy < 24; gy++) {
    const x = A.x0 + (gx + 0.5) / 40 * A.w, y = A.y0 + (gy + 0.5) / 24 * A.h; total++;
    if (!stations.some(s => Math.hypot(x - s.x, y - s.y) <= reach)) dark++;
  }
  return dark / total;
}

function survRate(P, scale, furn, trials) { let s = 0; for (let i = 0; i < trials; i++) s += simRound(P, scale, furn); return s / trials; }

// ---- schedule test: verify a proposed scale(P)+furn(P) curve ----
if (process.env.SCHED) {
  // FINAL: scale room + cover by hunter count (grows with players, capped for the TV)
  const nHof = (P) => P - numGhostsFor(P);
  const scaleFn = (P) => clamp(0.96 + 0.05 * (nHof(P) - 1), 0.96, 1.22);
  const furnFn  = (P) => clamp(Math.round(6 + 1.5 * (nHof(P) - 1)), 6, 16);
  const TR = +process.argv[2] || 200;
  console.log(`Schedule test — ${TR} trials. scale=0.95..1.45, furn=7..15\n`);
  console.log('P  scale  furn  world(WxH)        nH nG  survival%');
  for (let P = 2; P <= 8; P++) {
    const s = scaleFn(P), f = furnFn(P), nG = numGhostsFor(P), nH = P - nG;
    const r = Math.round(survRate(P, s, f, TR) * 100);
    console.log(`${P}   ${s.toFixed(2)}   ${String(f).padStart(2)}   ${String(Math.round(1804*s)).padStart(4)}x${String(Math.round(926*s)).padStart(4)}        ${nH} ${nG}    ${r}`);
  }
  process.exit(0);
}

// ---- sweep ----
const TRIALS = +process.argv[2] || 60;
const FURN = [4, 6, 8, 10, 12, 14, 16];
const SCALES = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
console.log(`Poltergeist balance sweep — ${TRIALS} trials/cell. GHOST_AT=${GHOST_AT} TRIPLE_AT=${TRIPLE_AT}`);
console.log(`Cell = ghost survival % (target ~50 for an even game).\n`);
const best = {};   // P -> {scale, furn, rate, dist}
for (const scale of SCALES) {
  console.log(`=== map scale ${scale.toFixed(1)} (world ${Math.round(1804*scale)}x${Math.round(926*scale)}) ===`);
  console.log('P\\furn ' + FURN.map(f => String(f).padStart(5)).join('') + '   nH nG');
  for (let P = 2; P <= 8; P++) {
    const nG = numGhostsFor(P), nH = P - nG;
    const rates = FURN.map(f => survRate(P, scale, f, TRIALS));
    const row = rates.map(r => String(Math.round(r * 100)).padStart(5)).join('');
    rates.forEach((r, i) => { const d = Math.abs(r - 0.5); if (!best[P] || d < best[P].dist) best[P] = { scale, furn: FURN[i], rate: r, dist: d }; });
    console.log(`  ${P}   ${row}   ${String(nH).padStart(2)} ${nG}`);
  }
  console.log('');
}
console.log('=== closest-to-even config per player count ===');
console.log('P   bestScale  bestFurn  survival%');
for (let P = 2; P <= 8; P++) { const b = best[P]; console.log(`${P}      ${b.scale.toFixed(1)}        ${String(b.furn).padStart(2)}        ${Math.round(b.rate*100)}`); }
