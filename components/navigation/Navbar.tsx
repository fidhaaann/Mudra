"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/events", label: "EVENTS" },
  { href: "/schedule", label: "SCHEDULE" },
  { href: "/leaderboard", label: "LEADERBOARD" },
  { href: "/team", label: "TEAM" },
];

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
        visible: { y: 0, opacity: 1 },
        hidden: { y: -90, opacity: 0 },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-4 inset-x-0 z-50 w-full px-4 sm:px-6 flex justify-center pointer-events-none"
    >
      <div className="relative pointer-events-auto flex items-center justify-between gap-4 sm:gap-8 bg-[#110B0B]/85 backdrop-blur-md border border-[#E3D28A]/25 hover:border-[#E3D28A]/40 transition-colors shadow-2xl shadow-black/80 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 max-w-4xl w-full sm:w-auto">
        {/* MUDRA Official Logo */}
        <Link href="/" className="group flex items-center py-0.5 shrink-0">
          <Image
            src="/images/mudra-logo.png"
            alt="MUDRA 2026"
            width={585}
            height={511}
            priority
            className="h-8 sm:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href === "/team" && pathname === "/lookup");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-4 py-1.5 rounded-full font-display text-xs tracking-widest uppercase transition-all duration-200",
                  isActive
                    ? "bg-[#5A0E0B] text-[#E02E0B] font-bold border border-[#E02E0B]/40 shadow-inner"
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
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Floating Drawer */}
        {mobileMenuOpen && (
          <div className="absolute top-full mt-3 left-0 right-0 bg-[#110B0B]/95 backdrop-blur-md border border-[#E3D28A]/25 rounded-2xl p-4 shadow-2xl shadow-black/90 space-y-1.5 md:hidden pointer-events-auto">
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === "/team" && pathname === "/lookup");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-4 py-2.5 rounded-xl font-display text-sm tracking-widest uppercase transition-colors",
                    isActive
                      ? "bg-[#5A0E0B] text-[#E02E0B] font-bold border border-[#E02E0B]/40"
                      : "text-[#E3D28A]/80 hover:text-[#E3D28A] hover:bg-[#5A0E0B]/30"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.header>
  );
};
