// Builds "Fig. 1 — Anatomia de uma requisição" into the site.
//   node tools/figure/build.mjs
// Writes css/anatomy.css, js/request-figure.js and the figure markup
// between <!-- fig:start --> and <!-- fig:end --> in index.html.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

// ───────────────────────── world ─────────────────────────
const W = 760;
const PLATE = { x: -214, y: -94, w: 432, d: 148, r: 9 };
const PLATE_H = 9, FOOT_H = 5;

const TOK = { r: 6.2, h: 2.4 };
const GUIDE = { off: 8, half: 0.7, h: 2.8 };
const LANE = { P: -13, G: 13, LOOP: -21 };
const X = {
  start: -206, hopper: -186, sIn: -172, sOut: -140, gate: -100, tray: -128,
  wheel: -46, mIn: -16, mOut: 16, cache: 36, lIn: 58, lOut: 90, rIn: 124, rOut: 156, printer: 158, end: 180,
  db: 97,
};
const HOP = { x: X.hopper, y: 0, half: 11, z0: 30, z1: 37, wall: 1.3, post: 12.5 };
const GATE = { x: X.gate, posts: [-24, 0], postHalf: 2.2, top: 28, beam: 34, leaf: 13, lift: 13.5 };
const GEAR_Z = 25.6;
const BOX = { x: -80, y: -72, w: 66, d: 42, r: 3 };
const SHELF = { x: 20, y: -40, w: 32, d: 25, r: 2 };
const CAB = { x: 84, y: -90, w: 48, d: 46, r: 2 };
const PRN = { x: X.printer, y: -24, w: 46, d: 48, r: 4 };
const TRAY = { x: -138, y: 29, w: 20, d: 17, r: 3 };

const FIT = [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CAB.x, CAB.y, 56], [HOP.x - 12, -12, 46], [PRN.x + PRN.w, PRN.y, 34]];
const H = (() => { const p0 = k.fitProjection(FIT, W, 1000, { pad: 16, azimuth: 55 }); const ys = FIT.map((q) => k.iso(q, p0)[1]); return Math.ceil(Math.max(...ys) - Math.min(...ys) + 32 + 8); })();
const P = k.fitProjection(FIT, W, H, { pad: 16, azimuth: 55 });
const V = [Math.cos(55 * Math.PI / 180) * Math.cos(Math.PI / 6), Math.sin(55 * Math.PI / 180) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
const depth = (p) => k.depthOf(p, P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const box = (x0, y0, x1, y1, r = 0.6) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });
const byDepth = (pts) => [...pts].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));

// A solid whose paths the page rewrites every frame: all four shade paths always exist.
function liveSolid(part, paths, { tone = "hi", lit = false, crease = "faint" } = {}) {
  const shades = [0, 1, 2, 3].map((i) => `<path class="iso-shade" data-shade="${i}" d="${paths.shades[i] || ""}"/>`).join("");
  return `<g class="iso-solid" data-part="${part}"${lit ? " data-lit" : ""}><path class="iso-fill" d="${paths.fill}"/>${shades}<path class="iso-top" d="${paths.top}"/><path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/><path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/></g>`;
}

// ───────────────────────── track network ─────────────────────────
const ease = (t) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;
const sCurve = (x, x0, x1, y0, y1) => y0 + (y1 - y0) * ease((x - x0) / (x1 - x0));
const laneY = (lane) => (x) => (x < X.sOut ? sCurve(x, X.sIn, X.sOut, 0, LANE[lane]) : sCurve(x, X.mIn, X.mOut, LANE[lane], 0));
const loopY = (x) => (x < X.rIn ? sCurve(x, X.lIn, X.lOut, 0, LANE.LOOP) : sCurve(x, X.rIn, X.rOut, LANE.LOOP, 0));
const sample = (fn, x0, x1, step = 1) => { const out = []; for (let x = x0; x <= x1 + 1e-6; x += step) out.push([x, fn(x)]); return out; };

const TRACKS = {
  entry: sample(() => 0, X.start, X.sIn),
  P: sample(laneY("P"), X.sIn, X.mOut),
  G: sample(laneY("G"), X.sIn, X.mOut),
  main: sample(() => 0, X.mOut, X.printer),
  loop: sample(loopY, X.lIn, X.rOut),
};
const distTo = (pts, [x, y]) => { let best = 1e9; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };
const normalAt = (pts, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
// Openings in the guides: the gate leaves, the trip wheels, the tray chute.
const GAPS = [
  { x0: X.gate - 3, x1: X.gate + 3 },
  { x0: X.wheel - 9, x1: X.wheel + 9, side: { P: -1, G: 1 } },
  { x0: X.tray - 8.5, x1: X.tray + 8.5, side: { G: 1 } },
];
function guideRuns() {
  const runs = [];
  for (const [name, pts] of Object.entries(TRACKS)) {
    for (const side of [-1, 1]) {
      let run = [];
      const flush = () => { if (run.length > 1) runs.push({ name, side, pts: run }); run = []; };
      pts.forEach((p, i) => {
        const n = normalAt(pts, i);
        const q = [p[0] + n[0] * GUIDE.off * side, p[1] + n[1] * GUIDE.off * side];
        const inside = Object.entries(TRACKS).some(([other, op]) => other !== name && distTo(op, q) < GUIDE.off - GUIDE.half - 0.15);
        const gapped = GAPS.some((g) => q[0] > g.x0 && q[0] < g.x1 && (!g.side || g.side[name] === side));
        const stop = name === "main" && q[0] > X.printer - 0.5;
        if (inside || gapped || stop) flush(); else run.push(q);
      });
      flush();
    }
  }
  return runs;
}
function ribbon(pts) {
  const left = [], right = [];
  pts.forEach((p, i) => { const n = normalAt(pts, i); left.push([p[0] + n[0] * GUIDE.half, p[1] + n[1] * GUIDE.half]); right.push([p[0] - n[0] * GUIDE.half, p[1] - n[1] * GUIDE.half]); });
  return [...left, ...right.reverse()];
}

// ───────────────────────── request paths ─────────────────────────
// Every request is a polyline the token follows, with the arc length of each of the seven stages.
function pathOf(kind) {
  const pts = [[X.hopper, 0, 46], [X.hopper, 0, 0]];
  const lane = kind === "post" ? "P" : "G";
  const fn = laneY(lane);
  const stages = [];
  const push = (x, y, z = 0) => pts.push([x, y, z]);
  for (let x = X.hopper + 1; x <= X.gate - 10; x += 1) push(x, x < X.sIn ? 0 : fn(x));
  if (kind === "deny") {
    for (let x = X.gate - 11; x >= X.tray; x -= 1) push(x, fn(x));
    for (let y = LANE.G + 1; y <= TRAY.y + 9; y += 1) push(X.tray, y);
    return finish(pts, [[X.hopper, 0, 0], [-128, LANE[lane]], [X.gate - 10, LANE[lane]], [X.tray, TRAY.y + 9]]);
  }
  for (let x = X.gate - 9; x <= X.mOut; x += 1) push(x, fn(x));
  const viaLoop = kind !== "hit";
  for (let x = X.mOut + 1; x <= X.end; x += 1) push(x, viaLoop && x >= X.lIn && x <= X.rOut ? loopY(x) : 0);
  return finish(pts, [[X.hopper, 0, 0], [-128, LANE[lane]], [X.gate - 10, LANE[lane]], [X.wheel, LANE[lane]], [X.cache, 0], [X.db, viaLoop ? LANE.LOOP : 0], [X.end, 0]]);
}
function finish(pts, marks) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const stage = marks.map(([mx, my]) => { let best = 0, d = 1e9; pts.forEach((p, i) => { const e = Math.hypot(p[0] - mx, p[1] - my) + p[2]; if (e < d - 1e-9) { d = e; best = i; } }); return Math.round(s[best] * 10) / 10; });
  return { pts: pts.map((p) => p.map((v) => Math.round(v * 100) / 100)), s: s.map((v) => Math.round(v * 100) / 100), stage };
}
const PATHS = { hit: pathOf("hit"), miss: pathOf("miss"), post: pathOf("post"), deny: pathOf("deny") };

