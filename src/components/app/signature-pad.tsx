import { useEffect, useRef, useState } from "react";
import { Modal, btnGhost, btnPrimary, inputClass, Field } from "./kit";
import { ChevronDown, ChevronUp, Eraser, PenLine, ShieldCheck } from "lucide-react";

export const DATA_POLICY_TEXT = `Autorización para el Tratamiento de Datos Personales

Con la aceptación de esta autorización y la firma del presente documento, el titular de los datos personales, de manera libre, previa, expresa e informada, autoriza al establecimiento para la recolección, almacenamiento, uso, circulación y supresión de sus datos personales, conforme a lo dispuesto en la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Colombia).

Finalidades del tratamiento:
• Gestionar la agenda de citas, servicios y tratamientos contratados.
• Llevar el historial clínico/estético, pagos, abonos y saldos pendientes.
• Enviar recordatorios de citas, felicitaciones y mensajes relacionados con los servicios, a través de WhatsApp, llamadas o correo electrónico.
• Elaborar reportes internos y cumplir obligaciones contables y legales.

Derechos del titular:
El titular podrá ejercer en cualquier momento sus derechos de conocer, actualizar, rectificar y suprimir sus datos, así como revocar esta autorización, mediante solicitud escrita dirigida al establecimiento, sin que ello afecte el uso de los datos previamente autorizado ni las obligaciones legales de conservación.

El establecimiento garantiza la confidencialidad y seguridad de la información y no compartirá los datos con terceros ajenos a la prestación del servicio, salvo obligación legal.`;

/**
 * Panel de firma. Funciona con dedo (tablet/celular), lápiz digital,
 * mouse y touchpad del computador (Pointer Events cubre los tres).
 */
export function SignaturePad({
  onDone,
  onCancel,
  title = "Firma del cliente",
  clientName,
  subtitle,
}: {
  onDone: (signatureDataUrl: string, signedByName: string) => void;
  onCancel: () => void;
  title?: string;
  clientName?: string;
  subtitle?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState(clientName ?? "");
  const [accepted, setAccepted] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f2937";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    // Fondo blanco para que la firma se vea en cualquier lugar
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    onDone(out.toDataURL("image/png"), name.trim());
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-muted-foreground">
        {subtitle ??
          "El cliente firma aquí para confirmar que la cita se cumplió. Puede firmar con el dedo en celular o tablet, o con el touchpad en el computador."}
      </p>

      <div className="mt-4">
        <Field label="Nombre de quien firma">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre y apellido"
          />
        </Field>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-2">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="h-48 w-full touch-none rounded-xl bg-white"
          style={{ touchAction: "none" }}
          aria-label="Área de firma"
        />
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <PenLine className="h-3 w-3" /> Firme dentro del recuadro
          </span>
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Eraser className="h-3.5 w-3.5" /> Borrar
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={btnPrimary} onClick={save} disabled={!hasInk}>
          Confirmar cita firmada
        </button>
      </div>
    </Modal>
  );
}
