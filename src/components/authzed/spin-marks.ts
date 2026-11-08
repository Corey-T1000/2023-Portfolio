// Live, draggable SpiceDB marks on a 2D canvas. No dependencies.
//
//   import { initSpinMark } from "./spin-marks";
//   const mark = initSpinMark(el, "N3", { label: "SpiceDB garnet mark" });
//   mark.destroy(); // also runs by itself on astro:before-swap
//
// `el` is a container (a canvas is appended, 100% wide and square) or a canvas.
// Pose is three angles: theta about the mark's own spin axis, then roll, then tilt about the screen's x axis.
// Each solid is convex pieces split by exact planes, so draw order comes from which side of each plane the
// viewer is on. It holds at every angle, tilt and roll.
import { SPIN_MARK_DATA, type MarkId, type MarkData, type SortTree } from "./spin-marks-data";

export type { MarkId };
export interface SpinOptions {
  label?: string; // aria-label for the canvas; falls back to the element's own aria-label
  ground?: string; // tile colour, or "transparent" (seams then cut through to the page). Default #0c050f
  seed?: number; // fixes the orbit, for tests. Default: new every page load
}
export interface Pose {
  theta: number; // radians
  tilt: number; // radians, positive shows more of the top
  roll: number; // radians
}
export interface SpinController {
  destroy(): void;
  getPose(): Pose & { frames: number; drawMs: number; dragging: boolean; running: boolean };
  setPose(pose: Pose | null): void; // test hook: holds a pose; null hands back to the orbit
}

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const MAX_DPR = 2;
const FRAME = 960; // data units per canvas width
const INERTIA_TAU = 0.9; // s, decay of release speed back to the idle speed
const TILT_SPRING = 2.2; // rad/s, critically damped return to the idle tilt
const MAX_SPIN = 7; // rad/s, cap on release speed
const SEAM_TAPER = 0.08; // N3: seams narrow as a face turns edge-on, so the outline never jumps

type Range = [number, number];
// Separate ranges per mark, so two marks can never share a base speed. With the 6% speed wave, every
// revolution stays between 16 and 24 s.
const ORBIT: Record<MarkId, { seconds: Range; start: Range }> = {
  B2: { seconds: [17.2, 18.7], start: [12, 38] },
  N3: { seconds: [19, 20.7], start: [-38, -12] },
  F0: { seconds: [21.2, 22.5], start: [-24, 10] },
};