// ───────────────────────── layers ─────────────────────────
const base = [];   // always under the token
const sorted = []; // drawn before or after the token by a rule
const front = [];  // always over the token
let order = 0;
const add = (list, key, svg) => list.push({ key: key + order++ * 1e-6, svg });
const addSort = (rule, value, key, svg) => sorted.push({ key: key + order++ * 1e-6, svg, rule, value });

// ── base plate on feet
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 22), [PLATE.x + PLATE.w / 2, PLATE.y + 22], [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d - 22]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: -100, y: PLATE.y + PLATE.d - 15, w: 250, d: 7, r: 1 };
  out.push(S(slab(strip, 0, 0.6, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 4, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.5, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2.5, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // label plate, front left, with the one engraved label
  const tag = { x: -204, y: 26, w: 52, d: 18, r: 1.5 };
  out.push(S(slab(tag, 0, 0.9, 4), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(tag, 1.6), 0.9, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + 5, tag.y + 8], 0.9, P, "x"), "HTTP/1.1", { size: 4.2, tone: "mid" }));
  out.push(L([[16, 22], [16, 32], [16, 26]].map(([dx, len], i) => k.lineOnTop([tag.x + 5, tag.y + 11 + i * 2.2], [tag.x + 5 + (i === 1 ? 30 : 22), tag.y + 11 + i * 2.2], 0.9, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([tag.x + 2.6, tag.y + 3, 0.9]), at([tag.x + tag.w - 2.6, tag.y + 3, 0.9])], { size: 0.45 }));
  return out.join("");
}
add(base, -1e6, plate());

// ── sub-plates under the stations, with screws
for (const plan of [box(-86, -78, -8, -24, 2), box(14, -46, 58, -12, 2), box(78, -96, 138, -36, 2), box(-112, -44, -88, -30, 1.5)]) {
  add(base, -9e5, S(slab(plan, 0, 1.2, 3, 0.4), { tone: "lo" }) + D(k.corners(plan, 2.4).map(([x, y]) => at([x, y, 1.2])), { size: 0.42 }));
}

// ── track guides
const runs = guideRuns();
function simplify(pts, tol = 0.06) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let worst = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = distTo([a, b], pts[i]); if (d > worst) { worst = d; at = i; } }
  return worst < tol ? [a, b] : [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}
for (const run of runs) {
  const keep = simplify(run.pts);
  // straight stretches become chunks of at most 14 units; curves keep their points
  const pts = [];
  keep.forEach((p, i) => { if (i) { const q = keep[i - 1], n = Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 14); for (let j = 1; j < n; j++) pts.push([q[0] + (p[0] - q[0]) * j / n, q[1] + (p[1] - q[1]) * j / n]); } pts.push(p); });
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1, len = 0;
    while (j < pts.length - 1 && len + Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]) + Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) <= 14.5) { len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); j++; }
    const piece = pts.slice(i, j + 1);
    i = j;
    const mid = [(piece[0][0] + piece[piece.length - 1][0]) / 2, (piece[0][1] + piece[piece.length - 1][1]) / 2];
    const svg = S(k.extrude(ribbon(piece), 0, GUIDE.h, P, { convex: piece.length <= 3 }), { tone: "mid", crease: "faint" });
    addSort("y", mid[1], depth([mid[0], mid[1], 1]), svg);
  }
  // screws along the guide tops every 24 units
  const dots = run.pts.filter((_, i) => i % 24 === 12).map(([x, y]) => at([x, y, GUIDE.h]));
  run.dots = dots;
}

