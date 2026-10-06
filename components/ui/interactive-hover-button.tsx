import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * InteractiveHoverButton — label slides out, a red fill expands from a dot and
 * the label returns with an arrow. CSS transitions only (no JS state).
 *
 * Adapted to this codebase:
 *  - MUDRA palette instead of shadcn theme tokens (not defined here).
 *  - Named group (`group/ihb`) so an enclosing `group` (e.g. an event card)
 *    does not trigger the animation.
 *  - The duplicated label/arrow are aria-hidden, so the accessible name is the
 *    text once.
 *  - `hover:` variants only apply on hover-capable devices (Tailwind v4), so a
 *    tap on touch screens activates immediately; reduced motion disables the
 *    transitions.
 *
 * `InteractiveHoverButton` renders a <button>; `InteractiveHoverLink` renders
 * the same visuals as an <a> for navigation (keeps link semantics, new-tab
 * behaviour and middle-click).
 */

const ROOT_CLASS =
  "group/ihb relative inline-flex w-40 h-10 cursor-pointer items-center justify-center overflow-hidden " +
  "border border-[#E02E0B] bg-[#110B0B] text-center font-display text-xs font-bold uppercase tracking-widest text-[#E3D28A] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-[#E3D28A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#110B0B]";

const MOTION = "transition-all duration-300 motion-reduce:transition-none";

function InteractiveHoverContent({ text }: { text: string }) {
  return (
    <>
      <span
        className={cn(
          "relative inline-block translate-x-1",
          MOTION,
          "group-hover/ihb:translate-x-12 group-hover/ihb:opacity-0 group-focus-visible/ihb:translate-x-12 group-focus-visible/ihb:opacity-0"
        )}
      >
        {text}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-[#E3D28A] opacity-0",
          MOTION,
          "group-hover/ihb:-translate-x-1 group-hover/ihb:opacity-100 group-focus-visible/ihb:-translate-x-1 group-focus-visible/ihb:opacity-100"
        )}
      >
        <span>{text}</span>
        <ArrowRight size={14} aria-hidden="true" />
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "absolute left-[20%] top-[40%] h-2 w-2 scale-100 rounded-lg bg-[#E02E0B]",
          MOTION,
          "group-hover/ihb:left-0 group-hover/ihb:top-0 group-hover/ihb:h-full group-hover/ihb:w-full group-hover/ihb:scale-[1.8]",
          "group-focus-visible/ihb:left-0 group-focus-visible/ihb:top-0 group-focus-visible/ihb:h-full group-focus-visible/ihb:w-full group-focus-visible/ihb:scale-[1.8]"
        )}
      />
    </>
  );
}

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
}

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text = "Button", className, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(ROOT_CLASS, className)} {...props}>
    <InteractiveHoverContent text={text} />
  </button>
));

InteractiveHoverButton.displayName = "InteractiveHoverButton";

interface InteractiveHoverLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  text?: string;
}

const InteractiveHoverLink = React.forwardRef<
  HTMLAnchorElement,
  InteractiveHoverLinkProps
>(({ text = "Button", className, children, ...props }, ref) => (
  <a ref={ref} className={cn(ROOT_CLASS, className)} {...props}>
    {/* Optional extra layers (e.g. a press-and-hold indicator) beneath the label */}
    {children}
    <InteractiveHoverContent text={text} />
  </a>
));

InteractiveHoverLink.displayName = "InteractiveHoverLink";

export { InteractiveHoverButton, InteractiveHoverLink };
