import type { Metadata } from "next";
import localFont from "next/font/local";
import { Anek_Malayalam, Cinzel, Noto_Sans_Malayalam, Outfit, Space_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { DitherGridBackground } from "@/components/ui/dither-grid-background";
import { BackgroundMusic } from "@/components/audio/BackgroundMusic";

const wardrum = localFont({
  src: "./fonts/Wardrum-Bold.otf",
  variable: "--font-wardrum",
  display: "swap",
  weight: "700",
});

const chithira = localFont({
  src: "./fonts/ML_TT_Chithira_HeavyBold.ttf",
  variable: "--font-chithira",
  display: "swap",
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

// Primary Unicode Malayalam face (Google Fonts, self-hosted by Next.js)
const notoSansMalayalam = Noto_Sans_Malayalam({
  variable: "--font-noto-sans-malayalam",
  subsets: ["malayalam"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

// Secondary bold boxy Malayalam display face
const anekMalayalam = Anek_Malayalam({
  variable: "--font-anek-malayalam",
  subsets: ["malayalam"],
  weight: ["700", "800"],
  display: "swap",
  preload: false,
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mudra-26.vercel.app"),
  title: {
    default: "MUDRA 2026 | Cultural Arts Festival at Toc H Institute",
    template: "%s | MUDRA 2026",
  },
  description:
    "MUDRA 2026 is the cultural arts festival of Toc H Institute of Science & Technology, Ernakulam, Kerala. Explore music, dance, fine arts, competitions and more.",
  keywords: [
    "MUDRA 2026",
    "Toc H cultural fest",
    "TIST cultural festival",
    "Kerala college fest",
    "malayalam cultural arts",
    "കലോത്സവം",
    "കല സംസ്കാരിക കലോത്സവം",
    "MUDRA Toc H",
  ],
  authors: [{ name: "MUDRA Team, Toc H Institute of Science & Technology" }],
  creator: "MUDRA Team, Toc H",
  alternates: {
    canonical: "https://mudra-26.vercel.app",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://mudra-26.vercel.app",
    siteName: "MUDRA 2026",
    title: "MUDRA 2026 — Toc H Cultural Arts Festival",
    description:
      "The official website for MUDRA 2026, the cultural arts competition of Toc H Institute of Science & Technology, Kerala.",
    images: [
      {
        url: "/images/mudra-logo-dancer.png",
        width: 994,
        height: 748,
        alt: "MUDRA 2026 — Toc H Cultural Festival Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUDRA 2026 — Toc H Cultural Arts Festival",
    description:
      "The official website for MUDRA 2026, the cultural arts competition of Toc H Institute of Science & Technology, Kerala.",
    images: ["/images/mudra-logo-dancer.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Icons come from the file conventions: app/favicon.ico, app/icon.png,
  // app/apple-icon.png (generated from the MUDRA dancer logo).
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
      className={`${wardrum.variable} ${chithira.variable} ${cinzel.variable} ${outfit.variable} ${spaceMono.variable} ${notoSansMalayalam.variable} ${anekMalayalam.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#110B0B] text-[#E3D28A]"
      >
        <LoadingScreen />
        {/* Single persistent audio instance; layouts don't remount on navigation */}
        <BackgroundMusic />
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
