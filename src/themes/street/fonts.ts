// Street fonts — Fraunces for serif headlines (variable weight + italic
// for accent words), Inter for body and chrome.
//
// Fraunces has SOFT and WONK opsz axes — we lean into them at large
// display sizes (the hero headline) and dial them back for body serif use.

import { Fraunces, Inter } from "next/font/google";

export const streetSerif = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--street-serif",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const streetSans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--street-sans",
  display: "swap",
});
