import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Fraunces,
  Geist,
  Geist_Mono,
  Hanken_Grotesk,
  IBM_Plex_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Space_Grotesk,
} from "next/font/google";
import { ThemeSync } from "@/components/theme/theme-toggle";
import { LiveSessionSync } from "@/components/auth/live-session-sync";
import { HydrationMark } from "@/components/pp/hydration-mark";
import { Toaster } from "@/components/ui/sonner";
import { NO_FLASH_SCRIPT } from "@/lib/theme";
import { siteUrl } from "@/lib/site-url";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// The type of the whole product: Geist for headings and text, Geist Mono for codes. One variable
// file each covers every weight.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

// The "Expressive" store font pair (the previous house style). Only stores that pick it use it.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-bricolage", display: "swap", preload: false });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-hanken", display: "swap", preload: false });

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

const SITE_TITLE = "PowerProof — sell digital products in minutes";
const SITE_DESCRIPTION =
  "Add a product, share a link, get paid. Instant delivery, invoices and payouts for creators in India selling worldwide.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: "%s · PowerProof",
  },
  description: SITE_DESCRIPTION,
  keywords: ["digital products", "sell downloads", "creator store", "Gumroad alternative India", "GST invoices", "Razorpay"],
  authors: [{ name: "PowerProof" }],
  creator: "PowerProof",
  publisher: "PowerProof",
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: "PowerProof",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: siteUrl(),
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  alternates: { canonical: siteUrl() },
};

export const viewport: Viewport = {
  themeColor: "#F5F6F4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The inline script sets data-theme before first paint, so React must not complain that it differs
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} ${hanken.variable} ${fraunces.variable} ${spaceGrotesk.variable} ${plexSans.variable} ${INDIC}`}>
      <head>
        {/* Light, dark or system, applied before anything paints (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <ThemeSync />
        <LiveSessionSync />
        <HydrationMark />
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
