import type { Event } from "@/types/event";
import { RegisterButton, getRegistrationUrl } from "./RegisterButton";

/**
 * Registration area for an event, driven by the competition rule:
 *
 *  - participantType "group" (every group event, Painting Relay included):
 *    no registration at all — each house fields exactly one team — so show an
 *    informational note and never a Register button, whatever the sheet's
 *    REGISTRATION_LINK holds.
 *  - "solo" / "duo": unchanged — the Register button when REGISTRATION_LINK is
 *    a valid link, otherwise the existing "Registration opens soon." note.
 *
 * participantType comes from the EVENTS sheet (normalised server-side to
 * "solo" | "duo" | "group"); no event names are hardcoded.
 */
export function RegistrationStatus({
  event,
}: {
  event: Pick<Event, "participantType" | "registrationLink">;
}) {
  if (event.participantType === "group") {
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

  if (getRegistrationUrl(event.registrationLink)) {
    return (
      <div className="flex justify-center">
        <RegisterButton registrationLink={event.registrationLink} />
      </div>
    );
  }

  return <p className="font-body text-xs text-[#E3D28A]/60 italic">Registration opens soon.</p>;
}
