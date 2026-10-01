"use client";

/**
 * TeamNameLanguageTransition
 * ──────────────────────────
 * Alternates a team's English and Malayalam wordmark artwork using the
 * React Bits "Shuffle" strip mechanism: the mark is cut into vertical strips,
 * each strip holds a two-cell track (current over next), and GSAP slides the
 * tracks upward with a small stagger so the new language resolves in place.
 *
 * Because the names are lettered images (not text), Malayalam conjuncts,
 * vowel signs and chillu marks are never split by a text splitter — each strip
 * is just a horizontal window onto the finished artwork.
 *
 * - One shared clock keeps every instance on the page in the same language.
 * - Off-screen / hidden-tab instances snap instead of animating.
 * - prefers-reduced-motion shows the static English mark.
 * - Fixed box size (max of both marks) → no layout shift.
 */

import { memo, useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import type { Wordmark } from "@/lib/team-wordmarks";

type Lang = "en" | "ml";

const INTERVAL_MS = 4000;
const DURATION = 0.45;
const STAGGER = 0.03;
const EASE = "power3.out";

// ─── shared language clock ───────────────────────────────────────────────────

type Listener = (lang: Lang) => void;
const listeners = new Set<Listener>();
let currentLang: Lang = "en";
let timer: number | null = null;

function subscribeClock(fn: Listener): () => void {
  listeners.add(fn);
  if (timer === null) {
    timer = window.setInterval(() => {
      currentLang = currentLang === "en" ? "ml" : "en";
      listeners.forEach((l) => l(currentLang));
    }, INTERVAL_MS);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
      currentLang = "en";
    }
  };
}

// ─── reduced motion ──────────────────────────────────────────────────────────

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(cb: () => void): () => void {
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export interface TeamNameLanguageTransitionProps {
  englishName: string;
  malayalamName: string;
  english: Wordmark;
  malayalam: Wordmark;
  /** Rendered height in em, so the mark scales with the surrounding text size. */
  height?: number;
  /** Number of vertical shuffle strips. */
  strips?: number;
  className?: string;
}

function TeamNameLanguageTransition({
  englishName,
  malayalamName,
  english,
  malayalam,
  height = 1.5,
  strips = 10,
  className,
}: TeamNameLanguageTransitionProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  const width = Math.max(english.aspect, malayalam.aspect) * height;
  const stripW = width / strips;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const tracks = Array.from(root.querySelectorAll<HTMLElement>("[data-track]"));
    const fronts = Array.from(root.querySelectorAll<HTMLElement>("[data-front]"));
    const backs = Array.from(root.querySelectorAll<HTMLElement>("[data-back]"));

    const setLang = (els: HTMLElement[], lang: Lang) =>
      els.forEach((el) => {
        if (lang === "ml") el.dataset.lang = "ml";
        else delete el.dataset.lang;
      });

    const snap = (lang: Lang) => {
      setLang(fronts, lang);
      setLang(backs, lang);
      gsap.set(tracks, { clearProps: "transform" });
    };

    if (reducedMotion) {
      snap("en");
      return;
    }

    let shown: Lang = "en";
    let visible = true;
    let ready = false;
    let tl: gsap.core.Timeline | null = null;

    // Only animate once both marks are decoded, so no strip shows a blank cell.
    let cancelled = false;
    Promise.all(
      [english.src, malayalam.src].map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      })
    ).then(() => {
      if (!cancelled) ready = true;
    });

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(root);

    const go = (lang: Lang) => {
      if (lang === shown) return;
      tl?.progress(1).kill();
      tl = null;
      shown = lang;

      if (!ready || !visible || document.hidden) {
        snap(lang);
        return;
      }

      setLang(backs, lang);
      tl = gsap.timeline({
        onComplete: () => {
          setLang(fronts, lang);
          gsap.set(tracks, { clearProps: "transform" });
          tl = null;
        },
      });
      tl.fromTo(
        tracks,
        { yPercent: 0 },
        { yPercent: -50, duration: DURATION, ease: EASE, stagger: STAGGER, force3D: true }
      );
    };

    // Join the shared clock in whatever language the page is currently showing.
    snap(currentLang);
    shown = currentLang;
    const unsubscribe = subscribeClock(go);

    return () => {
      cancelled = true;
      unsubscribe();
      io.disconnect();
      tl?.kill();
      gsap.set(tracks, { clearProps: "transform" });
    };
  }, [reducedMotion, english.src, malayalam.src]);

  const vars = {
    "--en-img": `url("${english.src}")`,
    "--ml-img": `url("${malayalam.src}")`,
    "--en-size": `${english.aspect * height}em ${height}em`,
    "--ml-size": `${malayalam.aspect * height}em ${height}em`,
  } as CSSProperties;

  const cell =
    "block h-1/2 w-full bg-no-repeat [background-image:var(--en-img)] [background-size:var(--en-size)] " +
    "data-[lang=ml]:[background-image:var(--ml-img)] data-[lang=ml]:[background-size:var(--ml-size)]";

  return (
    <span
      ref={rootRef}
      role="img"
      aria-label={`${englishName} (${malayalamName})`}
      className={cn("relative inline-block overflow-hidden align-middle", className)}
      style={{ ...vars, width: `${width}em`, height: `${height}em` }}
    >
      {Array.from({ length: strips }, (_, i) => {
        const pos = { backgroundPosition: `${-i * stripW}em 0` };
        return (
          <span
            key={i}
            data-track
            className="absolute top-0 block h-[200%]"
            style={{ left: `${i * stripW}em`, width: `${stripW}em` }}
          >
            <span data-front className={cell} style={pos} />
            <span data-back className={cell} style={pos} />
          </span>
        );
      })}
    </span>
  );
}

export default memo(TeamNameLanguageTransition);
