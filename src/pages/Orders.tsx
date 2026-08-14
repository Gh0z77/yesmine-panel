import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Card, Empty, uzs } from "@/components/ui";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  orderItemsQuery,
  ordersQuery,
} from "@/lib/queries";

export default function Orders() {
  const { data: orders = [], isLoading } = useQuery(ordersQuery);
  const { data: items = [] } = useQuery(orderItemsQuery);
  const [status, setStatus] = useState("all");
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.phone.includes(q)
      );
    });
  }, [orders, status, term]);

  if (isLoading) return <Empty text="Yuklanmoqda…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Buyurtmalar</h1>
        <p className="mt-1 text-sm text-muted">{rows.length} ta buyurtma</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Raqam, ism yoki telefon"
          className="h-10 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-pink-vivid sm:w-72"
        />
        <div className="flex flex-wrap gap-1">
          {["all", ...ORDER_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                status === s
                  ? "border-transparent bg-rose-deep text-white"
                  : "border-line bg-surface text-muted hover:text-rose-deep"
              }`}
            >
              {s === "all" ? "Hammasi" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty text="Bu shartga mos buyurtma yo'q." />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => {
            const lines = items.filter((i) => i.order_id === o.id);
            return (
              <Card key={o.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{o.order_number}</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs text-white"
                    style={{ backgroundColor: STATUS_TONE[o.status] }}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  {o.payment_status !== "paid" ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700">
                      To&apos;lanmagan
                    </span>
                  ) : null}
                  <span className="ml-auto font-display text-xl text-rose-deep">
                    {uzs(Number(o.total))}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-2">
                  <div>
                    <p className="text-ink">
                      {o.customer_name} · {o.phone}
                    </p>
                    <p>{o.address}</p>
                    {o.note ? <p>Izoh: {o.note}</p> : null}
                    <p>{new Date(o.created_at).toLocaleString()}</p>
                    {o.lat !== null && o.lng !== null ? (
                      <a
                        className="text-rose-deep hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}#map=17/${o.lat}/${o.lng}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Xaritada ochish
                      </a>
                    ) : null}
                  </div>
                  <div>
                    {lines.map((i) => (
                      <p key={i.id}>
                        {i.product_name} ×{i.quantity}{" "}
                        {[i.size, i.color].filter(Boolean).join(" · ")}
                      </p>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
