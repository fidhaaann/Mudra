import React from "react";
import Link from "next/link";
import Image from "next/image";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-10 px-4 sm:px-6 flex justify-center">
      <div className="w-full max-w-4xl bg-[#110B0B]/85 backdrop-blur-md border border-[#E3D28A]/25 rounded-full px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-2xl shadow-black/80">
        {/* MUDRA Logo */}
        <Link href="/" className="group flex items-center shrink-0">
          <Image
            src="/images/mudra-logo.png"
            alt="MUDRA 2026"
            width={585}
            height={511}
            className="h-7 sm:h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
          />
        </Link>

        {/* Instagram Icon Link */}
        <a
          href="https://www.instagram.com/mudra.tist?stkn=MWtobTIyNm04MDZ1eg%3D%3D&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="MUDRA on Instagram"
          className="text-[#E3D28A]/70 hover:text-[#E02E0B] transition-colors duration-200 hover:scale-110 transform"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>

        {/* Copyright */}
        <div className="font-body text-[#E3D28A]/50 tracking-wider">
          © MUDRA 2026
        </div>
      </div>
    </footer>
  );
};