// ── inlet hopper on four posts
{
  const { x, y, half, z0, z1, wall, post } = HOP;
  const postAt = (px, py, list, rule) => {
    const svg = S(k.cylinder(px, py, 1.5, 0, z0, P, 16), { tone: "mid", crease: "none" }) + S(k.cylinder(px, py, 2.4, 0, 1.2, P, 18), { tone: "lo" });
    list === "base" ? add(base, depth([px, py, 10]), svg) : add(front, depth([px, py, 10]), svg);
  };
  postAt(x - post, y - post, "base"); postAt(x + post, y - post, "base");
  const walls = {
    back: box(x - half, y - half, x + half, y - half + wall, 0.3),
    left: box(x - half, y - half, x - half + wall, y + half, 0.3),
    right: box(x + half - wall, y - half, x + half, y + half, 0.3),
    near: box(x - half, y + half - wall, x + half, y + half, 0.3),
  };
  add(base, depth([x, y - half, z0]), S(slab(walls.back, z0, z1 - z0, 2), { tone: "mid" }));
  add(base, depth([x - half, y, z0]), S(slab(walls.left, z0, z1 - z0, 2), { tone: "mid" }));
  // the throat seen from above: a dark square inside the collar
  add(base, depth([x, y - half, z0]) + 0.1, `<path class="rq-void" d="${k.onTop([[x - half + wall, y - half + wall], [x + half - wall, y - half + wall], [x + half - wall, y + half - wall], [x - half + wall, y + half - wall]], z0 + 0.4, P, true)}"/>`);
  add(front, depth([x + half, y, z0]), S(slab(walls.right, z0, z1 - z0, 2), { tone: "mid" }));
  add(front, depth([x, y + half, z0]), S(slab(walls.near, z0, z1 - z0, 2), { tone: "mid" }) + L(k.sideSeam(walls.near, z0 + 3.5, P, 2), { tone: "faint" }));
  // lip ring screws on the collar top
  add(front, depth([x, y + half, z1]) + 0.1, D([[x - half + 0.65, y + half - 0.65], [x + half - 0.65, y + half - 0.65], [x + half - 0.65, y - half + 0.65]].map(([a, b]) => at([a, b, z1])), { size: 0.42 }));
  postAt(x - post, y + post, "front"); postAt(x + post, y + post, "front");
  // cross ties under the collar
  add(base, depth([x, y - post, z0 - 2]), S(slab(box(x - post, y - post - 0.8, x + post, y - post + 0.8, 0.3), z0 - 2.4, 1.6, 2), { tone: "mid" }));
  add(front, depth([x, y + post, z0 - 2]), S(slab(box(x - post, y + post - 0.8, x + post, y + post + 0.8, 0.3), z0 - 2.4, 1.6, 2), { tone: "mid" }));
}

// ── router: a switch tongue on a rotary solenoid at the frog
const frogX = (() => { for (let x = X.sIn; x < X.sOut; x += 0.25) if (laneY("G")(x) - laneY("P")(x) >= 2 * GUIDE.off - 0.6) return x; return X.sOut; })();
const ROUTER = { pivot: [frogX, 0], tip: frogX - 21, reach: GUIDE.off - GUIDE.half - 1.1 };
function bladeRing(pivot, tipX, tipY, half) {
  const dx = tipX - pivot[0], dy = tipY - pivot[1], l = Math.hypot(dx, dy), nx = -dy / l * half, ny = dx / l * half;
  return [[pivot[0] + nx, pivot[1] + ny], [tipX + nx * 0.4, tipY + ny * 0.4], [tipX - nx * 0.4, tipY - ny * 0.4], [pivot[0] - nx, pivot[1] - ny]];
}
const BLADE_H = 2.2;
addSort("blade", 0, depth([ROUTER.pivot[0] - 10, 0, 1]), liveSolid("router-blade", k.extrude(bladeRing(ROUTER.pivot, ROUTER.tip, -ROUTER.reach, 1), 0, BLADE_H, P), { tone: "hi" }));
addSort("pt", 0, depth([ROUTER.pivot[0], 0, 4]),
  S(k.cylinder(ROUTER.pivot[0], 0, 2.6, 0, 3.4, P, 22, 0.4), { tone: "mid" }) + L(k.ring(ROUTER.pivot[0], 0, 1.2, 3.4, P, 14), { tone: "lo" }) + D([at([ROUTER.pivot[0], 0, 3.4])], { size: 0.45, tone: "hi" }));

// ── cache switch: the same tongue where the loop leaves the main line
const loopFrogX = (() => { for (let x = X.lIn; x < X.lOut; x += 0.25) if (-loopY(x) >= 2 * GUIDE.off - 0.6) return x; return X.lOut; })();
const SWITCH = { pivot: [loopFrogX, LANE.LOOP / 2 + (0 - loopY(loopFrogX) + LANE.LOOP) / 2 * 0], tip: loopFrogX - 21, reach: GUIDE.off - GUIDE.half - 1.1 };
SWITCH.pivot = [loopFrogX, loopY(loopFrogX) / 2];
addSort("switch", 0, depth([SWITCH.pivot[0] - 10, SWITCH.pivot[1], 1]), liveSolid("cache-blade", k.extrude(bladeRing(SWITCH.pivot, SWITCH.tip, ROUTER.reach, 1), 0, BLADE_H, P), { tone: "hi" }));
addSort("pt", SWITCH.pivot[1], depth([SWITCH.pivot[0], SWITCH.pivot[1], 4]),
  S(k.cylinder(SWITCH.pivot[0], SWITCH.pivot[1], 2.6, 0, 3.4, P, 22, 0.4), { tone: "mid" }) + L(k.ring(SWITCH.pivot[0], SWITCH.pivot[1], 1.2, 3.4, P, 14), { tone: "lo" }) + D([at([SWITCH.pivot[0], SWITCH.pivot[1], 3.4])], { size: 0.45, tone: "hi" }));

