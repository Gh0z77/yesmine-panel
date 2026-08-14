import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";

const url = import.meta.env["VITE_SUPABASE_URL"];
const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL va VITE_SUPABASE_PUBLISHABLE_KEY .env faylida bo'lishi kerak");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
};

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  pending: "Kutilmoqda",
  processing: "Tayyorlanmoqda",
  shipped: "Yo'lda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

export const STATUS_TONE: Record<string, string> = {
  pending: "#F59E0B",
  processing: "#6366F1",
  shipped: "#0EA5E9",
  delivered: "#10B981",
  cancelled: "#94A3B8",
};

/* ------------------------------------------------------------------ */
/* Raw fetches — the studio session is what makes these readable       */
/* ------------------------------------------------------------------ */

export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  staleTime: 30_000,
  queryFn: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Order[];
  },
});

export const orderItemsQuery = queryOptions({
  queryKey: ["order_items"],
  staleTime: 30_000,
  queryFn: async (): Promise<OrderItem[]> => {
    const { data, error } = await supabase.from("order_items").select("*");
    if (error) throw error;
    return (data ?? []) as OrderItem[];
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  staleTime: 60_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,slug,price,stock,sold_count,active,category_id");
    if (error) throw error;
    return data ?? [];
  },
});

/* ------------------------------------------------------------------ */
/* Derived analytics — the sales desk's actual questions               */
/* ------------------------------------------------------------------ */

/** Cancelled orders are excluded from money, kept in counts. */
export const isLive = (o: Order) => o.status !== "cancelled";

export function inRange(orders: Order[], days: number) {
  if (days <= 0) return orders;
  const from = Date.now() - days * 24 * 60 * 60 * 1000;
  return orders.filter((o) => new Date(o.created_at).getTime() >= from);
}

export type Kpis = {
  revenue: number;
  orders: number;
  averageCheck: number;
  units: number;
  cancelledRate: number;
  unpaidCod: number;
  unpaidCodSum: number;
};

export function computeKpis(orders: Order[], items: OrderItem[]): Kpis {
  const live = orders.filter(isLive);
  const liveIds = new Set(live.map((o) => o.id));
  const revenue = live.reduce((n, o) => n + Number(o.total), 0);
  const units = items
    .filter((i) => liveIds.has(i.order_id))
    .reduce((n, i) => n + i.quantity, 0);
  const cod = live.filter((o) => o.payment_status !== "paid");

  return {
    revenue,
    orders: orders.length,
    averageCheck: live.length ? revenue / live.length : 0,
    units,
    cancelledRate: orders.length ? (orders.length - live.length) / orders.length : 0,
    unpaidCod: cod.length,
    unpaidCodSum: cod.reduce((n, o) => n + Number(o.total), 0),
  };
}

/** The boutique's funnel: an order walks the status ladder, or drops out. */
export function statusFunnel(orders: Order[]) {
  return ORDER_STATUSES.map((status) => ({
    status,
    label: STATUS_LABEL[status] ?? status,
    color: STATUS_TONE[status] ?? "#94A3B8",
    count: orders.filter((o) => o.status === status).length,
    sum: orders
      .filter((o) => o.status === status)
      .reduce((n, o) => n + Number(o.total), 0),
  }));
}

/**
 * Calendar day in the shop's own timezone.
 *
 * toISOString() converts local midnight to UTC, which in Tashkent (UTC+5) lands
 * on the previous evening — every bar was labelled a day early and today's
 * takings fell outside the range entirely.
 */
function localDay(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Revenue per calendar day, oldest first, gaps filled with zero. */
export function dailyRevenue(orders: Order[], days = 14) {
  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.set(localDay(d), { revenue: 0, orders: 0 });
  }
  for (const o of orders.filter(isLive)) {
    // Bucket by the local day the sale happened, matching the keys above.
    const key = localDay(new Date(o.created_at));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(o.total);
    bucket.orders += 1;
  }
  return [...buckets.entries()].map(([day, v]) => ({ day, ...v }));
}

export type ProductLine = {
  name: string;
  units: number;
  revenue: number;
};

export function topProducts(orders: Order[], items: OrderItem[], limit = 8): ProductLine[] {
  const liveIds = new Set(orders.filter(isLive).map((o) => o.id));
  const map = new Map<string, ProductLine>();
  for (const i of items) {
    if (!liveIds.has(i.order_id)) continue;
    const row = map.get(i.product_name) ?? { name: i.product_name, units: 0, revenue: 0 };
    row.units += i.quantity;
    row.revenue += Number(i.price) * i.quantity;
    map.set(i.product_name, row);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Which sizes and colours actually move — the buying decision for a boutique. */
export function variantBreakdown(orders: Order[], items: OrderItem[], field: "size" | "color") {
  const liveIds = new Set(orders.filter(isLive).map((o) => o.id));
  const map = new Map<string, number>();
  for (const i of items) {
    if (!liveIds.has(i.order_id)) continue;
    const key = i[field] ?? "—";
    map.set(key, (map.get(key) ?? 0) + i.quantity);
  }
  return [...map.entries()]
    .map(([label, units]) => ({ label, units }))
    .sort((a, b) => b.units - a.units);
}

export function paymentSplit(orders: Order[]) {
  const live = orders.filter(isLive);
  const cod = live.filter((o) => o.payment_method === "cod");
  const card = live.filter((o) => o.payment_method !== "cod");
  return [
    {
      label: "Naqd (yetkazishda)",
      count: cod.length,
      sum: cod.reduce((n, o) => n + Number(o.total), 0),
      color: "#F59E0B",
    },
    {
      label: "Karta",
      count: card.length,
      sum: card.reduce((n, o) => n + Number(o.total), 0),
      color: "#10B981",
    },
  ];
}

/** Customers are identified by phone — there are no accounts on the storefront. */
export function customers(orders: Order[]) {
  const map = new Map<
    string,
    { phone: string; name: string; orders: number; spent: number; last: string }
  >();
  for (const o of orders.filter(isLive)) {
    const key = o.phone.replace(/\D/g, "");
    const row = map.get(key) ?? {
      phone: o.phone,
      name: o.customer_name,
      orders: 0,
      spent: 0,
      last: o.created_at,
    };
    row.orders += 1;
    row.spent += Number(o.total);
    if (o.created_at > row.last) {
      row.last = o.created_at;
      row.name = o.customer_name;
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}
