"use client";

import { Suspense } from "react";
import { ForecastExplorer } from "@/components/ForecastExplorer";
import { PageHeader } from "@/components/PageHeader";
import { PondPicker } from "@/components/PondPicker";
import { LoadingState } from "@/components/States";

export default function ForecastPage() {
  return (
    <>
      <PageHeader
        eyebrow="Nightly oxygen forecast"
        title="Forecast explorer"
        sub="Combine tonight's weather with the pond's size and stock to estimate oxygen hour by hour, from 6 PM to 8 AM — and see when the aerator should start."
      />
      <Suspense fallback={<LoadingState />}>
        <PondPicker>{(pond, reload) => <ForecastExplorer pond={pond} onChange={reload} />}</PondPicker>
      </Suspense>
    </>
  );
}