// ── gate with a pin-tumbler beam, one leaf per lane
const PIN_Y = { P: [-19, -16, -13, -10, -7].map((v) => v), G: [7, 10, 13, 16, 19] };
const PIN_REST = [3.2, 1.4, 4.0, 2.1, 3.6];
const PIN_OPEN = 2.6;
{
  const gx = GATE.x;
  GATE.posts.forEach((py) => {
    const plan = box(gx - GATE.postHalf, py - GATE.postHalf, gx + GATE.postHalf, py + GATE.postHalf, 0.5);
    const foot = box(gx - 4, py - 4, gx + 4, py + 4, 1);
    const svg = S(slab(foot, 0, 1.6, 3, 0.4), { tone: "lo" }) + D(k.corners(foot, 1.3).map(([a, b]) => at([a, b, 1.6])), { size: 0.38 })
      + S(slab(plan, 1.6, GATE.top - 1.6, 2, 0.3), { tone: "mid", inner: L(k.sideSeam(plan, 15, P, 2), { tone: "faint" }) });
    if (py < -1) add(base, depth([gx, py, 10]), svg); else if (py > 1) add(front, depth([gx, py, 10]), svg);
    else addSort("pt", py, depth([gx, py, 10]), svg);
  });
  // beam and pin holes
  const beam = box(gx - 4.5, -27, gx + 4.5, 27, 1.2);
  let beamSvg = S(slab(beam, GATE.top, GATE.beam - GATE.top, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(beam, GATE.top + 2, P, 4), { tone: "faint" }) });
  beamSvg += L([...PIN_Y.P, ...PIN_Y.G].map((py) => k.ring(gx, py, 1.25, GATE.beam, P, 14)).join(""), { tone: "lo" });
  beamSvg += D([[gx, -25], [gx, 25], [gx, 0]].map(([a, b]) => at([a, b, GATE.beam])), { size: 0.45 });
  for (const lane of ["P", "G"]) {
    PIN_Y[lane].forEach((py, i) => {
      beamSvg += liveSolid(`pin-${lane}-${i}`, k.cylinder(gx, py, 0.85, GATE.beam, PIN_REST[i], P, 14), { tone: "hi" });
    });
  }
  addSort("x", gx, depth([gx, 0, GATE.beam]), beamSvg);
  // the beam overhangs lane G; a gusset under it ties it to the middle post
  const gus = box(gx - 1.2, GATE.postHalf, gx + 1.2, 9, 0.2);
  addSort("pt", 1, depth([gx, 5, 24]), S(k.extrude([[gx - 1.2, GATE.postHalf], [gx + 1.2, GATE.postHalf], [gx + 1.2, 9], [gx - 1.2, 9]], GATE.top - 6, 6, P), { tone: "mid" }));
  void gus;
  // leaves, with a keyway slot and two rivets
  for (const lane of ["P", "G"]) {
    const y0 = lane === "P" ? -24 + GATE.postHalf + 1.6 : GATE.postHalf + 1.6;
    const y1 = lane === "P" ? -GATE.postHalf - 1.6 : 24 - GATE.postHalf - 1.6;
    const plan = box(gx - 1.1, y0, gx + 1.1, y1, 0.3);
    const ly = LANE[lane];
    const slot = k.onTop([[ly - 1.4, 3], [ly + 1.4, 3], [ly + 1.4, 5.4], [ly - 1.4, 5.4]], 0, P, true);
    // keyway on the leaf's near face (x = gx + 1.1): draw it in that face plane
    const m = k.sideMatrix([gx + 1.1, 0], 0, P, "right");
    const keyway = `<g transform="${m}"><path class="rq-void" d="M${-(ly + 1.6)} ${-6.2}h3.2v2.6h-3.2Z"/><path class="iso-line" data-tone="lo" d="M${-(ly + 1.6)} ${-6.2}h3.2v2.6h-3.2Z"/></g>`;
    void slot;
    const rivets = D([[ly - 5, 10.5], [ly + 5, 10.5]].map(([py, pz]) => at([gx + 1.1, py, pz])), { size: 0.4 });
    addSort("x", gx + 0.01, depth([gx, ly, 6]), `<g data-part="leaf-${lane}">${S(slab(plan, 0, GATE.leaf, 2, 0.3), { tone: "hi" })}${keyway}${rivets}</g>`);
  }
}

// ── trip wheels: a pin wheel each side, pushed round by a passing token
const WHEELS = { P: [X.wheel, LANE.P - 13.2], G: [X.wheel, LANE.G + 13.2] };
const WHEEL_R = 8.6, WHEEL_Z = 1.2;
function spokes(cx, cy, a) {
  let d = "";
  for (let i = 0; i < 6; i++) { const t = a + i * Math.PI / 3; d += k.lineOnTop([cx + Math.cos(t) * 2, cy + Math.sin(t) * 2], [cx + Math.cos(t) * WHEEL_R, cy + Math.sin(t) * WHEEL_R], WHEEL_Z, P); }
  return d;
}
// pin heads: a small ball at each spoke's end, as one path of circles
function spokeTips(cx, cy, a) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const t = a + i * Math.PI / 3, [x, y] = k.iso([cx + Math.cos(t) * WHEEL_R, cy + Math.sin(t) * WHEEL_R, WHEEL_Z], P), r = 1.15;
    d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  }
  return d;
}
for (const lane of ["P", "G"]) {
  const [cx, cy] = WHEELS[lane];
  const pad = box(cx - 5, cy - 5, cx + 5, cy + 5, 1.5);
  const padSvg = S(slab(pad, 0, 0.6, 3), { tone: "lo", crease: "none" }) + D(k.corners(pad, 1.4).map(([a, b]) => at([a, b, 0.6])), { size: 0.36 });
  const svg = padSvg + `<path class="iso-line rq-spokes" data-part="spokes-${lane}" data-tone="mid" d="${spokes(cx, cy, 0)}"/><path class="rq-tips" data-part="tips-${lane}" d="${spokeTips(cx, cy, 0)}"/>`
    + S(k.cylinder(cx, cy, 2.3, 0.6, 2.4, P, 20, 0.3), { tone: "mid" }) + D([at([cx, cy, 3])], { size: 0.5, tone: "hi" });
  addSort("pt", cy, depth([cx, cy, 2]), svg);
}
// a shaft housing from the near wheel's pad to the plate edge would cross the lane; it runs under the deck instead.

