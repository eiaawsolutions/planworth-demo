import type { Metadata, Viewport } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.css";

/**
 * Typography follows the deck: a high-contrast transitional serif for display
 * (slides 1 and 13) paired with a humanist sans for body copy.
 *
 * Deliberately NOT Inter / Roboto / Space Grotesk — all three now read as
 * default-AI tells. next/font self-hosts at build time, which is required here
 * because the CSP sets `font-src 'self' data:`.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "The Intelligent Ecosystem — Planworth × Claritas",
    template: "%s — Planworth Intelligent Ecosystem",
  },
  description:
    "A working preview of the five AI scenarios in the Planworth Intelligent Ecosystem brief: predictive engagement, conversational solution matching, intelligent document processing, dynamic risk scoring, and adaptive security.",
  referrer: "strict-origin-when-cross-origin",
  // Client-facing prospect demo — never index it.
  robots: "noindex, nofollow",
  applicationName: "Planworth Intelligent Ecosystem",
  authors: [{ name: "EIAAW Solutions Sdn Bhd" }],
};

export const viewport: Viewport = {
  themeColor: "#081d32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
