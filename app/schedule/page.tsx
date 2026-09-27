"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { AlertCircle, RefreshCw, Search, CalendarClock } from "lucide-react";
import { ScheduledEvent, ScheduleResponse } from "@/types/schedule";

// ─── types ────────────────────────────────────────────────────────────────────
type CategoryFilter = "all" | "on-stage" | "off-stage";

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusLabel(status: ScheduledEvent["status"]): string {
  if (status === "completed") return "DONE";
  if (status === "live")      return "LIVE";
  return "UPCOMING";
}

function statusClass(status: ScheduledEvent["status"]): string {
  if (status === "completed") return "text-[#E3D28A]/50";
  if (status === "live")      return "text-[#E02E0B] animate-pulse";
  return "text-[#E3D28A]/70";
}

function categoryBadgeClass(cat: ScheduledEvent["category"]): string {
  return cat === "off-stage"
    ? "border-[#EE8814]/50 text-[#EE8814]"
    : "border-[#E3D28A]/40 text-[#E3D28A]/70";
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading schedule" aria-live="polite">
      {/* filter bar skeleton */}
      <div className="flex flex-wrap gap-2 animate-pulse">
        {[48, 72, 80, 80].map((w, i) => (
          <div key={i} className="h-7 bg-[#E3D28A]/10 rounded-sm" style={{ width: w }} />
        ))}
      </div>
      {/* venue grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border border-[#E3D28A]/20 bg-[#110B0B] animate-pulse"
          >
            <div className="h-9 bg-[#E3D28A]/10 border-b border-[#E3D28A]/10" />
            <div className="p-4 space-y-3">
              {[0.7, 0.5, 0.6].map((o, j) => (
                <div key={j} className="space-y-1">
                  <div className="h-3 bg-[#E3D28A]/10 rounded-sm" style={{ opacity: o }} />
                  <div className="h-2.5 w-2/3 bg-[#E3D28A]/10 rounded-sm" style={{ opacity: o * 0.7 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="border border-[#E02E0B]/40 bg-[#5A0E0B]/10 p-8 text-center space-y-4 max-w-lg mx-auto">
      <div className="flex justify-center text-[#E02E0B]">
        <AlertCircle size={32} aria-hidden="true" />
      </div>
      <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80">
        Unable to load the schedule. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-wider font-bold hover:bg-[#941108] transition-colors"
      >
        <RefreshCw size={14} aria-hidden="true" />
        <span>TRY AGAIN</span>
      </button>
    </div>
  );
}

// ─── individual event row inside a venue column ───────────────────────────────

function EventRow({ event }: { event: ScheduledEvent }) {
  const isScheduled = event.date !== null;

  return (
    <div className="border-b border-[#E3D28A]/15 last:border-b-0 py-3 px-4 space-y-1">
      {/* name + category badge */}
      <div className="flex items-start gap-2 justify-between">
        <span className="font-display font-bold text-[11px] sm:text-xs tracking-wide text-[#E3D28A] leading-snug flex-1 min-w-0">
          {event.name}
        </span>
        <span
          className={`shrink-0 border font-display text-[9px] tracking-widest uppercase px-1.5 py-0.5 ${categoryBadgeClass(event.category)}`}
          aria-label={event.category}
        >
          {event.category === "off-stage" ? "OFF" : "ON"}
        </span>
      </div>

      {/* schedule info */}
      {isScheduled ? (
        <div className="font-body text-[10px] text-[#E3D28A]/60 space-y-0.5">
          {event.date && (
            <div>{event.date}</div>
          )}
          {(event.startTime || event.endTime) && (
            <div>
              {event.startTime ?? ""}
              {event.endTime ? ` – ${event.endTime}` : ""}
            </div>
          )}
          <div className={`font-display text-[9px] tracking-widest uppercase ${statusClass(event.status)}`}>
            {statusLabel(event.status)}
          </div>
        </div>
      ) : (
        <div className="font-body text-[10px] text-[#E3D28A]/30 italic">
          To be announced
        </div>
      )}
    </div>
  );
}

// ─── venue column ─────────────────────────────────────────────────────────────

