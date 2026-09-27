"use client";

import React, { useReducer, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, AlertCircle, RefreshCw } from "lucide-react";
import { Event } from "@/types/event";

// ─── types ────────────────────────────────────────────────────────────────────

type CategoryFilter = "all" | "on-stage" | "off-stage";

// Pre-lowercased search key computed once after fetch — never recomputed per keystroke.
interface IndexedEvent extends Event {
  _searchKey: string; // `${id}\n${name}` lowercased, ready for String.includes()
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildIndex(events: Event[]): IndexedEvent[] {
  return events.map((e) => ({
    ...e,
    _searchKey: `${e.id}\n${e.name}`.toLowerCase(),
  }));
}

// ─── fetch state machine ──────────────────────────────────────────────────────
// Using useReducer lets us express state transitions cleanly without calling
// setState synchronously inside a useEffect body (which the lint rule forbids).

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; indexed: IndexedEvent[] };

type FetchAction =
  | { type: "retry" }
  | { type: "success"; indexed: IndexedEvent[] }
  | { type: "failure"; message: string };

function fetchReducer(_state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "retry":   return { status: "loading" };
    case "success": return { status: "ok", indexed: action.indexed };
    case "failure": return { status: "error", message: action.message };
  }
}

// ─── loading skeleton ─────────────────────────────────────────────────────────
// Mirrors the actual event card structure exactly (image aspect + body + footer)
// to prevent layout shift when real cards appear.

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
      aria-label="Loading events"
      aria-busy="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="border border-[#E3D28A]/15 bg-[#110B0B] flex flex-col justify-between"
          aria-hidden="true"
        >
          {/* Image placeholder — same aspect-[2/1] as real cards */}
          <div className="w-full aspect-[2/1] bg-[#5A0E0B]/10 border-b border-[#E3D28A]/10" />

          {/* Card body */}
          <div className="p-4 space-y-3">
            {/* Event name placeholder — two lines for long names */}
            <div className="space-y-1.5">
              <div
                className="h-[14px] bg-[#E3D28A]/10 rounded-sm"
                style={{ width: `${65 + ((i * 17) % 25)}%` }}
              />
              <div
                className="h-[14px] bg-[#E3D28A]/8 rounded-sm"
                style={{ width: `${35 + ((i * 13) % 20)}%` }}
              />
            </div>

            {/* Card footer — category / status row */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E3D28A]/10">
              <div className="h-[10px] w-16 bg-[#E3D28A]/10 rounded-sm" />
              <div className="h-[10px] w-14 bg-[#E3D28A]/10 rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [fetchState, dispatch] = useReducer(fetchReducer, { status: "loading" });
  const [searchQuery, setSearchQuery]           = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<CategoryFilter>("all");

  // ── single fetch path ─────────────────────────────────────────────────────
  // The effect depends on fetchState.status so it re-runs whenever "retry"
  // flips status back to "loading".  All dispatch() calls happen asynchronously
  // inside .then()/.catch(), never synchronously at the top of the effect body.
  useEffect(() => {
    if (fetchState.status !== "loading") return;

    let ignore = false;

    fetch("/api/events")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load events (Status: ${res.status})`);
        return res.json();
      })
      .then((data: { events: Event[] }) => {
        if (!ignore) dispatch({ type: "success", indexed: buildIndex(data.events ?? []) });
      })
      .catch((err: unknown) => {
        if (!ignore)
          dispatch({
            type: "failure",
            message: err instanceof Error ? err.message : "Failed to load events",
          });
      });

    return () => { ignore = true; };
  }, [fetchState.status]);

  // Retry: dispatch sets status → "loading" → effect re-runs
  const handleRetry = () => dispatch({ type: "retry" });

  // ── stable event list ─────────────────────────────────────────────────────
  const indexed = useMemo(
    () => (fetchState.status === "ok" ? fetchState.indexed : []),
    [fetchState]
  );

  // ── derived counts + filtered list — one iteration ────────────────────────
  // onStageCount and offStageCount are computed in the same pass as
  // filteredEvents so the array is never walked more than once per change.
  const { filteredEvents, onStageCount, offStageCount } = useMemo(() => {
    const q        = searchQuery.trim().toLowerCase();
    const filtered: IndexedEvent[] = [];
    let onStage    = 0;
    let offStage   = 0;

    for (const event of indexed) {
      if (event.category === "on-stage") onStage++;
      else                               offStage++;

      const matchesCategory =
        selectedCategory === "all" || event.category === selectedCategory;
      const matchesSearch = q === "" || event._searchKey.includes(q);

      if (matchesCategory && matchesSearch) filtered.push(event);
    }

    return { filteredEvents: filtered, onStageCount: onStage, offStageCount: offStage };
  }, [indexed, selectedCategory, searchQuery]);

  const loading = fetchState.status === "loading";
  const error   = fetchState.status === "error" ? fetchState.message : null;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 pt-28 pb-16 space-y-10">

      {/* Header */}
      <div className="space-y-4">
        <h1 className="font-display font-black text-4xl sm:text-5xl text-[#E3D28A] tracking-wider uppercase">
          EVENTS
        </h1>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#E3D28A]/30 pb-5 min-w-0">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#E3D28A]/40"
              aria-hidden="true"
            />
            <label htmlFor="event-search" className="sr-only">Search events</label>
            <input
              id="event-search"
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#110B0B] border border-[#E3D28A]/40 pl-8 pr-4 py-2 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/30 focus:outline-none focus:border-[#E02E0B] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by category">
            {(
              [
                { value: "all",       label: "ALL",       count: indexed.length },
                { value: "on-stage",  label: "ON-STAGE",  count: onStageCount   },
                { value: "off-stage", label: "OFF-STAGE", count: offStageCount  },
              ] as const
            ).map(({ value, label, count }) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                aria-pressed={selectedCategory === value}
                className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
                  selectedCategory === value
                    ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                    : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
                }`}
              >
                {label} ({loading ? "..." : count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="border border-[#E02E0B]/40 bg-[#5A0E0B]/10 p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="flex justify-center text-[#E02E0B]">
            <AlertCircle size={32} />
          </div>
          <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80">{error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-wider font-bold hover:bg-[#941108] transition-colors"
          >
            <RefreshCw size={14} />
            <span>TRY AGAIN</span>
          </button>
        </div>
      )}

      {/* Event Cards Grid */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group border border-[#E3D28A]/40 bg-[#110B0B] hover:border-[#E3D28A] transition-colors flex flex-col justify-between"
              >
                {/* Image or placeholder */}
                {event.imageUrl ? (
                  <div className="w-full aspect-[2/1] bg-[#5A0E0B]/20 border-b border-[#E3D28A]/25 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-[2/1] bg-[#5A0E0B]/10 border-b border-[#E3D28A]/20 flex items-center justify-center text-[10px] text-[#E3D28A]/30 font-display tracking-widest uppercase select-none">
                    MUDRA
                  </div>
                )}

                {/* Card body */}
                <div className="p-4 space-y-3">
                  <h2 className="font-display font-bold text-base text-[#E3D28A] group-hover:text-[#E02E0B] transition-colors leading-tight">
                    {event.name}
                  </h2>

                  <div className="flex items-center justify-between font-display text-[10px] tracking-wider text-[#E3D28A]/60 pt-2 border-t border-[#E3D28A]/20">
                    <span className="uppercase">{event.category}</span>
                    <span
                      className={`font-bold uppercase ${
                        event.status === "completed"
                          ? "text-[#E3D28A]"
                          : event.status === "live"
                          ? "text-[#E02E0B] animate-pulse"
                          : "text-[#E3D28A]/70"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredEvents.length === 0 && (
            <div className="py-12 text-center text-xs text-[#E3D28A]/50 font-body">
              No events found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </>
      )}
    </div>
  );
}
