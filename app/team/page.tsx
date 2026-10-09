"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { lookupStudentTeam } from "@/lib/lookup";
import { DEPARTMENTS, SEMESTERS } from "@/lib/lookup-options";
import { resolveHouse } from "@/lib/houses";
import { LotusEtch } from "@/components/ui/LotusEtch";
import { StudentLookupCandidate, StudentLookupQuery, StudentLookupResult } from "@/types/lookup";

// WebGL card: client-only and code-split so three.js isn't in the page's
// initial bundle. Its frame reserves the space, so nothing shifts on load.
const TeamLookupCard = dynamic(() => import("@/components/ui/TeamLookupCard"), { ssr: false });

// Desktop (lg) slides the card box out sideways; smaller screens slide it down.
const DESKTOP_MQ = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mql = window.matchMedia(DESKTOP_MQ);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};
const getDesktop = () => window.matchMedia(DESKTOP_MQ).matches;
const getDesktopServer = () => false;

const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;


export default function TeamPage() {
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudentLookupResult | null>(null);
  // House whose card artwork failed to load (falls back to the neutral card).
  const [failedHouse, setFailedHouse] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const student = result?.found ? result.student : undefined;
  const house = student ? resolveHouse(student.team) : null;
  const cardUnavailable = !!student && (!house || failedHouse === house.id);
  const showHouseCard = !!house && !cardUnavailable;

  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktop, getDesktopServer);
  const reduceMotion = useReducedMotion() ?? false;

  // Card box: opens when a search finds a student, stays open while a new
  // search runs, closes again if a search finds nobody.
  const [boxOpen, setBoxOpen] = useState(false);
  // True once the box has finished sliding in — only then does the card drop.
  const [boxSettled, setBoxSettled] = useState(false);
  const cardLabel = showHouseCard ? `${house.name} house ID card` : "House card unavailable";
  // Warm the card's code chunk (three.js) while the visitor fills in the form,
  // so the first reveal doesn't wait on the download. Safari has no
  // requestIdleCallback, hence the timeout fallback.
  useEffect(() => {
    const warm = () => {
      void import("@/components/ui/TeamLookupCard");
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm);
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(warm, 1500);
    return () => clearTimeout(timer);
  }, []);

  // The card component mounts as soon as the box starts opening, so its faces
  // are prepared during the slide; it only drops once the box has settled.
  const showCard = boxOpen && !!student;
  const cardDropping = showCard && boxSettled;

  // Bring the newly dropped card into view (on mobile it sits below the form).
  useEffect(() => {
    if (!cardDropping) return;
    const el = cardRef.current;
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }, [cardDropping, house, reduceMotion]);

  const revealTransition = { duration: reduceMotion ? 0 : 0.45, ease: REVEAL_EASE };
  // Desktop: slides out from behind the search box to the right.
  // Mobile: opens downward beneath the search box.
  const boxVariants = isDesktop
    ? { hidden: { opacity: 0, x: -240 }, shown: { opacity: 1, x: 0 } }
    : { hidden: { opacity: 0, height: 0 }, shown: { opacity: 1, height: "auto" } };

  const runLookup = async (query: StudentLookupQuery) => {
    setLoading(true);
    setResult(null);
    setFailedHouse(null);

    try {
      const res = await lookupStudentTeam(query);
      setResult(res);
      const found = res.found && !!res.student;
      setBoxOpen(found);
      if (!found) setBoxSettled(false);
    } catch {
      setResult({
        found: false,
        message: "An unexpected error occurred during lookup.",
      });
      setBoxOpen(false);
      setBoxSettled(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !semester.trim() || !branch.trim()) return;
    void runLookup({ name, semester, branch });
  };

  // Picking a possible match looks up that exact registered name; the team
  // is only shown from this point on.
  const handleSelectMatch = (match: StudentLookupCandidate) => {
    setName(match.name);
    void runLookup({ name: match.name, semester: match.semester, branch: match.branch });
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 pt-28 pb-16 space-y-8">
      {/* Title */}
      <div className="space-y-1.5 text-center">
        <h1 className="font-display font-black text-3xl sm:text-4xl text-[#E3D28A] tracking-wider uppercase">
          FIND YOUR TEAM
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70">
          Enter your student details to determine your allocated house.
        </p>
      </div>

      {/* Search box + card box: same size. The search box starts centred; on
          a successful search it glides left (desktop) as the card box slides
          out to its right — or down beneath it on mobile — then the card drops. */}
      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
      <motion.div
        layout="position"
        transition={revealTransition}
        className="relative z-10 flex flex-col w-full max-w-115 min-h-95 sm:min-h-105 lg:min-h-150 border border-[#E3D28A]/40 bg-[#110B0B]"
      >
      {/* One etched dancer pair (same baked shadow/highlight/face treatment as
          the card box's lotus) in its own space above the form — never behind
          the fields or the button. */}
      <div
        aria-hidden="true"
        className="pointer-events-none flex-1 min-h-40 sm:min-h-48 mx-6 mt-6 sm:mx-8 sm:mt-8 bg-center bg-no-repeat bg-contain"
        style={{ backgroundImage: "url(/images/dancers-etched.webp)" }}
      />
      <form onSubmit={handleSubmit} className="w-full p-6 sm:p-8 space-y-5">
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

        <div aria-live="polite">
        {result?.found && result.student && (
          // The ID card is the visible result; this is for screen readers.
          <p className="sr-only">
            {result.student.name}, Semester {result.student.semester}, {result.student.branch}.
            Allocated house: {result.student.team}.
            {cardUnavailable ? " House card unavailable." : ""}
          </p>
        )}
        {result && !(result.found && result.student) && (
          <div className="pt-4 border-t border-[#E3D28A]/25 text-center font-body text-xs">
            {result.matches && result.matches.length > 0 ? (
              <div className="space-y-2.5 text-left">
                <div className="text-center text-[10px] text-[#E3D28A]/60 uppercase tracking-widest">
                  POSSIBLE MATCHES
                </div>
                <ul className="space-y-1.5">
                  {result.matches.map((match, i) => (
                    <li key={`${match.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectMatch(match)}
                        disabled={loading}
                        className="w-full px-3.5 py-2.5 border border-[#E3D28A]/25 bg-[#110B0B]/80 text-left hover:border-[#E02E0B] focus:outline-none focus-visible:border-[#E02E0B] transition-colors disabled:opacity-50"
                      >
                        <div className="text-xs text-[#E3D28A]">{match.name}</div>
                        <div className="text-[10px] text-[#E3D28A]/55 tracking-wider">
                          Sem {match.semester} • {match.branch}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-center text-[10px] italic text-[#E3D28A]/50">
                  {result.moreMatches
                    ? "More names match — type more of your name to narrow it down."
                    : "Select your name to see your house."}
                </p>
              </div>
            ) : (
              <div className="p-3.5 border border-[#E3D28A]/20 bg-[#110B0B]/80 text-[#E3D28A]/80">
                <p className="italic">{result.message}</p>
              </div>
            )}
          </div>
        )}
        </div>
      </form>
      </motion.div>

      <AnimatePresence initial={false}>
        {boxOpen && (
          <motion.div
            key="card-box"
            variants={boxVariants}
            initial="hidden"
            animate="shown"
            exit="hidden"
            transition={revealTransition}
            onAnimationComplete={(definition) => {
              if (definition === "shown") setBoxSettled(true);
            }}
            className="relative z-0 w-full max-w-115 overflow-hidden"
          >
            {/* Etched lotus surface (card box only); the strap hangs from its top edge */}
            <div
              ref={cardRef}
              className="relative isolate overflow-hidden h-95 sm:h-105 lg:h-150 max-h-[85svh] border border-[#E3D28A]/40 bg-[#110B0B]"
            >
              <LotusEtch />
              {/* Mounted per successful search while the box opens (faces get
                  prepared); drops in once the box has slid in. */}
              {showCard && (
                <TeamLookupCard
                  house={showHouseCard ? house : null}
                  student={student}
                  dropReady={boxSettled}
                  status="unavailable"
                  label={cardLabel}
                  onImageError={() => house && setFailedHouse(house.id)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