function VenueColumn({
  venue,
  events,
  allUnscheduled,
}: {
  venue: string;
  events: ScheduledEvent[];
  allUnscheduled: boolean;
}) {
  return (
    <div className="border border-[#E3D28A]/30 bg-[#110B0B] flex flex-col min-h-[180px] hover:border-[#E3D28A]/50 transition-colors">
      {/* venue header */}
      <div className="py-2.5 px-4 border-b border-[#E3D28A]/25 bg-[#5A0E0B]/20">
        <h3 className="font-display font-bold text-[10px] sm:text-[11px] tracking-widest text-[#E3D28A] uppercase text-center">
          {venue}
        </h3>
      </div>

      {/* events list */}
      <div className="flex-1 flex flex-col">
        {events.length > 0 ? (
          events.map((ev) => <EventRow key={ev.eventId} event={ev} />)
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="font-body text-[11px] text-[#E3D28A]/35 italic leading-relaxed">
              {allUnscheduled
                ? "Schedule will be\npublished here."
                : "No events match\nyour filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── unscheduled events list ──────────────────────────────────────────────────

function UnscheduledList({ events }: { events: ScheduledEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="unscheduled-heading">
      <div className="flex items-center gap-3">
        <h2
          id="unscheduled-heading"
          className="font-display text-xs tracking-widest text-[#E3D28A]/50 uppercase"
        >
          Awaiting Schedule
        </h2>
        <div className="flex-1 border-t border-[#E3D28A]/15" aria-hidden="true" />
        <span className="font-display text-[10px] text-[#E3D28A]/30">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="border border-[#E3D28A]/20 bg-[#110B0B] divide-y divide-[#E3D28A]/10">
        {events.map((ev) => (
          <div key={ev.eventId} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span className="font-display text-xs text-[#E3D28A]/60 min-w-0 truncate">
              {ev.name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`border font-display text-[9px] tracking-widest uppercase px-1.5 py-0.5 ${categoryBadgeClass(ev.category)}`}
              >
                {ev.category === "off-stage" ? "OFF" : "ON"}
              </span>
              <span className="font-body text-[10px] text-[#E3D28A]/30 italic whitespace-nowrap">
                TBA
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── point distribution (static scoring table — unchanged) ────────────────────

function PointDistribution() {
  const rows = [
    { label: "Group",     pts: [20, 15, 10] },
    { label: "Duo",       pts: [12,  8,  5] },
    { label: "Solo",      pts: [10,  7,  5] },
    { label: "Off-stage", pts: [ 8,  5,  3] },
  ];

  return (
    <section className="space-y-4" aria-labelledby="scoring-heading">
      <div className="border-b border-[#E3D28A]/30 pb-2.5">
        <h2
          id="scoring-heading"
          className="font-display font-bold text-xl sm:text-2xl text-[#E3D28A] tracking-wide uppercase"
        >
          POINT DISTRIBUTION
        </h2>
      </div>

      <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto min-w-0">
        <table
          className="min-w-full text-left font-body text-xs sm:text-sm border-collapse"
          aria-label="Competition point distribution"
        >
          <thead>
            <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
              <th className="py-3.5 px-4 sm:px-5 whitespace-nowrap">Category</th>
              <th className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">1st Place</th>
              <th className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">2nd Place</th>
              <th className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">3rd Place</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3D28A]/15">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-[#5A0E0B]/10 transition-colors">
                <td className="py-3 px-4 sm:px-5 font-display font-bold text-[#E3D28A] whitespace-nowrap">
                  {row.label}
                </td>
                <td className="py-3 px-4 sm:px-5 text-center font-display font-bold text-[#E02E0B] whitespace-nowrap">
                  {row.pts[0]}
                </td>
                <td className="py-3 px-4 sm:px-5 text-center font-display text-[#E3D28A] whitespace-nowrap">
                  {row.pts[1]}
                </td>
                <td className="py-3 px-4 sm:px-5 text-center font-display text-[#E3D28A]/80 whitespace-nowrap">
                  {row.pts[2]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[#E3D28A]/55 italic">
        * Painting Relay is an off-stage group event and follows Off-stage scoring (8 / 5 / 3 points).
      </p>
    </section>
  );
}

// ─── filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  category,
  onCategory,
  search,
  onSearch,
  counts,
}: {
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  search: string;
  onSearch: (v: string) => void;
  counts: { all: number; onStage: number; offStage: number };
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  const filters: { value: CategoryFilter; label: string; count: number }[] = [
    { value: "all",       label: "ALL",       count: counts.all },
    { value: "on-stage",  label: "ON-STAGE",  count: counts.onStage },
    { value: "off-stage", label: "OFF-STAGE", count: counts.offStage },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#E3D28A]/25 pb-5">
      {/* category pills */}
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by category">
        {filters.map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => onCategory(value)}
            aria-pressed={category === value}
            className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
              category === value
                ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* search */}
      <div className="relative w-full sm:w-64">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E3D28A]/35 pointer-events-none"
          aria-hidden="true"
        />
        <label htmlFor="schedule-search" className="sr-only">
          Search events
        </label>
        <input
          ref={searchRef}
          id="schedule-search"
          type="text"
          placeholder="Search events…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-[#110B0B] border border-[#E3D28A]/35 pl-8 pr-4 py-1.5 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/28 focus:outline-none focus:border-[#E02E0B] transition-colors"
        />
      </div>
    </div>
  );
}

// ─── full-unscheduled banner ───────────────────────────────────────────────────

function UnscheduledBanner({ totalCount }: { totalCount: number }) {
  return (
    <div className="border border-[#E3D28A]/25 bg-[#5A0E0B]/10 p-8 text-center space-y-3 max-w-xl mx-auto">
      <div className="flex justify-center text-[#E3D28A]/40">
        <CalendarClock size={36} aria-hidden="true" />
      </div>
      <p className="font-display font-bold text-sm tracking-wider text-[#E3D28A]/60 uppercase">
        Schedule Not Yet Published
      </p>
      <p className="font-body text-xs text-[#E3D28A]/45 leading-relaxed">
        Event timings and venues have not been announced yet.
        {totalCount > 0 && (
          <> All {totalCount} event{totalCount !== 1 ? "s" : ""} are listed below once venues are confirmed.</>
        )}
      </p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  // ── data fetching ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/schedule");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ScheduleResponse = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/schedule");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ScheduleResponse = await res.json();
        if (!cancelled) { setData(json); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // ── derived data ─────────────────────────────────────────────────────────
  const allEvents = useMemo(() => data?.events ?? [], [data]);

  // All distinct, non-null venues from the API — never invented
  const venues = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const ev of allEvents) {
      if (ev.venue && !seen.has(ev.venue)) {
        seen.add(ev.venue);
        list.push(ev.venue);
      }
    }
    return list;
  }, [allEvents]);

  const hasVenueData = venues.length > 0;

  // Apply category + search filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      const matchCat = category === "all" || ev.category === category;
      const q = search.trim().toLowerCase();
      const matchSearch = q === "" || ev.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allEvents, category, search]);

  // Counts for filter buttons — based on unfiltered search (just category)
  const counts = useMemo(() => ({
    all:      allEvents.length,
    onStage:  allEvents.filter((e) => e.category === "on-stage").length,
    offStage: allEvents.filter((e) => e.category === "off-stage").length,
  }), [allEvents]);

  // Partition into scheduled (have a venue) vs unscheduled
  const scheduledEvents  = filteredEvents.filter((e) => e.venue !== null);
  const unscheduledEvents = filteredEvents.filter((e) => e.venue === null);

  // Events per venue (only scheduled events appear in venue columns)
  const eventsByVenue = useMemo(() => {
    const map = new Map<string, ScheduledEvent[]>();
    for (const v of venues) map.set(v, []);
    for (const ev of scheduledEvents) {
      if (ev.venue) {
        const list = map.get(ev.venue) ?? [];
        list.push(ev);
        map.set(ev.venue, list);
      }
    }
    return map;
  }, [venues, scheduledEvents]);

  const allUnscheduled = (data?.scheduledCount ?? 0) === 0;

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-14">

      {/* ── Page title ── */}
      <div className="space-y-1.5 min-w-0">
        <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-[#E3D28A] tracking-wide sm:tracking-wider uppercase leading-tight">
          SCHEDULE
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/60">
          Stage arenas, timings, and competition venue assignments for Mudra 2026.
        </p>
      </div>

      {/* ── Point Distribution (always visible, static scoring) ── */}
      <PointDistribution />

      {/* ── Venue Schedule section ── */}
      <section className="space-y-6 min-w-0" aria-labelledby="venue-schedule-heading">
        <div className="border-b border-[#E3D28A]/30 pb-2.5">
          <h2
            id="venue-schedule-heading"
            className="font-display font-bold text-xl sm:text-2xl text-[#E3D28A] tracking-wide uppercase"
          >
            STAGE ARENAS
          </h2>
        </div>

        {/* loading */}
        {loading && <LoadingSkeleton />}

        {/* error */}
        {!loading && error && <ErrorState onRetry={load} />}

        {/* content */}
        {!loading && !error && data && (
          <div className="space-y-8">
            {/* filter bar */}
            <FilterBar
              category={category}
              onCategory={setCategory}
              search={search}
              onSearch={setSearch}
              counts={counts}
            />

            {/* no-schedule banner when nothing from the sheet has a venue yet */}
            {allUnscheduled && search === "" && (
              <UnscheduledBanner totalCount={allEvents.length} />
            )}

            {/* venue columns — only shown when the API has returned venue data */}
            {hasVenueData && (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(venues.length, 5)}, minmax(0, 1fr))`,
                }}
              >
                {venues.map((venue) => (
                  <VenueColumn
                    key={venue}
                    venue={venue}
                    events={eventsByVenue.get(venue) ?? []}
                    allUnscheduled={allUnscheduled}
                  />
                ))}
              </div>
            )}

            {/* unscheduled events — shown collapsed at the bottom */}
            {unscheduledEvents.length > 0 && (
              <UnscheduledList events={unscheduledEvents} />
            )}

            {/* search returned zero results */}
            {search.trim() !== "" && filteredEvents.length === 0 && (
              <p className="text-center font-body text-xs text-[#E3D28A]/40 py-8">
                No events found matching &ldquo;{search}&rdquo;.
              </p>
            )}

            {/* footer meta */}
            <p className="text-center font-body text-[10px] text-[#E3D28A]/25">
              Last updated:{" "}
              {new Date(data.lastUpdated).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              {data.scheduledCount} scheduled · {data.unscheduledCount} pending
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
