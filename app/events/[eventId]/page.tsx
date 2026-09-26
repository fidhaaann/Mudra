"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { Event } from "@/types/event";
import { EventResult } from "@/types/result";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params?.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [results, setResults] = useState<EventResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEventData = useCallback(async () => {
    if (!eventId) return;

    try {
      // Parallel fetch for event details and results
      const [eventRes, resultsRes] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}`),
        fetch(`/api/events/${encodeURIComponent(eventId)}/results`),
      ]);

      if (eventRes.status === 404) {
        throw new Error("Event not found");
      }
      if (!eventRes.ok) {
        throw new Error(`Failed to load event details (Status: ${eventRes.status})`);
      }

      const eventData = await eventRes.json();
      setEvent(eventData.event);
      setError(null);

      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults(resultsData.results || null);
      }
    } catch (err) {
      console.error("Error fetching event details:", err);
      setError(err instanceof Error ? err.message : "Failed to load event details");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      if (!eventId) return;
      try {
        const [eventRes, resultsRes] = await Promise.all([
          fetch(`/api/events/${encodeURIComponent(eventId)}`),
          fetch(`/api/events/${encodeURIComponent(eventId)}/results`),
        ]);

        if (eventRes.status === 404) {
          throw new Error("Event not found");
        }
        if (!eventRes.ok) {
          throw new Error(`Failed to load event details (Status: ${eventRes.status})`);
        }

        const eventData = await eventRes.json();
        if (!ignore) {
          setEvent(eventData.event);
          setError(null);
        }

        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          if (!ignore) {
            setResults(resultsData.results || null);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error("Error fetching event details:", err);
          setError(err instanceof Error ? err.message : "Failed to load event details");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      ignore = true;
    };
  }, [eventId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchEventData();
  };

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-28 pb-16 space-y-8">
      {/* Back Link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 font-display text-xs tracking-wider text-[#E3D28A]/70 hover:text-[#E02E0B] transition-colors"
      >
        <ArrowLeft size={14} />
        <span>BACK TO EVENTS</span>
      </Link>

      {/* Loading State */}
      {loading && (
        <div className="border border-[#E3D28A]/20 bg-[#110B0B] p-6 sm:p-8 space-y-6 animate-pulse">
          <div className="w-full aspect-[21/9] bg-[#5A0E0B]/10 border border-[#E3D28A]/10" />
          <div className="h-6 bg-[#E3D28A]/10 w-2/3 rounded-sm" />
          <div className="h-4 bg-[#E3D28A]/10 w-1/3 rounded-sm" />
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E3D28A]/10">
            <div className="h-12 bg-[#E3D28A]/10 rounded-sm" />
            <div className="h-12 bg-[#E3D28A]/10 rounded-sm" />
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="border border-[#E02E0B]/40 bg-[#5A0E0B]/10 p-8 text-center space-y-4">
          <div className="flex justify-center text-[#E02E0B]">
            <AlertCircle size={32} />
          </div>
          <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-wider font-bold hover:bg-[#941108] transition-colors"
            >
              <RefreshCw size={14} />
              <span>RETRY</span>
            </button>
            <Link
              href="/events"
              className="px-4 py-2 border border-[#E3D28A]/30 text-[#E3D28A] font-display text-xs uppercase tracking-wider hover:border-[#E3D28A] transition-colors"
            >
              ALL EVENTS
            </Link>
          </div>
        </div>
      )}

      {/* Event Details Content */}
      {!loading && !error && event && (
        <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-hidden space-y-6 p-6 sm:p-8">
          {/* Event Image if available, otherwise clean placeholder */}
          {event.imageUrl ? (
            <div className="w-full aspect-[21/9] bg-[#5A0E0B]/20 border border-[#E3D28A]/25 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.imageUrl}
                alt={event.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-[21/9] bg-[#5A0E0B]/10 border border-[#E3D28A]/20 flex items-center justify-center text-xs text-[#E3D28A]/30 font-display tracking-widest uppercase select-none">
              MUDRA 2026
            </div>
          )}

          {/* Event Header */}
          <div className="space-y-2 border-b border-[#E3D28A]/25 pb-5">
            <div className="flex items-center justify-between">
              <div className="font-display text-[10px] tracking-widest text-[#E02E0B] uppercase">
                {event.category} {" / "} {event.participantType}
              </div>
              <span
                className={`font-display text-[10px] tracking-wider uppercase font-bold px-2 py-0.5 border ${
                  event.status === "completed"
                    ? "border-[#E3D28A] text-[#E3D28A] bg-[#E3D28A]/10"
                    : event.status === "live"
                    ? "border-[#E02E0B] text-[#E02E0B] bg-[#E02E0B]/10 animate-pulse"
                    : "border-[#E3D28A]/30 text-[#E3D28A]/60"
                }`}
              >
                {event.status}
              </span>
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
                {event.pointsCategory}
              </span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-2 border-b border-[#E3D28A]/25 pb-6">
              <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">
                DESCRIPTION
              </h2>
              <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80 leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}

          {/* Registration Section */}
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

          {/* Results Section */}
          <div className="space-y-3">
            <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">
              RESULTS
            </h2>
            {results && results.placements && results.placements.length > 0 ? (
              <div className="space-y-2 font-body text-xs">
                {results.placements.map((p) => (
                  <div
                    key={p.placement}
                    className="flex justify-between items-center py-2 border-b border-[#E3D28A]/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-[#E3D28A]">
                        #{p.placement}
                      </span>
                      <span className="text-[#E3D28A]">
                        {p.participantOrTeamName}
                      </span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 border border-[#E3D28A]/30 text-[#E3D28A]/70 font-mono">
                        {p.teamId}
                      </span>
                    </div>
                    <span className="text-[#E02E0B] font-bold">
                      +{p.pointsAwarded} PTS
                    </span>
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
      )}
    </div>
  );
}