// ── gearbox with three meshing gears on its top deck
const GEARS = (() => {
  const B = { c: [-46, -51], n: 15 }, A = { n: 12 }, C = { n: 9 };
  const m = 1.6, pr = (g) => (g.n * m) / 2;
  const place = (g, from, deg) => { const d = pr(g) + pr(from), t = deg * Math.PI / 180; g.c = [from.c[0] + Math.cos(t) * d, from.c[1] + Math.sin(t) * d]; g.alpha = t; };
  place(A, B, 196); place(C, B, 24);
  return [A, B, C].map((g) => ({ c: g.c.map((v) => Math.round(v * 100) / 100), n: g.n, r: pr(g), alpha: g.alpha ?? 0 }));
})();
function gearRing(cx, cy, r, n, a) {
  const ra = r + 1.15, rd = r - 1.3, w = Math.PI / n, out = [];
  const p = (t, rr) => [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr];
  for (let i = 0; i < n; i++) { const t = a + 2 * w * i; out.push(p(t - 0.5 * w, rd), p(t - 0.26 * w, ra), p(t + 0.26 * w, ra), p(t + 0.5 * w, rd), p(t + w, rd)); }
  return out;
}
function gearHoles(cx, cy, r, a, z) {
  let d = "";
  for (let i = 0; i < 4; i++) { const t = a + i * Math.PI / 2 + Math.PI / 4; d += k.ring(cx + Math.cos(t) * r * 0.5, cy + Math.sin(t) * r * 0.5, r * 0.17, z, P, 12); }
  return d;
}
{
  const h = 22;
  let svg = S(slab(BOX, 1.2, h - 1.2, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, 7, P, 4), { tone: "faint" }) });
  // vent slots on the front face, as closed outlines in the face plane
  const mf = k.sideMatrix([0, BOX.y + BOX.d], 0, P, "left");
  svg += `<g transform="${mf}">${[0, 1, 2, 3, 4, 5].map((i) => `<path class="iso-line" data-tone="lo" d="M${BOX.x + 10 + i * 5} -4.5h2.2v-9h-2.2Z"/>`).join("")}</g>`;
  // side face: inspection plate with four screws
  const ms = k.sideMatrix([BOX.x + BOX.w, 0], 0, P, "right");
  svg += `<g transform="${ms}"><path class="iso-line" data-tone="lo" d="M${-(BOX.y + 34)} -15h26v-10h-26Z"/></g>`;
  svg += D([[BOX.y + 10, 16.5], [BOX.y + 32, 16.5], [BOX.y + 10, 23.5], [BOX.y + 32, 23.5]].map(([py, pz]) => at([BOX.x + BOX.w, py, pz])), { size: 0.4 });
  const deck = k.insetPlan(BOX, 2);
  svg += S(slab(deck, h, 1.4, 4, 0.5), { tone: "mid" });
  svg += D(k.corners(deck, 2.6).map(([a, b]) => at([a, b, h + 1.4])), { size: 0.45 });
  // a small output counter on the front: a window with a drum
  svg += `<g transform="${mf}"><path class="rq-void" d="M${BOX.x + 46} -15h12v-5h-12Z"/><path class="iso-line" data-tone="mid" d="M${BOX.x + 46} -15h12v-5h-12Z"/></g>`;
  add(base, depth([BOX.x + BOX.w / 2, BOX.y + BOX.d / 2, 0]), svg);
  // gears: spacer, live gear, hub
  GEARS.forEach((g, i) => {
    let gs = S(k.cylinder(g.c[0], g.c[1], 3.2, h + 1.4, GEAR_Z - h - 1.4, P, 20), { tone: "lo" });
    gs += liveSolid(`gear-${i}`, k.extrude(gearRing(g.c[0], g.c[1], g.r, g.n, 0), GEAR_Z, 2.6, P, { convex: false }), { tone: "hi" });
    gs += `<path class="iso-line" data-part="holes-${i}" data-tone="lo" d="${gearHoles(g.c[0], g.c[1], g.r, 0, GEAR_Z + 2.6)}"/>`;
    gs += S(k.cylinder(g.c[0], g.c[1], 2.2, GEAR_Z + 2.6, 1.2, P, 18, 0.3), { tone: "mid" }) + D([at([g.c[0], g.c[1], GEAR_Z + 3.8])], { size: 0.5, tone: "hi" });
    add(base, depth([g.c[0], g.c[1], GEAR_Z]) + 200 + i * 0.01, gs);
  });
}

// ── cache shelf: small, fast, beside the line; a shutter closes it when the cache is off
const CACHE_CARDS = [-36, -31.5, -27, -22.5];
{
  const s = SHELF;
  let svg = S(slab(box(s.x, s.y, s.x + s.w, s.y + s.d, 1.5), 1.2, 2.4, 3, 0.4), { tone: "mid" });
  for (const ux of [s.x + 1, s.x + s.w - 3]) svg += S(slab(box(ux, s.y + 1, ux + 2, s.y + s.d - 1, 0.4), 3.6, 19, 2, 0.2), { tone: "mid" });
  svg += S(slab(box(s.x + 3, s.y + 1, s.x + s.w - 3, s.y + 2.2, 0.2), 3.6, 19, 2), { tone: "mid" });
  svg += S(slab(box(s.x + 3, s.y + 1, s.x + s.w - 3, s.y + s.d - 1, 0.3), 10, 1.4, 2, 0.3), { tone: "mid" });
  // slot rails on the shelf board
  svg += L(CACHE_CARDS.map((cy) => k.lineOnTop([s.x + 3, cy - 0.9], [s.x + s.w - 3, cy - 0.9], 11.4, P)).join(""), { tone: "faint" });
  // the three cards that are always cached (other routes)
  CACHE_CARDS.slice(0, 3).forEach((cy) => { svg += S(slab(box(s.x + 6, cy - 0.35, s.x + s.w - 6, cy + 0.35, 0.1), 11.4, 8.6, 1), { tone: "lo", crease: "none" }); });
  add(base, depth([s.x + s.w / 2, s.y + s.d / 2, 0]), svg);
  const cy = CACHE_CARDS[3];
  const card = S(slab(box(s.x + 6, cy - 0.35, s.x + s.w - 6, cy + 0.35, 0.1), 11.4, 8.6, 1), { tone: "hi", crease: "none" })
    + `<g transform="${k.sideMatrix([0, cy + 0.35], 0, P, "left")}"><path class="iso-line" data-tone="lo" data-free="" d="M${s.x + 9} -17.4h9M${s.x + 9} -15.8h13M${s.x + 9} -14.2h7"/></g>`;
  add(base, depth([s.x + s.w / 2, cy, 12]) + 0.5, `<g data-part="cache-card">${card}</g>`);
  // shutter: a plate in front of the lower bay, raised over the cards when the cache is off
  const sh = box(s.x + 3, s.y + s.d - 1.6, s.x + s.w - 3, s.y + s.d - 0.6, 0.2);
  const shutter = S(slab(sh, 2.6, 7, 2, 0.2), { tone: "mid" }) + L(k.sideSeam(sh, 5.2, P, 2), { tone: "faint" }) + D([at([s.x + s.w / 2, s.y + s.d - 0.6, 4.4])], { size: 0.45 });
  add(base, depth([s.x + s.w / 2, s.y + s.d, 6]) + 1, `<g data-part="shutter">${shutter}</g>`);
  // toggle lever on the base, and its lamp
  const lv = [s.x + s.w - 6, s.y + s.d + 3.2];
  add(base, depth([lv[0], lv[1], 3]) + 2, S(slab(box(lv[0] - 3, lv[1] - 2, lv[0] + 3, lv[1] + 2, 0.8), 1.2, 1.4, 3, 0.3), { tone: "mid" })
    + `<path class="iso-line rq-lever" data-part="lever" data-tone="hi" d=""/><circle class="rq-knob" data-part="knob" r="1.3" cx="0" cy="0"/>`);
  const lamp = [s.x + 6, s.y + s.d + 3.2];
  add(base, depth([lamp[0], lamp[1], 3]) + 2, S(k.cylinder(lamp[0], lamp[1], 2, 1.2, 1.2, P, 16), { tone: "mid" }) + `<path class="rq-lamp" data-part="lamp" d="${k.cylinder(lamp[0], lamp[1], 1.3, 2.4, 1.1, P, 16).fill}"/>`);
  SHELF.lever = lv;
}

