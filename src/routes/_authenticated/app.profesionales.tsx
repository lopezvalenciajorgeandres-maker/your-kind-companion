import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createProfessional, deleteProfessional, listProfessionals, updateProfessional } from "@/lib/professionals.functions";
import { useTenant } from "@/lib/use-tenant";
import { EmptyState, Field, Modal, PageHeader, Panel, ProGate, btnGhost, btnPrimary, inputClass } from "@/components/app/kit";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/profesionales")({ component: Professionals });

type Pro = { id: string; full_name: string; specialty: string | null; phone: string | null; email: string | null; color: string; active: boolean };

function Professionals() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const list = useServerFn(listProfessionals);
  const create = useServerFn(createProfessional);
  const update = useServerFn(updateProfessional);
  const del = useServerFn(deleteProfessional);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Pro | null>(null);

  const pros = useQuery({ queryKey: ["professionals"], queryFn: () => list() });
  const rows = (pros.data ?? []) as unknown as Pro[];

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["professionals"] }); toast.success("Profesional eliminado"); },
  });

  if (!tenant.isLoading && !tenant.can("profesionales")) {
    return (
      <div className="p-5 md:p-10 max-w-3xl">
        <ProGate title="Gestión de profesionales" body="Controla la agenda por profesional, comisiones y disponibilidad con el plan PRO." />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-10 max-w-5xl">
      <PageHeader
        title="Profesionales"
        subtitle="Tu equipo y sus especialidades."
        action={<button className={btnPrimary} onClick={() => { setEditing(null); setModal(true); }}><Plus className="h-4 w-4" /> Nuevo</button>}
      />
      <Panel className="mt-6 divide-y divide-border">
        {rows.length === 0 && <EmptyState title="Sin profesionales" body="Añade a las personas de tu equipo." />}
        {rows.map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-serif" style={{ background: `${p.color}55` }}>
              {p.full_name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.full_name}{!p.active && <span className="text-xs text-muted-foreground"> (inactivo)</span>}</div>
              <div className="text-xs text-muted-foreground truncate">{[p.specialty, p.phone, p.email].filter(Boolean).join(" · ")}</div>
            </div>
            <button onClick={() => { setEditing(p); setModal(true); }} className="p-2 rounded-lg hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => { if (confirm("¿Eliminar profesional?")) delMut.mutate(p.id); }} className="p-2 rounded-lg hover:bg-secondary text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Panel>

      {modal && (
        <ProModal
          pro={editing}
          onClose={() => setModal(false)}
          onSave={async (payload) => {
            try {
              if (editing) await update({ data: { ...payload, id: editing.id } });
              else await create({ data: payload });
              qc.invalidateQueries({ queryKey: ["professionals"] });
              toast.success("Guardado");
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

function ProModal({ pro, onClose, onSave }: {
  pro: Pro | null;
  onClose: () => void;
  onSave: (p: { full_name: string; specialty: string | null; phone: string | null; email: string | null; color: string; active: boolean }) => void;
}) {
  const [full_name, setName] = useState(pro?.full_name ?? "");
  const [specialty, setSpecialty] = useState(pro?.specialty ?? "");
  const [phone, setPhone] = useState(pro?.phone ?? "");
  const [email, setEmail] = useState(pro?.email ?? "");
  const [color, setColor] = useState(pro?.color ?? "#CDB4DB");
  const [active, setActive] = useState(pro?.active ?? true);

  return (
    <Modal title={pro ? "Editar profesional" : "Nuevo profesional"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!full_name.trim()) return;
        onSave({ full_name: full_name.trim(), specialty: specialty || null, phone: phone || null, email: email || null, color, active });
      }}>
        <Field label="Nombre *"><input required className={inputClass} value={full_name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Especialidad"><input className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Field>
          <Field label="Color"><input type="color" className={`${inputClass} h-10 p-1`} value={color} onChange={(e) => setColor(e.target.value)} /></Field>
          <Field label="Teléfono"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo</label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          <button className={btnPrimary}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
