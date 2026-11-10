import {
  Inter,
  Lato,
  Merriweather,
  Open_Sans,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";
import type { ResumeFont } from "@/lib/resume";

// next/font needs literal options in each call (no shared objects or spreads).
// Variable fonts cover 400/600/700; Lato is static and only ships 400/700.
const openSans = Open_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--rzf-open-sans",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--rzf-source-sans",
});
const lato = Lato({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--rzf-lato",
});
const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--rzf-inter",
});
const merriweather = Merriweather({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--rzf-merriweather",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--rzf-source-serif",
});

export const resumeFontClassName = [
  openSans,
  sourceSans,
  lato,
  inter,
  merriweather,
  sourceSerif,
]
  .map((f) => f.variable)
  .join(" ");

const SANS = `"Helvetica Neue", Arial, sans-serif`;
const SERIF = `Georgia, "Times New Roman", serif`;

export const resumeFontFamily: Record<ResumeFont, string> = {
  "open-sans": `var(--rzf-open-sans), ${SANS}`,
  "source-sans": `var(--rzf-source-sans), ${SANS}`,
  lato: `var(--rzf-lato), ${SANS}`,
  inter: `var(--rzf-inter), ${SANS}`,
  merriweather: `var(--rzf-merriweather), ${SERIF}`,
  "source-serif": `var(--rzf-source-serif), ${SERIF}`,
};
