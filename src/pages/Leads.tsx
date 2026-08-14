import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Phone, Plus, UserPlus } from "lucide-react";
import { useState } from "react";

import { Card, Empty, short, uzs } from "@/components/ui";
import {
  LEAD_LABEL,
  LEAD_STATUSES,
  LEAD_TONE,
  LOSS_REASONS,
  conversion,
  eventsQuery,
  funnel,
  leadsQuery,
  operatorsQuery,
  overdue,
  sourcesQuery,
  type Lead,
  type LeadStatus,
} from "@/lib/crm";
import { supabase } from "@/lib/queries";

const BLANK = {
  name: "",
  phone: "",
  amount: "",
  source_id: "",
  operator_id: "",
  note: "",
};

export default function Leads() {
  const qc = useQueryClient();
  const { data: leads = [], isLoading, error } = useQuery(leadsQuery);
  const { data: operators = [] } = useQuery(operatorsQuery);
  const { data: sources = [] } = useQuery(sourcesQuery);
  const { data: events = [] } = useQuery(eventsQuery);

  const [draft, setDraft] = useState<typeof BLANK | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState("");
  const [linkNumber, setLinkNumber] = useState("");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["lead_events"] });
  };

  const create = useMutation({
    mutationFn: async (d: typeof BLANK) => {
      const { error: e } = await supabase.from("leads").insert({
        name: d.name.trim(),
        phone: d.phone.trim(),
        amount: Number(d.amount || 0),
        source_id: d.source_id || null,
        operator_id: d.operator_id || null,
        note: d.note.trim() || null,
      });
      if (e) throw e;
    },
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });

  const move = useMutation({
    mutationFn: async ({
      id,
      status,
      loss_reason,
    }: {
      id: string;
      status: LeadStatus;
      loss_reason?: string;
    }) => {
      const { error: e } = await supabase
        .from("leads")
        .update({ status, loss_reason: status === "lost" ? (loss_reason ?? null) : null })
        .eq("id", id);
      if (e) throw e;
    },
    onSuccess: refresh,
  });

  // Operators had no way in: the table was seeded empty and nothing in either
  // app could create one, so the "Sotuvchi" field could never be filled.
  const addOperator = useMutation({
    mutationFn: async (name: string) => {
      const { error: e } = await supabase.from("sales_operators").insert({ name: name.trim() });
      if (e) throw e;
    },
    onSuccess: () => {
      setOperatorName("");
      void qc.invalidateQueries({ queryKey: ["sales_operators"] });
    },
  });

  // The lead -> order link existed only in the schema. Attaching a real order
  // number is what turns "sotildi" into something the shop can verify.
  const linkOrder = useMutation({
    mutationFn: async ({ lead, number }: { lead: Lead; number: string }) => {
      const { data: order, error: findError } = await supabase
        .from("orders")
        .select("id,total")
        .ilike("order_number", number.trim())
        .maybeSingle();
      if (findError) throw findError;
      if (!order) throw new Error("Bunday raqamli buyurtma topilmadi.");

      const { error: e } = await supabase
        .from("leads")
        .update({ order_id: order.id, status: "won", amount: Number(order.total) })
        .eq("id", lead.id);
      if (e) throw e;
    },
    onSuccess: () => {
      setLinkNumber("");
      refresh();
    },
  });

  const logEvent = useMutation({
    mutationFn: async ({ lead, kind }: { lead: Lead; kind: "call" | "meeting" }) => {
      const { error: e } = await supabase
        .from("lead_events")
        .insert({ lead_id: lead.id, kind, operator_id: lead.operator_id });
      if (e) throw e;
    },
    onSuccess: refresh,
  });

  if (error) return <Empty text={`Xato: ${(error as Error).message}`} />;
  if (isLoading) return <Empty text="Yuklanmoqda…" />;

  const stats = conversion(leads);
  const columns = funnel(leads);
  const late = overdue(leads);
  const operatorLabel = (id: string | null) =>
    operators.find((o) => o.id === id)?.name ?? "Biriktirilmagan";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Lidlar</h1>
          <p className="mt-1 text-sm text-muted">
            {leads.length} ta lid · konversiya{" "}
            <span className="text-ink">{(stats.rate * 100).toFixed(0)}%</span> · ochiq summa{" "}
            {short(stats.openAmount)}
          </p>
        </div>
        <button
          onClick={() => setDraft({ ...BLANK })}
          className="flex items-center gap-2 rounded-full bg-rose-deep px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Yangi lid
        </button>
      </div>

      <Card title="Sotuvchilar">
        <div className="flex flex-wrap items-end gap-3">
          <input
            className={inputCls + " w-56"}
            placeholder="Yangi sotuvchi ismi"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
          />
          <button
            disabled={operatorName.trim().length < 2 || addOperator.isPending}
            onClick={() => addOperator.mutate(operatorName)}
            className="rounded-full bg-rose-deep px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            <UserPlus className="mr-1 inline h-4 w-4" /> Qo'shish
          </button>
          <span className="text-sm text-muted">
            {operators.length === 0
              ? "Hali sotuvchi yo'q — lidlarni biriktirish uchun kamida bittasi kerak."
              : operators.map((o) => o.name).join(", ")}
          </span>
        </div>
      </Card>

      {late.length > 0 ? (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-sm">
          <span className="font-medium text-amber-800">
            {late.length} ta lidga qayta aloqa muddati o&apos;tib ketdi:
          </span>{" "}
          <span className="text-amber-700">{late.map((l) => l.name).join(", ")}</span>
        </div>
      ) : null}

      {draft ? (
        <Card title="Yangi lid">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ism">
              <input
                className={inputCls}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Telefon">
              <input
                className={inputCls}
                value={draft.phone}
                placeholder="+998 90 123 45 67"
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label="Kutilayotgan summa">
              <input
                className={inputCls}
                inputMode="numeric"
                value={draft.amount}
                onChange={(e) =>
                  setDraft({ ...draft, amount: e.target.value.replace(/\D/g, "") })
                }
              />
            </Field>
            <Field label="Manba">
              <select
                className={inputCls}
                value={draft.source_id}
                onChange={(e) => setDraft({ ...draft, source_id: e.target.value })}
              >
                <option value="">—</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sotuvchi">
              <select
                className={inputCls}
                value={draft.operator_id}
                onChange={(e) => setDraft({ ...draft, operator_id: e.target.value })}
              >
                <option value="">—</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Izoh">
              <input
                className={inputCls}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              disabled={draft.name.trim().length < 2 || draft.phone.trim().length < 7}
              onClick={() => create.mutate(draft)}
              className="rounded-full bg-rose-deep px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              Saqlash
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-full border border-line px-5 py-2 text-sm text-muted"
            >
              Bekor qilish
            </button>
          </div>
        </Card>
      ) : null}

      {leads.length === 0 ? (
        <Empty text="Hali lid yo'q. Instagram yoki Telegramdan kelgan mijozni shu yerga qo'shing." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {columns.map((col) => {
            const inColumn = leads.filter((l) => l.status === col.status);
            return (
              <div key={col.status} className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="ml-auto text-xs text-muted">{col.count}</span>
                </div>

                <div className="space-y-2">
                  {inColumn.map((l) => {
                    const timeline = events.filter((e) => e.lead_id === l.id);
                    const expanded = open === l.id;
                    return (
                      <div
                        key={l.id}
                        className="rounded-2xl border border-line bg-surface p-3 text-sm"
                      >
                        <button
                          className="w-full text-left"
                          onClick={() => setOpen(expanded ? null : l.id)}
                        >
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-muted">{l.phone}</p>
                          {Number(l.amount) > 0 ? (
                            <p className="mt-1 text-xs text-rose-deep">{uzs(Number(l.amount))}</p>
                          ) : null}
                        </button>

                        {expanded ? (
                          <div className="mt-3 space-y-2 border-t border-line pt-3">
                            <p className="text-xs text-muted">{operatorLabel(l.operator_id)}</p>
                            {l.note ? <p className="text-xs">{l.note}</p> : null}
                            {l.loss_reason ? (
                              <p className="text-xs text-muted">Sabab: {l.loss_reason}</p>
                            ) : null}

                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => logEvent.mutate({ lead: l, kind: "call" })}
                                className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs text-muted hover:text-rose-deep"
                              >
                                <Phone className="h-3 w-3" /> Qo&apos;ng&apos;iroq
                              </button>
                              {timeline.length > 0 ? (
                                <span className="rounded-full bg-canvas px-2 py-1 text-xs text-muted">
                                  {timeline.length} ta aloqa
                                </span>
                              ) : null}
                            </div>

                            {l.order_id ? (
                              <p className="flex items-center gap-1 text-xs text-emerald-600">
                                <Link2 className="h-3 w-3" /> Buyurtmaga bog'langan
                              </p>
                            ) : (
                              <div className="flex gap-1">
                                <input
                                  className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2 py-1 text-xs"
                                  placeholder="YSM-2608-1001"
                                  value={open === l.id ? linkNumber : ""}
                                  onChange={(e) => setLinkNumber(e.target.value)}
                                />
                                <button
                                  disabled={!linkNumber.trim() || linkOrder.isPending}
                                  onClick={() =>
                                    linkOrder.mutate(
                                      { lead: l, number: linkNumber },
                                      {
                                        onError: (err) =>
                                          window.alert((err as Error).message),
                                      },
                                    )
                                  }
                                  className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-rose-deep disabled:opacity-40"
                                >
                                  Bog'lash
                                </button>
                              </div>
                            )}

                            <select
                              className="mt-1 w-full rounded-lg border border-line bg-canvas px-2 py-1 text-xs"
                              value={l.status}
                              onChange={(e) => {
                                const status = e.target.value as LeadStatus;
                                if (status === "lost") {
                                  const reason =
                                    window.prompt(
                                      `Yo'qotish sababi:\n${LOSS_REASONS.join(", ")}`,
                                      LOSS_REASONS[0],
                                    ) ?? undefined;
                                  move.mutate({ id: l.id, status, loss_reason: reason });
                                } else {
                                  move.mutate({ id: l.id, status });
                                }
                              }}
                            >
                              {LEAD_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {LEAD_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {inColumn.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line p-4 text-center text-xs text-muted">
                      bo&apos;sh
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card title="Voronka bo'yicha summa">
        <ul className="space-y-2 text-sm">
          {columns.map((c) => (
            <li key={c.status} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.label}</span>
              <span className="ml-auto tabular-nums">{c.count}</span>
              <span className="w-28 text-right tabular-nums text-muted">
                {c.amount > 0 ? uzs(c.amount) : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
          Yopilgan {stats.closed} ta lid · sotilgani {stats.won} ta ·{" "}
          {uzs(stats.wonAmount)}
        </p>
      </Card>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-pink-vivid";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
