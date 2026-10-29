import { type Data } from "@/lib/model";
import { projectTypes, workTypes } from "@/lib/project-details";
export function EstimateProjectInfo({
  data,
  projectId,
  open,
}: {
  data: Data;
  projectId: string;
  open: () => void;
}) {
  const p = data.projects.find((p) => p.id === projectId);
  if (!p) return <span>Obra no disponible</span>;
  const contact = data.contacts.find((c) => c.id === p.contact_id);
  const builder = data.builders.find((b) => b.id === p.builder_id);
  return (
    <div className="estimate-work-info">
      <button className="text-link" onClick={open}>
        {p.name} →
      </button>
      <span>
        <b>Builder:</b> {builder?.name || p.builder}
      </span>
      <span>
        <b>Zona:</b> {p.zone || "Sin registrar"}
      </span>
      <span>
        <b>Dirección:</b> {p.address || "Sin registrar"}
      </span>
      {p.address && (
        <a
          target="_blank"
          rel="noreferrer"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : p.address)}`}
        >
          Ver ubicación en mapa ↗
        </a>
      )}
      {p.lot_unit && (
        <span>
          <b>Lote / unidad:</b> {p.lot_unit}
        </span>
      )}
      {(p.project_type || p.work_type) && (
        <span>
          {p.project_type && projectTypes[p.project_type]}
          {p.project_type && p.work_type && " · "}
          {p.work_type && workTypes[p.work_type]}
        </span>
      )}
      <span>
        <b>Contacto:</b> {contact?.name || "Sin asignar"}
      </span>
      {contact?.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
      {contact?.email && (
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
      )}
      {contact && !contact.phone && !contact.email && (
        <span>Medios de contacto sin registrar</span>
      )}
      <span>
        <b>Entrega:</b>{" "}
        {p.target_date
          ? p.target_date.split("-").reverse().join("/")
          : "Por definir"}
      </span>
    </div>
  );
}
