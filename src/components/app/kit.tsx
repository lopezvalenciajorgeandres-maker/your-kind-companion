import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Lock, Sparkles, X } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {Icon && (
          <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 font-serif text-2xl md:text-3xl">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Panel>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="p-10 text-center">
      <div className="font-serif text-lg">{title}</div>
      {body && <p className="text-sm text-muted-foreground mt-1">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div
        className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-xl max-h-[92vh] overflow-y-auto`}
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-serif text-xl">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary transition";

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
      <Sparkles className="h-3 w-3" /> Pro
    </span>
  );
}

export function ProGate({ title, body }: { title: string; body?: string }) {
  return (
    <Panel className="p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {body ?? "Esta función está disponible en el plan PRO de ELEVA SYSTEM."}
      </p>
      <Link to="/app/planes" className={`${btnPrimary} mt-6`}>
        <Sparkles className="h-4 w-4" /> Ver plan PRO
      </Link>
    </Panel>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    scheduled: "bg-primary/15 text-primary",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-muted text-muted-foreground",
    no_show: "bg-destructive/10 text-destructive",
  };
  const label: Record<string, string> = {
    pending: "Pendiente",
    scheduled: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No asistió",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-muted"}`}>
      {label[status] ?? status}
    </span>
  );
}
