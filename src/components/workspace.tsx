"use client";
import { useEffect, useRef, useState } from "react";
import { readAll } from "@/lib/read-all";
import Link from "next/link";
import { MeasurementsCalculator, MeasurementDetails } from "./measurements";
import {
  measureWalls,
  measurementText,
  type Measurements,
} from "@/lib/measurements";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  HardHat,
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  MapPin,
  Check,
  ChevronRight,
  X,
  LogOut,
  Download,
  Layers,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  Directory,
  RelationFields,
  ContactInfo,
  resolveContact,
} from "./contacts";
import { withDirectory } from "@/lib/model";
import { ProjectDetailFields } from "./project-detail-fields";
import { parseProjectDetails } from "@/lib/project-details";
import { AddressInput } from "./address-input";
import { parseProjectAddress } from "@/lib/address";
import { WorkersModule } from "./workers";
import { WorkerFields, AssignmentEditor } from "./worker-assignments";
import { localDate } from "@/lib/workers";
import { ProgressReview, ReviewStatus } from "./progress-review";
import { SalesPipeline } from "./sales-pipeline";
import { type PipelineStage, pipelineOpportunity } from "@/lib/pipeline";
import { EstimateProjectInfo } from "./estimate-project-info";
import { OperationsDashboard } from "./operations-dashboard";
import { ProjectDashboard } from "./project-dashboard";
import { MediaComposer, ProgressAttachments } from "./progress-media";
import {
  mediaStore,
  sendProgress,
  validateMedia,
  type PendingMedia,
} from "@/lib/progress-media";
import { Brand } from "./brand";
import { browserDb } from "@/lib/supabase";
import {
  calculate,
  demoData,
  money,
  num,
  projectSchema,
  reportSchema,
  type Data,
  type Project,
  type Estimate,
  type Report,
} from "@/lib/model";

type Tab =
  | "workers"
  | "contacts"
  | "overview"
  | "projects"
  | "estimates"
  | "field"
  | "review"
  | "settings";
