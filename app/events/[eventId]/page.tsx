"use client";

import React, { useReducer, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { Event } from "@/types/event";
import { RegistrationStatus } from "@/components/events/RegistrationStatus";
import { EventResult } from "@/types/result";

// ─── fetch state machine ──────────────────────────────────────────────────────
// Same pattern as the events list page — useReducer avoids setState-in-effect.

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      event: Event;
      results: EventResult | null;
      resultsError: string | null;
    };

type FetchAction =
  | { type: "retry" }
  | {
      type: "success";
      event: Event;
      results: EventResult | null;
      resultsError: string | null;
    }
  | { type: "failure"; message: string };

function fetchReducer(_: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "retry":   return { status: "loading" };
    case "success":
      return {
        status: "ok",
        event: action.event,
        results: action.results,
        resultsError: action.resultsError,
      };
    case "failure": return { status: "error", message: action.message };
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function friendlyError(status: number): string {
  if (status === 404) return "Event not found.";
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  return `Unable to load event details. Please try again.`;
}

function friendlyResultsError(status: number): string {
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  return "Unable to load event results. Please try again.";
}

function resultLabel(event: Event, placement: EventResult["placements"][number]): string {
  return event.participantType === "group"
    ? placement.teamId.toUpperCase()
    : placement.participantOrTeamName;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const params  = useParams();
  const eventId = params?.eventId as string;

  const [state, dispatch] = useReducer(fetchReducer, { status: "loading" });

  // The effect re-runs whenever status flips back to "loading" (via retry).
  // All dispatch() calls happen asynchronously in .then()/.catch() —
  // never synchronously at the top of the effect body.
  useEffect(() => {
    if (state.status !== "loading") return;
    if (!eventId) {
      dispatch({ type: "failure", message: "No event ID provided." });
      return;
    }

    let cancelled = false;

    // One parallel fetch — two requests, counted once against the rate limit window
    Promise.all([
      fetch(`/api/events/${encodeURIComponent(eventId)}`),
      fetch(`/api/events/${encodeURIComponent(eventId)}/results`),
    ])
      .then(async ([eventRes, resultsRes]) => {
        if (cancelled) return;

        if (!eventRes.ok) {
          dispatch({ type: "failure", message: friendlyError(eventRes.status) });
          return;
        }

        const eventData = await eventRes.json();

        let results: EventResult | null = null;
        let resultsError: string | null = null;
        if (resultsRes.ok) {
          const rd = await resultsRes.json();
          results = rd.results ?? null;
        } else {
          resultsError = friendlyResultsError(resultsRes.status);
        }

        if (!cancelled) {
          dispatch({ type: "success", event: eventData.event, results, resultsError });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: "failure", message: "Unable to connect. Please check your connection." });
        }
      });

    return () => { cancelled = true; };
  }, [state.status, eventId]);

  const handleRetry = () => dispatch({ type: "retry" });

  const loading = state.status === "loading";
  const error   = state.status === "error"   ? state.message : null;
  const event   = state.status === "ok"      ? state.event   : null;
  const results = state.status === "ok"      ? state.results : null;
  const resultsError = state.status === "ok" ? state.resultsError : null;
  const isFinished = event?.status === "completed";
  const isLive = event?.status === "live";

  return (
    <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 pt-28 pb-16 space-y-8 min-w-0">
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
        <div className="border border-[#E3D28A]/20 bg-[#110B0B] p-5 sm:p-8 lg:p-10 flex flex-col gap-6 lg:flex-row lg:gap-10 animate-pulse">
          <div className="w-full max-w-60 sm:max-w-72 mx-auto shrink-0 lg:mx-0 lg:w-72 lg:max-w-none xl:w-80 aspect-4/5 bg-[#5A0E0B]/10 border border-[#E3D28A]/10" />
          <div className="min-w-0 flex-1 space-y-6">
            <div className="h-6 bg-[#E3D28A]/10 w-2/3 rounded-sm" />
            <div className="h-4 bg-[#E3D28A]/10 w-1/3 rounded-sm" />
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E3D28A]/10">
              <div className="h-12 bg-[#E3D28A]/10 rounded-sm" />
              <div className="h-12 bg-[#E3D28A]/10 rounded-sm" />
            </div>
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
        // ID-card layout from lg: poster column (fixed width, 4:5) on the left,
        // details on the right; stacks vertically on narrower screens.
        <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-hidden p-5 sm:p-8 lg:p-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          {/* Poster — 4:5, full poster visible (object-contain) */}
          <div className="w-full max-w-60 sm:max-w-72 mx-auto shrink-0 lg:mx-0 lg:w-72 lg:max-w-none xl:w-80">
            {event.imageUrl ? (
              <div className="w-full aspect-4/5 bg-[#5A0E0B]/20 border border-[#E3D28A]/25 overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.imageUrl}
                  alt={event.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full aspect-4/5 bg-[#5A0E0B]/10 border border-[#E3D28A]/20 flex items-center justify-center text-xs text-[#E3D28A]/30 font-display tracking-widest uppercase select-none">
                MUDRA
              </div>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-6 lg:border-l lg:border-[#E3D28A]/25 lg:pl-10">
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
                  {event.status === "completed" ? "FINISHED" : event.status.toUpperCase()}
                </span>
              </div>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-[#E3D28A] uppercase wrap-break-word">
                {event.name}
              </h1>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-body border-b border-[#E3D28A]/25 pb-6">
              <div>
                <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">VENUE</span>
                <span className="text-[#E3D28A]">{event.venue || "Venue to be announced"}</span>
              </div>
              <div>
                <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">SCHEDULE</span>
                <span className="text-[#E3D28A]">{event.schedule || "Schedule to be announced"}</span>
              </div>
              <div>
                <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">PARTICIPATION</span>
                <span className="text-[#E3D28A] uppercase">{event.participantType}</span>
              </div>
              <div>
                <span className="text-[10px] font-display text-[#E3D28A]/50 uppercase block mb-1">SCORING CATEGORY</span>
                <span className="text-[#E3D28A] uppercase">{event.pointsCategory}</span>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="space-y-2 border-b border-[#E3D28A]/25 pb-6">
                <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">DESCRIPTION</h2>
                <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80 leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}

            {/* Registration */}
            <div className="space-y-2 border-b border-[#E3D28A]/25 pb-6">
              <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">REGISTRATION</h2>
              <RegistrationStatus event={event} />
            </div>

            {/* Results */}
            <div className="space-y-3">
              <h2 className="font-display text-[10px] tracking-widest text-[#E3D28A]/50 uppercase">RESULTS</h2>
              <div className="overflow-x-auto min-w-0">
                {isLive ? (
                  <p className="font-body text-xs text-[#E02E0B] italic">
                    LIVE event — completed results are not available yet.
                  </p>
                ) : !isFinished ? (
                  <p className="font-body text-xs text-[#E3D28A]/60 italic">
                    Results will be published here upon event completion.
                  </p>
                ) : resultsError ? (
                  <p className="font-body text-xs text-[#E02E0B]/80 italic">
                    {resultsError}
                  </p>
                ) : results?.placements?.length ? (
                  <div className="space-y-2 font-body text-xs min-w-70">
                    {results.placements.map((p) => (
                      <div
                        key={p.placement}
                        className="flex justify-between items-center py-2 border-b border-[#E3D28A]/20 gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-display font-bold text-[#E3D28A] shrink-0">
                            {p.placement === 1 ? "1st" : p.placement === 2 ? "2nd" : "3rd"}
                          </span>
                          <span className="text-[#E3D28A] wrap-break-word">
                            {resultLabel(event, p)}
                          </span>
                          <span className="text-[10px] uppercase px-1.5 py-0.5 border border-[#E3D28A]/30 text-[#E3D28A]/70 font-mono shrink-0">
                            {p.teamId}
                          </span>
                        </div>
                        <span className="text-[#E02E0B] font-bold shrink-0">+{p.pointsAwarded} PTS</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-body text-xs text-[#E3D28A]/60 italic">
                    Results not available yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
