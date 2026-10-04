"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MenuToggleIcon } from "./MenuToggleIcon";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",            label: "HOME"        },
  { href: "/events",      label: "EVENTS"      },
  { href: "/schedule",    label: "SCHEDULE"    },
  { href: "/leaderboard", label: "LEADERBOARD" },
  { href: "/team",        label: "TEAM"        },
];

// Phone menu: the panel unrolls downward out of the navbar (top-anchored
// clip reveal + slight drop), then the links follow in a short stagger.
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const DRAWER: Variants = {
  closed: {
    opacity: 0,
    y: -10,
    clipPath: "inset(0% 0% 100% 0% round 16px)",
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
  open: {
    opacity: 1,
    y: 0,
    clipPath: "inset(0% 0% 0% 0% round 16px)",
    transition: { duration: 0.42, ease: EASE_OUT, when: "beforeChildren", staggerChildren: 0.045 },
  },
};
const DRAWER_ITEM: Variants = {
  closed: { opacity: 0, y: -8, transition: { duration: 0.12 } },
  open: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};
// Reduced motion: a plain fade, no movement.
const DRAWER_REDUCED: Variants = {
  closed: { opacity: 0, transition: { duration: 0.15 } },
  open: { opacity: 1, transition: { duration: 0.15 } },
};
const DRAWER_ITEM_REDUCED: Variants = { closed: { opacity: 1 }, open: { opacity: 1 } };

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const [hidden, setHidden] = useState(false);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    // Hide navbar when scrolling down past 60px
    if (latest > previous && latest > 60) {
      setHidden(true);
      setMobileMenuOpen(false);
    } else if (latest < previous) {
      // Show navbar when scrolling up
      setHidden(false);
    }
  });

  return (
    <motion.header
      variants={{
        // Clear the filter once shown: a filter on this ancestor would disable
        // the glass surface's backdrop blur.
        visible: { y: 0, opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } },
        // Keyframes start from blur(0px) since "none" can't be interpolated.
        hidden: { y: -24, opacity: 0, filter: ["blur(0px)", "blur(12px)"] },
      }}
      initial={false}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-4 inset-x-0 z-50 w-full px-4 sm:px-6 flex justify-center pointer-events-none"
    >
      <div className="glass-surface relative pointer-events-auto flex items-center justify-between gap-4 sm:gap-8 bg-[#110B0B]/85 backdrop-blur-md border border-[#E3D28A]/25 hover:border-[#E3D28A]/40 transition-colors shadow-2xl shadow-black/80 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 max-w-4xl w-full sm:w-auto">
        {/* MUDRA Official Logo */}
        <Link href="/" className="group flex items-center py-0.5 shrink-0">
          <Image
            src="/images/mudra-logo-dancer.png"
            alt="MUDRA"
            width={48}
            height={36}
            loading="eager"
            fetchPriority="high"
            className="h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href ||
                  (link.href === "/team" && pathname === "/lookup");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-4 py-1.5 rounded-full font-display text-xs tracking-widest uppercase transition-all duration-200",
                  isActive
                    ? "text-[#E02E0B] font-bold"
                    : "text-[#E3D28A]/80 hover:text-[#E3D28A] hover:bg-[#5A0E0B]/30 hover:scale-[1.03]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>


        {/* Mobile Menu Toggle Button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-full text-[#E3D28A] hover:bg-[#5A0E0B]/40 hover:text-[#E02E0B] transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <MenuToggleIcon open={mobileMenuOpen} />
          </button>
        </div>

        {/* Mobile Floating Drawer */}
        <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            key="mobile-nav-drawer"
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            variants={reducedMotion ? DRAWER_REDUCED : DRAWER}
            initial="closed"
            animate="open"
            exit="closed"
            style={{ transformOrigin: "top" }}
            className="absolute top-full mt-3 left-0 right-0 bg-[#110B0B]/95 backdrop-blur-md border border-[#E3D28A]/25 rounded-2xl p-4 shadow-2xl shadow-black/90 space-y-1.5 md:hidden pointer-events-auto"
          >
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href ||
                    (link.href === "/team" && pathname === "/lookup");
              return (
                <motion.div key={link.href} variants={reducedMotion ? DRAWER_ITEM_REDUCED : DRAWER_ITEM}>
                <Link
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-4 py-2.5 rounded-xl font-display text-sm tracking-widest uppercase transition-colors",
                    isActive
                      ? "text-[#E02E0B] font-bold"
                      : "text-[#E3D28A]/80 hover:text-[#E3D28A] hover:bg-[#5A0E0B]/30"
                  )}
                >
                  {link.label}
                </Link>
                </motion.div>
              );
            })}
          </motion.nav>
        )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};
