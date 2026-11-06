// ───────────────────────── live figure: one model moves every part ─────────────────────────
const figure = document.getElementById("fig-requisicao");
if (figure) {
const stage = figure.querySelector(".rq-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const part = (name) => svg.querySelector(`[data-part="${name}"]`);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const band = (s, a, b) => ease((s - a) / (b - a));
const { PATHS, TOK, GATE, PIN_Y, PIN_REST, PIN_OPEN, ROUTER, SWITCH, BLADE_H, WHEELS, GEARS, GEAR_Z, X, TICKET, SHELF, ITEMS } = DATA;

// ── words
const T = {
  pt: {
    title: "Fig. 1 — Anatomia de uma requisição", hint: "passe o mouse para seguir a requisição",
    "k.route": "método · rota", "k.status": "status", "k.cache": "cache", "k.db": "consultas ao banco", "k.latency": "latência",
    s0: "Fenda", s1: "Roteador", s2: "Autenticação", s3: "Lógica", s4: "Cache", s5: "Banco", s6: "Resposta",
    cacheOn: "cache ligado", cacheOff: "cache desligado", new: "nova requisição ↻",
    waiting: "aguardando", working: "em andamento", hit: "HIT · atalho", miss: "MISS", off: "desligado", skip: "ignora · invalida", none: "—",
    select: "SELECT", insert: "INSERT", returned: "devolvida",
    ok: "200 OK", created: "201 Created", denied: "401 Unauthorized",
    step: (i, n, name) => `Etapa ${i} de ${n}: ${name}`,
    label: "Requisição: setas avançam ou recuam uma etapa, Enter envia uma nova requisição, C liga ou desliga o cache",
    caption: "A ficha é a requisição. O desviador escolhe o trilho pela rota; a fechadura de pinos só abre para a chave certa e devolve a ficha sem chave com uma plaqueta 401; as engrenagens são a lógica de negócio; a prateleira de cache devolve uma resposta já pronta e pula as gavetas do banco. A latência soma o custo de cada etapa: cerca de 8 ms com cache contra cerca de 42 ms indo ao banco.",
    ms: (v) => `${v.toFixed(1).replace(".", ",")} ms`,
  },
  en: {
    title: "Fig. 1 — Anatomy of a request", hint: "hover to follow the request",
    "k.route": "method · route", "k.status": "status", "k.cache": "cache", "k.db": "database queries", "k.latency": "latency",
    s0: "Slot", s1: "Router", s2: "Auth", s3: "Logic", s4: "Cache", s5: "Database", s6: "Response",
    cacheOn: "cache on", cacheOff: "cache off", new: "new request ↻",
    waiting: "waiting", working: "in progress", hit: "HIT · shortcut", miss: "MISS", off: "off", skip: "bypass · invalidate", none: "—",
    select: "SELECT", insert: "INSERT", returned: "returned",
    ok: "200 OK", created: "201 Created", denied: "401 Unauthorized",
    step: (i, n, name) => `Step ${i} of ${n}: ${name}`,
    label: "Request: arrow keys step forward or back, Enter sends a new request, C toggles the cache",
    caption: "The token is the request. The switch picks the rail by route; the pin-tumbler lock only opens for the right key and hands a keyless token back with a 401 tag; the gears are the business logic; the cache shelf returns a ready-made response and skips the database drawers. Latency adds up each step's cost: about 8 ms from cache against about 42 ms through the database.",
    ms: (v) => `${v.toFixed(1)} ms`,
  },
};
let lang = /^en/i.test(document.documentElement.lang) ? "en" : "pt";
const t = (key) => T[lang][key];

// ── the model: requests, the cache, and what each step costs
const SEQ = [
  { method: "GET", route: "/api/projetos", lane: "G", valid: true },
  { method: "GET", route: "/api/projetos", lane: "G", valid: true },
  { method: "POST", route: "/api/projetos", lane: "P", valid: true },
  { method: "GET", route: "/api/admin", lane: "G", valid: false },
];
const COST = { parse: 0.4, route: 0.3, auth: 1.8, logicGet: 3.4, logicPost: 5.6, lookup: 0.6, invalidate: 0.3, select: 34.2, insert: 41.3, respond: 1.3, store: 0.2, refuse: 0.5 };
const cache = { on: true, projetos: false };
let serial = 0, req = null;

function kindOf(spec) {
  if (!spec.valid) return "deny";
  if (spec.method === "POST") return "post";
  return cache.on && cache.projetos ? "hit" : "miss";
}
function costsOf(r) {
  const j = 1 + 0.06 * Math.sin(r.n * 12.9898 + 1.7), d = 1 + 0.08 * Math.sin(r.n * 78.233 + 0.4);
  if (r.kind === "deny") return [COST.parse, COST.route, COST.auth, COST.refuse];
  const logic = (r.kind === "post" ? COST.logicPost : COST.logicGet) * j;
  const cacheCost = cache.on ? (r.kind === "post" ? COST.invalidate : COST.lookup) : 0;
  const db = r.kind === "hit" ? 0 : (r.kind === "post" ? COST.insert : COST.select) * d;
  const respond = COST.respond + (r.kind === "miss" && cache.on ? COST.store : 0);
  return [COST.parse, COST.route, COST.auth, logic, cacheCost, db, respond];
}
function makeRequest() {
  const spec = SEQ[serial % SEQ.length];
  const r = { ...spec, n: serial++, committed: false };
  r.kind = kindOf(r);
  r.path = PATHS[r.kind];
  r.costs = costsOf(r);
  r.last = r.path.stage.length - 1;
  return r;
}
// Toggling the cache before the token reaches the shelf re-decides the route: hit and miss share every point up to there.
function redecide() {
  if (!req || req.kind === "deny" || req.kind === "post" || pos.x > req.path.stage[4] + 2) return;
  const kind = kindOf(req);
  if (kind === req.kind) return;
  req.kind = kind; req.path = PATHS[kind]; req.costs = costsOf(req);
}

// ── path sampling
function pointAt(path, s) {
  const S = path.s, n = S.length;
  if (s <= 0) return path.pts[0];
  if (s >= S[n - 1]) return path.pts[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
  const f = (s - S[lo]) / (S[hi] - S[lo] || 1), a = path.pts[lo], b = path.pts[hi];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// ── springs
function settle(st, target, dt, tau, calm) {
  if (calm) { st.x = target; st.v = 0; return false; }
  const w = 1 / tau, h = dt / 4;
  for (let i = 0; i < 4; i++) { st.v += (w * w * (target - st.x) - 2 * w * st.v) * h; st.x += st.v * h; }
  if (Math.abs(target - st.x) < 1e-3 && Math.abs(st.v) < 1e-3) { st.x = target; st.v = 0; return false; }
  return true;
}
const pos = { x: 0, v: 0 };      // token arc length
// The token rolls: it speeds up, cruises and brakes to a stop, instead of creeping in on a spring tail.
const VMAX = 150, ACC = 420;
function roll(st, target, dt, calm) {
  if (calm) { st.x = target; st.v = 0; return false; }
  const d = target - st.x;
  if (Math.abs(d) < 0.05 && Math.abs(st.v) < 2) { st.x = target; st.v = 0; return false; }
  const want = Math.sign(d) * Math.min(VMAX, Math.sqrt(2 * ACC * 0.9 * Math.abs(d)));
  const dv = clamp(want - st.v, -ACC * dt, ACC * dt);
  st.v += dv; st.x += st.v * dt;
  if ((target - st.x) * d < 0) { st.x = target; st.v = 0; }
  return true;
}
const pins = { x: 0, v: 0 };     // 0 scattered → 1 on the shear line
const leaf = { x: 0, v: 0 };     // 0 down → 1 raised
const tag = { x: 0, v: 0 };      // 401 tag: 0 flat → 1 standing
const router = { x: -1, v: 0 };  // −1 sends to the GET rail, +1 to the POST rail
const sw = { x: 1, v: 0 };       // +1 into the database loop, −1 straight on (cache hit)
const shelfCard = { x: 0, v: 0 };
const shutter = { x: 0, v: 0 };
const lever = { x: 1, v: 0 };
const spin = { x: 0, v: 0 };
const fade = { x: 1, v: 0 };     // token opacity, for swapping requests
const ticketFade = { x: 1, v: 0 };
let gearAngle = 0, step = 0, swapping = false, refusedAt = -1, clock = 0;
const wheelCount = { P: 0, G: 0 };
let ticketReq = null;

// ── refs
const token = part("token"), keyBit = part("key"), method = part("method"), tagEl = part("tag"), halo = token.querySelector(".rq-token-halo");
const layerPre = svg.querySelector('[data-layer="pre"]'), layerPost = svg.querySelector('[data-layer="post"]');
const sortedNodes = [...svg.querySelectorAll("[data-s]")].sort((a, b) => a.dataset.s - b.dataset.s);
let lastFlags = "";
const leaves = { P: part("leaf-P"), G: part("leaf-G") };
const pinEls = { P: PIN_Y.P.map((_, i) => part(`pin-P-${i}`)), G: PIN_Y.G.map((_, i) => part(`pin-G-${i}`)) };
const gearEls = GEARS.map((_, i) => part(`gear-${i}`)), holeEls = GEARS.map((_, i) => part(`holes-${i}`));
const spokeEls = { P: part("spokes-P"), G: part("spokes-G") }, tipEls = { P: part("tips-P"), G: part("tips-G") };
const routerBlade = part("router-blade"), cacheBlade = part("cache-blade");
const drawer = part("drawer"), dbCard = part("db-card"), cacheCard = part("cache-card"), shutterEl = part("shutter");
const leverEl = part("lever"), knobEl = part("knob"), lampEl = part("lamp");
const display = part("display"), ticketEl = part("ticket");
const readout = figure.querySelector("[data-readout]"), live = figure.querySelector(".rq-live");
const V = (name) => figure.querySelector(`[data-v="${name}"]`);
const out = { route: V("route"), status: V("status"), cache: V("cache"), db: V("db"), latency: V("latency") };
const stepButtons = [...figure.querySelectorAll("[data-step]")];
const switchBtn = figure.querySelector('[data-action="cache"]'), newBtn = figure.querySelector('[data-action="new"]');

function setSolid(g, paths) {
  const c = g.children;
  c[0].setAttribute("d", paths.fill);
  for (let i = 0; i < 4; i++) c[1 + i].setAttribute("d", paths.shades[i] || "");
  c[5].setAttribute("d", paths.top);
  c[6].setAttribute("d", paths.crease);
  c[7].setAttribute("d", paths.outline);
}
const memo = new Map(), seen = new Map();
const changed = (key, value) => { const v = Math.round(value * 2000); if (seen.get(key) === v) return false; seen.set(key, v); return true; };
const write = (el, attr, value) => { const key = el; const prev = memo.get(key); if (prev === value) return; memo.set(key, value); el.setAttribute(attr, value); };

// ── per-frame drawing from the model
function stagesPassed(s) {
  const st = req.path.stage;
  let i = 0;
  while (i < st.length - 1 && s >= st[i + 1] - 0.6) i++;
  return i;
}
function latencyAt(s) {
  const st = req.path.stage, c = req.costs;
  let total = 0;
  for (let i = 0; i < st.length; i++) {
    if (s >= st[i] - 0.6) { total += c[i]; continue; }
    const from = i ? st[i - 1] : 0;
    total += c[i] * clamp((s - from) / (st[i] - from));
    break;
  }
  return total;
}

function draw(dt) {
  const s = pos.x, p = pointAt(req.path, s), st = req.path.stage;
  // token
  write(token, "transform", translateAlong(P, p));
  token.style.opacity = (fade.x * clamp(s / 6 + 0.15)).toFixed(3);
  halo.style.opacity = p[2] > 0.5 ? "0" : "";
  keyBit.style.display = req.valid ? "" : "none";
  if (method.textContent !== req.method) method.textContent = req.method;
  const phi = tag.x * Math.PI / 2;
  if (tag.x > 0.04) {
    const o = iso([0, 0, TOK.h], P), u = k_axis([0, -1, 0]), v = k_axis([Math.cos(phi), 0, -Math.sin(phi)]);
    write(tagEl, "transform", `matrix(${u[0].toFixed(3)} ${u[1].toFixed(3)} ${v[0].toFixed(3)} ${v[1].toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`);
    tagEl.setAttribute("opacity", ease(tag.x * 3).toFixed(2));
  } else tagEl.setAttribute("opacity", "0");

  // painter's order around the token
  let flags = "";
  for (let i = 0; i < ITEMS.length; i++) {
    const [rule, value] = ITEMS[i];
    let before;
    if (rule === "x") before = value < p[0];
    else if (rule === "blade") before = router.x < 0;
    else if (rule === "switch") before = sw.x < 0;
    else before = value < p[1];
    flags += before ? "1" : "0";
  }
  if (flags !== lastFlags) {
    for (let i = 0; i < sortedNodes.length; i++) (flags[i] === "1" ? layerPre : layerPost).appendChild(sortedNodes[i]);
    lastFlags = flags;
  }

  // router and cache switch tongues
  if (changed("router", router.x)) setSolid(routerBlade, extrude(bladeRing(ROUTER.pivot, ROUTER.tip, router.x * ROUTER.reach, 1), 0, BLADE_H, P));
  if (changed("switch", sw.x)) setSolid(cacheBlade, extrude(bladeRing(SWITCH.pivot, SWITCH.tip, sw.x * SWITCH.reach, 1), 0, BLADE_H, P));

  // gate: pins of the request's lane, and its leaf
  for (const lane of ["P", "G"]) {
    const mine = lane === req.lane;
    const refused = mine && !req.valid && refusedAt >= 0 ? Math.exp(-(clock - refusedAt) / 0.5) : 0;
    if (changed(`pins-${lane}`, (mine ? pins.x : 0) + refused * Math.sin(clock * 38) * 7)) PIN_Y[lane].forEach((py, i) => {
      const a = mine ? pins.x : 0;
      const shake = refused * 0.9 * Math.sin(clock * 38 + i * 1.9);
      const e = PIN_REST[i] + (PIN_OPEN - PIN_REST[i]) * a + shake;
      setSolid(pinEls[lane][i], cylinder(GATE.x, py, 0.85, GATE.beam, Math.max(0.4, e), P, 14));
    });
    const lift = mine ? leaf.x : 0;
    write(leaves[lane], "transform", translateAlong(P, [0, 0, lift * GATE.lift]));
  }

  // trip wheels and the gear train
  const wheelAngle = {};
  for (const lane of ["P", "G"]) {
    const [wx] = WHEELS[lane];
    const pushed = req.lane === lane && req.kind !== "deny" ? band(p[0], wx - 10, wx + 10) : 0;
    wheelAngle[lane] = (wheelCount[lane] + pushed) * Math.PI / 3 * (lane === "P" ? 1 : -1);
    if (changed(`wheel-${lane}`, wheelAngle[lane])) { write(spokeEls[lane], "d", spokes(WHEELS[lane][0], WHEELS[lane][1], wheelAngle[lane])); write(tipEls[lane], "d", spokeTips(WHEELS[lane][0], WHEELS[lane][1], wheelAngle[lane])); }
  }
  const thetaB = (wheelAngle.P - wheelAngle.G) * 0.75 + gearAngle;
  if (changed("gears", thetaB)) GEARS.forEach((g, i) => {
    let th = thetaB;
    if (i !== 1) {
      const B = GEARS[1], a = g.alpha;
      th = a + Math.PI - (2 * Math.PI / g.n) * (0.5 - ((a - thetaB) * B.n) / (2 * Math.PI));
    }
    setSolid(gearEls[i], extrude(gearRing(g.c[0], g.c[1], g.r, g.n, th), GEAR_Z, 2.6, P, { convex: false }));
    write(holeEls[i], "d", gearHoles(g.c[0], g.c[1], g.r, th, GEAR_Z + 2.6));
  });

  // database drawer and the card it gives (or takes)
  const viaDb = req.kind === "miss" || req.kind === "post";
  const s5 = st[5] ?? 0;
  const open = viaDb ? band(s, s5 - 30, s5 - 12) * (1 - band(s, s5 + 16, s5 + 34)) : 0;
  write(drawer, "transform", translateAlong(P, [0, open * DATA.DRAWER_OPEN, 0]));
  let cardZ = 0, cardShow = 1;
  if (req.kind === "miss") cardZ = 13 * band(s, s5 - 8, s5 - 1) * (1 - band(s, s5 + 6, s5 + 16));
  if (req.kind === "post") { cardZ = 13 * (1 - band(s, s5 - 6, s5)); cardShow = band(s, s5 - 20, s5 - 12) * open + band(s, s5, s5 + 1); }
  write(dbCard, "transform", translateAlong(P, [0, 0, cardZ]));
  dbCard.style.opacity = clamp(cardShow).toFixed(2);
  dbCard.toggleAttribute("data-on", cardZ > 1);

  // cache shelf: the cached card, the shutter, the lever and lamp
  const hitNow = req.kind === "hit" && s >= st[4] - 3 && s < st[4] + 40 ? 1 : 0;
  write(cacheCard, "transform", translateAlong(P, [0, 0, (1 - shelfCard.x) * 9 + hitNow * 2.4]));
  cacheCard.style.opacity = ease(shelfCard.x).toFixed(2);
  cacheCard.toggleAttribute("data-on", hitNow > 0);
  write(shutterEl, "transform", translateAlong(P, [0, 0, shutter.x * 9.4]));
  const lf = lever.x * 0.55, [lx, ly] = SHELF.lever;
  const a0 = iso([lx, ly, 2.6], P), a1 = iso([lx + Math.sin(lf) * 5, ly, 2.6 + Math.cos(lf) * 5], P);
  write(leverEl, "d", `M${a0[0].toFixed(1)} ${a0[1].toFixed(1)}L${a1[0].toFixed(1)} ${a1[1].toFixed(1)}`);
  write(knobEl, "cx", a1[0].toFixed(1)); write(knobEl, "cy", a1[1].toFixed(1));
  lampEl.toggleAttribute("data-on", cache.on);

  // printer display and ticket
  const valid = req.kind !== "deny";
  const printing = valid ? band(s, st[st.length - 1] - 14, st[st.length - 1] - 1) : 0;
  const code = req.kind === "post" ? "201" : "200";
  const shown = valid && printing > 0.05 ? code : "---";
  if (display.textContent !== shown) display.textContent = shown;
  if (!ticketReq || (ticketFade.x < 0.02 && ticketReq !== req)) { ticketReq = req; ticketFade.x = 1; }
  const tr = ticketReq, tLen = tr === req ? printing : 1;
  drawTicket(tLen * TICKET.len, tr, ticketFade.x);

  // numbers, all from the same instant
  const passed = stagesPassed(s);
  const lat = latencyAt(s);
  const statusText = req.kind === "deny" ? (passed >= 2 && refusedAt >= 0 ? t("denied") : t("none")) : (passed >= st.length - 1 || printing > 0.5 ? t(req.kind === "post" ? "created" : "ok") : t("none"));
  const cacheText = passed < 4 || req.kind === "deny" ? t("none") : req.kind === "post" ? (cache.on ? t("skip") : t("off")) : !cache.on ? t("off") : req.kind === "hit" ? t("hit") : t("miss");
  const dbText = viaDb && passed >= 5 ? `1 · ${t(req.kind === "post" ? "insert" : "select")}` : "0";
  const latText = T[lang].ms(lat);
  const routeText = `${req.method} ${req.route}`;
  if (out.route.textContent !== routeText) out.route.textContent = routeText;
  if (out.status.textContent !== statusText) { out.status.textContent = statusText; out.status.dataset.code = statusText.slice(0, 3); }
  if (out.cache.textContent !== cacheText) { out.cache.textContent = cacheText; out.cache.dataset.state = req.kind === "hit" && passed >= 4 ? "hit" : ""; }
  if (out.db.textContent !== dbText) out.db.textContent = dbText;
  if (out.latency.textContent !== latText) out.latency.textContent = latText;
  const tail = req.kind === "deny" && passed >= 3 ? t("returned") : statusText !== t("none") ? statusText.slice(0, 3) : t("working");
  const line = `${routeText} · ${tail} · ${latText}`;
  if (readout.textContent !== line) readout.textContent = line;
  const here = Math.min(passed, req.last);
  stepButtons.forEach((b, i) => {
    const state = req.kind === "hit" && i === 5 ? "skip" : i === here ? "now" : i < here ? "done" : i > req.last ? "off" : "";
    if (b.dataset.state !== state) b.dataset.state = state;
  });
}
const k_axis = (p) => axisVector(P, p).map((v, i) => v);

function drawTicket(len, r, alpha) {
  const key = `${len.toFixed(2)}|${r.n}|${alpha.toFixed(2)}|${lang}`;
  if (ticketEl.dataset.key === key) return;
  ticketEl.dataset.key = key;
  if (len < 0.3 || r.kind === "deny") { ticketEl.innerHTML = ""; return; }
  const { x0, x1, y0, z } = TICKET, y1 = y0 + len;
  const paper = slabOf({ x: x0, y: y0, w: x1 - x0, d: len, r: 0.3 }, z, 0.35, P, 1);
  const top = onTop([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z + 0.35, P, true);
  const id = `rq-clip-${r.n}`;
  const lines = [];
  const code = r.kind === "post" ? "201 Created" : "200 OK";
  const total = r.costs.reduce((a, b) => a + b, 0);
  const rows = [[code, 3.1, "hi"], [`${r.method} ${r.route}`, 2.1, "mid"], [T[lang].ms(total) + (r.kind === "hit" ? " · cache" : ""), 2.1, "mid"]];
  rows.forEach(([text, size, tone], i) => {
    const y = y1 - 3.6 - i * 3.6;
    lines.push(`<text class="iso-face-text" data-tone="${tone}" transform="${topMatrix([x0 + 2.2, y], z + 0.35, P, "x")}" font-size="${size}">${text}</text>`);
  });
  const rule = y1 - 3.6 * 3 - 1.2;
  if (rule > y0) lines.push(lineSvg(lineOnTop([x0 + 2.2, rule], [x1 - 2.2, rule], z + 0.35, P), { tone: "faint", free: true }));
  ticketEl.innerHTML = `<g opacity="${alpha.toFixed(2)}"><clipPath id="${id}"><path d="${top}"/></clipPath>${solidSvg(paper, { tone: "mid", crease: "none" })}<g clip-path="url(#${id})">${lines.join("")}</g></g>`;
}

// ── loop
let frame = 0, last = 0, visible = false, touring = !still.matches, tourClock = 0, idleTimer = 0;
const DWELL = (r, i) => [1.1, 0.75, r.kind === "deny" ? 1.6 : 1.0, r.kind === "deny" ? 2.2 : 1.25, 0.8, r.kind === "hit" ? 0.45 : 1.7, 2.4][i];
function targetS() { return req.path.stage[Math.min(step, req.last)]; }

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now; clock += dt;
  const calm = still.matches;
  let moving = false;
  if (touring) {
    if (Math.abs(pos.x - targetS()) < 0.5 && !swapping) tourClock += dt;
    if (tourClock > DWELL(req, Math.min(step, req.last))) {
      tourClock = 0;
      if (step < req.last) step++; else newRequest();
    }
  }
  if (swapping) {
    moving = settle(fade, 0, dt, 0.06, calm) || true;
    if (fade.x < 0.03 || calm) { swapping = false; begin(makeRequest()); }
  } else moving = settle(fade, 1, dt, 0.08, calm) || moving;

  const st = req.path.stage;
  // gate logic: the pins read the key once the token is in the keyway; the leaf follows the pins
  const atGate = pos.x >= st[2] - 1.5 && pos.x < st[2] + 30;
  if (req.valid) {
    moving = settle(pins, atGate || pos.x >= st[2] ? 1 : 0, dt, 0.16, calm) || moving;
    moving = settle(leaf, pins.x > 0.96 ? 1 : 0, dt, 0.2, calm) || moving;
  } else {
    if (atGate && refusedAt < 0) { refusedAt = clock; live.textContent = `${req.method} ${req.route}: ${t("denied")}`; }
    moving = settle(tag, refusedAt >= 0 ? 1 : 0, dt, 0.18, calm) || moving;
    if (refusedAt >= 0 && clock - refusedAt < 3) moving = true;
  }
  moving = settle(router, req.lane === "G" ? -1 : 1, dt, 0.12, calm) || moving;
  const swTarget = req.kind === "hit" && pos.x >= st[4] - 4 ? -1 : 1;
  moving = settle(sw, swTarget, dt, 0.1, calm) || moving;

  // the token: follows its target, held at the gate until the leaf is up and at the switch until it has thrown
  let goal = targetS();
  moving = roll(pos, goal, dt, calm) || moving;
  let limit = Infinity;
  if (req.valid && leaf.x < 0.9) limit = Math.min(limit, st[2]);
  if (req.kind === "hit" && Math.abs(sw.x - swTarget) > 0.2) limit = Math.min(limit, st[4]);
  if (pos.x > limit) { pos.x = limit; pos.v = Math.min(0, pos.v); }

  // gears spin while the request is being worked on at the logic step
  const working = req.kind !== "deny" && Math.abs(pos.x - st[3]) < 4 && step === 3;
  moving = settle(spin, working ? 1 : 0, dt, 0.35, calm) || moving;
  gearAngle += (calm ? 0 : spin.x * 2.6 * dt);
  if (spin.x > 1e-3) moving = true;

  // the cache commits what this request did once the token is past the drawers
  if (!req.committed && pos.x >= (st[5] ?? Infinity) + 4) {
    req.committed = true;
    if (req.kind === "miss" && cache.on) cache.projetos = true;
    if (req.kind === "post") cache.projetos = false;
  }
  moving = settle(shelfCard, cache.on && cache.projetos ? 1 : 0, dt, 0.18, calm) || moving;
  moving = settle(shutter, cache.on ? 0 : 1, dt, 0.22, calm) || moving;
  moving = settle(lever, cache.on ? 1 : -1, dt, 0.1, calm) || moving;
  moving = settle(ticketFade, ticketReq && ticketReq !== req ? 0 : 1, dt, 0.12, calm) || moving;
  if (ticketReq && ticketReq !== req) moving = true;

  draw(dt);
  frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

function begin(r) {
  if (req && req.kind !== "deny") {
    const wx = WHEELS[req.lane][0];
    if (pointAt(req.path, pos.x)[0] > wx + 10) wheelCount[req.lane]++;
  }
  req = r; step = 0; pos.x = 0; pos.v = 0; refusedAt = -1; tourClock = 0;
  tag.x = 0; tag.v = 0; pins.x = 0; pins.v = 0; leaf.x = 0; leaf.v = 0;
  stage.setAttribute("aria-valuemax", String(req.last + 1));
  describe();
}
function newRequest() {
  if (still.matches) { begin(makeRequest()); return; }
  swapping = true;
}
function describe() {
  const names = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`s${i}`));
  const here = Math.min(step, req.last);
  const name = req.kind === "deny" && here === 3 ? t("returned") : names[here];
  stage.setAttribute("aria-valuenow", String(here + 1));
  stage.setAttribute("aria-valuetext", `${req.method} ${req.route} · ${T[lang].step(here + 1, req.last + 1, name)}`);
}
function goTo(i) { step = clamp(i, 0, req.last); describe(); run(); }
function takeOver() {
  touring = false; tourClock = 0;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (held) return; touring = !still.matches; tourClock = 0; run(); }, 4200);
}

// ── pointer: the stages sit left to right; the pointer picks the one under it
const stageX = () => PATHS.miss.stage.map((s) => iso(pointAt(PATHS.miss, s), P)[0]);
let STAGE_X = stageX();
function svgX(event) {
  const m = svg.getScreenCTM();
  if (!m) return 0;
  const pt = svg.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY;
  return pt.matrixTransform(m.inverse()).x;
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  takeOver();
  const x = svgX(event);
  let i = 0;
  for (let j = 1; j < STAGE_X.length; j++) if (x >= (STAGE_X[j - 1] + STAGE_X[j]) / 2) i = j;
  if (i !== step) goTo(i);
});
stage.addEventListener("click", () => { takeOver(); newRequest(); run(); });
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = step + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = step - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = req.last;
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); takeOver(); newRequest(); run(); return; }
  if (event.key === "c" || event.key === "C") { event.preventDefault(); takeOver(); toggleCache(); return; }
  if (to === null) return;
  event.preventDefault(); takeOver(); goTo(to);
});
stepButtons.forEach((b) => b.addEventListener("click", () => { takeOver(); goTo(Number(b.dataset.step)); }));
newBtn.addEventListener("click", () => { takeOver(); newRequest(); run(); });
function toggleCache() {
  cache.on = !cache.on;
  if (!cache.on) cache.projetos = false;
  redecide();
  switchBtn.setAttribute("aria-checked", String(cache.on));
  switchBtn.querySelector("span").textContent = t(cache.on ? "cacheOn" : "cacheOff");
  live.textContent = t(cache.on ? "cacheOn" : "cacheOff");
  run();
}
switchBtn.addEventListener("click", () => { takeOver(); toggleCache(); });

