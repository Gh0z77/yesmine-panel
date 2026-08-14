import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BarList, Card, Empty, Kpi, Sparkline, short, uzs } from "@/components/ui";
import {
  computeKpis,
  dailyRevenue,
  inRange,
  orderItemsQuery,
  ordersQuery,
  paymentSplit,
  statusFunnel,
  topProducts,
  variantBreakdown,
} from "@/lib/queries";

const RANGES = [
  { days: 7, label: "7 kun" },
  { days: 30, label: "30 kun" },
  { days: 90, label: "3 oy" },
  { days: 0, label: "Butun davr" },
];

export default function Overview() {
  const [days, setDays] = useState(30);
  const { data: allOrders = [], isLoading, error } = useQuery(ordersQuery);
  const { data: items = [] } = useQuery(orderItemsQuery);

  if (error) {
    return (
      <Empty text={`Ma'lumotni o'qib bo'lmadi: ${(error as Error).message}`} />
    );
  }
  if (isLoading) return <Empty text="Yuklanmoqda…" />;

  const orders = inRange(allOrders, days);
  const kpis = computeKpis(orders, items);
  const funnel = statusFunnel(orders);
  const trend = dailyRevenue(orders, days === 0 ? 30 : Math.min(days, 30));
  const products = topProducts(orders, items);
  const sizes = variantBreakdown(orders, items, "size");
  const colors = variantBreakdown(orders, items, "color");
  const payments = paymentSplit(orders);

  const empty = allOrders.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Boshqaruv paneli</h1>
          <p className="mt-1 text-sm text-muted">
            Yesmine do'konining haqiqiy savdo ko'rsatkichlari.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                days === r.days ? "bg-rose-deep text-white" : "text-muted hover:text-rose-deep"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <Empty text="Hali bironta buyurtma yo'q. Do'konda birinchi xarid bo'lgach, bu yerda hamma ko'rsatkich paydo bo'ladi." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Tushum" value={short(kpis.revenue)} sub={uzs(kpis.revenue)} />
        <Kpi label="Buyurtmalar" value={String(kpis.orders)} sub={`${kpis.units} dona tovar`} />
        <Kpi label="O'rtacha chek" value={short(kpis.averageCheck)} sub={uzs(kpis.averageCheck)} />
        <Kpi
          label="To'lanmagan (naqd)"
          value={String(kpis.unpaidCod)}
          sub={uzs(kpis.unpaidCodSum)}
          tone={kpis.unpaidCod > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Tushum dinamikasi" hint="Kunlik, bekor qilinganlarsiz">
          <Sparkline points={trend} />
        </Card>

        <Card title="Buyurtma voronkasi" hint="Har bir bosqichda nechta buyurtma turibdi">
          <ul className="space-y-3">
            {funnel.map((s) => (
              <li key={s.status} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-sm">{s.label}</span>
                <span className="ml-auto text-sm tabular-nums">{s.count}</span>
                <span className="w-24 text-right text-xs tabular-nums text-muted">
                  {s.sum > 0 ? short(s.sum) : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
            Bekor qilingan ulush: {(kpis.cancelledRate * 100).toFixed(0)}%
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Eng ko'p daromad keltirgan mahsulotlar">
          <BarList
            rows={products.map((p) => ({ label: p.name, value: p.revenue }))}
            format={short}
          />
        </Card>

        <Card title="To'lov usuli">
          <BarList
            rows={payments.map((p) => ({ label: p.label, value: p.sum, color: p.color }))}
            format={short}
          />
          <div className="mt-4 flex gap-6 border-t border-line pt-4 text-sm text-muted">
            {payments.map((p) => (
              <span key={p.label}>
                {p.label}: <span className="text-ink">{p.count}</span> ta
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Qaysi o'lchamlar ketyapti" hint="Keyingi partiyani shu bo'yicha buyurtma qiling">
          <BarList
            rows={sizes.map((s) => ({ label: s.label, value: s.units, color: "oklch(0.59 0.203 1.5)" }))}
            format={(n) => `${n} dona`}
          />
        </Card>
        <Card title="Qaysi ranglar ketyapti">
          <BarList
            rows={colors.map((c) => ({
              label: c.label,
              value: c.units,
              color: "oklch(0.688 0.185 358.5)",
            }))}
            format={(n) => `${n} dona`}
          />
        </Card>
      </div>
    </div>
  );
}
