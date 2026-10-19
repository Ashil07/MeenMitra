"use client";

import { useRouter } from "next/navigation";
import { api } from "@/api";
import { PageHeader } from "@/components/PageHeader";
import { PondForm } from "@/components/PondForm";

export default function NewPondPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/ponds", label: "Ponds" },
          { href: "/ponds/new", label: "Register" },
        ]}
        eyebrow="Pond management"
        title="Register a pond"
        sub="A one-time setup. MeenMitra uses size, depth, stock and stocking date to estimate tonight's oxygen demand — no sensor needed."
      />
      <div className="card">
        <PondForm
          submitLabel="Register pond"
          onCancel={() => router.push("/ponds")}
          onSubmit={async (input) => {
            const pond = await api.createPond(input);
            router.push(`/ponds/${pond.id}?created=1`);
          }}
        />
      </div>
    </>
  );
}
