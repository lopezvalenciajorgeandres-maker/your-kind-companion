import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createService, deleteService, listServices, updateService } from "@/lib/services.functions";
import { listProfessionals } from "@/lib/professionals.functions";
import { useTenant } from "@/lib/use-tenant";
import { formatMoney, limitReached } from "@/lib/plan";
import { EmptyState, Field, Modal, PageHeader, Panel, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/servicios")({ component: Services });

const COLORS = ["#CDB4DB", "#A8C5A1", "#F5C6D6", "#BEB7B0", "#9AB7D3", "#E8C39E"];

type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_min: number;
  price_cents: number;
  color: string;
  active: boolean;
  professional_id: string | null;
};

function Services() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const list = useServerFn(listServices);
  const listPros = useServerFn(listProfessionals);
  const create = useServerFn(createService);
  const update = useServerFn(updateService);
  const del = useServerFn(deleteService);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const services = useQuery({ queryKey: ["services"], queryFn: () => list() });
  const pros = useQuery({ queryKey: ["professionals"], queryFn: () => listPros() });
  const rows = (services.data ?? []) as unknown as Service[];
  const over = limitReached(tenant.limits, "max_services", rows.length);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); toast.success("Servicio eliminado"); },
  });

  return (
    <div className="p-5 md:p-10 max-w-5xl">
      <PageHeader
        title="Servicios"
        subtitle="Catálogo de tratamientos con duración y precio."
        action={
          <button
            className={btnPrimary}
            onClick={() => {
              if (over) return toast.error("Límite de servicios alcanzado en tu plan.");
              setEditing(null);
              setModal(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo servicio
          </button>
        }
      />

      <Panel className="mt-6 divide-y divide-border">
        {services.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando...</div>}
        {!services.isLoading && rows.length === 0 && <EmptyState title="Sin servicios" body="Añade tu primer tratamiento." />}
        {rows.map((s) => (
          <div key={s.id} className="p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full" style={{ background: s.color }} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {s.name} {!s.active && <span className="text-xs text-muted-foreground">(inactivo)</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {s.category ? `${s.category} · ` : ""}{formatMoney(s.price_cents, tenant.currency)}
              </div>
            </div>
            <button onClick={() => { setEditing(s); setModal(true); }} className="p-2 rounded-lg hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => { if (confirm("¿Eliminar servicio?")) delMut.mutate(s.id); }} className="p-2 rounded-lg hover:bg-secondary text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Panel>

      {modal && (
        <ServiceModal
          service={editing}
          professionals={(pros.data ?? []) as Array<{ id: string; full_name: string }>}
          onClose={() => setModal(false)}
          onSave={async (payload) => {
            try {
              if (editing) await update({ data: { ...payload, id: editing.id } });
              else await create({ data: payload });
              qc.invalidateQueries({ queryKey: ["services"] });
              toast.success("Servicio guardado");
              setModal(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          }}
        />
      )}
    </div>
  );
}

function ServiceModal({
  service,
  professionals,
  onClose,
  onSave,
}: {
  service: Service | null;
  professionals: Array<{ id: string; full_name: string }>;
  onClose: () => void;
  onSave: (p: {
    name: string; description: string | null; category: string | null; duration_min: number;
    price_cents: number; color: string; active: boolean; professional_id: string | null;
  }) => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const duration = service?.duration_min ?? 60;
  const [price, setPrice] = useState(service ? (service.price_cents / 100).toString() : "");
  const [color, setColor] = useState(service?.color ?? COLORS[0]);
  const [active, setActive] = useState(service?.active ?? true);
  const [professionalId, setProfessionalId] = useState(service?.professional_id ?? "");

  return (
    <Modal title={service ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            duration_min: Number(duration) || 60,
            price_cents: Math.round((Number(price) || 0) * 100),
            color,
            active,
            professional_id: professionalId || null,
          });
        }}
      >
        <Field label="Nombre *"><input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Categoría"><input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Facial" /></Field>
          <Field label="Precio"><input type="number" min={0} step="0.01" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <Field label="Descripción"><textarea rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {professionals.length > 0 && (
          <Field label="Profesional asignado">
            <select className={inputClass} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Cualquiera</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Color en la agenda">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Servicio activo (visible en reservas online)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
