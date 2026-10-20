import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Farmer view · ರೈತರ ನೋಟ",
  description: "Simple Kannada-first pond status for fish farmers: tonight's risk, what to do, and one-tap replies.",
};

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
