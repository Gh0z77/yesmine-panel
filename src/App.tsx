import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Boxes,
  LayoutDashboard,
  Loader2,
  Megaphone,
  LogOut,
  Menu,
  ShoppingBag,
  UserCog,
  Target,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { can, profileQuery, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/queries";
import Customers from "@/pages/Customers";
import Finance from "@/pages/Finance";
import Kassa from "@/pages/Kassa";
import Leads from "@/pages/Leads";
import Marketing from "@/pages/Marketing";
import Orders from "@/pages/Orders";
import Overview from "@/pages/Overview";
import Products from "@/pages/Products";
import Staff from "@/pages/Staff";
import Supply from "@/pages/Supply";

/**
 * The menu is derived from the job, never chosen by the person signing in.
 * Each entry names the permission that unlocks it; positions carry those
 * permissions, and the same codes gate the rows in the database.
 */
type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  /** Any one of these opens the page — a floor manager runs shifts without
      ever touching the cash drawer, so both keys reach the same screen. */
  need: string[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Boshqaruv paneli", icon: LayoutDashboard, end: true, need: ["dashboard.view"] },
  { to: "/kassa", label: "Kassa va smena", icon: Wallet, end: false, need: ["cash.register", "shift.manage"] },
  { to: "/leads", label: "Lidlar", icon: Target, end: false, need: ["leads.read"] },
  { to: "/orders", label: "Buyurtmalar", icon: ShoppingBag, end: false, need: ["orders.read"] },
  { to: "/products", label: "Mahsulotlar", icon: Boxes, end: false, need: ["products.read"] },
  { to: "/customers", label: "Mijozlar", icon: Users, end: false, need: ["orders.read"] },
  { to: "/marketing", label: "Marketing / SMM", icon: Megaphone, end: false, need: ["smm.read"] },
  { to: "/staff", label: "Xodimlar", icon: UserCog, end: false, need: ["staff.read"] },
  { to: "/finance", label: "Moliya", icon: Banknote, end: false, need: ["finance.read"] },
  { to: "/supply", label: "Ta'minot", icon: Truck, end: false, need: ["supply.manage"] },
];

const allowed = (profile: Profile | null) =>
  NAV.filter((item) => item.need.some((code) => can(profile, code)));

/* ------------------------------------------------------------------ */
/*  Sign in                                                            */
/* ------------------------------------------------------------------ */

/**
 * One form, no choices. Nobody picks a department at the door — the account
 * already knows which job it belongs to, and where the person lands is
 * decided after sign-in from their employee record.
 */
function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(address)) {
      setError("Emailni to'g'ri kiriting.");
      return;
    }
    if (password.length < 6) {
      setError("Parolni kiriting.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });
    setBusy(false);
    // Deliberately identical for a wrong password and an unknown address, so
    // the form cannot be used to discover which accounts exist.
    if (authError) setError("Email yoki parol noto'g'ri.");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-line bg-surface p-8 shadow-[0_24px_60px_-24px_oklch(0.5_0.2_5.2/0.3)]">
        <p className="text-center font-display text-3xl text-rose-deep">Yesmine</p>
        <p className="mt-1 text-center text-[11px] uppercase tracking-[0.2em] text-muted">
          Xodimlar paneli
        </p>

        <div className="mt-8 space-y-3">
          <input
            type="email"
            value={email}
            autoFocus
            autoComplete="username"
            placeholder="Login (email)"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="h-11 w-full rounded-xl border border-line bg-canvas px-4 text-sm outline-none focus:border-pink-vivid"
          />
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="Parol"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="h-11 w-full rounded-xl border border-line bg-canvas px-4 text-sm outline-none focus:border-pink-vivid"
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-deep font-medium text-white transition-opacity disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Tekshirilmoqda…" : "Kirish"}
        </button>

        <p className="mt-6 text-center text-xs text-muted">
          Login va parolni administrator beradi.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

function Locked({ onOut }: { onOut: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div className="max-w-sm space-y-3">
        <p className="font-display text-2xl text-rose-deep">Panel biriktirilmagan</p>
        <p className="text-sm text-muted">
          Hisobingiz hali hech qaysi lavozimga bog'lanmagan. Administrator sizni Xodimlar
          bo'limidan qo'shgach, panel o'zi ochiladi.
        </p>
        <button onClick={onOut} className="h-10 rounded-xl border border-line px-5 text-sm">
          Chiqish
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(Boolean(s));
      // A different person may sign in on the same machine, so nothing the
      // previous session fetched may be reused.
      queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    ...profileQuery,
    enabled: signedIn,
  });

  const signOut = () => void supabase.auth.signOut();

  if (!ready) return <div className="grid min-h-screen place-items-center text-muted">…</div>;
  if (!signedIn) return <SignIn />;
  if (profileLoading)
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  const menu = allowed(profile ?? null);
  if (menu.length === 0) return <Locked onOut={signOut} />;

  const home = menu[0]!.to;
  const guard = (need: string | string[], element: React.ReactElement) => {
    const codes = Array.isArray(need) ? need : [need];
    return codes.some((code) => can(profile, code)) ? element : <Navigate to={home} replace />;
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-line bg-surface p-5 lg:static lg:block ${
          menuOpen ? "block" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-2xl text-rose-deep">Yesmine</p>
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {profile?.department_name ?? "Xodimlar paneli"}
            </p>
          </div>
          <button className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-rose-deep text-white"
                    : "text-muted hover:bg-canvas hover:text-rose-deep"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-10 space-y-2 border-t border-line pt-5">
          <p className="truncate text-sm text-ink">{profile?.full_name}</p>
          <p className="truncate text-xs text-muted">
            {profile?.position_title ?? profile?.position}
          </p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 pt-2 text-sm text-muted transition-colors hover:text-rose-deep"
          >
            <LogOut className="h-3.5 w-3.5" /> Chiqish
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button onClick={() => setMenuOpen(true)} aria-label="Menyu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg text-rose-deep">Yesmine</span>
          <span className="ml-auto truncate text-xs text-muted">{profile?.full_name}</span>
        </header>

        <main className="p-4 sm:p-8">
          <Routes>
            <Route path="/" element={guard("dashboard.view", <Overview />)} />
            <Route
              path="/kassa"
              element={guard(["cash.register", "shift.manage"], <Kassa profile={profile as Profile} />)}
            />
            <Route
              path="/marketing"
              element={guard("smm.read", <Marketing profile={profile as Profile} />)}
            />
            <Route
              path="/staff"
              element={guard("staff.read", <Staff profile={profile as Profile} />)}
            />
            <Route path="/leads" element={guard("leads.read", <Leads />)} />
            <Route path="/orders" element={guard("orders.read", <Orders />)} />
            <Route path="/products" element={guard("products.read", <Products />)} />
            <Route path="/customers" element={guard("orders.read", <Customers />)} />
            <Route
              path="/finance"
              element={guard("finance.read", <Finance profile={profile as Profile} />)}
            />
            <Route
              path="/supply"
              element={guard("supply.manage", <Supply profile={profile as Profile} />)}
            />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
