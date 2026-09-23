"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const MUDRA_IMAGES = [
  "/images/mudras/mudra-1.png",
  "/images/mudras/mudra-2.png",
  "/images/mudras/mudra-3.png",
  "/images/mudras/mudra-4.png",
  "/images/mudras/mudra-5.png",
];

export const LoadingScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Randomly change mudra image every 160ms without fade
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => {
        let next = Math.floor(Math.random() * MUDRA_IMAGES.length);
        if (next === prev) {
          next = (prev + 1) % MUDRA_IMAGES.length;
        }
        return next;
      });
    }, 160);

    // End loading screen after ~1.8s
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="mudra-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-[#110B0B] flex flex-col items-center justify-center select-none"
        >
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Direct Mudra Image Display - Zero glow, zero crossfade */}
            <div className="relative w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center">
              <Image
                src={MUDRA_IMAGES[currentImageIndex]}
                alt="Dance Mudra"
                fill
                sizes="(max-width: 768px) 208px, 256px"
                priority
                className="object-contain"
              />
            </div>

            {/* Title: MUDRA only */}
            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-[0.25em] text-[#E3D28A] uppercase">
              MUDRA
            </h2>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
