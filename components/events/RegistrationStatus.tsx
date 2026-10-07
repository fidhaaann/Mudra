import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event } from "@/types/event";
import { RegisterButton, getRegistrationUrl } from "./RegisterButton";

type RegistrationEvent = Pick<Event, "participantType" | "status" | "registrationLink">;

export type RegistrationState = "not-required" | "closed" | "open" | "pending";

/**
 * The single registration rule, used by the event detail page and the events
 * listing cards so an event always shows the same state everywhere. Inputs are
 * the event's own sheet data (participantType, status, REGISTRATION_LINK);
 * no event names or statuses are hardcoded. In priority order:
 *
 *  1. "group" (every group event, Painting Relay included) → "not-required":
 *     each house fields one team; a link in the sheet is ignored.
 *  2. any status other than "upcoming" (live or completed) → "closed":
 *     registration shuts automatically when the organiser sets STATUS to live
 *     or completed, even if a Tally link exists.
 *  3. upcoming + valid REGISTRATION_LINK → "open": the Register button.
 *  4. upcoming without a link → "pending" ("Registration opens soon.").
 */
export function getRegistrationState(event: RegistrationEvent): RegistrationState {
  if (event.participantType === "group") return "not-required";
  if (event.status !== "upcoming") return "closed";
  if (getRegistrationUrl(event.registrationLink)) return "open";
  return "pending";
}

/** Non-interactive "Registration closed" label (deliberately not button-like). */
export function RegistrationClosedLabel({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border border-[#E3D28A]/30 bg-[#110B0B]/90 font-display font-bold uppercase text-[#E3D28A]/70",
        compact ? "px-2 py-1 text-[8px] sm:text-[10px] tracking-wider" : "px-4 py-2 text-xs tracking-widest",
        className
      )}
    >
      <Lock aria-hidden="true" className={compact ? "h-2.5 w-2.5 sm:h-3 sm:w-3" : "h-3.5 w-3.5"} strokeWidth={2} />
      Registration closed
    </span>
  );
}

/** Registration area of the event detail page. */
export function RegistrationStatus({ event }: { event: RegistrationEvent }) {
  const state = getRegistrationState(event);

  if (state === "not-required") {
    return (
      <div className="text-center space-y-1 py-1">
        <p className="font-display text-xs font-bold tracking-widest text-[#E3D28A] uppercase">
          No registration required
        </p>
        <p className="font-body text-xs text-[#E3D28A]/70 leading-relaxed">
          Each team will have one team participating in this event.
        </p>
      </div>
    );
  }

  if (state === "closed") {
    return (
      <div className="flex justify-center">
        <RegistrationClosedLabel />
      </div>
    );
  }

  if (state === "open") {
    return (
      <div className="flex justify-center">
        <RegisterButton registrationLink={event.registrationLink} />
      </div>
    );
  }

  return <p className="font-body text-xs text-[#E3D28A]/60 italic">Registration opens soon.</p>;
}
