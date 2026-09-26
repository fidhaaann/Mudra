"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { lookupStudentTeam } from "@/lib/lookup";
import { StudentLookupResult } from "@/types/lookup";

const SEMESTERS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
const DEPARTMENTS = ["CE", "CSE", "EC", "EEE", "EL", "SFE", "IT", "ME", "RA"] as const;

export default function TeamPage() {
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudentLookupResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !semester.trim() || !branch.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await lookupStudentTeam({ name, semester, branch });
      setResult(res);
    } catch {
      setResult({
        found: false,
        message: "An unexpected error occurred during lookup.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 sm:px-8 pt-28 pb-16 space-y-8">
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
            placeholder="Type your full name"
            disabled={loading}
            className="w-full bg-[#110B0B] border border-[#E3D28A]/30 px-3.5 py-2.5 font-body text-xs text-[#E3D28A] placeholder-[#E3D28A]/30 focus:outline-none focus:border-[#E02E0B] disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-display text-[11px] tracking-wider text-[#E3D28A]/70 uppercase mb-1.5">
              SEMESTER
            </label>
            <div className="relative">
              <select
                required
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={loading}
                className="w-full bg-[#110B0B] border border-[#E3D28A]/30 px-3.5 py-2.5 pr-8 font-body text-xs text-[#E3D28A] focus:outline-none focus:border-[#E02E0B] disabled:opacity-50 appearance-none cursor-pointer"
              >
                <option value="" disabled className="bg-[#110B0B] text-[#E3D28A]/40">
                  Select Sem
                </option>
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem} className="bg-[#110B0B] text-[#E3D28A]">
                    {sem}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#E3D28A]/50"
              />
            </div>
          </div>

          <div>
            <label className="block font-display text-[11px] tracking-wider text-[#E3D28A]/70 uppercase mb-1.5">
              DEPARTMENT
            </label>
            <div className="relative">
              <select
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={loading}
                className="w-full bg-[#110B0B] border border-[#E3D28A]/30 px-3.5 py-2.5 pr-8 font-body text-xs text-[#E3D28A] focus:outline-none focus:border-[#E02E0B] disabled:opacity-50 appearance-none cursor-pointer"
              >
                <option value="" disabled className="bg-[#110B0B] text-[#E3D28A]/40">
                  Select Dept
                </option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} className="bg-[#110B0B] text-[#E3D28A]">
                    {dept}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#E3D28A]/50"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim() || !semester.trim() || !branch.trim()}
          className="w-full py-3 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-widest font-bold hover:bg-[#941108] transition-colors disabled:opacity-50"
        >
          {loading ? "SEARCHING..." : "FIND TEAM"}
        </button>

        {result && (
          <div className="pt-4 border-t border-[#E3D28A]/25 text-center font-body text-xs">
            {result.found && result.student ? (
              <div className="space-y-2.5 p-4 border border-[#E02E0B] bg-[#5A0E0B]/20">
                <div className="text-[10px] text-[#E3D28A]/60 uppercase tracking-widest">ALLOCATED HOUSE</div>
                <div className="font-display font-black text-2xl sm:text-3xl text-[#E3D28A]">
                  {result.student.team}
                </div>
                <div className="pt-2 border-t border-[#E3D28A]/15 text-[11px] text-[#E3D28A]/75 flex flex-wrap justify-center items-center gap-2">
                  <span>{result.student.name}</span>
                  <span>•</span>
                  <span>Sem {result.student.semester}</span>
                  <span>•</span>
                  <span>{result.student.branch}</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 border border-[#E3D28A]/20 bg-[#110B0B]/80 text-[#E3D28A]/80">
                <p className="italic">{result.message}</p>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
