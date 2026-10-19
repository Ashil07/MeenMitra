"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/api";
import { PageHeader } from "@/components/PageHeader";
import { PondForm } from "@/components/PondForm";
import { ErrorState, LoadingState } from "@/components/States";
import { useApiQuery } from "@/lib/useApi";

export default function EditPondPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pond = useApiQuery(() => api.getPond(id), [id]);

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/ponds", label: "Ponds" },
          { href: `/ponds/${id}`, label: pond.data?.name ?? "Pond" },
          { href: `/ponds/${id}/edit`, label: "Edit" },
        ]}
        eyebrow="Pond management"
        title={pond.data ? `Edit ${pond.data.name}` : "Edit pond"}
      />
      <div className="card">
        {pond.loading && !pond.data && <LoadingState label="Loading pond" rows={6} />}
        {!!pond.error && <ErrorState error={pond.error} onRetry={pond.reload} title="Could not load this pond" />}
        {pond.data && !pond.error && (
          <PondForm
            initial={pond.data}
            submitLabel="Save changes"
            onCancel={() => router.push(`/ponds/${id}`)}
            onSubmit={async (input) => {
              await api.updatePond(id, input);
              router.push(`/ponds/${id}?saved=1`);
            }}
          />
        )}
      </div>
    </>
  );
}
