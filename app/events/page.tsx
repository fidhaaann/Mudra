"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Search, AlertCircle, RefreshCw } from "lucide-react";
import { Event } from "@/types/event";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "on-stage" | "off-stage">("all");

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error(`Failed to load events (Status: ${res.status})`);
      }
      const data = await res.json();
      setEvents(data.events || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) {
          throw new Error(`Failed to load events (Status: ${res.status})`);
        }
        const data = await res.json();
        if (!ignore) {
          setEvents(data.events || []);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Error fetching events:", err);
          setError(err instanceof Error ? err.message : "Failed to load events");
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
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    loadEvents();
  };

  const onStageCount = useMemo(
    () => events.filter((e) => e.category === "on-stage").length,
    [events]
  );
  const offStageCount = useMemo(
    () => events.filter((e) => e.category === "off-stage").length,
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesCategory =
        selectedCategory === "all" || event.category === selectedCategory;
      const matchesSearch =
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [events, selectedCategory, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 pt-28 pb-16 space-y-10">
      {/* Top Header */}
      <div className="space-y-4">
        <h1 className="font-display font-black text-4xl sm:text-5xl text-[#E3D28A] tracking-wider uppercase">
          EVENTS
        </h1>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[#E3D28A]/30 pb-5">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E3D28A]/40" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#110B0B] border border-[#E3D28A]/40 pl-9 pr-4 py-2 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/30 focus:outline-none focus:border-[#E02E0B]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
                selectedCategory === "all"
                  ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                  : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
              }`}
            >
              ALL ({loading ? "..." : events.length})
            </button>
            <button
              onClick={() => setSelectedCategory("on-stage")}
              className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
                selectedCategory === "on-stage"
                  ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                  : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
              }`}
            >
              ON-STAGE ({loading ? "..." : onStageCount})
            </button>
            <button
              onClick={() => setSelectedCategory("off-stage")}
              className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
                selectedCategory === "off-stage"
                  ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                  : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
              }`}
            >
              OFF-STAGE ({loading ? "..." : offStageCount})
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border border-[#E3D28A]/20 bg-[#110B0B] p-4 space-y-4 animate-pulse"
            >
              <div className="w-full aspect-[2/1] bg-[#5A0E0B]/10 border border-[#E3D28A]/10" />
              <div className="h-4 bg-[#E3D28A]/10 w-3/4 rounded-sm" />
              <div className="h-3 bg-[#E3D28A]/10 w-1/2 rounded-sm" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
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
                {/* Event Image if available, otherwise clean placeholder */}
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
                    MUDRA 2026
                  </div>
                )}

                {/* Event Card Content: Only Name, Category, Status */}
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