// ── card-catalog cabinet: the database
const DRAWER = { col: 0, row: 2, open: 12 };
const ROW_Z = [4, 18, 32], ROW_H = 13.4, COL_X = [CAB.x + 1.2, CAB.x + CAB.w / 2 + 0.6], COL_W = CAB.w / 2 - 1.8;
{
  const c = CAB, top = 46;
  let svg = S(slab(box(c.x + 1.5, c.y + 1.5, c.x + c.w - 1.5, c.y + c.d - 1.5, 1), 1.2, 2.8, 3), { tone: "lo" });
  svg += S(slab(c, 4, top - 4, 3, 0.6), { tone: "mid" });
  svg += S(slab(k.insetPlan(c, -0.8), top, 2.6, 3, 0.8), { tone: "mid" });
  svg += D(k.corners(c, 3).map(([a, b]) => at([a, b, top + 2.6])), { size: 0.45 });
  // a hinged index tray on top, and a little stack of cards waiting
  svg += S(slab(box(c.x + 8, c.y + 10, c.x + 26, c.y + 34, 1), top + 2.6, 2, 3, 0.3), { tone: "mid" });
  svg += L([0, 1, 2, 3].map((i) => k.lineOnTop([c.x + 8, c.y + 14 + i * 5.5], [c.x + 26, c.y + 14 + i * 5.5], top + 4.6, P)).join(""), { tone: "faint" });
  // drawer fronts
  const fy = c.y + c.d;
  for (let r = 0; r < 3; r++) for (let col = 0; col < 2; col++) {
    if (r === DRAWER.row && col === DRAWER.col) continue;
    svg += drawerFront(COL_X[col], fy, ROW_Z[r], false);
  }
  // the cabinet's side: a seam per row
  add(base, depth([c.x + c.w / 2, c.y + c.d / 2, 0]), svg);
  // the open drawer: box (floor, walls, cards) and front, moved together
  const x0 = COL_X[DRAWER.col], x1 = x0 + COL_W, z0 = ROW_Z[DRAWER.row];
  const back = fy - 16;
  let dr = S(slab(box(x0 + 1, back, x1 - 1, fy, 0.2), z0 + 0.8, 0.8, 1), { tone: "lo", crease: "none" });
  dr += S(slab(box(x0 + 1, back, x0 + 1.8, fy, 0.2), z0 + 0.8, 8, 1), { tone: "mid" });
  for (let i = 0; i < 6; i++) {
    const cy = back + 2.6 + i * 2.2;
    if (i === 4) { dr += `<g data-part="db-card">${dbCard(x0, x1, cy, z0, true)}</g>`; continue; }
    dr += dbCard(x0, x1, cy, z0, false);
  }
  dr += S(slab(box(x1 - 1.8, back, x1 - 1, fy, 0.2), z0 + 0.8, 8, 1), { tone: "mid" });
  dr += drawerFront(x0, fy, z0, true);
  const hull = k.slabOf(box(x0 - 2, fy, x1 + 2, fy + 40, 0), z0 - 2, 34, P, 1).fill;
  add(base, depth([x0 + COL_W / 2, fy, z0]) + 50, `<clipPath id="rq-drawer-clip"><path d="${hull}"/></clipPath><g clip-path="url(#rq-drawer-clip)"><g data-part="drawer">${dr}</g></g>`);
}
function drawerFront(x0, fy, z0, live) {
  const f = box(x0, fy, x0 + COL_W, fy + 1.3, 0.5);
  let s = S(slab(f, z0, ROW_H, 2, 0.4), { tone: live ? "hi" : "mid" });
  const m = k.sideMatrix([0, fy + 1.3], 0, P, "left");
  const cx = x0 + COL_W / 2;
  s += `<g transform="${m}"><path class="iso-line" data-tone="lo" d="M${cx - 5} ${-(z0 + 10.6)}h10v-2.6h-10Z"/><path class="iso-line" data-tone="${live ? "mid" : "faint"}" data-free="" d="M${cx - 3.6} ${-(z0 + 11.9)}h${live ? 7.2 : 5}"/></g>`;
  // pull: two posts and a bar
  const py = fy + 1.3;
  s += S(slab(box(cx - 3.4, py, cx - 2.4, py + 1.6, 0.2), z0 + 4.2, 1, 1), { tone: "mid" }) + S(slab(box(cx + 2.4, py, cx + 3.4, py + 1.6, 0.2), z0 + 4.2, 1, 1), { tone: "mid" });
  s += S(slab(box(cx - 3.8, py + 1.6, cx + 3.8, py + 2.5, 0.4), z0 + 4, 1.4, 2), { tone: live ? "hi" : "mid" });
  s += D([at([cx - 5.8, fy + 1.3, z0 + 11.9]), at([cx + 5.8, fy + 1.3, z0 + 11.9])], { size: 0.32 });
  return s;
}
function dbCard(x0, x1, cy, z0, picked) {
  const plan = box(x0 + 2.4, cy - 0.3, x1 - 2.4, cy + 0.3, 0.1);
  const tab = picked ? S(slab(box(x0 + 4, cy - 0.3, x0 + 8, cy + 0.3, 0.1), z0 + 11.2, 1.6, 1), { tone: "hi", crease: "none" }) : "";
  return S(slab(plan, z0 + 1.6, 9.6, 1), { tone: picked ? "hi" : "lo", crease: "none" }) + tab;
}

