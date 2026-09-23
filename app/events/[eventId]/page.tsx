import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EVENTS } from "@/data/events";
import { RECORDED_RESULTS } from "@/data/mockResults";

export function generateStaticParams() {
  return EVENTS.map((event) => ({
    eventId: event.id,
  }));
}

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;
  const event = EVENTS.find((e) => e.id === eventId);

  if (!event) {
    notFound();
  }

  const results = RECORDED_RESULTS[event.id];

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-12 space-y-8">
      {/* Back Link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 font-display text-xs tracking-wider text-[#E3D28A]/70 hover:text-[#E02E0B] transition-colors"
      >
        <ArrowLeft size={14} />
        <span>BACK TO EVENTS</span>
      </Link>

      {/* Main Container with Lighter Stroke */}
      <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-hidden space-y-6 p-6 sm:p-8">
        {/* Event Image Placeholder */}
        <div className="w-full aspect-[21/9] bg-[#5A0E0B]/20 border border-[#E3D28A]/25 flex items-center justify-center text-xs text-[#E3D28A]/40 font-mono select-none">
          [ Event Image Placeholder ]
        </div>

        {/* Event Header */}
        <div className="space-y-2 border-b border-[#E3D28A]/25 pb-5">
          <div className="font-display text-[10px] tracking-widest text-[#E02E0B] uppercase">
            {event.category} {" / "} {event.participantType}
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[#E3D28A] uppercase">
            {event.name}
          </h1>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-body border-b border-[#E3D28A]/25 pb-6">
          <div>
            <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">
              VENUE
            </span>
            <span className="text-[#E3D28A]">
              {event.venue || "Venue to be announced"}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">
              SCHEDULE
            </span>
            <span className="text-[#E3D28A]">
              {event.schedule || "Schedule to be announced"}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">
              PARTICIPATION
            </span>
            <span className="text-[#E3D28A] uppercase">
              {event.participantType}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">
              SCORING CATEGORY
            </span>
            <span className="text-[#E3D28A] uppercase">
              {event.pointsCategory} {event.id === "painting-relay" && "(8/5/3 pts)"}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2 border-b border-[#E3D28A]/25 pb-6">
          <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">
            DESCRIPTION
          </h2>
          <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80 leading-relaxed">
            {event.description || "Official rules and description will be published once event registrations open."}
          </p>
        </div>

        {/* Registration Action */}
        <div className="space-y-2 border-b border-[#E3D28A]/25 pb-6">
          <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">
            REGISTRATION
          </h2>
          {event.registrationOpen ? (
            <button className="px-5 py-2.5 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-wider font-bold hover:bg-[#941108] transition-colors">
              REGISTER FOR EVENT
            </button>
          ) : (
            <p className="font-body text-xs text-[#E3D28A]/60 italic">
              Registration opens soon.
            </p>
          )}
        </div>

        {/* Results */}
        <div className="space-y-2">
          <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">
            RESULTS
          </h2>
          {results && results.placements.length > 0 ? (
            <div className="space-y-2 font-body text-xs">
              {results.placements.map((p) => (
                <div key={p.placement} className="flex justify-between py-1.5 border-b border-[#E3D28A]/20">
                  <span className="font-bold text-[#E3D28A]">
                    {p.placement}. {p.participantOrTeamName} ({p.teamId.toUpperCase()})
                  </span>
                  <span className="text-[#E02E0B] font-bold">+{p.pointsAwarded} PTS</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body text-xs text-[#E3D28A]/60 italic">
              Results will be published here upon event completion.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
