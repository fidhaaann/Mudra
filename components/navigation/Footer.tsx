import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#110B0B] border-t border-[#5A0E0B] py-12 text-[#E3D28A]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm">
        <div className="font-display font-black tracking-widest text-lg">
          MUDRA 2026
        </div>
        <div className="font-body text-xs text-[#E3D28A]/70">
          Instagram: <span className="text-[#E3D28A]">[placeholder]</span>
        </div>
        <div className="font-body text-xs text-[#E3D28A]/50">
          © MUDRA 2026
        </div>
      </div>
    </footer>
  );
};
