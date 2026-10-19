import Link from "next/link";
import { EmptyState } from "@/components/States";

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon="search"
        title="Page not found"
        body="This page does not exist in MeenMitra."
        action={
          <Link href="/" className="btn primary">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
