import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, Noto_Sans_Kannada } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const notoKannada = Noto_Sans_Kannada({ subsets: ["kannada"], weight: ["400", "600"], variable: "--font-noto-kannada", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MeenMitra — pond oxygen early warning", template: "%s · MeenMitra" },
  description: "Overnight oxygen-risk forecasts, water-quality checks and Kannada alerts for small fish farms in coastal Karnataka. Hackathon MVP.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10291f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${notoKannada.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