const tabs = [
  { id: "overview" as const, label: "Vista general", icon: LayoutDashboard },
  { id: "workers" as const, label: "Trabajadores", icon: HardHat },
  { id: "contacts" as const, label: "Builders y contactos", icon: Building2 },
  { id: "projects" as const, label: "Obras", icon: Building2 },
  { id: "estimates" as const, label: "Estimados", icon: FileText },
  { id: "field" as const, label: "Avances de obra", icon: HardHat },
  { id: "review" as const, label: "Revisar avances", icon: ClipboardList },
  { id: "settings" as const, label: "Configuración", icon: Settings },
];
const empty: Data = {
  projects: [],
  estimates: [],
  reports: [],
  builders: [],
  contacts: [],
};
const demoKey = "qh-demo-v1";
function Modal({
  title,
  wide = false,
  close,
  children,
}: {
  title: string;
  wide?: boolean;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className={wide ? "dashboard-dialog" : undefined}
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "En obra",
    scheduled: "Programada",
    done: "Terminada",
    draft: "Borrador",
    approved: "Aprobado",
  };
  return (
    <span className={`status ${status}`}>
      <span />
      {map[status] || status}
    </span>
  );
}
export function Workspace({
  demo = false,
  userId,
}: {
  demo?: boolean;
  userId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Data>(empty);
  const [role, setRole] = useState("worker");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"project" | "estimate" | null>(null);
  const [estimateProject, setEstimateProject] = useState("");
  const [estimateView, setEstimateView] = useState<"pipeline" | "list">(
    "pipeline",
  );
  const [creatingEstimateProject, setCreatingEstimateProject] = useState(false);
  const [selected, setSelectedState] = useState<Project | null>(null);
  function setSelected(p: Project | null) {
    setSelectedState(p);
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        window.location.search +
        (p ? `#obra=${p.id}` : ""),
    );
  }
  const [busy, setBusy] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [calc, setCalc] = useState({
    area: 2400,
    rate: 1.25,
    waste: 8,
    roll_size: 1350,
  });
  const [workDate, setWorkDate] = useState(() => localDate());
  const [demoWorker, setDemoWorker] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [mediaRecording, setMediaRecording] = useState(false);
  const [report, setReport] = useState({
    author_name: "",
    project_id: "",
    notes: "",
    hours: "",
    rolls: "",
    installed_area: "",
  });
  const canManage = demo || ["owner", "office"].includes(role);
  const canApprove = demo || role === "owner";
  useEffect(() => {
    const syncProject = () => {
      const id = new URLSearchParams(window.location.hash.slice(1)).get("obra");
      setSelectedState(data.projects.find((p) => p.id === id) || null);
    };
    window.addEventListener("hashchange", syncProject);
    return () => window.removeEventListener("hashchange", syncProject);
  }, [data.projects]);
  const draftKey = `qh-report-draft-v1-${demo ? "demo" : userId}`;
  const reportEventId = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (demo) {
          const saved = localStorage.getItem(demoKey);
          if (alive) {
            const loaded = withDirectory(
              saved ? JSON.parse(saved) : demoData(),
            );
            setData(loaded);
            const projectId = new URLSearchParams(
              window.location.hash.slice(1),
            ).get("obra");
            setSelectedState(
              loaded.projects.find((p) => p.id === projectId) || null,
            );
            setRole("owner");
          }
        } else {
          const db = browserDb();
          const [p, e, r, m, b, c, w, rates, assignments] = await Promise.all([
            readAll<Project>(db, "projects", ["created_at", "id"], false),
            readAll<Estimate>(db, "estimates", ["created_at", "id"], false),
            readAll<Report>(db, "field_reports", ["created_at", "id"], false),
            db
              .from("memberships")
              .select("role")
              .eq("user_id", userId!)
              .maybeSingle(),
            readAll<Data["builders"][number]>(db, "builders", ["name", "id"]),
            readAll<Data["contacts"][number]>(db, "contacts", ["name", "id"]),
            readAll<NonNullable<Data["workers"]>[number]>(db, "workers", [
              "full_name",
              "user_id",
            ]),
            readAll<NonNullable<Data["worker_rates"]>[number]>(
              db,
              "worker_rates",
              ["user_id", "effective_date"],
            ),
            readAll<NonNullable<Data["assignments"]>[number]>(
              db,
              "assignments",
              ["project_id", "user_id"],
            ),
          ]);
          const err =
            p.error ||
            e.error ||
            r.error ||
            m.error ||
            b.error ||
            c.error ||
            w.error ||
            rates.error ||
            assignments.error;
          if (err)
            throw new Error(
              "No se pudieron cargar los datos. Verifica la conexión y vuelve a intentar.",
            );
          if (!m.data)
            throw new Error(
              "Tu cuenta todavía no tiene acceso asignado. Contacta al administrador.",
            );
          if (alive) {
            setData({
              workers: w.data || [],
              worker_rates: rates.data || [],
              assignments: assignments.data || [],
              builders: b.data || [],
              contacts: c.data || [],
              projects: p.data || [],
              estimates: e.data || [],
              reports: r.data || [],
            });
            setRole(m.data.role);
            const projectId = new URLSearchParams(
              window.location.hash.slice(1),
            ).get("obra");
            setSelectedState(
              (p.data || []).find((p) => p.id === projectId) || null,
            );
          }
        }
        const draft = localStorage.getItem(draftKey);
        if (draft && alive) {
          const saved = JSON.parse(draft);
          setReport({ author_name: "", installed_area: "", ...saved });
          setWorkDate(saved.work_date || localDate());
          setDemoWorker(saved.worker_id || "");
          reportEventId.current = saved.client_id || null;
          try {
            const files = await mediaStore("get", draftKey);
            if (alive && Array.isArray(files)) setPendingMedia(files);
          } catch {
            if (alive)
              setNotice(
                "Se recuperó el texto del borrador, pero no sus archivos. Vuelve a adjuntarlos.",
              );
          }
        }
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el espacio.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [demo, userId, draftKey]);
  function persist(next: Data) {
    if (demo) localStorage.setItem(demoKey, JSON.stringify(next));
    setData(next);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.name === "ZodError"
            ? "Revisa los campos. Las cantidades deben estar dentro de los límites indicados."
            : e.message
          : "No se pudo guardar. Vuelve a intentar.",
      );
    } finally {
      setBusy(false);
    }
  }
  function navigate(t: Tab) {
    setTab(t);
    setSearch("");
    setNotice("");
  }
  const namedProjects = data.projects.map((p) => ({
    ...p,
    builder:
      data.builders.find((b) => b.id === p.builder_id)?.name || p.builder,
  }));
  const projects = namedProjects.filter((p) =>
    `${p.name} ${p.builder} ${p.address}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pending = data.estimates.filter((e) => e.status === "draft");
  let calculation: ReturnType<typeof calculate> | null = null;
  try {
    calculation = calculate(calc);
  } catch {
    /* Show validation in form. */
  }
  async function addProject(form: FormData, fromEstimate = false) {
    const raw = Object.fromEntries(form);
    const workerIds = form.getAll("worker_ids").map(String);
    const builderName =
      data.builders.find((b) => b.id === raw.builder_id)?.name ||
      String(raw.builder || "");
    const values = projectSchema.parse({ ...raw, builder: builderName });
    const location = parseProjectAddress(form);
    const details = parseProjectDetails(form, values.target_date);
    const { next, builder, contact } = await resolveContact(
      form,
      data,
      demo,
      persist,
    );
    const p = {
      ...values,
      ...location,
      ...details,
      builder: builder.name,
      builder_id: builder.id,
      contact_id: contact.id,
      target_date: values.target_date || null,
      status: "scheduled" as const,
    };
    let created: Project;
    if (demo)
      created = {
        ...p,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
    else {
      const { data, error } = await browserDb().rpc(
        "create_project_with_workers",
        { p_project: p, p_worker_ids: workerIds },
      );
      if (error)
        throw new Error(
          "No se pudo crear la obra. Revisa tus permisos e inténtalo de nuevo.",
        );
      created = data;
    }
    persist({
      ...next,
      projects: [created, ...next.projects],
      assignments: [
        ...(next.assignments || []),
        ...workerIds.map((user_id) => ({ project_id: created.id, user_id })),
      ],
    });
    if (fromEstimate) {
      setEstimateProject(created.id);
      setCreatingEstimateProject(false);
      setNotice("Obra creada y seleccionada para este estimado.");
    } else {
      setModal(null);
      setNotice("Obra creada. Ya puedes preparar su estimado.");
      setTab("projects");
    }
  }
  async function addEstimate(form: FormData) {
    const values = calculate(calc);
    const project_id = String(form.get("project_id"));
    if (!data.projects.some((p) => p.id === project_id))
      throw new Error("Selecciona una obra.");
    let row: Estimate;
    if (demo)
      row = {
        ...values,
        measurements,
        project_id,
        id: crypto.randomUUID(),
        status: "draft",
        created_at: new Date().toISOString(),
      };
    else {
      const { data, error } = await browserDb().rpc(
        measurements ? "create_estimate_from_measurements" : "create_estimate",
        measurements
          ? {
              p_project_id: project_id,
              p_measurements: measurements,
              p_rate: values.rate,
              p_waste: values.waste,
            }
          : {
              p_project_id: project_id,
              p_area: values.area,
              p_rate: values.rate,
              p_waste: values.waste,
              p_roll_size: values.roll_size,
            },
      );
      if (error)
        throw new Error(
          "No se pudo guardar el estimado. Revisa los valores y tu acceso.",
        );
      row = data;
    }
    persist({
      ...data,
      estimates: [row, ...data.estimates],
      projects: data.projects.map((p) => {
        const stage = pipelineOpportunity(p, data).stage;
        return p.id === project_id && ["received", "to_quote"].includes(stage)
          ? {
              ...p,
              pipeline_stage: "quoted",
              pipeline_changed_at: new Date().toISOString(),
            }
          : p;
      }),
    });
    setModal(null);
    setTab("estimates");
    setMeasurements(null);
    setNotice("Estimado guardado como borrador.");
  }
  async function moveOpportunity(id: string, stage: PipelineStage) {
    await run(async () => {
      let patch: Partial<Project> = {
        pipeline_stage: stage,
        pipeline_changed_at: new Date().toISOString(),
      };
      if (!demo) {
        const result = await browserDb()
          .from("projects")
          .update({ pipeline_stage: stage })
          .eq("id", id)
          .select("pipeline_stage,pipeline_changed_at")
          .single();
        if (result.error)
          throw new Error("No se pudo cambiar la etapa. Intenta de nuevo.");
        patch = result.data;
      }
      persist({
        ...data,
        projects: data.projects.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      });
      setNotice("Etapa comercial actualizada.");
    });
  }
  async function approve(e: Estimate) {
    if (
      !window.confirm(
        "¿Aprobar este estimado? Sus cantidades y precio quedarán bloqueados. No se enviará al builder.",
      )
    )
      return;
    await run(async () => {
      if (!demo) {
        const { error } = await browserDb().rpc("approve_estimate", {
          p_id: e.id,
        });
        if (error)
          throw new Error(
            "No se pudo aprobar. Solo el dueño puede aprobar un borrador vigente.",
          );
      }
      persist({
        ...data,
        estimates: data.estimates.map((x) =>
          x.id === e.id ? { ...x, status: "approved" } : x,
        ),
      });
      setNotice(
        "Estimado aprobado internamente. El envío al builder sigue pendiente.",
      );
    });
  }
  async function reviewReport(
    report: Report,
    status: "approved" | "observed",
    note: string,
  ) {
    if (!canManage)
      throw new Error("Solo oficina y el dueño pueden revisar avances.");
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      let updated: Report = {
        ...report,
        review_status: status,
        review_note: note,
        reviewed_at: new Date().toISOString(),
        reviewed_by: demo ? null : userId,
      };
      if (!demo) {
        const result = await browserDb()
          .from("field_reports")
          .update({ review_status: status, review_note: note })
          .eq("id", report.id)
          .eq("review_status", report.review_status || "pending")
          .select()
          .single();
        if (result.error)
          throw new Error(
            "No se pudo guardar. El avance pudo cambiar o tu acceso no permite revisarlo; recarga e intenta de nuevo.",
          );
        updated = result.data;
      }
      persist({
        ...data,
        reports: data.reports.map((r) => (r.id === report.id ? updated : r)),
      });
      setNotice(
        status === "approved"
          ? "Avance aprobado."
          : "Avance devuelto con observaciones.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitReport() {
    const ownWorker = (data.workers || []).find(
      (w) => w.user_id === (demo || canManage ? demoWorker : userId),
    );
    const values = reportSchema.parse({
      ...report,
      author_name:
        demo && !ownWorker
          ? report.author_name
          : ownWorker?.full_name || "Oficina",
    });
    if (!workDate || workDate > localDate())
      throw new Error("Elige una fecha trabajada válida, hasta hoy.");
    const authorId = demo || canManage ? demoWorker || undefined : userId;
    if (!demo && !ownWorker)
      throw new Error(
        "Selecciona un trabajador registrado y asignado a la obra.",
      );
    if (
      (demo || canManage) &&
      demoWorker &&
      !(data.assignments || []).some(
        (a) => a.user_id === demoWorker && a.project_id === report.project_id,
      )
    )
      throw new Error("El trabajador no está asignado a esta obra.");
    if (
      authorId &&
      data.reports
        .filter(
          (r) =>
            r.author_id === authorId &&
            (r.work_date || r.created_at.slice(0, 10)) === workDate,
        )
        .reduce((n, r) => n + Number(r.hours), 0) +
        values.hours >
        24
    )
      throw new Error("No puedes registrar más de 24 horas en un día.");
    const id = reportEventId.current || crypto.randomUUID();
    reportEventId.current = id;
    validateMedia(pendingMedia);
    if (values.notes.length < 5 && !pendingMedia.length)
      throw new Error(
        "Escribe al menos 5 caracteres o adjunta una foto o nota de voz.",
      );
    const row = await sendProgress(
      {
        ...values,
        id,
        created_at: new Date().toISOString(),
        author_id: authorId,
        ...(!demo ? { submitted_by: userId } : {}),
        work_date: workDate,
      },
      pendingMedia,
      demo,
    );
    persist({
      ...data,
      reports: [row, ...data.reports.filter((r) => r.id !== id)],
    });
    reportEventId.current = null;
    localStorage.removeItem(draftKey);
    void mediaStore("delete", draftKey).catch(() => {});
    setPendingMedia([]);
    setReport({
      author_name: report.author_name,
      project_id: "",
      notes: "",
      hours: "",
      rolls: "",
      installed_area: "",
    });
    setNotice(
      "Avance recibido. Las horas y el material quedan pendientes de revisión.",
    );
  }
  function exportEstimate(e: Estimate) {
    const p = namedProjects.find((x) => x.id === e.project_id);
    const text = `Quality Housewrap\nHOUSEWRAP ESTIMATE - ${e.status === "approved" ? "INTERNALLY APPROVED" : "DRAFT"}\n${demo ? "DEMONSTRATION - NOT A COMMERCIAL QUOTE\n" : ""}Project: ${p?.name}\nBuilder: ${p?.builder}\nAddress: ${p?.address}\nGross billable area: ${num(e.area)} ft2\nRate: ${money(e.rate)} / ft2\nTotal: ${money(e.total)}\n\nScope: housewrap installation only. No opening deductions.\nMaterial quantities are preliminary. Product, overlap rules, terms and validity must be confirmed before sending.\nThis file does not record builder acceptance.\nMaterial reserve: ${e.waste}% · Preliminary rolls: ${e.rolls}\n${e.measurements ? measurementText(e.measurements) : "Manual area entry"}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `estimate-${e.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/app">
          <Brand dark />
        </Link>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          {tabs
            .filter(
              (t) =>
                !["contacts", "review", "estimates", "settings"].includes(
                  t.id,
                ) || canManage,
            )
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => navigate(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={19} />
                {id === "workers" && !canManage ? "Mis horas" : label}
                {id === "estimates" && pending.length > 0 && (
                  <b>{pending.length}</b>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-label">HECHO PARA EL OFICIO</div>
          <strong>
            Todo empieza
            <br />
            por una buena base.
          </strong>
          <div className="lap-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="profile">
            <span className="avatar">QH</span>
            <div>
              <strong>{demo ? "Espacio de ejemplo" : "Mi equipo"}</strong>
              <small>Quality Housewrap</small>
            </div>
            {!demo && (
              <button
                className="icon-button"
                aria-label="Cerrar sesión"
                onClick={() =>
                  run(async () => {
                    const result = await browserDb().auth.signOut();
                    if (result.error)
                      throw new Error(
                        "No se pudo cerrar la sesión. Vuelve a intentar.",
                      );
                    router.replace("/login");
                    router.refresh();
                  })
                }
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Operaciones</span>
            <ChevronRight size={14} />
            <strong>{tabs.find((x) => x.id === tab)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="location-dot" /> Atlanta, GA{" "}
            <span className="avatar small-avatar">QH</span>
          </div>
        </header>
        <main id="main" className="content">
          {demo && (
            <div className="demo-strip">
              <span>
                <span className="demo-dot" /> Demostración · Datos de ejemplo
                guardados solo en este navegador.
              </span>
              <Link href="/app" className="button primary">
                Salir del demo · Entrar a mi equipo <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              <Check size={18} />
              {notice}
            </div>
          )}
          {loading ? (
            <div className="loading">Preparando tu espacio…</div>
          ) : (
            <>
              <div className="page-title">
                <div>
                  <p className="eyebrow">
                    {tab === "overview"
                      ? "CADA DETALLE CUENTA"
                      : "QUALITY HOUSEWRAP / OPERACIONES"}
                  </p>
                  <h1>
                    {
                      {
                        workers: canManage
                          ? "Tu equipo y su semana de trabajo."
                          : "Tus horas y avances.",
                        contacts: "Tus builders, siempre a mano.",
                        overview: "El estado de tus obras, en un vistazo.",
                        projects: "Cada obra, en su lugar.",
                        estimates: "Cada oportunidad, en su etapa.",
                        field: "Cuéntanos cómo va la obra.",
                        review: "Revisa y aprueba los avances.",
                        settings: "La base de tu espacio.",
                      }[tab]
                    }
                  </h1>
                  <p>
                    {
                      {
                        workers:
                          "Obras asignadas, horas aprobadas y pago base estimado de lunes a domingo.",
                        contacts:
                          "Un directorio compartido para todas tus obras.",
                        overview:
                          "Obras, estimados y equipo. Todo lo importante, aquí.",
                        projects:
                          "Organiza tus proyectos y prepara el siguiente paso.",
                        estimates:
                          "Cantidades claras. Precios revisados. Sin perder el detalle.",
                        field:
                          "Comparte lo que avanzaste con texto, fotos o una nota de voz.",
                        review:
                          "Fotos, audio, horas y materiales, antes de aprobar.",
                        settings:
                          "Conexiones, acceso y estado de esta primera versión.",
                      }[tab]
                    }
                  </p>
                </div>
                {canManage && ["overview", "projects"].includes(tab) && (
                  <button
                    className="button primary"
                    onClick={() => setModal("project")}
                  >
                    <Plus size={18} /> Nueva obra
                  </button>
                )}
                {canManage && tab === "estimates" && (
                  <button
                    className="button primary"
                    onClick={() => {
                      setCreatingEstimateProject(false);
                      setModal("estimate");
                    }}
                  >
                    <Plus size={18} /> Nuevo estimado
                  </button>
                )}
              </div>
              {tab === "workers" && (
                <WorkersModule
                  data={data}
                  demo={demo}
                  canManage={canManage}
                  busy={busy}
                  persist={persist}
                  run={run}
                />
              )}
              {tab === "contacts" && canManage && (
                <Directory
                  data={data}
                  demo={demo}
                  persist={persist}
                  run={run}
                  busy={busy}
                />
              )}
              {tab === "review" && canManage && (
                <ProgressReview
                  data={data}
                  busy={busy}
                  review={reviewReport}
                  open={(id) =>
                    setSelected(namedProjects.find((p) => p.id === id) || null)
                  }
                />
              )}
              {canManage && ["overview", "field"].includes(tab) && (
                <button
                  className="review-inbox-link"
                  onClick={() => navigate("review")}
                >
                  <span>
                    <strong>
                      Avances por revisar:{" "}
                      {
                        data.reports.filter(
                          (r) =>
                            !r.review_status || r.review_status === "pending",
                        ).length
                      }
                    </strong>
                    <small>
                      Abre fotos y audio, revisa horas y rollos, y registra tu
                      decisión.
                    </small>
                  </span>
                  <span>Revisar avances →</span>
                </button>
              )}
              {tab === "overview" && (
                <>
                  <OperationsDashboard
                    data={data}
                    canManage={canManage}
                    open={(id) =>
                      setSelected(
                        namedProjects.find((p) => p.id === id) || null,
                      )
                    }
                    field={() => navigate("field")}
                  />
                  <section className="panel activity-panel">
                    <div className="section-head">
                      <h2>Lo último del equipo</h2>
                      <span className="muted small">Avances de obra</span>
                    </div>
                    {data.reports.length ? (
                      [...data.reports]
                        .sort((a, b) =>
                          b.created_at.localeCompare(a.created_at),
                        )
                        .slice(0, 4)
                        .map((r) => (
                          <div className="activity" key={r.id}>
                            <span className="activity-icon">
                              <ClipboardList size={18} />
                            </span>
                            <div>
                              <strong>
                                {data.projects.find(
                                  (p) => p.id === r.project_id,
                                )?.name || "Obra asignada"}
                              </strong>
                              <p>{r.notes || "Avance con archivos adjuntos"}</p>
                              <ProgressAttachments
                                attachments={r.attachments}
                              />
                              <ReviewStatus report={r} />
                            </div>
                            <span className="muted small">
                              {num(r.hours)} h · {num(r.rolls)} rollos
                            </span>
                          </div>
                        ))
                    ) : (
                      <div className="empty-inline">
                        <Clock size={22} />
                        <span>Los avances de tu equipo aparecerán aquí.</span>
                        <button
                          className="text-link"
                          onClick={() => navigate("field")}
                        >
                          Registrar el primero →
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === "projects" && (
                <section className="panel">
                  <div className="section-head">
                    <h2>
                      Tus obras <span>{data.projects.length}</span>
                    </h2>
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Buscar obras"
                        placeholder="Buscar obra o builder"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <ProjectList projects={projects} open={setSelected} />
                </section>
              )}
              {tab === "estimates" && (
                <>
                  <div className="notice">
                    <Layers size={19} /> Medición asistida por fachadas
                    disponible al crear un estimado. La lectura automática de
                    PDF y el despiece por fabricante aún no están habilitados.
                  </div>
                  <div
                    className="operations-filters"
                    aria-label="Vista de estimados"
                  >
                    <button
                      aria-pressed={estimateView === "pipeline"}
                      onClick={() => setEstimateView("pipeline")}
                    >
                      Pipeline
                    </button>
                    <button
                      aria-pressed={estimateView === "list"}
                      onClick={() => setEstimateView("list")}
                    >
                      Ver lista de estimados
                    </button>
                  </div>
                  {estimateView === "pipeline" ? (
                    <SalesPipeline
                      data={data}
                      busy={busy}
                      canApprove={canApprove}
                      move={(id, stage) => void moveOpportunity(id, stage)}
                      open={(id) =>
                        setSelected(
                          namedProjects.find((p) => p.id === id) || null,
                        )
                      }
                      prepare={(id) => {
                        setEstimateProject(id);
                        setModal("estimate");
                      }}
                      approve={(e) => void approve(e)}
                      download={exportEstimate}
                    />
                  ) : (
                    <section className="panel">
                      {data.estimates.length ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Obra</th>
                                <th>Área</th>
                                <th>Material preliminar</th>
                                <th>Total</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.estimates.map((e) => (
                                <tr key={e.id}>
                                  <td>
                                    <EstimateProjectInfo
                                      data={data}
                                      projectId={e.project_id}
                                      open={() =>
                                        setSelected(
                                          namedProjects.find(
                                            (p) => p.id === e.project_id,
                                          ) || null,
                                        )
                                      }
                                    />
                                    <small>Estimado #{e.id.slice(0, 8)}</small>
                                    <MeasurementDetails
                                      value={e.measurements}
                                    />
                                  </td>
                                  <td>{num(e.area)} ft²</td>
                                  <td>{e.rolls} rollos</td>
                                  <td className="amount">{money(e.total)}</td>
                                  <td>
                                    <Status status={e.status} />
                                  </td>
                                  <td>
                                    <div className="actions">
                                      {e.status === "draft" && canApprove && (
                                        <button
                                          className="button compact outline"
                                          disabled={busy}
                                          onClick={() => approve(e)}
                                        >
                                          Aprobar
                                        </button>
                                      )}
                                      <button
                                        className="icon-button"
                                        aria-label="Descargar resumen del estimado"
                                        onClick={() => exportEstimate(e)}
                                      >
                                        <Download size={18} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          title="Tu próximo estimado empieza aquí."
                          text="Crea una obra y agrega sus medidas para preparar el primer borrador."
                        />
                      )}
                    </section>
                  )}
                </>
              )}
              {tab === "field" && (
                <div className="field-grid">
                  <section className="panel field-form">
                    <div className="section-head">
                      <h2>Nuevo avance</h2>
                      <span className="tag">ESPAÑOL</span>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(submitReport);
                      }}
                    >
                      <label>
                        ¿En qué obra trabajaste?
                        <select
                          required
                          value={report.project_id}
                          onChange={(e) => {
                            setReport({
                              ...report,
                              project_id: e.target.value,
                            });
                            if (!demo && canManage) setDemoWorker("");
                          }}
                        >
                          <option value="">Selecciona una obra</option>
                          {data.projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {demo && !!data.workers?.length && (
                        <label>
                          Trabajador de demostración
                          <select
                            value={demoWorker}
                            onChange={(e) => setDemoWorker(e.target.value)}
                          >
                            <option value="">
                              Registro sin cuenta vinculada
                            </option>
                            {data.workers.map((w) => (
                              <option key={w.user_id} value={w.user_id}>
                                {w.full_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Fecha trabajada
                        <input
                          type="date"
                          value={workDate}
                          max={localDate()}
                          required
                          onChange={(e) => setWorkDate(e.target.value)}
                        />
                      </label>
                      {!demo && canManage ? (
                        <label>
                          Nombre del trabajador
                          <select
                            required
                            value={demoWorker}
                            onChange={(e) => setDemoWorker(e.target.value)}
                          >
                            <option value="">
                              {report.project_id
                                ? "Selecciona un trabajador asignado"
                                : "Primero selecciona una obra"}
                            </option>
                            {(data.workers || [])
                              .filter((w) =>
                                (data.assignments || []).some(
                                  (a) =>
                                    a.user_id === w.user_id &&
                                    a.project_id === report.project_id,
                                ),
                              )
                              .map((w) => (
                                <option key={w.user_id} value={w.user_id}>
                                  {w.full_name}
                                </option>
                              ))}
                          </select>
                          <small>
                            Solo trabajadores asignados a esta obra. Puedes
                            gestionarlos desde Trabajadores y la ficha de la
                            obra.
                          </small>
                        </label>
                      ) : (
                        <>
                          {" "}
                          <label>
                            Nombre del trabajador
                            <input
                              required
                              minLength={2}
                              maxLength={100}
                              readOnly={!demo || !!demoWorker}
                              value={
                                !demo
                                  ? (data.workers || []).find(
                                      (w) => w.user_id === userId,
                                    )?.full_name || "Oficina"
                                  : demoWorker
                                    ? (data.workers || []).find(
                                        (w) => w.user_id === demoWorker,
                                      )?.full_name || ""
                                    : report.author_name
                              }
                              onChange={(e) =>
                                setReport({
                                  ...report,
                                  author_name: e.target.value,
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                      <label>
                        ¿Qué hiciste y qué quedó pendiente?
                        <textarea
                          required={!pendingMedia.length}
                          minLength={pendingMedia.length ? undefined : 5}
                          maxLength={2000}
                          rows={5}
                          placeholder="Por ejemplo: terminamos el muro norte. Falta revisar el flashing de dos ventanas."
                          value={report.notes}
                          onChange={(e) =>
                            setReport({ ...report, notes: e.target.value })
                          }
                        />
                      </label>
                      <MediaComposer
                        files={pendingMedia}
                        onChange={setPendingMedia}
                        disabled={busy}
                        onRecording={setMediaRecording}
                      />
                      <div className="form-grid">
                        <label>
                          Horas reportadas
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            required
                            value={report.hours}
                            onChange={(e) =>
                              setReport({ ...report, hours: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Rollos utilizados
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.25"
                            required
                            value={report.rolls}
                            onChange={(e) =>
                              setReport({ ...report, rolls: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Área nueva instalada (ft²)
                        <input
                          type="number"
                          min="0"
                          max="1000000"
                          step="0.01"
                          value={report.installed_area}
                          onChange={(e) =>
                            setReport({
                              ...report,
                              installed_area: e.target.value,
                            })
                          }
                        />
                        <small>
                          Solo el área adicional de este avance, no el
                          acumulado. No repitas la misma superficie entre
                          trabajadores. Usa 0 si no instalaste área; déjalo
                          vacío si aún no se midió. Se sumará al aprobarlo.
                        </small>
                      </label>

                      <p className="muted small">
                        Revisa los datos antes de enviarlos. Estas horas no se
                        suman automáticamente a nómina.
                      </p>
                      <div className="actions">
                        <button
                          className="button primary"
                          disabled={
                            busy || mediaRecording || !data.projects.length
                          }
                        >
                          {busy ? "Enviando…" : "Confirmar y enviar"}{" "}
                          <ArrowRight size={18} />
                        </button>
                        <button
                          type="button"
                          className="button outline"
                          disabled={busy || mediaRecording}
                          onClick={async () => {
                            try {
                              await mediaStore("put", draftKey, pendingMedia);
                              localStorage.setItem(
                                draftKey,
                                JSON.stringify({
                                  ...report,
                                  client_id: reportEventId.current,
                                  work_date: workDate,
                                  worker_id: demoWorker,
                                }),
                              );
                              setNotice(
                                "Borrador con archivos guardado solo en este dispositivo. Ábrelo aquí y envíalo cuando tengas conexión.",
                              );
                            } catch {
                              setError(
                                "No hay espacio para guardar el borrador.",
                              );
                            }
                          }}
                        >
                          Guardar borrador
                        </button>
                      </div>
                    </form>
                  </section>
                  <aside className="field-help">
                    <ClipboardList size={30} />
                    <h2>
                      Habla claro.
                      <br />
                      Escribe como tú.
                    </h2>
                    <p>
                      Incluye la parte de la casa donde trabajaste, los
                      materiales y lo que falta resolver.
                    </p>
                    <div className="help-step">
                      <b>1</b> Elige la obra correcta.
                    </div>
                    <div className="help-step">
                      <b>2</b> Cuenta lo que avanzaste.
                    </div>
                    <div className="help-step">
                      <b>3</b> Revisa y envía.
                    </div>
                    <p className="small muted">
                      Escribe, adjunta fotos o graba una nota de voz. Revisa los
                      archivos antes de compartir el avance con tu equipo.
                    </p>
                  </aside>
                </div>
              )}
              {tab === "settings" && (
                <div className="settings-grid">
                  <section className="panel settings-panel">
                    <h2>Tu espacio</h2>
                    <dl>
                      <dt>Empresa</dt>
                      <dd>Quality Housewrap</dd>
                      <dt>Zona horaria</dt>
                      <dd>America/New_York</dd>
                      <dt>Moneda y unidades</dt>
                      <dd>USD · ft² · rollos</dd>
                      <dt>Almacenamiento</dt>
                      <dd>
                        {demo
                          ? "Demostración local"
                          : "Supabase · acceso protegido"}
                      </dd>
                      <dt>Rol</dt>
                      <dd>{demo ? "Dueño de demostración" : role}</dd>
                    </dl>
                    {demo && (
                      <button
                        className="button outline"
                        onClick={() => {
                          if (
                            confirm(
                              "¿Restablecer solo los datos de esta demostración?",
                            )
                          ) {
                            for (const advance of data.reports)
                              for (const item of advance.attachments || [])
                                if (item.path.startsWith("demo/"))
                                  void mediaStore("delete", item.path).catch(
                                    () => {},
                                  );
                            void mediaStore("delete", draftKey).catch(() => {});
                            setPendingMedia([]);
                            persist(withDirectory(demoData()));
                            localStorage.removeItem(draftKey);
                            setReport({
                              author_name: "",
                              project_id: "",
                              notes: "",
                              hours: "",
                              rolls: "",
                              installed_area: "",
                            });
                            setNotice("Demostración restablecida.");
                          }
                        }}
                      >
                        Restablecer demostración
                      </button>
                    )}
                  </section>
                  <section className="panel settings-panel">
                    <h2>Estado del desarrollo</h2>
                    <p>
                      <Check size={16} /> Obras, estimados manuales y avances
                      con texto, fotos y voz.
                    </p>
                    <p>
                      <Clock size={16} /> Medición IA y planos: pendientes.
                    </p>
                    <p>
                      <Clock size={16} /> Mensajería y aprobación del builder:
                      pendientes.
                    </p>
                    <p>
                      <Clock size={16} /> QuickBooks: no conectado.
                    </p>
                    <p className="muted small">
                      Esta primera base no realiza envíos, cobros ni movimientos
                      contables.
                    </p>
                  </section>
                </div>
              )}
              <footer className="app-footer">
                <span>Quality Housewrap · Operations</span>
                <span>Una buena base para cada obra.</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal === "project" && (
        <Modal title="Nueva obra" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() => addProject(f));
            }}
          >
            <ProjectFields data={data} />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Guardando…" : "Crear obra"}
              <ArrowRight size={18} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "estimate" && (
        <Modal
          title="Preparar estimado"
          close={() => {
            setMeasurements(null);
            setModal(null);
            setCreatingEstimateProject(false);
          }}
        >
          {creatingEstimateProject && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(() => addProject(f, true));
              }}
            >
              <h3>Nueva obra para este estimado</h3>
              <p className="muted">
                Tus medidas y tarifa se conservarán al continuar.
              </p>
              <ProjectFields data={data} />
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button className="button primary" disabled={busy}>
                  Crear obra y continuar
                </button>
                <button
                  type="button"
                  className="button outline"
                  disabled={busy}
                  onClick={() => {
                    setCreatingEstimateProject(false);
                    setError("");
                  }}
                >
                  Cancelar nueva obra
                </button>
              </div>
            </form>
          )}
          <form
            hidden={creatingEstimateProject}
            style={creatingEstimateProject ? { display: "none" } : undefined}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() => addEstimate(f));
            }}
          >
            <label>
              Obra
              <select
                name="project_id"
                aria-label="Obra"
                required
                autoFocus
                value={
                  data.projects.some((p) => p.id === estimateProject)
                    ? estimateProject
                    : data.projects[0]?.id || ""
                }
                onChange={(e) => {
                  setEstimateProject(e.target.value);
                  setMeasurements(null);
                }}
              >
                {!data.projects.length && (
                  <option value="">Crea tu primera obra para continuar</option>
                )}
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setCreatingEstimateProject(true);
                setError("");
              }}
            >
              + Crear nueva obra
            </button>
            <MeasurementsCalculator
              key={estimateProject}
              value={measurements}
              reserve={calc.waste}
              onApply={(m) => {
                const result = measureWalls(m);
                setMeasurements(m);
                setCalc({
                  ...calc,
                  area: result.area,
                  roll_size: result.rollSize,
                });
              }}
            />
            <div className="form-grid">
              {(
                [
                  {
                    id: "area",
                    label: "Área bruta (ft²)",
                    min: 1,
                    max: 1000000,
                    step: 0.01,
                  },
                  {
                    id: "rate",
                    label: "Tarifa por ft² (USD)",
                    min: 0.01,
                    max: 10000,
                    step: 0.01,
                  },
                  {
                    id: "waste",
                    label: "Reserva de material (%)",
                    min: 0,
                    max: 50,
                    step: 0.1,
                  },
                  {
                    id: "roll_size",
                    label: "Área nominal por rollo (ft²)",
                    min: 1,
                    max: 100000,
                    step: 0.01,
                  },
                ] as const
              ).map((f) => (
                <label key={f.id}>
                  {f.label}
                  <input
                    type="number"
                    required
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={calc[f.id]}
                    onChange={(e) => {
                      setCalc({ ...calc, [f.id]: Number(e.target.value) });
                      if (f.id === "area" || f.id === "roll_size")
                        setMeasurements(null);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="estimate-result">
              <span>
                Total estimado
                <strong>
                  {calculation
                    ? money(calculation.total)
                    : "Revisa los valores"}
                </strong>
              </span>
              <span>
                Material preliminar
                <strong>{calculation?.rolls ?? "—"} rollos</strong>
              </span>
            </div>
            <p className="small muted">
              No se descuentan aberturas. La reserva global es una hipótesis
              para cortes y solapes; no calcula su distribución individual ni
              flashing. Verifica el producto antes de comprar material.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary"
              disabled={busy || !calculation || !data.projects.length}
            >
              {busy ? "Guardando…" : "Guardar borrador"}
              <Check size={18} />
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal wide title={selected.name} close={() => setSelected(null)}>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <ProjectDashboard
            project={selected}
            data={data}
            canManage={canManage}
            busy={busy}
            exportEstimate={exportEstimate}
            save={async (patch) => {
              setBusy(true);
              try {
                let updated = { ...selected, ...patch };
                if (!demo) {
                  const result = await browserDb()
                    .from("projects")
                    .update(patch)
                    .eq("id", selected.id)
                    .select()
                    .single();
                  if (result.error)
                    throw new Error(
                      "No se pudo guardar. Verifica las fechas y que el estimado esté aprobado.",
                    );
                  updated = result.data;
                }
                persist({
                  ...data,
                  projects: data.projects.map((p) =>
                    p.id === selected.id ? updated : p,
                  ),
                });
                setSelected(updated);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="project-detail">
              <Status status={selected.status} />
              <p>
                <strong>Builder</strong>
                <br />
                {data.builders.find((b) => b.id === selected.builder_id)
                  ?.name || selected.builder}
              </p>
              <h3>Persona de contacto</h3>
              <ContactInfo
                contact={data.contacts.find(
                  (c) => c.id === selected.contact_id,
                )}
              />
              {canManage && (
                <AssignmentEditor
                  data={data}
                  projectId={selected.id}
                  demo={demo}
                  busy={busy}
                  persist={persist}
                  run={run}
                />
              )}
              {canManage && (
                <details>
                  <summary>Cambiar builder o contacto de esta obra</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const { next, builder, contact } = await resolveContact(
                          f,
                          data,
                          demo,
                          persist,
                        );
                        const patch = {
                          builder_id: builder.id,
                          contact_id: contact.id,
                          builder: builder.name,
                        };
                        if (!demo) {
                          const result = await browserDb()
                            .from("projects")
                            .update(patch)
                            .eq("id", selected.id)
                            .select()
                            .single();
                          if (result.error)
                            throw new Error(
                              "No se pudo cambiar el contacto de la obra.",
                            );
                        }
                        const updated = { ...selected, ...patch };
                        persist({
                          ...next,
                          projects: next.projects.map((p) =>
                            p.id === selected.id ? updated : p,
                          ),
                        });
                        setSelected(updated);
                      });
                    }}
                  >
                    <RelationFields
                      data={data}
                      initialBuilder={selected.builder_id || ""}
                      initialContact={selected.contact_id || ""}
                    />
                    <button className="button primary" disabled={busy}>
                      Guardar contacto de la obra
                    </button>
                  </form>
                </details>
              )}
              <p>
                <strong>Dirección</strong>
                <br />
                {selected.address}
              </p>
              {selected.address_source === "photon" &&
              selected.latitude != null &&
              selected.longitude != null ? (
                <a
                  className="text-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=18/${selected.latitude}/${selected.longitude}`}
                >
                  Ver dirección seleccionada en el mapa ↗
                </a>
              ) : (
                <p className="small muted">
                  Dirección pendiente de verificar
                  {selected.address_review_note
                    ? `: ${selected.address_review_note}`
                    : "."}
                </p>
              )}
              <p>
                <strong>Fecha objetivo</strong>
                <br />
                {selected.target_date || "Por definir"}
              </p>
              <p>
                {
                  data.estimates.filter((e) => e.project_id === selected.id)
                    .length
                }{" "}
                estimados ·{" "}
                {
                  data.reports.filter((r) => r.project_id === selected.id)
                    .length
                }{" "}
                avances
              </p>
              {canManage && (
                <label>
                  Estado de la obra
                  <select
                    value={selected.status}
                    disabled={busy}
                    onChange={(e) => {
                      const status = e.target.value as Project["status"];
                      void run(async () => {
                        if (!demo) {
                          const { error } = await browserDb()
                            .from("projects")
                            .update({ status })
                            .eq("id", selected.id);
                          if (error)
                            throw new Error("No se pudo cambiar el estado.");
                        }
                        const updated = { ...selected, status };
                        persist({
                          ...data,
                          projects: data.projects.map((p) =>
                            p.id === selected.id ? updated : p,
                          ),
                        });
                        setSelected(updated);
                      });
                    }}
                  >
                    <option value="scheduled">Programada</option>
                    <option value="active">En obra</option>
                    <option value="done">Terminada</option>
                  </select>
                </label>
              )}
              {canManage && (
                <button
                  className="button primary"
                  onClick={() => {
                    setEstimateProject(selected.id);
                    setCreatingEstimateProject(false);
                    setSelected(null);
                    setModal("estimate");
                  }}
                >
                  Preparar estimado de esta obra
                </button>
              )}
              <button
                className="button outline"
                onClick={() => {
                  setReport({ ...report, project_id: selected.id });
                  setSelected(null);
                  navigate("field");
                }}
              >
                Registrar avance <ArrowRight size={16} />
              </button>
            </div>
          </ProjectDashboard>
        </Modal>
      )}
    </div>
  );
}
function ProjectList({
  projects,
  open,
}: {
  projects: Project[];
  open: (p: Project) => void;
}) {
  return projects.length ? (
    <div className="project-list">
      {projects.map((p, i) => (
        <button className="project-row" key={p.id} onClick={() => open(p)}>
          <span className={`house-icon house-${i % 3}`}>
            <Building2 size={25} />
          </span>
          <span className="project-name">
            <strong>{p.name}</strong>
            <small>{p.builder}</small>
          </span>
          <span className="project-location">
            <MapPin size={13} />
            {p.address}
          </span>
          <Status status={p.status} />
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  ) : (
    <Empty
      title="Todo listo para tu primera obra."
      text="Agrega una obra para empezar a organizar estimados y avances."
    />
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Building2 size={35} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ProjectFields({ data }: { data: Data }) {
  return (
    <>
      <label>
        Nombre de la obra
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          placeholder="Oakview · Lot 14"
          autoFocus
        />
      </label>
      <h3>Builder y ubicación</h3>
      <RelationFields data={data} />
      <AddressInput />
      <h3>Detalles y planificación</h3>
      <ProjectDetailFields />
      <WorkerFields data={data} />
      <label>
        Fecha objetivo <span className="muted">(opcional)</span>
        <input name="target_date" type="date" />
      </label>
    </>
  );
}