function makeOrbit(id: MarkId, seed: number) {
  // mulberry32
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (r: Range) => r[0] + (r[1] - r[0]) * rnd();
  const wave = (amp: Range, period: Range) => {
    const a = pick(amp) * DEG;
    const w = TAU / pick(period);
    const p = rnd() * TAU;
    return (t: number) => a * Math.sin(w * t + p);
  };
  const o = ORBIT[id];
  const tiltA = wave([2, 3.4], [13, 23]);
  const tiltB = wave([0.8, 1.5], [29, 41]);
  const rollA = wave([1.2, 2.4], [17, 31]);
  const speedW = TAU / pick([23, 37]);
  const speedP = rnd() * TAU;
  const omega = TAU / pick(o.seconds);
  return {
    start: pick(o.start) * DEG,
    speed: (t: number) => omega * (1 + 0.06 * Math.sin(speedW * t + speedP)),
    tilt: (t: number) => tiltA(t) + tiltB(t),
    roll: rollA,
  };
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function initSpinMark(el: HTMLElement, id: MarkId, opts: SpinOptions = {}): SpinController {
  const data: MarkData = SPIN_MARK_DATA[id];
  if (!data) throw new Error(`Unknown mark: ${id}`);

  const ownCanvas = !(el instanceof HTMLCanvasElement);
  const canvas = ownCanvas ? document.createElement("canvas") : (el as HTMLCanvasElement);
  const ground = opts.ground ?? "#0c050f";
  const transparent = ground === "transparent";
  const label = opts.label ?? el.getAttribute("aria-label");
  canvas.setAttribute("role", "img");
  if (label) canvas.setAttribute("aria-label", label);
  const prior = canvas.style.cssText;
  Object.assign(canvas.style, { display: "block", width: "100%", aspectRatio: "1", touchAction: "pan-y", cursor: "grab", userSelect: "none" });
  if (ownCanvas) el.appendChild(canvas);
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("2D canvas unavailable");
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const orbit = makeOrbit(id, opts.seed ?? Math.floor(Math.random() * 4294967296));
  const tiltMin = data.tilt[0] * DEG;
  const tiltMax = data.tilt[1] * DEG;
  const nv = data.v.length / 3;
  const nn = data.n.length / 3;
  const px = new Float32Array(nv);
  const py = new Float32Array(nv);
  const nz = new Float32Array(nn);
  const [ax, ay, az] = data.axis;

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reduceQuery.matches;
  let clock = 0;
  let theta = reduced ? 0 : orbit.start;
  let tilt = reduced ? 0 : orbit.tilt(0);
  let roll = reduced ? 0 : orbit.roll(0);
  let spinExtra = 0; // rad/s on top of the idle speed, decaying
  let tiltOff = 0; // tilt away from the idle tilt, springing back
  let tiltVel = 0;
  let held = false;
  let visible = true;
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let size = 0; // CSS px
  let dpr = 1;
  let frames = 0;
  let drawMs = 0;

  // ------------------------------------------------------------------ draw
  function transform() {
    // R = Rx(tilt) Rz(roll) Rot(axis, theta)
    const c = Math.cos(theta), s = Math.sin(theta), k = 1 - c;
    const a00 = c + ax * ax * k, a01 = ax * ay * k - az * s, a02 = ax * az * k + ay * s;
    const a10 = ay * ax * k + az * s, a11 = c + ay * ay * k, a12 = ay * az * k - ax * s;
    const a20 = az * ax * k - ay * s, a21 = az * ay * k + ax * s, a22 = c + az * az * k;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const b00 = cr * a00 - sr * a10, b01 = cr * a01 - sr * a11, b02 = cr * a02 - sr * a12;
    const b10 = sr * a00 + cr * a10, b11 = sr * a01 + cr * a11, b12 = sr * a02 + cr * a12;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const r10 = ct * b10 - st * a20, r11 = ct * b11 - st * a21, r12 = ct * b12 - st * a22;
    const r20 = st * b10 + ct * a20, r21 = st * b11 + ct * a21, r22 = st * b12 + ct * a22;
    const V = data.v;
    for (let i = 0; i < nv; i++) {
      const x = V[3 * i], y = V[3 * i + 1], z = V[3 * i + 2];
      px[i] = data.ox + b00 * x + b01 * y + b02 * z;
      py[i] = data.oy - (r10 * x + r11 * y + r12 * z);
    }
    const N = data.n;
    for (let i = 0; i < nn; i++) nz[i] = r20 * N[3 * i] + r21 * N[3 * i + 1] + r22 * N[3 * i + 2];
  }

  function tracePoly(p: number[]) {
    ctx.moveTo(px[p[2]], py[p[2]]);
    for (let j = 3; j < p.length; j++) ctx.lineTo(px[p[j]], py[p[j]]);
    ctx.closePath();
  }

  function seamInk() {
    ctx.globalCompositeOperation = transparent ? "destination-out" : "source-over";
    ctx.strokeStyle = transparent ? "#000" : ground;
  }

  function fillPiece(piece: number) {
    const [a, b] = data.pieces[piece];
    for (let i = a; i < b; i++) {
      const p = data.polys[i];
      if (nz[p[0]] <= 1e-7) continue;
      const col = data.c[p[1]];
      ctx.beginPath();
      tracePoly(p);
      ctx.fillStyle = col;
      ctx.fill();
      if (data.overlap) {
        // F0's faces meet with no seam: a hairline in the face's own colour closes the anti-aliasing crack
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.6 / (dpr * size / FRAME);
        ctx.stroke();
      }
    }
  }

  function tracePieces(tree: SortTree) {
    if (typeof tree === "number") {
      const [a, b] = data.pieces[tree];
      for (let i = a; i < b; i++) if (nz[data.polys[i][0]] > 1e-7) tracePoly(data.polys[i]);
      return;
    }
    tracePieces(tree[1]);
    tracePieces(tree[2]);
  }

  function drawTree(tree: SortTree, top: boolean) {
    if (typeof tree === "number") return fillPiece(tree);
    const nearIsA = nz[tree[0]] > 0; // viewer is on the + side, where branch 1 lies
    const near = nearIsA ? tree[1] : tree[2];
    const far = nearIsA ? tree[2] : tree[1];
    drawTree(far, false);
    if (top && data.halo) {
      // F0: the near block keeps a ground edge where it crosses the far block
      seamInk();
      ctx.lineWidth = data.halo;
      ctx.beginPath();
      tracePieces(near);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
    drawTree(near, false);
  }

  function draw() {
    if (!size) return;
    const t0 = performance.now();
    transform();
    const s = (dpr * size) / FRAME;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    if (transparent) ctx.clearRect(0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    drawTree(data.tree, true);
    if (data.stroke) {
      // B2: the master's stroke on every edge, silhouette included
      seamInk();
      ctx.lineWidth = data.stroke;
      ctx.beginPath();
      tracePieces(data.tree);
      ctx.stroke();
    }
    if (data.seams && data.seam) {
      // N3: internal edges and strata lines only, never the silhouette
      seamInk();
      for (const [a, b, f, g] of data.seams) {
        const m = g < 0 ? nz[f] : Math.min(nz[f], nz[g]);
        if (m <= 1e-7) continue;
        const u = Math.min(1, m / SEAM_TAPER);
        ctx.lineWidth = data.seam * u * u * (3 - 2 * u);
        ctx.beginPath();
        ctx.moveTo(px[a], py[a]);
        ctx.lineTo(px[b], py[b]);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    frames++;
    drawMs += performance.now() - t0;
  }

  // ------------------------------------------------------------------ motion
  let dragId: number | null = null;
  let dragMouse = false;
  let x0 = 0, y0 = 0, theta0 = 0, tilt0 = 0;
  let trail: { t: number; theta: number; tilt: number }[] = [];

  const radiusPx = () => Math.max(1, (data.r * size) / FRAME);
  const shouldRun = () => visible && !destroyed && !held && size > 0 && (!reduced || dragId !== null);

  function step(dt: number) {
    if (dragId !== null || reduced) return;
    clock += dt;
    theta = (theta + (orbit.speed(clock) + spinExtra) * dt) % TAU;
    spinExtra *= Math.exp(-dt / INERTIA_TAU);
    // critically damped spring for the tilt offset
    const a = -2 * TILT_SPRING * tiltVel - TILT_SPRING * TILT_SPRING * tiltOff;
    tiltVel += a * dt;
    tiltOff += tiltVel * dt;
    tilt = clamp(orbit.tilt(clock) + tiltOff, tiltMin, tiltMax);
    roll = orbit.roll(clock);
  }

  function tick(now: number) {
    raf = 0;
    if (destroyed) return;
    step(Math.min(0.05, Math.max(0, (now - last) / 1000)));
    last = now;
    draw();
    if (shouldRun()) raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (raf || destroyed || held || !size || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ drag
  function onDown(e: PointerEvent) {
    if (dragId !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    dragId = e.pointerId;
    dragMouse = e.pointerType !== "touch"; // touch leaves vertical to the page scroll
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    x0 = e.clientX;
    y0 = e.clientY;
    theta0 = theta;
    tilt0 = tilt;
    spinExtra = 0;
    tiltOff = 0;
    tiltVel = 0;
    trail = [{ t: e.timeStamp, theta, tilt }];
    kick();
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== dragId) return;
    const r = radiusPx();
    theta = theta0 + (e.clientX - x0) / r;
    if (dragMouse) tilt = clamp(tilt0 + (e.clientY - y0) / r, tiltMin, tiltMax);
    trail.push({ t: e.timeStamp, theta, tilt });
    if (trail.length > 8) trail.shift();
    kick();
  }

  function release(e: PointerEvent) {
    if (e.pointerId !== dragId) return;
    dragId = null;
    canvas.style.cursor = "grab";
    const now = e.timeStamp;
    const recent = trail.filter((s) => now - s.t < 100);
    if (reduced) {
      kick();
      return;
    }
    let spin = 0, vTilt = 0;
    if (recent.length > 1) {
      const a = recent[0], b = recent[recent.length - 1];
      const dt = Math.max(0.008, (b.t - a.t) / 1000);
      spin = (b.theta - a.theta) / dt;
      vTilt = (b.tilt - a.tilt) / dt;
    }
    spinExtra = clamp(spin, -MAX_SPIN, MAX_SPIN) - orbit.speed(clock); // speed is continuous at release
    tiltOff = tilt - orbit.tilt(clock);
    tiltVel = clamp(vTilt, -3, 3);
    kick();
  }

  // ------------------------------------------------------------------ lifecycle
  function resize() {
    const w = canvas.getBoundingClientRect().width;
    const d = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (w === size && d === dpr) return;
    size = w;
    dpr = d;
    const target = Math.max(1, Math.round(w * d));
    if (canvas.width !== target) canvas.width = canvas.height = target;
    draw();
    kick();
  }

  function onReduceChange() {
    reduced = reduceQuery.matches;
    spinExtra = 0;
    tiltOff = tilt - orbit.tilt(clock);
    tiltVel = 0;
    kick();
  }

  const resizeObs = new ResizeObserver(resize);
  const viewObs = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) kick();
  });

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  reduceQuery.addEventListener("change", onReduceChange);
  document.addEventListener("astro:before-swap", destroy, { once: true });
  resizeObs.observe(canvas);
  viewObs.observe(canvas);
  resize(); // first frame now, under reduced motion too

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    resizeObs.disconnect();
    viewObs.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", release);
    canvas.removeEventListener("pointercancel", release);
    reduceQuery.removeEventListener("change", onReduceChange);
    document.removeEventListener("astro:before-swap", destroy);
    if (ownCanvas) canvas.remove();
    else canvas.style.cssText = prior;
  }

  return {
    destroy,
    getPose: () => ({ theta, tilt, roll, frames, drawMs, dragging: dragId !== null, running: raf !== 0 }),
    setPose(pose) {
      held = pose !== null;
      if (pose) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        theta = pose.theta;
        tilt = pose.tilt;
        roll = pose.roll;
        draw();
      } else kick();
    },
  };
}
