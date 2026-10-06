"use client";

import { useEffect, useRef } from "react";
import { InteractiveHoverLink } from "@/components/ui/interactive-hover-button";

/**
 * Returns the event's registration URL if it is a usable http(s) link, else
 * null. Uses the EVENTS sheet's REGISTRATION_LINK as-is (no hardcoded URLs);
 * non-URL values (blank, "TRUE", notes) → null. Which events may register at
 * all (not group events) is decided by RegistrationStatus.
 */
export function getRegistrationUrl(link: string | null | undefined): string | null {
  const value = link?.trim();
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    // Return the sheet's exact link (trimmed), not a normalised copy.
    return protocol === "https:" || protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/** How long a touch must be held before the link opens. */
const HOLD_MS = 500;
/** Finger travel that cancels the hold (the user is scrolling). */
const MOVE_TOLERANCE_PX = 10;

/**
 * Register button shared by the events listing cards and the event detail
 * page. Renders nothing when the event has no valid registration link.
 * Opens the exact link (e.g. the event's Tally form) in a new tab.
 *
 * Touch: press and hold for HOLD_MS (a red fill shows progress), then release
 * to open — so taps made while scrolling never open the form; a quick tap
 * does nothing. The link is opened from the touchend handler
 * (a user gesture, so iOS allows the new tab) by clicking the real anchor.
 * Mouse, keyboard and screen-reader activation (synthesised clicks without a
 * touch sequence) stay immediate. No React state: progress is driven by data
 * attributes + CSS.
 */
export function RegisterButton({
  registrationLink,
  className,
}: {
  registrationLink: string | null | undefined;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const hold = useRef({
    start: 0,
    x: 0,
    y: 0,
    active: false,
    readyTimer: 0,
    suppressClickUntil: 0,
    allowNextClick: false,
  });

  useEffect(() => {
    const h = hold.current;
    return () => window.clearTimeout(h.readyTimer);
  }, []);

  const href = getRegistrationUrl(registrationLink);
  if (!href) return null;

  const setFlag = (name: "holding" | "ready", on: boolean) => {
    const el = ref.current;
    if (!el) return;
    if (on) el.dataset[name] = "true";
    else delete el.dataset[name];
  };

  const endHold = () => {
    const h = hold.current;
    h.active = false;
    window.clearTimeout(h.readyTimer);
    setFlag("holding", false);
    setFlag("ready", false);
  };

  const onTouchStart = (e: React.TouchEvent<HTMLAnchorElement>) => {
    if (e.touches.length !== 1) return endHold();
    const h = hold.current;
    const t = e.touches[0];
    h.start = performance.now();
    h.x = t.clientX;
    h.y = t.clientY;
    h.active = true;
    setFlag("holding", true);
    window.clearTimeout(h.readyTimer);
    h.readyTimer = window.setTimeout(() => {
      if (!h.active) return;
      setFlag("ready", true);
      navigator.vibrate?.(15);
    }, HOLD_MS);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLAnchorElement>) => {
    const h = hold.current;
    if (!h.active) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - h.x, t.clientY - h.y) > MOVE_TOLERANCE_PX) endHold();
  };

  const onTouchEnd = () => {
    const h = hold.current;
    const wasActive = h.active;
    const held = wasActive && performance.now() - h.start >= HOLD_MS;
    endHold();
    // Swallow the browser's own click that follows this touch.
    h.suppressClickUntil = performance.now() + 800;
    if (held) {
      h.allowNextClick = true;
      ref.current?.click(); // real anchor click: same href / target / rel
    }
  };

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const h = hold.current;
    if (h.allowNextClick) {
      h.allowNextClick = false;
      return;
    }
    if (performance.now() < h.suppressClickUntil) e.preventDefault();
  };

  return (
    <InteractiveHoverLink
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      text="REGISTER"
      aria-label="Register"
      className={["select-none touch-manipulation", className].filter(Boolean).join(" ")}
      // No iOS link-preview / Android context menu on the long press.
      style={{ WebkitTouchCallout: "none" }}
      onContextMenu={(e) => {
        if (hold.current.active || performance.now() < hold.current.suppressClickUntil) e.preventDefault();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={endHold}
      onClick={onClick}
      draggable={false}
    >
      {/* Hold progress: fills left→right over HOLD_MS (duration-500); solid once ready
          (with reduced motion it appears dimmed, then solid when ready). */}
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left scale-x-0 bg-[#E02E0B] opacity-70 transition-transform duration-150
          group-data-[holding=true]/ihb:scale-x-100 group-data-[holding=true]/ihb:duration-500 group-data-[holding=true]/ihb:ease-linear
          group-data-[ready=true]/ihb:opacity-100"
      />
    </InteractiveHoverLink>
  );
}
