import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Empty, uzs } from "@/components/ui";
import { supabase } from "@/lib/queries";
import { can, type Profile } from "@/lib/profile";

type Shift = { id: string; started_at: string; ended_at: string | null };
type Session = {
  id: string;
  opening_float: number;
  counted_cash: number | null;
  opened_at: string;
  closed_at: string | null;
};
type Movement = {
  id: string;
  kind: string;
  amount: number;
  note: string | null;
  created_at: string;
};

const MOVEMENT_LABEL: Record<string, string> = {
  sale: "Sotuv",
  refund: "Qaytarish",
  payout: "Chiqim",
  deposit: "Kirim",
};

/**
 * Supabase's query builders are thenables rather than real Promises, so this
 * takes PromiseLike and awaits it instead of chaining off a Promise.
 */
const run = async (
  query: PromiseLike<{ error: { message: string } | null }>,
  ok: string,
): Promise<boolean> => {
  const { error } = await query;
  if (error) {
    alert(error.message);
    return false;
  }
  // eslint-disable-next-line no-console
  console.info(ok);
  return true;
};

export default function Kassa({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const employeeId = profile.employee_id ?? null;
  // Running shifts and handling money are separate jobs. A floor manager opens
  // and closes shifts; only someone trusted with the drawer sees the cash half.
  const mayCash = can(profile, "cash.register");

  const [float, setFloat] = useState("");
  const [counted, setCounted] = useState("");
  const [movement, setMovement] = useState({ kind: "sale", amount: "", note: "" });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["kassa"] });

  const { data: shift } = useQuery({
    queryKey: ["kassa", "shift", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<Shift | null> => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0] as Shift | undefined) ?? null;
    },
  });

  const { data: session } = useQuery({
    queryKey: ["kassa", "session", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .is("closed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0] as Session | undefined) ?? null;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["kassa", "movements", session?.id],
    enabled: Boolean(session?.id),
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", session!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Movement[];
    },
  });

  const openShift = useMutation({
    mutationFn: () => run(supabase.from("shifts").insert({ employee_id: employeeId! }), "ok"),
    onSuccess: refresh,
  });

  const closeShift = useMutation({
    mutationFn: () =>
      run(
        supabase.from("shifts").update({ ended_at: new Date().toISOString() }).eq("id", shift!.id),
        "ok",
      ),
    onSuccess: refresh,
  });

  const openCash = useMutation({
    mutationFn: () =>
      run(
        supabase
          .from("cash_sessions")
          .insert({ employee_id: employeeId!, opening_float: Number(float || 0) }),
        "ok",
      ).then((okay) => {
        if (okay) setFloat("");
      }),
    onSuccess: refresh,
  });

  const addMovement = useMutation({
    mutationFn: () =>
      run(
        supabase.from("cash_movements").insert({
          session_id: session!.id,
          kind: movement.kind,
          amount: Number(movement.amount || 0),
          note: movement.note.trim() || null,
        }),
        "ok",
      ).then((okay) => {
        if (okay) setMovement({ kind: "sale", amount: "", note: "" });
      }),
    onSuccess: refresh,
  });

  const closeCash = useMutation({
    mutationFn: () =>
      run(
        supabase
          .from("cash_sessions")
          .update({ counted_cash: Number(counted || 0), closed_at: new Date().toISOString() })
          .eq("id", session!.id),
        "ok",
      ).then((okay) => {
        if (okay) setCounted("");
      }),
    onSuccess: refresh,
  });

  if (!employeeId)
    return <Empty text="Sizning hisobingiz hali xodim yozuviga bog'lanmagan. Adminga murojaat qiling." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-rose-deep">Kassa va smena</h1>
        <p className="mt-1 text-sm text-muted">
          {profile.full_name} · {profile.position_title ?? profile.position}
        </p>
      </div>

      <Card title="Smena">
        {shift ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm">
              Smena ochiq —{" "}
              <span className="font-medium">
                {new Date(shift.started_at).toLocaleTimeString("uz-UZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>{" "}
              dan beri
            </p>
            <button
              onClick={() => closeShift.mutate()}
              disabled={closeShift.isPending}
              className="ml-auto h-10 rounded-xl border border-line px-4 text-sm"
            >
              Smenani yopish
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-muted">Smena yopiq.</p>
            <button
              onClick={() => openShift.mutate()}
              disabled={openShift.isPending}
              className="ml-auto h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white"
            >
              Smenani boshlash
            </button>
          </div>
        )}
      </Card>

      {mayCash ? (
      <Card title="Kassa">
        {session ? (
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Ochilish qoldig'i: <span className="text-ink">{uzs(session.opening_float)}</span>
            </p>

            <div className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto]">
              <select
                value={movement.kind}
                onChange={(e) => setMovement({ ...movement, kind: e.target.value })}
                className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
              >
                {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                inputMode="numeric"
                placeholder="Summa"
                value={movement.amount}
                onChange={(e) => setMovement({ ...movement, amount: e.target.value })}
                className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
              />
              <input
                placeholder="Izoh"
                value={movement.note}
                maxLength={140}
                onChange={(e) => setMovement({ ...movement, note: e.target.value })}
                className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
              />
              <button
                onClick={() => addMovement.mutate()}
                disabled={addMovement.isPending || !movement.amount}
                className="h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white disabled:opacity-40"
              >
                Yozish
              </button>
            </div>

            <ul className="divide-y divide-line rounded-2xl border border-line">
              {(movements ?? []).map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className="w-24 text-muted">{MOVEMENT_LABEL[m.kind] ?? m.kind}</span>
                  <span className="font-medium">{uzs(m.amount)}</span>
                  {m.note ? <span className="truncate text-muted">· {m.note}</span> : null}
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {new Date(m.created_at).toLocaleTimeString("uz-UZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
              {(movements ?? []).length === 0 ? (
                <li className="p-4 text-sm text-muted">Harakat yo'q.</li>
              ) : null}
            </ul>

            {/* Blind close: the counter enters what is physically in the drawer
                before ever seeing what the system expects. */}
            <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_auto]">
              <input
                inputMode="numeric"
                placeholder="Sanalgan naqd pul"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
              />
              <button
                onClick={() => closeCash.mutate()}
                disabled={closeCash.isPending || counted === ""}
                className="h-10 rounded-xl border border-line px-5 text-sm disabled:opacity-40"
              >
                Kassani yopish
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              inputMode="numeric"
              placeholder="Ochilish qoldig'i"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm"
            />
            <button
              onClick={() => openCash.mutate()}
              disabled={openCash.isPending || float === ""}
              className="h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white disabled:opacity-40"
            >
              Kassani ochish
            </button>
          </div>
        )}
      </Card>
      ) : null}
    </div>
  );
}
