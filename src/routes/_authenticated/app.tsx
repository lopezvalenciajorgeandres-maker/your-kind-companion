import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/use-tenant";
import { useAppMode, type AppMode } from "@/lib/mode";
import {
  Calendar,
  Users,
  Sparkles,
  Settings,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Wallet,
  BarChart3,
  UserCog,
  Crown,
  ExternalLink,
  Repeat,
  Home,
  Calculator,
} from "lucide-react";
import logoUrl from "@/assets/eleva-logo.png";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: typeof Calendar; exact?: boolean; pro?: boolean };

const NAV: NavItem[] = [
  { to: "/app", label: "Panel", icon: LayoutDashboard, exact: true },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/servicios", label: "Servicios", icon: Sparkles },
  { to: "/app/pagos", label: "Pagos", icon: Wallet, pro: true },
  { to: "/app/contabilidad", label: "Contabilidad", icon: Calculator, pro: true },
  { to: "/app/profesionales", label: "Profesionales", icon: UserCog, pro: true },
  { to: "/app/reportes", label: "Reportes", icon: BarChart3, pro: true },
  { to: "/app/planes", label: "Plan", icon: Crown, pro: true },
  { to: "/app/ajustes", label: "Ajustes", icon: Settings, pro: true },
];

const FREE_PATHS = ["/app", "/app/agenda", "/app/clientes", "/app/servicios", "/app/onboarding", "/app/modo"];

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenant = useTenant();
  const { mode, ready } = useAppMode();

  const needsOnboarding = !tenant.isLoading && (!tenant.business || !tenant.business.onboarded);

  useEffect(() => {
    if (needsOnboarding && pathname !== "/app/onboarding") {
      navigate({ to: "/app/onboarding", replace: true });
      return;
    }
    if (!needsOnboarding && ready && !mode && pathname !== "/app/modo") {
      navigate({ to: "/app/modo", replace: true });
      return;
    }
    if (mode === "free" && !FREE_PATHS.some((p) => (p === "/app" ? pathname === p : pathname.startsWith(p)))) {
      navigate({ to: "/app", replace: true });
    }
  }, [needsOnboarding, pathname, navigate, mode, ready]);

  const nav = mode === "free" ? NAV.filter((i) => !i.pro) : NAV;
  const mobileNav = (mode === "free"
    ? ["/app", "/app/agenda", "/app/clientes", "/app/servicios"]
    : ["/app", "/app/agenda", "/app/clientes", "/app/pagos", "/app/ajustes"]
  ).map((p) => NAV.find((i) => i.to === p)!).filter(Boolean);

  if (pathname === "/app/modo") {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <SidebarContent
      nav={nav}
      mode={mode}
      pathname={pathname}
      onSignOut={signOut}
      businessName={tenant.business?.name}
      slug={tenant.business?.slug}
      plan={tenant.plan}
      onNav={() => setOpen(false)}
      onSwitchMode={() => { setOpen(false); navigate({ to: "/app/modo" }); }}
    />
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-border bg-sidebar">{sidebar}</aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link to="/app" className="flex items-center gap-2">
            <img src={logoUrl} className="h-8 w-8 rounded-full" alt="" />
            <span className="font-serif">ELEVA</span>
          </Link>
          <a
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/70"
          >
            <Home className="h-3 w-3" /> Volver al inicio
          </a>
        </div>
        <button onClick={() => setOpen(!open)} aria-label="Menú">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && <div className="md:hidden fixed inset-0 z-20 pt-14 bg-sidebar overflow-y-auto">{sidebar}</div>}

      <main className="flex-1 pt-14 md:pt-0 pb-20 md:pb-0 min-w-0">
        <Outlet />
      </main>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border grid"
        style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0,1fr))` }}
      >
        {mobileNav.map((i) => {
          const active = i.exact ? pathname === i.to : pathname.startsWith(i.to);
          return (
            <Link
              key={i.to}
              to={i.to as "/app"}
              className={`flex flex-col items-center gap-1 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <i.icon className="h-5 w-5" />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({
  nav,
  mode,
  pathname,
  onSignOut,
  businessName,
  slug,
  plan,
  onNav,
  onSwitchMode,
}: {
  nav: NavItem[];
  mode: AppMode | null;
  pathname: string;
  onSignOut: () => void;
  businessName?: string | null;
  slug?: string | null;
  plan: "free" | "pro";
  onNav?: () => void;
  onSwitchMode: () => void;
}) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2 px-2 py-3">
        <a href="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="ELEVA SYSTEM" className="h-9 w-9 rounded-full" />
          <div className="leading-tight">
            <div className="font-serif text-lg">ELEVA</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">System</div>
          </div>
        </a>
        <a
          href="/"
          onClick={onNav}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/70 hover:bg-secondary transition"
        >
          <Home className="h-3 w-3" /> Volver al inicio
        </a>
      </div>

      {businessName && (
        <div className="mt-4 rounded-xl bg-primary/10 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Negocio</div>
            <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold uppercase">
              {mode ?? plan}
            </span>
          </div>
          <div className="font-medium truncate text-sm">{businessName}</div>
          {slug && (
            <a
              href={`/booking/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Ver página de reservas <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <nav className="mt-6 flex-1 space-y-1">
        {nav.map((i) => {
          const active = i.exact ? pathname === i.to : pathname.startsWith(i.to);
          return (
            <Link
              key={i.to}
              to={i.to as "/app"}
              onClick={onNav}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary"
              }`}
            >
              <i.icon className="h-4 w-4" />
              <span className="flex-1">{i.label}</span>
              {i.pro && mode !== "pro" && (
                <span className="text-[9px] uppercase font-semibold text-primary">Pro</span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onSwitchMode}
        className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-secondary transition"
      >
        <Repeat className="h-4 w-4" /> Cambiar versión
      </button>

      <button
        onClick={onSignOut}
        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary transition"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </div>
  );
}
