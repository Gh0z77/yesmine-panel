import type { ReactNode } from "react";

export const uzs = (n: number) =>
  `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Math.round(n))} so'm`;

/** 26 500 000 → 26.5M — for KPI tiles where the exact som is noise. */
export const short = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} mlrd`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
};

export function Card({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-line bg-surface p-6 shadow-[0_10px_30px_-18px_oklch(0.5_0.2_5.2/0.25)] ${className}`}
    >
      {title ? (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">{title}</h2>
            {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn" | "good";
}) {
  const accent =
    tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-rose-deep";
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 font-display text-3xl ${accent}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

/** Horizontal bar list — reads better than a pie for ranked data. */
export function BarList({
  rows,
  format = (n: number) => String(n),
}: {
  rows: { label: string; value: number; color?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-sm text-muted">Ma'lumot yo'q.</p>;

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(r.value / max) * 100}%`,
                backgroundColor: r.color ?? "oklch(0.5 0.208 5.2)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Inline SVG area chart — no chart library, no extra bundle. */
export function Sparkline({
  points,
  height = 160,
}: {
  points: { day: string; revenue: number; orders: number }[];
  height?: number;
}) {
  if (points.length === 0) return <p className="py-6 text-sm text-muted">Ma'lumot yo'q.</p>;

  const w = 100;
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, 100 - (p.revenue / max) * 92] as const);
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,100 ${line} ${w},100`;

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%" }}>
        <defs>
          <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.688 0.185 358.5)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.688 0.185 358.5)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#revfill)" />
        <polyline
          points={line}
          fill="none"
          stroke="oklch(0.5 0.208 5.2)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{points[0]?.day.slice(5)}</span>
        <span>eng yuqori: {short(max)}</span>
        <span>{points[points.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line p-12 text-center text-sm text-muted">
      {text}
    </div>
  );
}
