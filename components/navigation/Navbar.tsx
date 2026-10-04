"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { usePathname } from "next/navigation";
import { MenuToggleIcon } from "./MenuToggleIcon";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",            label: "HOME"        },
  { href: "/events",      label: "EVENTS"      },
  { href: "/schedule",    label: "SCHEDULE"    },
  { href: "/leaderboard", label: "LEADERBOARD" },
  { href: "/team",        label: "TEAM"        },
];

// Logo art direction: stacked dancer logo below md (where the links collapse
// into the menu button), the wide wordmark from md up. A <picture> means each
// device downloads only the logo it shows.
const LOGO_WIDE = getImageProps({
  src: "/images/mudra-wordmark.png",
  alt: "MUDRA",
  width: 98,
  height: 28,
}).props;
const LOGO_PHONE = getImageProps({
  src: "/images/mudra-logo-mobile.png",
  alt: "MUDRA",
  width: 48,
  height: 36,
  loading: "eager",
  fetchPriority: "high",
}).props;

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
          <picture className="contents">
            <source
              media="(min-width: 768px)"
              srcSet={LOGO_WIDE.srcSet}
              width={LOGO_WIDE.width}
              height={LOGO_WIDE.height}
            />
            {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
            <img
              {...LOGO_PHONE}
              className="h-9 md:h-7 w-auto aspect-994/748 md:aspect-793/228 object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </picture>
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
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            className="absolute top-full mt-3 left-0 right-0 bg-[#110B0B]/95 backdrop-blur-md border border-[#E3D28A]/25 rounded-2xl p-4 shadow-2xl shadow-black/90 space-y-1.5 md:hidden pointer-events-auto"
          >
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
              );
            })}
          </nav>
        )}
      </div>
    </motion.header>
  );
};