// ── printer: the response comes out as a ticket
const SLOT_Z = 11.5;
{
  const p = PRN, h = 30;
  let svg = S(slab(box(p.x - 3, -9.5, p.x + 2, 9.5, 0.4), 0, 3.4, 2, 0.3), { tone: "mid" });
  svg += S(slab(k.insetPlan(p, 1.4), 0, 1.6, 4), { tone: "lo" });
  svg += S(slab(p, 1.6, h - 1.6, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(p, 6, P, 6), { tone: "faint" }) + L(k.sideSeam(p, h - 7, P, 6), { tone: "faint" }) });
  // the lid: a lighter cover with a hinge line and vent slots
  const lid = box(p.x + 4, p.y + 4, p.x + p.w - 4, p.y + p.d - 18, 2);
  svg += L(k.planOutline(lid, h, P, 3), { tone: "lo" });
  svg += L([0, 1, 2, 3, 4].map((i) => k.planOutline(box(p.x + 9, p.y + 8 + i * 4, p.x + 30, p.y + 9.6 + i * 4, 0.8), h, P, 2)).join(""), { tone: "faint" });
  svg += D(k.corners(k.insetPlan(p, 2.2), 0).map(([a, b]) => at([a, b, h])), { size: 0.45 });
  // feed knob on the lid
  const kn = [p.x + p.w - 10, p.y + p.d - 10];
  svg += S(k.cylinder(kn[0], kn[1], 4.2, h, 3.2, P, 32), { tone: "mid" }) + L(k.knurl(kn[0], kn[1], 4.2, h, h + 3.2, 30, P), { tone: "lo" });
  svg += L(k.lineOnTop(kn, [kn[0] + 3.2, kn[1]], h + 3.2, P), { tone: "hi" }) + D([at([kn[0], kn[1], h + 3.2])], { size: 0.45, tone: "hi" });
  // front: display window, paper slot and a status lamp row
  const fy = p.y + p.d;
  const m = k.sideMatrix([0, fy], 0, P, "left");
  const win = { x: p.x + 8, w: 22, z0: 17.5, z1: 25 };
  svg += `<g transform="${m}"><path class="rq-screen" d="M${win.x} ${-win.z0}h${win.w}v${-(win.z1 - win.z0)}h${-win.w}Z"/><path class="iso-line" data-tone="mid" d="M${win.x} ${-win.z0}h${win.w}v${-(win.z1 - win.z0)}h${-win.w}Z"/>`
    + `<text class="rq-digits" data-part="display" x="${win.x + win.w / 2}" y="${-win.z0 - 1.9}" text-anchor="middle" font-size="5.2">---</text>`
    + `<path class="rq-void" d="M${p.x + 8} ${-SLOT_Z + 0.9}h30v-1.8h-30Z"/><path class="iso-line" data-tone="lo" d="M${p.x + 6.5} ${-SLOT_Z + 2.2}h33v-4.4h-33Z"/></g>`;
  svg += D([0, 1, 2].map((i) => at([p.x + 34 + i * 3, fy, 21.5])), { size: 0.7, tone: "lo" });
  add(front, depth([p.x + p.w / 2, 0, 10]), svg);
}

// ── return tray for refused requests
{
  const t = TRAY, h = 4, w = 1.2;
  add(base, depth([t.x + t.w / 2, t.y + t.d / 2, 0]) - 20, S(slab(t, 0, 1, 3, 0.3), { tone: "lo" }));
  const wallAt = (plan, rule, value) => addSort(rule, value, depth([plan.x + plan.w / 2, plan.y + plan.d / 2, 2]), S(slab(plan, 1, h, 2, 0.25), { tone: "mid" }));
  wallAt(box(t.x, t.y, t.x + t.w, t.y + w, 0.3), "y", t.y);
  wallAt(box(t.x, t.y, t.x + w, t.y + t.d, 0.3), "x", t.x);
  // the near walls carry a gap where the chute enters
  wallAt(box(t.x + t.w - w, t.y, t.x + t.w, t.y + t.d, 0.3), "x", t.x + t.w);
  wallAt(box(t.x, t.y + t.d - w, t.x + t.w, t.y + t.d, 0.3), "y", t.y + t.d);
  // chute guides from the lane to the tray
  for (const sx of [-1, 1]) {
    const gx = X.tray + sx * GUIDE.off;
    const plan = box(gx - GUIDE.half, LANE.G + GUIDE.off, gx + GUIDE.half, t.y, 0.3);
    addSort("x", gx, depth([gx, (LANE.G + GUIDE.off + t.y) / 2, 1]), S(slab(plan, 0, GUIDE.h, 2), { tone: "mid" }));
  }
}

// ── the ticket that leaves the printer (front layer, rebuilt as it grows)
const TICKET = { x0: PRN.x + 9, x1: PRN.x + 37, y0: PRN.y + PRN.d, len: 22, z: SLOT_Z - 0.3 };
add(front, 1e6, `<g data-part="ticket"></g>`);

// ── token: the request
function tokenSvg() {
  const { r, h } = TOK;
  let s = `<path class="iso-halo rq-token-halo" d="${k.cylinder(0, 0, r + 0.8, 0, 0.1, P, 28).fill}"/>`;
  // key bit on the leading edge: present only on keyed tokens
  const key = box(r - 1, -1.3, r + 3.6, 1.3, 0.3);
  s += `<g data-part="key">${S(slab(key, 0.5, 1.4, 2, 0.2), { tone: "hi", lit: true })}${L(k.lineOnTop([r + 1, -1.3], [r + 1, -0.3], 1.9, P) + k.lineOnTop([r + 2.4, -1.3], [r + 2.4, 0.2], 1.9, P), { tone: "lit" })}</g>`;
  s += S(k.cylinder(0, 0, r, 0, h, P, 40, 0.5), { tone: "hi", lit: true, crease: "lo" });
  s += L(k.ring(0, 0, r - 1.4, h, P, 36), { tone: "lo" });
  s += `<text class="iso-face-text rq-method" data-part="method" data-tone="hi" transform="${k.topMatrix([0, 1.05], h, P, "x")}" font-size="3" text-anchor="middle">GET</text>`;
  // the 401 tag, hinged at the token's back edge; the page sets its matrix
  s += `<g data-part="tag" opacity="0"><path class="rq-tag" d="M-4.6 0h9.2v-5.6h-9.2Z"/><path class="iso-line" data-tone="hi" d="M-4.6 0h9.2v-5.6h-9.2Z"/><text class="rq-tag-text" x="0" y="-1.55" text-anchor="middle" font-size="3.6">401</text></g>`;
  return `<g data-part="token">${s}</g>`;
}

// ───────────────────────── assemble ─────────────────────────
const guideDots = D(runs.flatMap((r) => r.dots), { size: 0.38, tone: "mid" });

