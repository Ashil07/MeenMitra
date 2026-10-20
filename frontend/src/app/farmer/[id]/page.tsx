"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { FarmerHome } from "@/components/farmer/FarmerHome";
import { FarmerShell } from "@/components/farmer/FarmerShell";

export default function FarmerPondPage() {
  return (
    <FarmerShell>
      {(lang) => (
        <Suspense fallback={null}>
          <FarmerPond lang={lang} />
        </Suspense>
      )}
    </FarmerShell>
  );
}

function FarmerPond({ lang }: { lang: "kn" | "en" }) {
  const params = useParams<{ id: string }>();
  return <FarmerHome pondId={decodeURIComponent(params.id)} lang={lang} />;
}
