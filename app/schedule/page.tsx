import React from "react";
import { VENUES, SCHEDULE_ITEMS } from "@/data/schedule";

export default function SchedulePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-12 space-y-12">
      {/* Page Title */}
      <div className="space-y-1.5">
        <h1 className="font-display font-black text-4xl sm:text-5xl text-[#E3D28A] tracking-wider uppercase">
          SCHEDULE
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70">
          Point distribution weightages and stage arena timetables.
        </p>
      </div>

      {/* 1. POINT DISTRIBUTION */}
      <section className="space-y-4">
        <div className="border-b border-[#E3D28A]/30 pb-2.5">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[#E3D28A] tracking-wide uppercase">
            POINT DISTRIBUTION
          </h2>
        </div>

        <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto">
          <table className="w-full text-left font-body text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
                <th className="py-3.5 px-5">CATEGORY</th>
                <th className="py-3.5 px-5 text-center">1ST PLACE</th>
                <th className="py-3.5 px-5 text-center">2ND PLACE</th>
                <th className="py-3.5 px-5 text-center">3RD PLACE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3D28A]/15 font-body">
              <tr className="hover:bg-[#5A0E0B]/10 transition-colors">
                <td className="py-3 px-5 font-display font-bold text-[#E3D28A]">Group</td>
                <td className="py-3 px-5 text-center font-display font-bold text-[#E02E0B]">20</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]">15</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]/80">10</td>
              </tr>
              <tr className="hover:bg-[#5A0E0B]/10 transition-colors">
                <td className="py-3 px-5 font-display font-bold text-[#E3D28A]">Duo</td>
                <td className="py-3 px-5 text-center font-display font-bold text-[#E02E0B]">12</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]">8</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]/80">5</td>
              </tr>
              <tr className="hover:bg-[#5A0E0B]/10 transition-colors">
                <td className="py-3 px-5 font-display font-bold text-[#E3D28A]">Solo</td>
                <td className="py-3 px-5 text-center font-display font-bold text-[#E02E0B]">10</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]">7</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]/80">5</td>
              </tr>
              <tr className="hover:bg-[#5A0E0B]/10 transition-colors">
                <td className="py-3 px-5 font-display font-bold text-[#E3D28A]">
                  Off-stage
                </td>
                <td className="py-3 px-5 text-center font-display font-bold text-[#E02E0B]">8</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]">5</td>
                <td className="py-3 px-5 text-center font-display text-[#E3D28A]/80">3</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="font-body text-[11px] text-[#E3D28A]/60 italic">
          * Note: Painting Relay is an off-stage group event and follows Off-stage scoring (8 / 5 / 3 points).
        </p>
      </section>

      {/* 2. VENUE / SESSION SCHEDULE (5 Venues) */}
      <section className="space-y-4">
        <div className="border-b border-[#E3D28A]/30 pb-2.5">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[#E3D28A] tracking-wide uppercase">
            STAGE ARENAS
          </h2>
        </div>

        {/* 5 Equal-Sized Containers with Lighter Stroke */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {VENUES.map((venue) => {
            const items = SCHEDULE_ITEMS.filter((item) => item.venue === venue);
            return (
              <div
                key={venue}
                className="border border-[#E3D28A]/40 bg-[#110B0B] flex flex-col justify-between min-h-[160px] sm:min-h-[180px] hover:border-[#E3D28A] transition-colors"
              >
                <div className="p-3 border-b border-[#E3D28A]/25 bg-[#5A0E0B]/20 text-center">
                  <h3 className="font-display font-bold text-xs tracking-wider text-[#E3D28A] uppercase">
                    {venue}
                  </h3>
                </div>

                <div className="p-4 flex-1 flex items-center justify-center text-center">
                  {items.length > 0 ? (
                    <div className="space-y-2 w-full">
                      {items.map((it) => (
                        <div key={it.id} className="text-[11px] text-[#E3D28A] border-b border-[#E3D28A]/20 pb-1.5">
                          <div className="font-bold">{it.eventName}</div>
                          <div className="text-[10px] text-[#E3D28A]/60">{it.startTime}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-body text-[11px] text-[#E3D28A]/40 italic">
                      Schedule to be announced
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
