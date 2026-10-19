"use client";

import { useState, type FormEvent } from "react";
import { ApiError, describeError } from "@/api";
import type { AlgaeLevel, Pond, PondInput, Species } from "@/api/types";
import { ALGAE_LABEL, SPECIES_LABEL } from "@/lib/labels";
import { istDateString } from "@/lib/time";
import { Icon } from "./Icon";
import { Notice, Spinner } from "./States";

type FormValues = Record<keyof PondInput, string | boolean>;

const EMPTY: FormValues = {
  name: "",
  farmer_name: "",
  phone: "+91",
  village: "",
  canal: "",
  area_m2: "",
  depth_m: "1.5",
  species: "rohu",
  stocking_date: "",
  fish_count: "",
  has_aerator: false,
  algae_level: "medium",
};

function fromPond(p: Pond): FormValues {
  return {
    name: p.name,
    farmer_name: p.farmer_name,
    phone: p.phone,
    village: p.village,
    canal: p.canal,
    area_m2: String(p.area_m2),
    depth_m: String(p.depth_m),
    species: p.species,
    stocking_date: p.stocking_date,
    fish_count: String(p.fish_count),
    has_aerator: p.has_aerator,
    algae_level: p.algae_level,
  };
}

/** Client-side checks for fast feedback. The backend remains the authority and its 422 messages are shown too. */
export function validatePondForm(v: FormValues, today = istDateString()): Record<string, string> {
  const e: Record<string, string> = {};
  const s = (k: keyof PondInput) => String(v[k]).trim();
  if (!s("name")) e.name = "Pond name is required.";
  if (!s("farmer_name")) e.farmer_name = "Farmer name is required.";
  if (!/^\+91[6-9]\d{9}$/.test(s("phone").replace(/\s/g, ""))) e.phone = "Enter an Indian mobile number like +919876543210.";
  if (!s("village")) e.village = "Village is required.";
  if (!s("canal")) e.canal = "Canal or water source is required (used to warn neighbouring ponds).";
  const area = Number(s("area_m2"));
  if (!s("area_m2") || !(area >= 50 && area <= 200_000)) e.area_m2 = "Area must be between 50 and 200,000 m².";
  const depth = Number(s("depth_m"));
  if (!s("depth_m") || !(depth >= 0.3 && depth <= 5)) e.depth_m = "Depth must be between 0.3 and 5 m.";
  const count = Number(s("fish_count"));
  if (!s("fish_count") || !Number.isInteger(count) || count < 1 || count > 1_000_000) e.fish_count = "Enter a whole number from 1 to 1,000,000.";
  const d = s("stocking_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.stocking_date = "Choose the date fingerlings were stocked.";
  else if (d > today) e.stocking_date = "Stocking date cannot be in the future.";
  return e;
}

function toInput(v: FormValues): PondInput {
  return {
    name: String(v.name).trim(),
    farmer_name: String(v.farmer_name).trim(),
    phone: String(v.phone).replace(/\s/g, ""),
    village: String(v.village).trim(),
    canal: String(v.canal).trim(),
    area_m2: Number(v.area_m2),
    depth_m: Number(v.depth_m),
    species: v.species as Species,
    stocking_date: String(v.stocking_date),
    fish_count: Number(v.fish_count),
    has_aerator: Boolean(v.has_aerator),
    algae_level: v.algae_level as AlgaeLevel,
  };
}

export function PondForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pond;
  submitLabel: string;
  onSubmit: (input: PondInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<FormValues>(initial ? fromPond(initial) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (k: keyof PondInput, val: string | boolean) => {
    const next = { ...values, [k]: val };
    setValues(next);
    if (touched) setErrors(validatePondForm(next));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    const errs = validatePondForm(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`pond-${first}`)?.focus();
      return;
    }
    setPending(true);
    try {
      await onSubmit(toInput(values));
    } catch (err) {
      setSubmitError(err);
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
    } finally {
      setPending(false);
    }
  }

  const area = Number(values.area_m2);
  const field = (k: keyof PondInput, label: string, input: React.ReactNode, hint?: string, full = false) => (
    <div className={`field${full ? " full" : ""}`}>
      <label className="label" htmlFor={`pond-${k}`}>
        {label}
      </label>
      {input}
      {hint && !errors[k] && (
        <span className="hint" id={`pond-${k}-hint`}>
          {hint}
        </span>
      )}
      {errors[k] && (
        <span className="field-error" id={`pond-${k}-error`}>
          <Icon name="error" size={14} /> {errors[k]}
        </span>
      )}
    </div>
  );
  const a11y = (k: keyof PondInput) => ({
    id: `pond-${k}`,
    name: k,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `pond-${k}-error` : `pond-${k}-hint`,
  });

  return (
    <form className="form" onSubmit={handleSubmit} noValidate aria-busy={pending}>
      {!!submitError && (
        <Notice tone="error" title="Could not save the pond.">
          {describeError(submitError)}
        </Notice>
      )}

      <fieldset className="fieldset">
        <legend>Farmer & location</legend>
        {field("name", "Pond name", <input className="input" {...a11y("name")} value={String(values.name)} onChange={(e) => set("name", e.target.value)} autoComplete="off" />, "A name the farmer recognises, e.g. “Kere 1”.")}
        {field("farmer_name", "Farmer name", <input className="input" {...a11y("farmer_name")} value={String(values.farmer_name)} onChange={(e) => set("farmer_name", e.target.value)} autoComplete="name" />)}
        {field(
          "phone",
          "Mobile number (for alerts)",
          <input className="input" {...a11y("phone")} type="tel" inputMode="tel" value={String(values.phone)} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />,
          "With +91. Demo messages are simulated and never sent.",
        )}
        {field("village", "Village", <input className="input" {...a11y("village")} value={String(values.village)} onChange={(e) => set("village", e.target.value)} />)}
        {field(
          "canal",
          "Canal / shared water source",
          <input className="input" {...a11y("canal")} value={String(values.canal)} onChange={(e) => set("canal", e.target.value)} />,
          "Ponds on the same canal are warned together about possible outbreaks. Names are never shared.",
          true,
        )}
      </fieldset>

      <fieldset className="fieldset three">
        <legend>Pond & stock</legend>
        {field(
          "area_m2",
          "Water area",
          <div className="input-wrap">
            <input className="input" {...a11y("area_m2")} type="number" inputMode="decimal" min={50} step="any" value={String(values.area_m2)} onChange={(e) => set("area_m2", e.target.value)} />
            <span className="unit">m²</span>
          </div>,
          area > 0 ? `≈ ${(area / 4046.86).toFixed(2)} acre` : "1 acre ≈ 4,047 m²",
        )}
        {field(
          "depth_m",
          "Average depth",
          <div className="input-wrap">
            <input className="input" {...a11y("depth_m")} type="number" inputMode="decimal" min={0.3} max={5} step="0.1" value={String(values.depth_m)} onChange={(e) => set("depth_m", e.target.value)} />
            <span className="unit">m</span>
          </div>,
        )}
        {field(
          "species",
          "Main species",
          <select className="select" {...a11y("species")} value={String(values.species)} onChange={(e) => set("species", e.target.value)}>
            {Object.entries(SPECIES_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>,
        )}
        {field(
          "stocking_date",
          "Stocking date",
          <input className="input" {...a11y("stocking_date")} type="date" max={istDateString()} value={String(values.stocking_date)} onChange={(e) => set("stocking_date", e.target.value)} />,
          "Used to estimate today's fish weight.",
        )}
        {field(
          "fish_count",
          "Fish stocked",
          <input className="input" {...a11y("fish_count")} type="number" inputMode="numeric" min={1} step={1} value={String(values.fish_count)} onChange={(e) => set("fish_count", e.target.value)} />,
        )}
        {field(
          "algae_level",
          "Water colour / algae",
          <select className="select" {...a11y("algae_level")} value={String(values.algae_level)} onChange={(e) => set("algae_level", e.target.value)}>
            {Object.entries(ALGAE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>,
        )}
        <div className="field full">
          <label className="check">
            <input type="checkbox" name="has_aerator" checked={Boolean(values.has_aerator)} onChange={(e) => set("has_aerator", e.target.checked)} />
            <span>
              <strong>Pond has an aerator</strong>
              <br />
              <span className="small muted">If not, Danger alerts suggest borrowing one from a neighbour.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? <Spinner /> : <Icon name="check" />} {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
