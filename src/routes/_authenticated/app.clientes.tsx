import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createClient, deleteClient, listClients, updateClient } from "@/lib/clients.functions";
import { useTenant } from "@/lib/use-tenant";
import { CLIENT_SOURCES, limitReached } from "@/lib/plan";
import { ClientForm } from "@/components/app/client-form";
import { EmptyState, Modal, PageHeader, Panel, btnPrimary, inputClass } from "@/components/app/kit";
import { WhatsAppMenu, birthdayMessage } from "@/components/app/whatsapp-menu";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes")({ component: Clients });

type Client = {
  id: string;
  full_name: string;
  last_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birthdate: string | null;
  gender: string | null;
  address: string | null;
  source: string | null;
  notes: string | null;
};

function Clients() {
  const qc = useQueryClient();
  const tenant = useTenant();
  const list = useServerFn(listClients);
  const create = useServerFn(createClient);
  const update = useServerFn(updateClient);
  const del = useServerFn(deleteClient);

  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [modal, setModal] = useState(false);

  const clients = useQuery({ queryKey: ["clients"], queryFn: () => list() });
  const rows = (clients.data ?? []) as unknown as Client[];

  const filtered = useMemo(
    () =>
      rows.filter((c) => {
        const text = `${c.full_name} ${c.last_name ?? ""} ${c.whatsapp ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
        return (!q || text.includes(q.toLowerCase())) && (!source || c.source === source);
      }),
    [rows, q, source],
  );

  const overLimit = limitReached(tenant.limits, "max_clients", rows.length);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
    },
  });

  return (
    <div className="p-5 md:p-10 max-w-6xl">
      <PageHeader
        title="Clientes"
        subtitle={`${rows.length} registrados${tenant.limits.max_clients ? ` de ${tenant.limits.max_clients} del plan ${tenant.plan.toUpperCase()}` : ""}`}
        action={
          <div className="flex items-center gap-2">


          <button
            className={btnPrimary}
            onClick={() => {
              if (overLimit) {
                toast.error("Alcanzaste el límite de clientes de tu plan. Mejora a PRO.");
                return;
              }
              setEditing(null);
              setModal(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo cliente
          </button>
          </div>
        }
      />

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono o email..." className={`${inputClass} pl-9`} />
        </div>
        <select className={`${inputClass} sm:w-52`} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Todos los orígenes</option>
          {CLIENT_SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <Panel className="mt-6 divide-y divide-border">
        {clients.isLoading && <div className="p-6 text-sm text-muted-foreground">Cargando...</div>}
        {!clients.isLoading && filtered.length === 0 && (
          <EmptyState title="Sin clientes" body="Crea tu primer cliente o recibe reservas desde tu página pública." />
        )}
        {filtered.map((c) => (
          <div key={c.id} className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-primary font-serif">
              {c.full_name[0]?.toUpperCase()}
            </div>
            <Link to="/app/clientes/$id" params={{ id: c.id }} className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {c.full_name} {c.last_name ?? ""}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {c.whatsapp || c.phone || "Sin WhatsApp"}
                {c.email ? ` · ${c.email}` : ""}
                {c.source ? ` · ${c.source}` : ""}
              </div>
            </Link>
            <WhatsAppMenu
              compact
              phone={c.whatsapp || c.phone}
              message={`Hola ${c.full_name} 💜 Te escribimos de ${tenant.business?.name ?? "nuestro centro"}.`}
            />
            <button onClick={() => { setEditing(c); setModal(true); }} className="p-2 rounded-lg hover:bg-secondary">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => { if (confirm("¿Eliminar cliente y su historial?")) delMut.mutate(c.id); }}
              className="p-2 rounded-lg hover:bg-secondary text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </Panel>

      {modal && (
        <ClientModal
          client={editing}
          onClose={() => setModal(false)}
          onSave={async (payload) => {
            try {
              if (editing) await update({ data: { ...payload, id: editing.id } });
              else await create({ data: payload });
              qc.invalidateQueries({ queryKey: ["clients"] });
              toast.success("Cliente guardado");
              setModal(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error al guardar");
            }
          }}
        />
      )}
    </div>
  );
}

type Payload = Omit<Client, "id">;

function ClientModal({ client, onClose, onSave }: { client: Client | null; onClose: () => void; onSave: (p: Payload) => void }) {
  return (
    <Modal title={client ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <ClientForm client={client} onCancel={onClose} onSave={onSave} />
    </Modal>
  );
}
