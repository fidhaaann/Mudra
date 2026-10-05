import type { Metadata } from "next";
import localFont from "next/font/local";
import { Cinzel, Outfit, Space_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { DitherGridBackground } from "@/components/ui/dither-grid-background";

const wardrum = localFont({
  src: "./fonts/Wardrum-Bold.otf",
  variable: "--font-wardrum",
  display: "swap",
  weight: "700",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MUDRA",
  description: "Official website for the MUDRA-Toc H Cultural Arts Competition.",
  // Icons come from the file conventions: app/favicon.ico, app/icon.png,
  // app/apple-icon.png (generated from the new MUDRA dancer logo).
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${wardrum.variable} ${cinzel.variable} ${outfit.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#110B0B] text-[#E3D28A]">
        <LoadingScreen />
        {/* Navbar is fixed/floating — positioned via CSS */}
        <Navbar />
        <div className="relative isolate flex min-h-full min-w-0 flex-1 flex-col">
          <DitherGridBackground contained startAfterHero />
          <main className="relative z-1 flex-1 flex flex-col w-full">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
