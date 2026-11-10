import type { Metadata } from "next";
import { Host_Grotesk, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeLabBootScript } from "@/components/theme-lab";
import "./globals.css";
import "./loaders.css";
import "./themes.css";

// Dealt pairing: Host Grotesk for display and text, JetBrains Mono for figures and code.
const host = Host_Grotesk({
  variable: "--font-host",
  subsets: ["latin"],
  // 600 is for resume headings only; the UI uses 400 and 500.
  weight: ["400", "500", "600"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Resume templates only (the serif option).
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Trackr: job tracker for software developers",
    template: "%s · Trackr",
  },
  description:
    "Track every application on a board, tailor your resume per role, draft outreach with AI and prep the questions each interview is likely to ask.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${host.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the theme-lab choice before first paint (trial only). */}
        <script dangerouslySetInnerHTML={{ __html: themeLabBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
