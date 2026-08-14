import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Empty } from "@/components/ui";
import { supabase } from "@/lib/queries";
import type { Profile } from "@/lib/profile";

type SupplyOrder = {
  id: string;
  supplier: string;
  status: string;
  expected_on: string | null;
  received_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Qoralama",
  ordered: "Buyurtma berildi",
  received: "Qabul qilindi",
  cancelled: "Bekor qilindi",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-canvas text-muted",
  ordered: "bg-amber-50 text-amber-700",
  received: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function Supply({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [expected, setExpected] = useState("");

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["supply"] });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["supply"],
    queryFn: async (): Promise<SupplyOrder[]> => {
      const { data, error } = await supabase
        .from("supply_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as SupplyOrder[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supply_orders").insert({
        supplier: supplier.trim(),
        expected_on: expected || null,
        created_by: profile.employee_id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSupplier("");
      setExpected("");
      refresh();
    },
    onError: (e: Error) => alert(e.message),
  });

  /** Receiving is a database operation: it moves stock, so the panel asks the
      server to do it rather than writing quantities from the browser. */
  const receive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("receive_supply_order", { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e: Error) => alert(e.message),
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("supply_orders").update({ status }).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-rose-deep">Ta'minot</h1>
        <p className="mt-1 text-sm text-muted">
          Yetkazib beruvchilardan kelgan buyurtmalar. Qabul qilinganda ombor avtomatik to'ldiriladi.
        </p>
      </div>

      <Card title="Yangi buyurtma">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <input
            placeholder="Yetkazib beruvchi"
            maxLength={120}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
          />
          <input
            type="date"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
          />
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || supplier.trim().length < 2}
            className="h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white disabled:opacity-40"
          >
            Yaratish
          </button>
        </div>
      </Card>

      <Card title="Buyurtmalar">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-canvas" />
        ) : (orders ?? []).length === 0 ? (
          <Empty text="Hozircha buyurtma yo'q." />
        ) : (
          <ul className="divide-y divide-line">
            {(orders ?? []).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-medium">{o.supplier}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    STATUS_TONE[o.status] ?? "bg-canvas text-muted"
                  }`}
                >
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                {o.expected_on ? (
                  <span className="text-muted">
                    kutilmoqda: {new Date(o.expected_on).toLocaleDateString("uz-UZ")}
                  </span>
                ) : null}

                <div className="ml-auto flex gap-2">
                  {o.status === "draft" ? (
                    <button
                      onClick={() => setStatus(o.id, "ordered")}
                      className="h-8 rounded-lg border border-line px-3 text-xs"
                    >
                      Buyurtma berildi
                    </button>
                  ) : null}
                  {o.status === "ordered" ? (
                    <button
                      onClick={() => receive.mutate(o.id)}
                      disabled={receive.isPending}
                      className="h-8 rounded-lg bg-rose-deep px-3 text-xs text-white"
                    >
                      Qabul qilish
                    </button>
                  ) : null}
                  {o.status !== "received" && o.status !== "cancelled" ? (
                    <button
                      onClick={() => setStatus(o.id, "cancelled")}
                      className="h-8 rounded-lg border border-line px-3 text-xs text-muted"
                    >
                      Bekor
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
