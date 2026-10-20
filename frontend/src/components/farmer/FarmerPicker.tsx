"use client";

import Link from "next/link";
import { api } from "@/api";
import type { PondSummary } from "@/api/types";
import { useApiQuery } from "@/lib/useApi";
import { FarmerError } from "./FarmerHome";
import { useRememberedPond } from "./prefs";
import { STATUS_WORD, UI, type Lang } from "./strings";
import styles from "./farmer.module.css";

/**
 * "Which is your pond?" In a real rollout each farmer would get a personal link by SMS
 * (/farmer/<pond id>). For the demo they pick from the list. Farmer names are not shown on this
 * shared list; only the pond name and village are.
 */
export function FarmerPicker({ lang }: { lang: Lang }) {
  const ponds = useApiQuery(() => api.listPonds(), []);
  const [rememberedId] = useRememberedPond();

  if (ponds.error) return <FarmerError lang={lang} error={ponds.error} onRetry={ponds.reload} />;

  const list = ponds.data ?? [];
  const remembered = list.find((p) => p.id === rememberedId);
  const others = list.filter((p) => p.id !== rememberedId);

  return (
    <>
      <h1 className={styles.title}>{UI.pickTitle[lang]}</h1>
      <p className={styles.small}>{UI.pickHint[lang]}</p>

      {ponds.loading && !ponds.data ? (
        <div className={styles.skeleton} style={{ marginTop: 16 }} aria-label={UI.loading[lang]} role="status" />
      ) : list.length === 0 ? (
        <p className={styles.section}>{UI.noPonds[lang]}</p>
      ) : (
        <>
          {remembered && (
            <>
              <p className={styles.small} style={{ marginTop: 16, marginBottom: 8 }}>
                {UI.lastUsed[lang]}
              </p>
              <PondChoice pond={remembered} lang={lang} highlighted />
            </>
          )}
          <ul className={styles.pickList} style={{ marginTop: 16 }}>
            {others.map((p) => (
              <li key={p.id}>
                <PondChoice pond={p} lang={lang} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function PondChoice({ pond, lang, highlighted = false }: { pond: PondSummary; lang: Lang; highlighted?: boolean }) {
  return (
    <Link href={`/farmer/${encodeURIComponent(pond.id)}`} className={`${styles.pickCard} ${highlighted ? styles.pickRemembered : ""}`}>
      <span className={`${styles.dot} ${styles[`dot_${pond.latest_risk}`]}`} aria-hidden="true" />
      <span>
        <span className={styles.pickName}>{pond.name}</span>
        <span className={styles.pickPlace}>
          {pond.village} · {STATUS_WORD[pond.latest_risk][lang]}
        </span>
      </span>
      <span className={styles.arrow} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
