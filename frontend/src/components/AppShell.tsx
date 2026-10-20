"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, apiConfig, describeError, resetDemoData } from "@/api";
import type { HealthResponse } from "@/api/types";
import { Icon, type IconName } from "./Icon";

const NAV: { group: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "dashboard" },
      { href: "/ponds", label: "Ponds", icon: "pond" },
      { href: "/farmer", label: "Farmer view", icon: "fish" },
    ],
  },
  {
    group: "Tonight",
    items: [
      { href: "/forecast", label: "Forecast explorer", icon: "forecast" },
      { href: "/water-check", label: "Water check", icon: "water" },
      { href: "/alerts", label: "Alert centre", icon: "alert" },
    ],
  },
  {
    group: "Community",
    items: [{ href: "/cooperative", label: "Cooperative", icon: "coop" }],
  },
  {
    group: "How it works",
    items: [
      { href: "/approach", label: "Approach explorer", icon: "approach" },
      { href: "/models", label: "Data & models", icon: "model" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 12c3-4.2 9-5.2 13-2.2l5-3v10.4l-5-3c-4 3-10 2-13-2.2Z" fill="#fff" fillOpacity=".95" />
        <circle cx="13.6" cy="11" r="1" fill="#0e4a43" />
        <path d="M2 19.5c1.7 0 1.7-1.2 3.4-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.4-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.4-1.2" stroke="#d7efe9" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="MeenMitra home">
      <BrandMark />
      <span>
        <span className="brand-name">MeenMitra</span>
        <br />
        <span className="brand-sub">ಮೀನ್‌ಮಿತ್ರ · Fish Friend</span>
      </span>
    </Link>
  );
}

function ModeCard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (apiConfig.mode !== "live") return;
    let cancelled = false;
    api
      .health()
      .then((h) => !cancelled && setHealth(h))
      .catch((e: unknown) => !cancelled && setHealthError(e));
    return () => {
      cancelled = true;
    };
  }, []);

  if (apiConfig.mode === "mock") {
    return (
      <div className="mode-card">
        <strong>
          <span className="mode-dot" /> Demo mode
        </strong>
        <p style={{ marginTop: 4 }}>Typed fixtures in this browser. No backend, no real messages.</p>
        {confirming ? (
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn sm on-dark"
              onClick={() => {
                resetDemoData();
                window.location.reload();
              }}
            >
              Confirm reset
            </button>
            <button type="button" className="btn sm ghost" style={{ color: "#cfe2db" }} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn sm on-dark" onClick={() => setConfirming(true)}>
            <Icon name="reset" size={14} /> Reset demo data
          </button>
        )}
      </div>
    );
  }

  const host = apiConfig.baseUrl.replace(/^https?:\/\//, "");
  return (
    <div className="mode-card" aria-live="polite">
      <strong>
        <span className={`mode-dot ${health ? "live" : healthError ? "down" : ""}`} />
        {health ? "Live API connected" : healthError ? "Backend unreachable" : "Checking backend…"}
      </strong>
      <p style={{ marginTop: 4 }} className="mono">
        {host}
      </p>
      {health && (
        <p style={{ marginTop: 4 }}>
          Messaging: {health.messaging_simulated ? `simulated (${health.messaging_provider})` : health.messaging_provider}
        </p>
      )}
      {!!healthError && <p style={{ marginTop: 4 }}>{describeError(healthError)}</p>}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      <Brand />
      <nav aria-label="Main" className="nav">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <ModeCard />
        <p className="tiny" style={{ color: "#7fa194", padding: "0 6px" }}>
          Hackathon MVP · Not a substitute for advice from a fisheries officer.
        </p>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [navPath, setNavPath] = useState(pathname);

  // Close the drawer on route change (including back/forward), adjusting state during render.
  if (pathname !== navPath) {
    setNavPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const trigger = menuButton.current;
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && drawerRef.current) {
        const items = drawerRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (prev ?? trigger)?.focus();
    };
  }, [open]);

  // The farmer screen is a standalone, phone-first app with its own simple header.
  if (pathname === "/farmer" || pathname?.startsWith("/farmer/")) return <>{children}</>;

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Sidebar">
        <SidebarContent />
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
          <button
            ref={menuButton}
            type="button"
            className="btn sm on-dark"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" /> Menu
          </button>
        </header>

        {open && (
          <>
            <div className="drawer-backdrop" onClick={() => setOpen(false)} />
            <div ref={drawerRef} id="mobile-nav" className="drawer" role="dialog" aria-modal="true" aria-label="Navigation">
              <div className="sidebar">
                <div className="row between">
                  <span />
                  <button type="button" className="btn sm on-dark" onClick={() => setOpen(false)}>
                    <Icon name="close" /> Close
                  </button>
                </div>
                <SidebarContent onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </>
        )}

        {apiConfig.mode === "mock" && (
          <div className="demo-ribbon" role="note">
            <Icon name="info" size={16} />
            <span>
              <strong>DEMO MODE</strong> — fictional ponds and fixture forecasts generated in your browser. Nothing is sent to farmers.
            </span>
          </div>
        )}

        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
