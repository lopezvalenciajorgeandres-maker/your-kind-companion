import { useState } from "react";
import { toast } from "sonner";
import { Copy, Monitor, MessageCircle, Globe } from "lucide-react";

const WA_WINDOW_NAME = "eleva_whatsapp_web";
let waWindow: Window | null = null;

export function normalizePhone(phone: string | null | undefined) {
  return (phone ?? "").replace(/[^\d]/g, "");
}

export function openWhatsAppWeb(phone: string, message: string) {
  const url = `https://web.whatsapp.com/send?phone=${normalizePhone(phone)}&text=${encodeURIComponent(message)}`;
  if (waWindow && !waWindow.closed) {
    waWindow.location.href = url;
    waWindow.focus();
    return;
  }
  waWindow = window.open(url, WA_WINDOW_NAME);
  waWindow?.focus();
}

export function openWhatsAppDesktop(phone: string, message: string) {
  window.location.href = `whatsapp://send?phone=${normalizePhone(phone)}&text=${encodeURIComponent(message)}`;
}

export function WhatsAppMenu({
  phone,
  message,
  label = "WhatsApp",
  compact,
}: {
  phone: string | null | undefined;
  message: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const disabled = !normalizePhone(phone);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={
          compact
            ? "p-2 rounded-lg hover:bg-secondary text-emerald-600 disabled:opacity-40"
            : "inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
        }
        title={disabled ? "Sin teléfono" : "Enviar por WhatsApp"}
      >
        <MessageCircle className="h-4 w-4" />
        {!compact && label}
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-card shadow-lg overflow-hidden text-sm">
            <button
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary text-left"
              onClick={() => { openWhatsAppWeb(phone!, message); setOpen(false); }}
            >
              <Globe className="h-4 w-4 text-emerald-600" /> WhatsApp Web
            </button>
            <button
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary text-left"
              onClick={() => { openWhatsAppDesktop(phone!, message); setOpen(false); }}
            >
              <Monitor className="h-4 w-4 text-emerald-600" /> WhatsApp Escritorio
            </button>
            <button
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary text-left"
              onClick={async () => {
                await navigator.clipboard.writeText(message);
                toast.success("Mensaje copiado");
                setOpen(false);
              }}
            >
              <Copy className="h-4 w-4 text-muted-foreground" /> Copiar mensaje
            </button>
            <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
              WhatsApp Web reutiliza siempre la misma pestaña.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export function reminderMessage(opts: {
  clientName: string;
  businessName: string;
  serviceName?: string | null;
  startsAt?: string | null;
}) {
  const when = opts.startsAt
    ? new Date(opts.startsAt).toLocaleString("es-ES", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";
  return `Hola ${opts.clientName} 💜 Te recordamos tu cita en ${opts.businessName}${opts.serviceName ? ` para ${opts.serviceName}` : ""}${when ? ` el ${when}` : ""}. ¿Nos confirmas tu asistencia?`;
}

export function birthdayMessage(opts: { clientName: string; businessName: string }) {
  return `¡Feliz cumpleaños ${opts.clientName}! 🎉💜 Todo el equipo de ${opts.businessName} te desea un día increíble. Queremos consentirte: escríbenos y agenda tu cita de cumpleaños con un detalle especial. 🎁`;
}
