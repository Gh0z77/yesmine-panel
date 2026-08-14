import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Kpi, uzs } from "@/components/ui";
import { supabase } from "@/lib/queries";
import type { Profile } from "@/lib/profile";

type Entry = {
  id: string;
  kind: string;
  category: string;
  amount: number;
  note: string | null;
  happened_on: string;
};

const CATEGORIES = [
  "Sotuv",
  "Ijara",
  "Oylik",
  "Tovar",
  "Reklama",
  "Kommunal",
  "Soliq",
  "Boshqa",
];

export default function Finance({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    kind: "expense",
    category: "Boshqa",
    amount: "",
    note: "",
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["finance"],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("*")
        .order("happened_on", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as Entry[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_entries").insert({
        kind: draft.kind,
        category: draft.category,
        amount: Number(draft.amount || 0),
        note: draft.note.trim() || null,
        created_by: profile.employee_id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft({ ...draft, amount: "", note: "" });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const rows = entries ?? [];
  const income = rows.filter((e) => e.kind === "income").reduce((sum, e) => sum + e.amount, 0);
  const expense = rows.filter((e) => e.kind === "expense").reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-rose-deep">Moliya</h1>
        <p className="mt-1 text-sm text-muted">Kirim va chiqimlar, oxirgi 200 ta yozuv.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Kirim" value={uzs(income)} />
        <Kpi label="Chiqim" value={uzs(expense)} />
        <Kpi label="Farq" value={uzs(income - expense)} />
      </div>

      <Card title="Yangi yozuv">
        <div className="grid gap-3 sm:grid-cols-[130px_1fr_1fr_1fr_auto]">
          <select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
          >
            <option value="expense">Chiqim</option>
            <option value="income">Kirim</option>
          </select>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            inputMode="numeric"
            placeholder="Summa"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
          />
          <input
            placeholder="Izoh"
            maxLength={160}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
          />
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || !draft.amount}
            className="h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white disabled:opacity-40"
          >
            Saqlash
          </button>
        </div>
      </Card>

      <Card title="Yozuvlar">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-canvas" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    e.kind === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {e.kind === "income" ? "Kirim" : "Chiqim"}
                </span>
                <span className="text-muted">{e.category}</span>
                <span className="font-medium">{uzs(e.amount)}</span>
                {e.note ? <span className="truncate text-muted">· {e.note}</span> : null}
                <span className="ml-auto shrink-0 text-xs text-muted">
                  {new Date(e.happened_on).toLocaleDateString("uz-UZ")}
                </span>
              </li>
            ))}
            {rows.length === 0 ? <li className="py-4 text-sm text-muted">Yozuv yo'q.</li> : null}
          </ul>
        )}
      </Card>
    </div>
  );
}
