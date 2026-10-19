"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PondPicker } from "@/components/PondPicker";
import { LoadingState } from "@/components/States";
import { WaterCheckForm } from "@/components/WaterCheck";

export default function WaterCheckPage() {
  return (
    <>
      <PageHeader
        eyebrow="Check my pond"
        title="Water-quality check"
        sub="Test-kit readings and visible symptoms go through the rules engine and come back as Safe, Watch or Danger with next steps."
      />
      <Suspense fallback={<LoadingState />}>
        <PondPicker>{(pond) => <WaterCheckForm pond={pond} />}</PondPicker>
      </Suspense>
    </>
  );
}
