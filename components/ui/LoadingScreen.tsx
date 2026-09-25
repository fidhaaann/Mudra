"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const MUDRA_IMAGES = [
  "/images/mudras/mudra-1.png?v=2",
  "/images/mudras/mudra-2.png?v=2",
  "/images/mudras/mudra-3.png?v=2",
  "/images/mudras/mudra-4.png?v=2",
  "/images/mudras/mudra-5.png?v=2",
  "/images/mudras/mudra-6.png?v=2",
];

// Generate randomized rapid sequence of mudras without immediate consecutive repeats
function generateRandomSequence(count: number = 10): string[] {
  const sequence: string[] = [];
  let lastIndex = -1;
  for (let i = 0; i < count; i++) {
    let nextIndex = Math.floor(Math.random() * MUDRA_IMAGES.length);
    while (nextIndex === lastIndex && MUDRA_IMAGES.length > 1) {
      nextIndex = Math.floor(Math.random() * MUDRA_IMAGES.length);
    }
    sequence.push(MUDRA_IMAGES[nextIndex]);
    lastIndex = nextIndex;
  }
  return sequence;
}

export const LoadingScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sequence, setSequence] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Preload all 6 mudra images into browser cache immediately
    MUDRA_IMAGES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });

    // 2. Generate rapid randomized sequence
    const seq = generateRandomSequence(10);
    setSequence(seq);

    // Prevent background scrolling while loading screen is active
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (sequence.length === 0) return;

    // Slower, more elegant pace: ~520ms per mudra
    const speed = shouldReduceMotion ? 300 : 220;

    if (step < sequence.length - 1) {
      timerRef.current = setTimeout(() => {
        setStep((prev) => prev + 1);
      }, speed);
    } else {
      // Completed rapid sequence: smoothly transition out to hero
      timerRef.current = setTimeout(() => {
        setLoading(false);
        document.body.style.overflow = "";
      }, speed + 80);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, sequence, shouldReduceMotion]);

  const activeImage = sequence[step] || MUDRA_IMAGES[0];

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="mudra-loading-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-[#110B0B] flex items-center justify-center select-none"
        >
          {/* Centered Mudra Box: full aspect ratio including entire yellow stroke */}
          <div className="relative w-48 sm:w-56 md:w-64 aspect-[2858/3039] flex items-center justify-center">
            {/* Motion blur on rapid frame switch without crossfade */}
            <motion.div
              key={step}
              initial={
                shouldReduceMotion
                  ? {}
                  : {
                    filter: "blur(6px)",
                    scale: 0.98,
                  }
              }
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                    filter: "blur(0px)",
                    scale: 1,
                  }
              }
              transition={{
                duration: 0.08,
                ease: "easeOut",
              }}
              className="relative w-full h-full"
            >
              <Image
                src={activeImage}
                alt="Kerala Mudra"
                fill
                sizes="(max-width: 640px) 192px, (max-width: 768px) 224px, 256px"
                priority
                unoptimized
                className="object-contain pointer-events-none select-none"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
