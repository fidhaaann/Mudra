"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-50 w-full bg-[#110B0B] border-b border-[#5A0E0B]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex items-center justify-between h-20">
          {/* MUDRA Logo */}
          <Link href="/" className="group flex items-center gap-2">
            <span className="font-display font-black text-2xl tracking-[0.2em] text-[#E3D28A] group-hover:text-[#E02E0B] transition-colors">
              MUDRA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href === "/team" && pathname === "/lookup");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "font-display text-sm tracking-widest uppercase transition-colors py-1 relative",
                    isActive
                      ? "text-[#E02E0B] font-bold"
                      : "text-[#E3D28A]/80 hover:text-[#E3D28A]"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#E02E0B]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#E3D28A] hover:text-[#E02E0B] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#5A0E0B] bg-[#110B0B] px-6 py-6 space-y-4">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || (link.href === "/team" && pathname === "/lookup");
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block font-display text-base tracking-widest uppercase py-2 transition-colors",
                  isActive
                    ? "text-[#E02E0B] font-bold"
                    : "text-[#E3D28A]/80 hover:text-[#E3D28A]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
