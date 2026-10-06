import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Fraunces,
  Hanken_Grotesk,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Space_Grotesk,
} from "next/font/google";
import { ThemeSync } from "@/components/theme/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { NO_FLASH_SCRIPT } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-bricolage",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Store theme font pairings (Editorial, Clean). Only stores that pick them use them, so they aren't
// preloaded on every page; the browser fetches them when a themed store first renders.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["700"], variable: "--font-fraunces", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["700"], variable: "--font-space", display: "swap", preload: false });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap", preload: false });

// Fallbacks for Hindi, Tamil, Telugu and Kannada names and text. Not preloaded: the browser
// only downloads them when a page actually contains those scripts (unicode-range).
const notoDeva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-noto-deva", display: "swap", preload: false });
const notoTamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-noto-tamil", display: "swap", preload: false });
const notoTelugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-noto-telugu", display: "swap", preload: false });
const notoKannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-noto-kannada", display: "swap", preload: false });
const INDIC = [notoDeva, notoTamil, notoTelugu, notoKannada].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: {
    default: "PowerProof — sell digital products in minutes",
    template: "%s · PowerProof",
  },
  description:
    "Add a product, share a link, get paid. Instant delivery, invoices and payouts for creators in India selling worldwide.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F6F4" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1412" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The inline script sets data-theme before first paint, so React must not complain that it differs
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${hanken.variable} ${plexMono.variable} ${fraunces.variable} ${spaceGrotesk.variable} ${plexSans.variable} ${INDIC}`}>
      <head>
        {/* Light, dark or system, applied before anything paints (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <ThemeSync />
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