base.sort((a, b) => a.key - b.key);
front.sort((a, b) => a.key - b.key);
sorted.sort((a, b) => a.key - b.key);
const START = PATHS.miss.pts[0];
const beforeAt = (it, p) => {
  if (it.rule === "y") return it.value < p[1];
  if (it.rule === "x") return it.value < p[0];
  if (it.rule === "pt") return it.value < p[1];
  return true;
};
const sortedSvg = sorted.map((it, i) => `<g data-s="${i}">${it.svg}</g>`);
const pre = sorted.map((it, i) => (beforeAt(it, START) ? sortedSvg[i] : "")).join("");
const post = sorted.map((it, i) => (beforeAt(it, START) ? "" : sortedSvg[i])).join("");

const LABEL_PT = "Uma máquina de mesa que mostra o ciclo de vida de uma requisição web: uma ficha metálica cai numa fenda, um desviador a manda para o trilho da rota, um portão com fechadura de pinos só abre para a ficha com a chave certa, uma caixa de engrenagens gira com a lógica de negócio, uma prateleira de cache oferece um atalho, um arquivo de gavetas faz o papel de banco de dados e uma impressora entrega o bilhete com o código de status.";
const svg = k.figureSvg({
  width: W, height: H, label: LABEL_PT,
  body: [
    `<g data-layer="base">${base.map((it) => it.svg).join("")}${guideDots}</g>`,
    `<g data-layer="pre">${pre}</g>`,
    tokenSvg(),
    `<g data-layer="post">${post}</g>`,
    `<g data-layer="front">${front.map((it) => it.svg).join("")}</g>`,
  ],
});

const STEPS_PT = ["Fenda", "Roteador", "Autenticação", "Lógica", "Cache", "Banco", "Resposta"];
const figureHtml = `<figure class="iso-figure rq-figure" id="fig-requisicao">
  <div class="iso iso-plate" data-theme="light">
    <div class="iso-plate-corners" aria-hidden="true">
      <span class="iso-plate-corner" data-corner="fig" data-t="title">Fig. 1 — Anatomia de uma requisição</span>
    </div>
    <div class="iso-stage rq-stage" tabindex="0" role="slider" aria-label="Requisição: setas avançam ou recuam uma etapa, Enter envia uma nova requisição, C liga ou desliga o cache" aria-valuemin="1" aria-valuemax="7" aria-valuenow="1" aria-valuetext="Etapa 1 de 7: fenda">${svg}</div>
    <div class="rq-foot"><span data-t="hint">passe o mouse para seguir a requisição</span><span data-readout>GET /api/projetos · em andamento</span></div>
    <div class="rq-panel">
      <dl class="rq-stats">
        <div><dt data-t="k.route">método · rota</dt><dd data-v="route">GET /api/projetos</dd></div>
        <div><dt data-t="k.status">status</dt><dd data-v="status">—</dd></div>
        <div><dt data-t="k.cache">cache</dt><dd data-v="cache">—</dd></div>
        <div><dt data-t="k.db">consultas ao banco</dt><dd data-v="db">0</dd></div>
        <div><dt data-t="k.latency">latência</dt><dd data-v="latency">0,0 ms</dd></div>
      </dl>
      <div class="rq-controls">
        <ol class="rq-steps">${STEPS_PT.map((s, i) => `<li><button type="button" data-step="${i}" aria-label="${i + 1} ${s}"><b>${i + 1}</b><span data-t="s${i}">${s}</span></button></li>`).join("")}</ol>
        <div class="rq-buttons">
          <button type="button" class="rq-switch" role="switch" aria-checked="true" data-action="cache"><i aria-hidden="true"></i><span data-t="cacheOn">cache ligado</span></button>
          <button type="button" class="rq-new" data-action="new" data-t="new">nova requisição ↻</button>
        </div>
      </div>
    </div>
    <p class="rq-live" aria-live="polite"></p>
  </div>
  <figcaption class="iso-legend rq-legend"><span class="iso-caption" data-t="caption">A ficha é a requisição. O desviador escolhe o trilho pela rota; a fechadura de pinos só abre para a chave certa e devolve a ficha sem chave com uma plaqueta 401; as engrenagens são a lógica de negócio; a prateleira de cache devolve uma resposta já pronta e pula as gavetas do banco. A latência soma o custo de cada etapa: cerca de 8 ms com cache contra cerca de 43 ms indo ao banco.</span></figcaption>
</figure>`;

// ───────────────────────── page data and live code ─────────────────────────
const DATA = {
  P, PATHS, TOK, GATE: { x: GATE.x, beam: GATE.beam, lift: GATE.lift }, PIN_Y, PIN_REST, PIN_OPEN, LANE,
  ROUTER, SWITCH, BLADE_H, WHEELS, WHEEL_R, GEARS, GEAR_Z, X, TICKET, SHELF: { lever: SHELF.lever }, DRAWER_OPEN: DRAWER.open,
  ITEMS: sorted.map((it) => [it.rule, Math.round(it.value * 100) / 100]),
};
const helpers = [bladeRing, gearRing, gearHoles, spokes, spokeTips].map((f) => f.toString()).join("\n")
  .replace(/k\./g, "")
  .replace(/\bP\b(?=[,)])/g, "P");
const kit = readFileSync(join(HERE, "iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8");
const script = `// Generated by tools/figure/build.mjs — do not edit by hand.\n${kit}\nconst DATA = ${JSON.stringify(DATA)};\nconst P = DATA.P, WHEEL_R = DATA.WHEEL_R, WHEEL_Z = ${WHEEL_Z};\n${helpers}\n${live}`;
writeFileSync(join(ROOT, "js", "request-figure.js"), script);

const css = `/* Generated by tools/figure/build.mjs — kit styles plus the figure's own. */\n${k.ISO_CSS}\n${readFileSync(join(HERE, "figure.css"), "utf8")}`;
writeFileSync(join(ROOT, "css", "anatomy.css"), css);

const indexPath = join(ROOT, "index.html");
const index = readFileSync(indexPath, "utf8");
const marked = /<!-- fig:start -->[\s\S]*?<!-- fig:end -->/;
if (!marked.test(index)) throw new Error("index.html has no <!-- fig:start --> … <!-- fig:end --> markers");
writeFileSync(indexPath, index.replace(marked, `<!-- fig:start -->\n${figureHtml}\n<!-- fig:end -->`));
console.log(`figure: ${base.length} base, ${sorted.length} sorted, ${front.length} front items · ${(svg.length / 1024).toFixed(0)} KB svg`);
