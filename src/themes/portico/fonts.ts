import { Cormorant_Garamond, Inter } from "next/font/google";

export const porticoSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--portico-serif",
  display: "swap",
});

export const porticoSans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--portico-sans",
  display: "swap",
});
