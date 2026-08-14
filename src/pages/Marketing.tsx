import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Empty, Kpi, short, uzs } from "@/components/ui";
import { can, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/queries";

/* ------------------------------------------------------------------ */
/*  Types and labels                                                   */
/* ------------------------------------------------------------------ */

type Plan = {
  id: string;
  platform: string;
  format: string;
  title: string;
  caption: string | null;
  scenario: string | null;
  hashtags: string | null;
  scheduled_at: string | null;
  status: string;
  external_url: string | null;
  reach: number;
  likes: number;
  created_at: string;
};

type Campaign = {
  id: string;
  platform: string;
  name: string;
  budget: number;
  spend: number;
  clicks: number;
  leads: number;
  status: string;
  started_on: string | null;
};

type Account = {
  id: string;
  platform: string;
  handle: string;
  followers: number;
  connected: boolean;
};

const PLATFORMS = ["instagram", "telegram", "youtube", "tiktok", "facebook"] as const;
const FORMATS = ["post", "reel", "story", "video", "carousel"] as const;

const FORMAT_LABEL: Record<string, string> = {
  post: "Post",
  reel: "Reels",
  story: "Story",
  video: "Video",
  carousel: "Karusel",
};

/** The content pipeline, in the order the work actually happens. */
const STATUSES = [
  "idea",
  "scripted",
  "filming",
  "editing",
  "ready",
  "scheduled",
  "published",
  "cancelled",
] as const;

const STATUS_LABEL: Record<string, string> = {
  idea: "G'oya",
  scripted: "Ssenariy yozildi",
  filming: "Suratga olinmoqda",
  editing: "Montaj",
  ready: "Tayyor",
  scheduled: "Rejalashtirildi",
  published: "E'lon qilindi",
  cancelled: "Bekor qilindi",
};

const STATUS_TONE: Record<string, string> = {
  idea: "bg-canvas text-muted",
  scripted: "bg-sky-50 text-sky-700",
  filming: "bg-amber-50 text-amber-700",
  editing: "bg-violet-50 text-violet-700",
  ready: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-blue-50 text-blue-700",
  published: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-50 text-rose-700",
};

const AI_KINDS = [
  { kind: "idea", label: "G'oya berish" },
  { kind: "scenario", label: "Ssenariy yozish" },
  { kind: "caption", label: "Matn (caption)" },
  { kind: "hashtags", label: "Hashtaglar" },
  { kind: "analysis", label: "Tahlil qilish" },
  { kind: "image", label: "Rasm yaratish" },
] as const;

const input = "h-10 rounded-xl border border-line bg-canvas px-3 text-sm";
const primary =
  "h-10 rounded-xl bg-rose-deep px-5 text-sm font-medium text-white disabled:opacity-40";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Marketing({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const mayWrite = can(profile, "smm.write");
  const mayAds = can(profile, "ads.manage");
  const mayPublish = can(profile, "social.publish");
  const mayAi = can(profile, "ai.use");
  const mayUpload = can(profile, "media.upload");

  const { data: stats } = useQuery({
    queryKey: ["smm", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("smm_overview", { p_days: 30 });
      if (error) throw new Error(error.message);
      return data as unknown as Record<string, number>;
    },
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ["smm", "plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("content_plan")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw new Error(error.message);
      return (data ?? []) as Plan[];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["smm", "accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from("smm_accounts").select("*").order("platform");
      if (error) throw new Error(error.message);
      return (data ?? []) as Account[];
    },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["smm"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-rose-deep">Marketing / SMM</h1>
        <p className="mt-1 text-sm text-muted">
          Kontent rejasi, mobilograf mediasi, AI yordamchisi va reklama — bitta joyda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="30 kunda e'lon qilindi" value={String(stats?.["published"] ?? 0)} />
        <Kpi label="Ishda" value={String(stats?.["in_work"] ?? 0)} />
        <Kpi label="Qamrov" value={short(Number(stats?.["reach"] ?? 0))} />
        <Kpi label="Obunachilar" value={short(Number(stats?.["followers"] ?? 0))} />
      </div>

      <ContentPlan
        plans={plans ?? []}
        loading={isLoading}
        profile={profile}
        mayWrite={mayWrite}
        mayUpload={mayUpload}
        mayPublish={mayPublish}
        onChange={refresh}
      />

      {mayAi ? <AiAssistant profile={profile} plans={plans ?? []} /> : null}

      {mayAds ? <Ads profile={profile} /> : null}

      <Accounts accounts={accounts ?? []} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Content plan                                                       */
/* ------------------------------------------------------------------ */

function ContentPlan({
  plans,
  loading,
  profile,
  mayWrite,
  mayUpload,
  mayPublish,
  onChange,
}: {
  plans: Plan[];
  loading: boolean;
  profile: Profile;
  mayWrite: boolean;
  mayUpload: boolean;
  mayPublish: boolean;
  onChange: () => void;
}) {
  const [draft, setDraft] = useState({
    platform: "instagram",
    format: "reel",
    title: "",
    scheduled_at: "",
  });
  const [open, setOpen] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_plan").insert({
        platform: draft.platform,
        format: draft.format,
        title: draft.title.trim(),
        scheduled_at: draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : null,
        created_by: profile.employee_id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft({ ...draft, title: "", scheduled_at: "" });
      onChange();
    },
    onError: (e: Error) => alert(e.message),
  });

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "published") patch["published_at"] = new Date().toISOString();
    const { error } = await supabase.from("content_plan").update(patch).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    onChange();
  };

  return (
    <Card title="Kontent reja">
      {mayWrite ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-[130px_120px_1fr_190px_auto]">
          <select
            value={draft.platform}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
            className={input}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={draft.format}
            onChange={(e) => setDraft({ ...draft, format: e.target.value })}
            className={input}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
          <input
            placeholder="Nomi — nima haqida post?"
            maxLength={160}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className={input}
          />
          <input
            type="datetime-local"
            value={draft.scheduled_at}
            onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })}
            className={input}
          />
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || draft.title.trim().length < 3}
            className={primary}
          >
            Qo'shish
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-canvas" />
      ) : plans.length === 0 ? (
        <Empty text="Hozircha reja bo'sh." />
      ) : (
        <ul className="divide-y divide-line">
          {plans.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted">
                  {p.platform}
                </span>
                <span className="text-xs text-muted">{FORMAT_LABEL[p.format] ?? p.format}</span>
                <span className="font-medium">{p.title}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    STATUS_TONE[p.status] ?? "bg-canvas text-muted"
                  }`}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                {p.scheduled_at ? (
                  <span className="text-xs text-muted">
                    {new Date(p.scheduled_at).toLocaleString("uz-UZ", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}

                <div className="ml-auto flex items-center gap-2">
                  {mayWrite ? (
                    <select
                      value={p.status}
                      onChange={(e) => setStatus(p.id, e.target.value)}
                      className="h-8 rounded-lg border border-line bg-canvas px-2 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    onClick={() => setOpen(open === p.id ? null : p.id)}
                    className="h-8 rounded-lg border border-line px-3 text-xs"
                  >
                    {open === p.id ? "Yopish" : "Ochish"}
                  </button>
                </div>
              </div>

              {open === p.id ? (
                <PlanDetail
                  plan={p}
                  profile={profile}
                  mayWrite={mayWrite}
                  mayUpload={mayUpload}
                  mayPublish={mayPublish}
                  onChange={onChange}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PlanDetail({
  plan,
  profile,
  mayWrite,
  mayUpload,
  mayPublish,
  onChange,
}: {
  plan: Plan;
  profile: Profile;
  mayWrite: boolean;
  mayUpload: boolean;
  mayPublish: boolean;
  onChange: () => void;
}) {
  const [scenario, setScenario] = useState(plan.scenario ?? "");
  const [caption, setCaption] = useState(plan.caption ?? "");
  const [hashtags, setHashtags] = useState(plan.hashtags ?? "");
  const [url, setUrl] = useState(plan.external_url ?? "");
  const [busy, setBusy] = useState(false);

  const { data: assets, refetch } = useQuery({
    queryKey: ["smm", "assets", plan.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_assets")
        .select("*")
        .eq("plan_id", plan.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; kind: string; path: string }[];
    },
  });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("content_plan")
      .update({
        scenario: scenario.trim() || null,
        caption: caption.trim() || null,
        hashtags: hashtags.trim() || null,
        external_url: url.trim() || null,
      })
      .eq("id", plan.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    onChange();
  };

  /** Mobilograf's footage goes straight into the shared media bucket, and the
      row that points at it carries who uploaded it. */
  const upload = async (file: File) => {
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `content/${plan.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file);
    if (upErr) {
      setBusy(false);
      alert(upErr.message);
      return;
    }
    const { error } = await supabase.from("content_assets").insert({
      plan_id: plan.id,
      kind: file.type.startsWith("video") ? "video" : "image",
      path,
      uploaded_by: profile.employee_id ?? null,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    void refetch();
  };

  /** Publishing is a server job: the panel names the post, the function holds
      the tokens and does the sending. */
  const publish = async () => {
    if (!window.confirm("Shu post e'lon qilinsinmi?")) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("smm-publish", {
      body: { plan_id: plan.id },
    });
    setBusy(false);
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (error || result?.error) {
      alert(result?.error ?? "E'lon qilinmadi.");
      return;
    }
    alert(result?.url ? `E'lon qilindi: ${result.url}` : "E'lon qilindi.");
    onChange();
  };

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-line bg-canvas/50 p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Ssenariy</span>
          <textarea
            rows={6}
            value={scenario}
            readOnly={!mayWrite}
            onChange={(e) => setScenario(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Matn</span>
          <textarea
            rows={6}
            value={caption}
            readOnly={!mayWrite}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          placeholder="#hashtaglar"
          value={hashtags}
          readOnly={!mayWrite}
          onChange={(e) => setHashtags(e.target.value)}
          className={`${input} bg-surface`}
        />
        <input
          placeholder="E'lon havolasi"
          value={url}
          readOnly={!mayWrite}
          onChange={(e) => setUrl(e.target.value)}
          className={`${input} bg-surface`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {mayWrite ? (
          <button onClick={save} disabled={busy} className={primary}>
            Saqlash
          </button>
        ) : null}

        {mayUpload ? (
          <label className="cursor-pointer rounded-xl border border-line bg-surface px-4 py-2 text-sm">
            Media yuklash
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}

        {mayPublish && plan.status !== "published" ? (
          <button onClick={publish} disabled={busy} className={primary}>
            E'lon qilish
          </button>
        ) : null}

        <span className="text-xs text-muted">{(assets ?? []).length} ta media</span>
      </div>

      {(assets ?? []).length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {(assets ?? []).map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted"
            >
              {a.kind === "video" ? "🎬" : "🖼"} {a.path.split("/").pop()}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI assistant                                                       */
/* ------------------------------------------------------------------ */

function AiAssistant({ profile, plans }: { profile: Profile; plans: Plan[] }) {
  const [kind, setKind] = useState<string>("idea");
  const [prompt, setPrompt] = useState("");
  const [planId, setPlanId] = useState("");
  const [output, setOutput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The API key lives in Supabase secrets, never in the browser — the panel
     asks an edge function, and the function talks to the model. */
  const ask = async () => {
    setBusy(true);
    setError(null);
    setOutput("");
    setImageUrl("");

    const { data, error: fnError } = await supabase.functions.invoke("smm-ai", {
      body: {
        kind,
        prompt: prompt.trim(),
        plan_id: planId || null,
        employee_id: profile.employee_id ?? null,
      },
    });

    setBusy(false);

    if (fnError) {
      setError(
        "AI javob bermadi. Kalit qo'yilmagan bo'lishi mumkin — administrator Supabase sozlamalariga GEMINI_API_KEY qo'shishi kerak.",
      );
      return;
    }

    const result = data as { text?: string; image_url?: string; error?: string } | null;
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOutput(result?.text ?? "");
    setImageUrl(result?.image_url ?? "");
  };

  const applyTo = async (field: "scenario" | "caption" | "hashtags") => {
    if (!planId || !output) return;
    const { error: updateError } = await supabase
      .from("content_plan")
      .update({ [field]: output })
      .eq("id", planId);
    if (updateError) {
      alert(updateError.message);
      return;
    }
    alert("Rejaga yozildi.");
  };

  return (
    <Card title="AI yordamchi">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {AI_KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => setKind(k.kind)}
              className={`h-9 rounded-xl px-4 text-sm transition-colors ${
                kind === k.kind
                  ? "bg-rose-deep text-white"
                  : "border border-line text-muted hover:text-rose-deep"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
          <textarea
            rows={3}
            placeholder={
              kind === "analysis"
                ? "Nimani tahlil qilay? Masalan: oxirgi oydagi reels natijalari"
                : kind === "image"
                  ? "Qanday rasm kerak? Masalan: kuzgi palto, iliq yorug'lik, studiya foni"
                  : "Nima haqida? Masalan: yangi kuzgi kolleksiya, 3 ta ko'ylak"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-xl border border-line bg-canvas p-3 text-sm"
          />
          <div className="space-y-2">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className={`${input} w-full`}
            >
              <option value="">Rejaga bog'lanmagan</option>
              {plans.slice(0, 40).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              onClick={ask}
              disabled={busy || prompt.trim().length < 3}
              className={`${primary} w-full`}
            >
              {busy ? "AI o'ylayapti…" : "So'rash"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        ) : null}

        {imageUrl ? (
          <img
            src={imageUrl}
            alt="AI yaratgan rasm"
            className="max-h-96 rounded-2xl border border-line"
          />
        ) : null}

        {output ? (
          <div className="space-y-3">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-line bg-canvas p-4 text-sm">
              {output}
            </pre>
            {planId ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyTo("scenario")}
                  className="h-9 rounded-xl border border-line px-4 text-sm"
                >
                  Ssenariyga yozish
                </button>
                <button
                  onClick={() => applyTo("caption")}
                  className="h-9 rounded-xl border border-line px-4 text-sm"
                >
                  Matnga yozish
                </button>
                <button
                  onClick={() => applyTo("hashtags")}
                  className="h-9 rounded-xl border border-line px-4 text-sm"
                >
                  Hashtaglarga yozish
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Ads — targetolog                                                   */
/* ------------------------------------------------------------------ */

function Ads({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ platform: "instagram", name: "", budget: "" });

  const { data: campaigns } = useQuery({
    queryKey: ["smm", "ads"],
    queryFn: async (): Promise<Campaign[]> => {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return (data ?? []) as Campaign[];
    },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["smm"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ad_campaigns").insert({
        platform: draft.platform,
        name: draft.name.trim(),
        budget: Number(draft.budget || 0),
        managed_by: profile.employee_id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft({ ...draft, name: "", budget: "" });
      refresh();
    },
    onError: (e: Error) => alert(e.message),
  });

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("ad_campaigns").update(values).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    refresh();
  };

  const rows = campaigns ?? [];
  const spend = rows.reduce((sum, c) => sum + Number(c.spend), 0);
  const leads = rows.reduce((sum, c) => sum + c.leads, 0);

  return (
    <Card title="Reklama kampaniyalari">
      <div className="mb-5 grid gap-3 sm:grid-cols-[140px_1fr_160px_auto]">
        <select
          value={draft.platform}
          onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
          className={input}
        >
          {["instagram", "facebook", "telegram", "youtube", "tiktok", "google"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          placeholder="Kampaniya nomi"
          maxLength={140}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className={input}
        />
        <input
          inputMode="numeric"
          placeholder="Byudjet"
          value={draft.budget}
          onChange={(e) => setDraft({ ...draft, budget: e.target.value })}
          className={input}
        />
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || draft.name.trim().length < 2}
          className={primary}
        >
          Yaratish
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-6 text-sm">
        <span className="text-muted">
          Sarflandi: <span className="text-ink">{uzs(spend)}</span>
        </span>
        <span className="text-muted">
          Lidlar: <span className="text-ink">{leads}</span>
        </span>
        <span className="text-muted">
          Bitta lid: <span className="text-ink">{leads > 0 ? uzs(spend / leads) : "—"}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty text="Kampaniya yo'q." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-3">Kampaniya</th>
                <th className="pb-3">Byudjet</th>
                <th className="pb-3">Sarflandi</th>
                <th className="pb-3">Lidlar</th>
                <th className="pb-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted">{c.platform}</span>
                  </td>
                  <td className="py-3">{uzs(c.budget)}</td>
                  <td className="py-3">
                    <input
                      inputMode="numeric"
                      defaultValue={String(c.spend)}
                      onBlur={(e) => {
                        const value = Number(e.target.value || 0);
                        if (value !== Number(c.spend)) void patch(c.id, { spend: value });
                      }}
                      className="h-8 w-28 rounded-lg border border-line bg-canvas px-2 text-sm"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      inputMode="numeric"
                      defaultValue={String(c.leads)}
                      onBlur={(e) => {
                        const value = Number(e.target.value || 0);
                        if (value !== c.leads) void patch(c.id, { leads: value });
                      }}
                      className="h-8 w-20 rounded-lg border border-line bg-canvas px-2 text-sm"
                    />
                  </td>
                  <td className="py-3">
                    <select
                      value={c.status}
                      onChange={(e) => patch(c.id, { status: e.target.value })}
                      className="h-8 rounded-lg border border-line bg-canvas px-2 text-xs"
                    >
                      {["draft", "active", "paused", "finished"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Connected accounts                                                 */
/* ------------------------------------------------------------------ */

function Accounts({ accounts }: { accounts: Account[] }) {
  return (
    <Card title="Ulangan ijtimoiy tarmoqlar">
      {accounts.length === 0 ? (
        <div className="space-y-2">
          <Empty text="Hech qanday tarmoq ulanmagan." />
          <p className="text-xs text-muted">
            Instagram va YouTube'ga avtomatik e'lon qilish uchun Meta va Google tomonida dasturchi
            ilovasi ochilishi kerak. Ular tayyor bo'lgach, shu yerda ko'rinadi.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted">
                {a.platform}
              </span>
              <span className="font-medium">{a.handle}</span>
              <span className="text-muted">{short(a.followers)} obunachi</span>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${
                  a.connected ? "bg-emerald-50 text-emerald-700" : "bg-canvas text-muted"
                }`}
              >
                {a.connected ? "Ulangan" : "Ulanmagan"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
