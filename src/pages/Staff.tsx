import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Empty, Kpi } from "@/components/ui";
import { can, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/queries";

type Position = {
  id: string;
  code: string;
  title_uz: string;
  headcount: number;
  department_id: string;
};

type Department = { id: string; code: string; name_uz: string };

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  position_id: string | null;
  active: boolean;
  hired_at: string;
};

const input = "h-10 rounded-xl border border-line bg-canvas px-3 text-sm";
const primary =
  "h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white disabled:opacity-40";

/** The database refuses some position changes outright; say why in plain words. */
function friendly(message: string): string {
  if (message.includes("FORBIDDEN_POSITION"))
    return "Bu lavozimni faqat rahbar biriktira oladi.";
  if (message.includes("duplicate") || message.includes("23505"))
    return "Bu email allaqachon ro'yxatda bor.";
  return message;
}

export default function Staff({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const mayManage = can(profile, "staff.manage");

  const [draft, setDraft] = useState({ full_name: "", position_id: "", email: "", phone: "" });
  const [showInactive, setShowInactive] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["hr", "departments"],
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, code, name_uz")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Department[];
    },
  });

  const { data: positions } = useQuery({
    queryKey: ["hr", "positions"],
    queryFn: async (): Promise<Position[]> => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, code, title_uz, headcount, department_id")
        .eq("active", true)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Position[];
    },
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["hr", "employees"],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, phone, email, position_id, active, hired_at")
        .order("full_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Employee[];
    },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["hr"] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").insert({
        full_name: draft.full_name.trim(),
        position_id: draft.position_id || null,
        email: draft.email.trim().toLowerCase() || null,
        phone: draft.phone.trim() || null,
      });
      if (error) throw new Error(friendly(error.message));
    },
    onSuccess: () => {
      setDraft({ full_name: "", position_id: "", email: "", phone: "" });
      refresh();
    },
    onError: (e: Error) => alert(e.message),
  });

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("employees").update(values).eq("id", id);
    if (error) {
      alert(friendly(error.message));
      return;
    }
    refresh();
  };

  const positionName = (id: string | null) =>
    positions?.find((p) => p.id === id)?.title_uz ?? "—";

  const departmentName = (id: string | null) => {
    const position = positions?.find((p) => p.id === id);
    return departments?.find((d) => d.id === position?.department_id)?.name_uz ?? "—";
  };

  const rows = (employees ?? []).filter((e) => showInactive || e.active);
  const active = (employees ?? []).filter((e) => e.active).length;
  const planned = (positions ?? []).reduce((sum, p) => sum + p.headcount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-rose-deep">Xodimlar</h1>
        <p className="mt-1 text-sm text-muted">
          Kim ishlaydi, qaysi lavozimda va qaysi bo'limda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Faol xodim" value={String(active)} />
        <Kpi label="Shtat bo'yicha" value={String(planned)} />
        <Kpi label="Lavozimlar" value={String((positions ?? []).length)} />
      </div>

      {mayManage ? (
        <Card title="Yangi xodim">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_150px_auto]">
            <input
              placeholder="To'liq ismi"
              maxLength={120}
              value={draft.full_name}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              className={input}
            />
            <select
              value={draft.position_id}
              onChange={(e) => setDraft({ ...draft, position_id: e.target.value })}
              className={input}
            >
              <option value="">Lavozim tanlang</option>
              {(positions ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title_uz}
                </option>
              ))}
            </select>
            <input
              type="email"
              placeholder="Email (login uchun)"
              maxLength={160}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className={input}
            />
            <input
              placeholder="Telefon"
              maxLength={40}
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className={input}
            />
            <button
              onClick={() => add.mutate()}
              disabled={add.isPending || draft.full_name.trim().length < 3}
              className={primary}
            >
              Qo'shish
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Email kiritilsa, o'sha manzil avtomatik ruxsat ro'yxatiga tushadi. Parolni rahbar
            beradi — shundan keyin xodim shu panelga o'z hisobi bilan kiradi.
          </p>
        </Card>
      ) : null}

      <Card title="Ro'yxat">
        <label className="mb-4 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Ishdan ketganlarni ham ko'rsatish
        </label>

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-canvas" />
        ) : rows.length === 0 ? (
          <Empty text="Hozircha xodim qo'shilmagan." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-3">Ism</th>
                  <th className="pb-3">Lavozim</th>
                  <th className="pb-3">Bo'lim</th>
                  <th className="pb-3">Aloqa</th>
                  <th className="pb-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="py-3">
                      <span className="font-medium">{e.full_name}</span>
                      <div className="text-xs text-muted">
                        {new Date(e.hired_at).toLocaleDateString("uz-UZ")} dan
                      </div>
                    </td>
                    <td className="py-3">
                      {mayManage ? (
                        <select
                          value={e.position_id ?? ""}
                          onChange={(ev) => patch(e.id, { position_id: ev.target.value || null })}
                          className="h-8 rounded-lg border border-line bg-canvas px-2 text-xs"
                        >
                          <option value="">—</option>
                          {(positions ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title_uz}
                            </option>
                          ))}
                        </select>
                      ) : (
                        positionName(e.position_id)
                      )}
                    </td>
                    <td className="py-3 text-muted">{departmentName(e.position_id)}</td>
                    <td className="py-3 text-muted">
                      <div>{e.email ?? "—"}</div>
                      <div className="text-xs">{e.phone ?? ""}</div>
                    </td>
                    <td className="py-3">
                      {mayManage ? (
                        <button
                          onClick={() => patch(e.id, { active: !e.active })}
                          className={`h-8 rounded-lg px-3 text-xs ${
                            e.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-canvas text-muted border border-line"
                          }`}
                        >
                          {e.active ? "Ishlayapti" : "Ketgan"}
                        </button>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs ${
                            e.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-canvas text-muted"
                          }`}
                        >
                          {e.active ? "Ishlayapti" : "Ketgan"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
