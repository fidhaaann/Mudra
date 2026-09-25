import type { Metadata } from "next";
import { Cinzel, Outfit, Space_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

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
  title: "MUDRA 2026 — Kerala Cultural Arts Competition",
  description: "Official portal for MUDRA 2026 Kerala Cultural Arts Competition.",
  icons: {
    icon: "/images/mudra-logo.png",
    shortcut: "/images/mudra-logo.png",
    apple: "/images/mudra-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${outfit.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#110B0B] text-[#E3D28A]">
        <LoadingScreen />
        {/* Navbar is fixed/floating — positioned via CSS */}
        <Navbar />
        {/* pt-24 clears the fixed floating navbar */}
        <main className="flex-1 flex flex-col w-full pt-24">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
