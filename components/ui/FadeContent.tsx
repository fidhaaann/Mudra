"use client";

/**
 * FadeContent — React Bits FadeContent (JavaScript + CSS variant)
 * ────────────────────────────────────────────────────────────────
 * Source: https://www.reactbits.dev/animations/fade-content
 * TypeScript port with one additional prop: `trigger` (boolean).
 *
 * When `trigger` is omitted or false the component uses GSAP ScrollTrigger
 * exactly as the original — the animation fires when the element scrolls
 * into the viewport past `threshold`.
 *
 * When `trigger` is set to `true` the animation plays immediately without
 * waiting for a scroll event. This is required for above-the-fold content
 * (the MUDRA hero) where ScrollTrigger never fires because the element is
 * already visible.
 *
 * Cleanup: on unmount the ScrollTrigger instance, the GSAP timeline, and
 * any active tweens on the element are all killed to prevent memory leaks.
 */

import { useRef, useEffect, CSSProperties, ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Convert a value to seconds. Values > 10 are assumed to be milliseconds. */
function toSeconds(val: number): number {
  return val > 10 ? val / 1000 : val;
}

export interface FadeContentProps {
  children: ReactNode;
  /** Optional scroll container selector or element. Defaults to window. */
  container?: string | HTMLElement | null;
  /** Apply a 10px blur that resolves to 0 during the fade. */
  blur?: boolean;
  /** Animation duration. Values >10 are treated as ms; ≤10 as seconds. */
  duration?: number;
  /** GSAP easing string. */
  ease?: string;
  /** Delay before the animation starts. Same unit convention as duration. */
  delay?: number;
  /** 0–1 fraction of the element that must be visible to trigger. */
  threshold?: number;
  /** Starting opacity. */
  initialOpacity?: number;
  /**
   * When true, plays the animation immediately without waiting for a scroll
   * event. Use this for above-the-fold elements where ScrollTrigger never
   * fires, such as the hero section after the loading intro completes.
   * The effect re-runs whenever this prop changes from false → true.
   */
  trigger?: boolean;
  /** Auto-disappear after this many seconds (0 = disabled). */
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

const FadeContent: React.FC<FadeContentProps> = ({
  children,
  container,
  blur = false,
  duration = 1000,
  ease = "power2.out",
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  trigger,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power2.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // ── ScrollTrigger path (default, for below-the-fold use) ─────────────────
  useEffect(() => {
    // Skip setup when the programmatic trigger is active — that effect handles it
    if (trigger !== undefined && trigger !== false) return;

    const el = ref.current;
    if (!el) return;

    let scrollerTarget: string | HTMLElement | Window | null = null;
    if (container) {
      scrollerTarget =
        typeof container === "string"
          ? document.querySelector<HTMLElement>(container)
          : container;
    }
    if (!scrollerTarget) {
      scrollerTarget =
        document.getElementById("snap-main-container") ?? window;
    }

    const startPct = (1 - threshold) * 100;

    gsap.set(el, {
      autoAlpha: initialOpacity,
      filter: blur ? "blur(10px)" : "blur(0px)",
      willChange: "opacity, filter, transform",
    });

    const tl = gsap.timeline({
      paused: true,
      delay: toSeconds(delay),
      onComplete: () => {
        // Drop the resting blur(0px) filter and layer hint so the settled
        // content isn't kept on a filtered layer (causes flicker/pop).
        gsap.set(el, { clearProps: "filter,willChange" });
        onComplete?.();
        if (disappearAfter > 0) {
          gsap.to(el, {
            autoAlpha: initialOpacity,
            filter: blur ? "blur(10px)" : "blur(0px)",
            delay: toSeconds(disappearAfter),
            duration: toSeconds(disappearDuration),
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.(),
          });
        }
      },
    });

    tl.to(el, {
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: toSeconds(duration),
      ease,
    });

    const st = ScrollTrigger.create({
      trigger: el,
      scroller: scrollerTarget,
      start: `top ${startPct}%`,
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      st.kill();
      tl.kill();
      gsap.killTweensOf(el);
    };
    // deps deliberately limited — matches original React Bits behaviour
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Programmatic trigger path (for hero / above-the-fold use) ────────────
  useEffect(() => {
    if (!trigger) return;

    const el = ref.current;
    if (!el) return;

    gsap.set(el, {
      autoAlpha: initialOpacity,
      filter: blur ? "blur(10px)" : "blur(0px)",
      willChange: "opacity, filter, transform",
    });

    const tl = gsap.timeline({
      delay: toSeconds(delay),
      onComplete: () => {
        // Drop the resting blur(0px) filter and layer hint so the settled
        // content isn't kept on a filtered layer (causes flicker/pop).
        gsap.set(el, { clearProps: "filter,willChange" });
        onComplete?.();
        if (disappearAfter > 0) {
          gsap.to(el, {
            autoAlpha: initialOpacity,
            filter: blur ? "blur(10px)" : "blur(0px)",
            delay: toSeconds(disappearAfter),
            duration: toSeconds(disappearDuration),
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.(),
          });
        }
      },
    });

    tl.to(el, {
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: toSeconds(duration),
      ease,
    });

    return () => {
      tl.kill();
      gsap.killTweensOf(el);
    };
    // Re-runs only when trigger flips true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

export default FadeContent;
