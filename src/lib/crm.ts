import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/lib/queries";

export const LEAD_STATUSES = ["new", "in_work", "callback", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_LABEL: Record<LeadStatus, string> = {
  new: "Yangi",
  in_work: "Ishlanmoqda",
  callback: "Qayta aloqa",
  won: "Sotildi",
  lost: "Yo'qotildi",
};

export const LEAD_TONE: Record<LeadStatus, string> = {
  new: "#6366F1",
  in_work: "#0EA5E9",
  callback: "#F59E0B",
  won: "#10B981",
  lost: "#94A3B8",
};

/** Why deals die — a fixed list keeps the reports comparable month to month. */
export const LOSS_REASONS = [
  "Narx qimmat",
  "O'lcham yo'q",
  "Boshqa joydan oldi",
  "Javob bermadi",
  "Hozircha kerak emas",
  "Boshqa sabab",
];

export type Operator = {
  id: string;
  name: string;
  phone: string | null;
  color: string;
  active: boolean;
};

export type LeadSource = { id: string; name: string; sort_order: number; active: boolean };

export type Lead = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  source_id: string | null;
  operator_id: string | null;
  amount: number;
  order_id: string | null;
  loss_reason: string | null;
  note: string | null;
  next_action_at: string | null;
  created_at: string;
};

export type LeadEvent = {
  id: string;
  lead_id: string;
  kind: "call" | "meeting" | "note";
  outcome: string | null;
  note: string | null;
  duration_sec: number | null;
  operator_id: string | null;
  happened_at: string;
};

export const operatorsQuery = queryOptions({
  queryKey: ["sales_operators"],
  queryFn: async (): Promise<Operator[]> => {
    const { data, error } = await supabase.from("sales_operators").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Operator[];
  },
});

export const sourcesQuery = queryOptions({
  queryKey: ["lead_sources"],
  queryFn: async (): Promise<LeadSource[]> => {
    const { data, error } = await supabase.from("lead_sources").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as LeadSource[];
  },
});

export const leadsQuery = queryOptions({
  queryKey: ["leads"],
  queryFn: async (): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Lead[];
  },
});

export const eventsQuery = queryOptions({
  queryKey: ["lead_events"],
  queryFn: async (): Promise<LeadEvent[]> => {
    const { data, error } = await supabase
      .from("lead_events")
      .select("*")
      .order("happened_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadEvent[];
  },
});

/** Conversion is what the sales desk is judged on: won ÷ everything closed. */
export function conversion(leads: Lead[]) {
  const closed = leads.filter((l) => l.status === "won" || l.status === "lost");
  const won = leads.filter((l) => l.status === "won");
  return {
    closed: closed.length,
    won: won.length,
    rate: closed.length ? won.length / closed.length : 0,
    wonAmount: won.reduce((n, l) => n + Number(l.amount), 0),
    openAmount: leads
      .filter((l) => l.status !== "won" && l.status !== "lost")
      .reduce((n, l) => n + Number(l.amount), 0),
  };
}

export function funnel(leads: Lead[]) {
  return LEAD_STATUSES.map((status) => ({
    status,
    label: LEAD_LABEL[status],
    color: LEAD_TONE[status],
    count: leads.filter((l) => l.status === status).length,
    amount: leads
      .filter((l) => l.status === status)
      .reduce((n, l) => n + Number(l.amount), 0),
  }));
}

/** Leads whose follow-up date has passed — the daily to-do list. */
export function overdue(leads: Lead[]) {
  const now = Date.now();
  return leads.filter(
    (l) =>
      l.next_action_at !== null &&
      l.status !== "won" &&
      l.status !== "lost" &&
      new Date(l.next_action_at).getTime() < now,
  );
}
