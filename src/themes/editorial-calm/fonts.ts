// Editorial Calm fonts — the brief's three faces, fixed roles:
//   Hanken Grotesk (variable)  → structural sans: titles, nav, buttons, prices
//   Newsreader (variable+opsz) → large editorial serif copy + italic accents
//   Courier Prime (400/700)    → bracketed labels, body captions, micro-copy

import { Hanken_Grotesk, Newsreader, Courier_Prime } from "next/font/google";

export const ecSans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--ec-sans",
  display: "swap",
});

export const ecSerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ec-serif",
  display: "swap",
  axes: ["opsz"],
});

export const ecMono = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--ec-mono",
  display: "swap",
});