// ── language
function applyLang() {
  figure.querySelectorAll("[data-t]").forEach((el) => {
    const key = el.dataset.t === "cacheOn" ? (cache.on ? "cacheOn" : "cacheOff") : el.dataset.t;
    const text = T[lang][key];
    if (typeof text === "string" && el.textContent !== text) el.textContent = text;
  });
  stepButtons.forEach((b, i) => b.setAttribute("aria-label", `${i + 1} ${t(`s${i}`)}`));
  stage.setAttribute("aria-label", t("label"));
  memo.clear(); seen.clear(); ticketEl.dataset.key = "";
  if (req) { describe(); draw(0); }
}
document.addEventListener("langchange", (event) => { lang = event.detail === "en" ? "en" : "pt"; applyLang(); });

// ── start
begin(makeRequest());
if (lang === "en") applyLang();
if (still.matches) { touring = false; step = 0; }
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
addEventListener("resize", () => { STAGE_X = stageX(); });
still.addEventListener?.("change", () => { touring = !still.matches; run(); });
draw(0);
let held = false;
window.__rq = { get req() { return req; }, get pos() { return pos.x; }, cache,
  hold() { held = true; touring = false; clearTimeout(idleTimer); },
  goTo(i) { takeOver(); goTo(i); }, newRequest() { takeOver(); newRequest(); run(); }, toggleCache() { takeOver(); toggleCache(); } };
}
