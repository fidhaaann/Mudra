"use client";

import React, { useState } from "react";
import { lookupStudentTeam } from "@/lib/lookup";
import { StudentLookupResult } from "@/types/lookup";

export default function TeamPage() {
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudentLookupResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await lookupStudentTeam({ name, semester, year });
      setResult(res);
    } catch {
      setResult({
        found: false,
        message: "An error occurred during lookup.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 sm:px-8 py-16 space-y-8">
      {/* Title */}
      <div className="space-y-1.5 text-center">
        <h1 className="font-display font-black text-3xl sm:text-4xl text-[#E3D28A] tracking-wider uppercase">
          FIND YOUR TEAM
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70">
          Enter your student details to determine your allocated house.
        </p>
      </div>

      {/* Clean Form with Lighter Stroke */}
      <form onSubmit={handleSubmit} className="border border-[#E3D28A]/40 bg-[#110B0B] p-6 space-y-5">
        <div>
          <label className="block font-display text-[11px] tracking-wider text-[#E3D28A]/70 uppercase mb-1.5">
            NAME
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter student name"
            className="w-full bg-[#110B0B] border border-[#E3D28A]/30 px-3.5 py-2.5 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/30 focus:outline-none focus:border-[#E02E0B]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-display text-[11px] tracking-wider text-[#E3D28A]/70 uppercase mb-1.5">
              SEMESTER
            </label>
            <input
              type="text"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="e.g. 4"
              className="w-full bg-[#110B0B] border border-[#E3D28A]/30 px-3.5 py-2.5 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/30 focus:outline-none focus:border-[#E02E0B]"
            />
          </div>

          <div>
            <label className="block font-display text-[11px] tracking-wider text-[#E3D28A]/70 uppercase mb-1.5">
              YEAR
            </label>
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2"
              className="w-full bg-[#110B0B] border border-[#E3D28A]/30 px-3.5 py-2.5 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/30 focus:outline-none focus:border-[#E02E0B]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-widest font-bold hover:bg-[#941108] transition-colors disabled:opacity-50"
        >
          {loading ? "SEARCHING..." : "FIND TEAM"}
        </button>

        {result && (
          <div className="pt-4 border-t border-[#E3D28A]/25 text-center font-body text-xs">
            {result.found && result.student ? (
              <div className="space-y-1.5 p-3.5 border border-[#E02E0B] bg-[#5A0E0B]/20">
                <div className="text-[10px] text-[#E3D28A]/60 uppercase">ALLOCATED HOUSE</div>
                <div className="font-display font-black text-2xl text-[#E3D28A]">
                  {result.student.teamName}
                </div>
              </div>
            ) : (
              <p className="text-[#E3D28A]/70 italic">{result.message}</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
