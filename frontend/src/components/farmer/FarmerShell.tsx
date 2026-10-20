"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { apiConfig } from "@/api";
import { BrandMark } from "../AppShell";
import { useFarmerLang } from "./prefs";
import { UI, type Lang } from "./strings";
import styles from "./farmer.module.css";

/** Frame for every farmer page: brand, one big language switch, demo strip, help footer. */
export function FarmerShell({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLang] = useFarmerLang();
  const other: Lang = lang === "kn" ? "en" : "kn";

  return (
    <div className={styles.page} lang={lang}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/farmer" className={styles.brand}>
            <BrandMark />
            <span>
              <span className={styles.brandName}>{UI.appName[lang]}</span>
              <span className={styles.brandSub}>{UI.appTagline[lang]}</span>
            </span>
          </Link>
          <button
            type="button"
            className={styles.langBtn}
            onClick={() => setLang(other)}
            aria-label={UI.switchToLabel[lang]}
            lang={other}
          >
            {UI.switchTo[lang]}
          </button>
        </div>
      </header>
      {apiConfig.mode === "mock" && (
        <div className={styles.demo} role="note">
          {UI.demo[lang]}
        </div>
      )}

      <main id="main" className={styles.wrap}>
        {children(lang)}
        <footer className={styles.footer}>
          <p>{UI.help[lang]}</p>
          {lang === "kn" && <p>{UI.draftNote.kn}</p>}
          <Link href="/">{UI.staffView[lang]}</Link>
        </footer>
      </main>
    </div>
  );
}
