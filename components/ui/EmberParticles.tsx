"use client";

import { useEffect, useRef } from "react";

type Kind = "ember" | "spark";

interface Particle {
  kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  depth: number;
  rotation: number; rotSpeed: number;
  life: number; lifeSpeed: number;
  alpha: number; targetAlpha: number;
  wobble: number; wobbleSpeed: number; wobbleAmp: number;
  colorIdx: number;
}

const COLORS = [
  { r: 224, g:  46, b:  11 },
  { r: 238, g: 136, b:  20 },
  { r: 255, g: 160, b:  20 },
  { r: 255, g: 120, b:   8 },
  { r: 200, g:  60, b:   0 },
  { r: 255, g: 200, b:  60 },
];

const MAX_EMBERS = 30;
const MAX_SPARKS = 22;
const CURSOR_RADIUS = 100;

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function makeEmberTex(sz: number, r: number, g: number, b: number) {
  const d = sz * 2 + 2;
  const c = document.createElement("canvas");
  c.width = d; c.height = d;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(d/2, d/2, 0, d/2, d/2, d/2);
  gr.addColorStop(0,   `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.3, `rgba(${r},${g},${b},0.7)`);
  gr.addColorStop(0.7, `rgba(${Math.min(r+20,255)},${Math.min((g/2)|0,80)},0,0.2)`);
  gr.addColorStop(1,   `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, d, d);
  return c;
}

function makeSparkTex(len: number, r: number, g: number, b: number) {
  const W = len * 2 + 4, H = 8;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createLinearGradient(0, H/2, W, H/2);
  gr.addColorStop(0,    `rgba(${r},${g},${b},0)`);
  gr.addColorStop(0.35, `rgba(${r},${g},${b},0.5)`);
  gr.addColorStop(0.5,  `rgba(${Math.min(r+40,255)},${Math.min(g+40,255)},${Math.min(b+40,255)},1)`);
  gr.addColorStop(0.65, `rgba(${r},${g},${b},0.5)`);
  gr.addColorStop(1,    `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.ellipse(W/2, H/2, W/2, H/2 * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function spawn(kind: Kind, W: number, H: number): Particle {
  const depth = rnd(0.15, 1);
  const colorIdx = Math.floor(Math.random() * COLORS.length);
  if (kind === "ember") {
    return {
      kind, colorIdx, depth,
      x: rnd(0, W), y: rnd(H * 0.25, H + 20),
      vx: rnd(-0.2, 0.2), vy: rnd(-0.7, -0.2) * depth,
      size: rnd(2, 6) * depth,
      rotation: 0, rotSpeed: 0,
      life: rnd(0.4, 1), lifeSpeed: rnd(0.0008, 0.0025),
      alpha: 0, targetAlpha: rnd(0.25, 0.65) * depth,
      wobble: rnd(0, Math.PI * 2), wobbleSpeed: rnd(0.01, 0.028), wobbleAmp: rnd(0.15, 0.55),
    };
  }
  const angle = rnd(-Math.PI * 0.55, -Math.PI * 0.45);
  const speed = rnd(1.2, 3.5) * depth;
  return {
    kind, colorIdx, depth,
    x: rnd(0, W), y: rnd(H * 0.3, H),
    vx: Math.cos(angle) * speed * rnd(0.3, 1), vy: Math.sin(angle) * speed,
    size: rnd(6, 22) * depth,
    rotation: angle, rotSpeed: rnd(-0.025, 0.025),
    life: rnd(0.5, 1), lifeSpeed: rnd(0.003, 0.009),
    alpha: 0, targetAlpha: rnd(0.35, 0.8) * depth,
    wobble: rnd(0, Math.PI * 2), wobbleSpeed: rnd(0.015, 0.035), wobbleAmp: rnd(0.05, 0.25),
  };
}

export function EmberParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;

    const emberTex = COLORS.map(c => [4,6,9,13].map(sz => makeEmberTex(sz, c.r, c.g, c.b)));
    const sparkTex = COLORS.map(c => [8,14,20,28].map(l  => makeSparkTex(l,  c.r, c.g, c.b)));

    const particles: Particle[] = [
      ...Array.from({ length: MAX_EMBERS }, () => { const p = spawn("ember", W, H); p.life = Math.random(); p.alpha = p.targetAlpha * Math.random(); return p; }),
      ...Array.from({ length: MAX_SPARKS  }, () => { const p = spawn("spark",  W, H); p.life = Math.random(); p.alpha = p.targetAlpha * Math.random(); return p; }),
    ];

    let animId: number;
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    const onMove   = (e: MouseEvent) => { cursorRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);

    function tick() {
      ctx!.clearRect(0, 0, W, H);
      const { x: cx, y: cy } = cursorRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const expectedKind: Kind = i < MAX_EMBERS ? "ember" : "spark";
        p.life -= p.lifeSpeed;
        const dx = p.x - cx, dy = p.y - cy;
        const near = Math.sqrt(dx*dx + dy*dy) < CURSOR_RADIUS;
        if (near) { p.alpha = Math.max(0, p.alpha - 0.03); }
        else if (p.life > 0.12) { p.alpha += (p.targetAlpha - p.alpha) * 0.055; }
        else { p.alpha = Math.max(0, p.alpha - 0.01); }
        if (p.life <= 0 || (near && p.alpha <= 0.005)) { particles[i] = spawn(expectedKind, W, H); continue; }
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * p.wobbleAmp;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (p.x < -30) p.x = W + 30;
        if (p.x > W+30) p.x = -30;
        if (p.y < -40) { particles[i] = spawn(expectedKind, W, H); continue; }
        const a = Math.max(0, Math.min(1, p.alpha));
        if (a < 0.005) continue;
        ctx!.save();
        ctx!.globalAlpha = a;
        ctx!.globalCompositeOperation = "screen";
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        const texArr = p.kind === "ember"
          ? emberTex[p.colorIdx]?.[Math.min(3, (p.size/4)|0)]
          : sparkTex[p.colorIdx]?.[Math.min(3, (p.size/8)|0)];
        if (texArr) ctx!.drawImage(texArr, -texArr.width/2, -texArr.height/2);
        ctx!.restore();
      }
      animId = requestAnimationFrame(tick);
    }
    tick();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); window.removeEventListener("mousemove", onMove); };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-[1] pointer-events-none" />;
}
