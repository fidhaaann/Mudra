"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { EVENTS } from "@/data/events";

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "on-stage" | "off-stage">("all");

  const filteredEvents = useMemo(() => {
    return EVENTS.filter((event) => {
      const matchesCategory =
        selectedCategory === "all" || event.category === selectedCategory;
      const matchesSearch =
        event.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-12 space-y-10">
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
              ALL ({EVENTS.length})
            </button>
            <button
              onClick={() => setSelectedCategory("on-stage")}
              className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
                selectedCategory === "on-stage"
                  ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                  : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
              }`}
            >
              ON-STAGE (22)
            </button>
            <button
              onClick={() => setSelectedCategory("off-stage")}
              className={`px-3.5 py-1.5 font-display text-[11px] uppercase tracking-wider transition-colors border ${
                selectedCategory === "off-stage"
                  ? "bg-[#E02E0B] text-[#E3D28A] border-[#E02E0B] font-bold"
                  : "text-[#E3D28A]/70 border-[#E3D28A]/30 hover:border-[#E3D28A]/60"
              }`}
            >
              OFF-STAGE (17)
            </button>
          </div>
        </div>
      </div>

      {/* Reduced-Size Event Cards with Lighter Stroke */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filteredEvents.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="group border border-[#E3D28A]/40 bg-[#110B0B] hover:border-[#E3D28A] transition-colors flex flex-col justify-between"
          >
            {/* Event Image Placeholder */}
            <div className="w-full aspect-[2/1] bg-[#5A0E0B]/20 border-b border-[#E3D28A]/25 flex items-center justify-center text-[11px] text-[#E3D28A]/40 font-mono select-none">
              [ Event Image ]
            </div>

            {/* Event Name & Category/Status */}
            <div className="p-4 space-y-2">
              <h2 className="font-display font-bold text-base text-[#E3D28A] group-hover:text-[#E02E0B] transition-colors leading-tight">
                {event.name}
              </h2>

              <div className="flex items-center justify-between font-display text-[10px] tracking-wider text-[#E3D28A]/60 pt-2 border-t border-[#E3D28A]/20">
                <span className="uppercase">{event.category}</span>
                <span className="text-[#E02E0B] font-bold uppercase">{event.status}</span>
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
    </div>
  );
}
