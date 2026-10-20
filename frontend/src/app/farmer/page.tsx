"use client";

import { FarmerPicker } from "@/components/farmer/FarmerPicker";
import { FarmerShell } from "@/components/farmer/FarmerShell";

export default function FarmerPickPage() {
  return <FarmerShell>{(lang) => <FarmerPicker lang={lang} />}</FarmerShell>;
}
