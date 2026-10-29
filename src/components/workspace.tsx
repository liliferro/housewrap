"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  HardHat,
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
} from "@/lib/model";

type Tab = "overview" | "projects" | "estimates" | "field" | "settings";
const tabs = [
  { id: "overview" as const, label: "Vista general", icon: LayoutDashboard },
  { id: "projects" as const, label: "Obras", icon: Building2 },
  { id: "estimates" as const, label: "Estimados", icon: FileText },
  { id: "field" as const, label: "Reportes de campo", icon: HardHat },
  { id: "settings" as const, label: "Configuración", icon: Settings },
];
const empty: Data = { projects: [], estimates: [], reports: [] };
const demoKey = "qh-demo-v1";
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
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
  const [selected, setSelected] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [calc, setCalc] = useState({
    area: 2400,
    rate: 1.25,
    waste: 8,
    roll_size: 1350,
  });
  const [report, setReport] = useState({
    project_id: "",
    notes: "",
    hours: "",
    rolls: "",
  });
  const canManage = demo || ["owner", "office"].includes(role);
  const canApprove = demo || role === "owner";
  const draftKey = `qh-report-draft-v1-${demo ? "demo" : userId}`;
  const reportEventId = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (demo) {
          const saved = localStorage.getItem(demoKey);
          if (alive) {
            setData(saved ? JSON.parse(saved) : demoData());
            setRole("owner");
          }
        } else {
          const db = browserDb();
          const [p, e, r, m] = await Promise.all([
            db
              .from("projects")
              .select("*")
              .order("created_at", { ascending: false }),
            db
              .from("estimates")
              .select("*")
              .order("created_at", { ascending: false }),
            db
              .from("field_reports")
              .select("*")
              .order("created_at", { ascending: false }),
            db
              .from("memberships")
              .select("role")
              .eq("user_id", userId!)
              .maybeSingle(),
          ]);
          const err = p.error || e.error || r.error || m.error;
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
              projects: p.data || [],
              estimates: e.data || [],
              reports: r.data || [],
            });
            setRole(m.data.role);
          }
        }
        const draft = localStorage.getItem(draftKey);
        if (draft && alive) {
          const saved = JSON.parse(draft);
          setReport(saved);
          reportEventId.current = saved.client_id || null;
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
  const projects = data.projects.filter((p) =>
    `${p.name} ${p.builder} ${p.address}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pending = data.estimates.filter((e) => e.status === "draft");
  const approved = data.estimates.filter((e) => e.status === "approved");
  let calculation: ReturnType<typeof calculate> | null = null;
  try {
    calculation = calculate(calc);
  } catch {
    /* Show validation in form. */
  }
  async function addProject(form: FormData) {
    const values = projectSchema.parse(Object.fromEntries(form));
    const p = {
      ...values,
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
      const { data, error } = await browserDb()
        .from("projects")
        .insert(p)
        .select()
        .single();
      if (error)
        throw new Error(
          "No se pudo crear la obra. Revisa tus permisos e inténtalo de nuevo.",
        );
      created = data;
    }
    persist({ ...data, projects: [created, ...data.projects] });
    setModal(null);
    setNotice("Obra creada. Ya puedes preparar su estimado.");
    setTab("projects");
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
        project_id,
        id: crypto.randomUUID(),
        status: "draft",
        created_at: new Date().toISOString(),
      };
    else {
      const { data, error } = await browserDb().rpc("create_estimate", {
        p_project_id: project_id,
        p_area: values.area,
        p_rate: values.rate,
        p_waste: values.waste,
        p_roll_size: values.roll_size,
      });
      if (error)
        throw new Error(
          "No se pudo guardar el estimado. Revisa los valores y tu acceso.",
        );
      row = data;
    }
    persist({ ...data, estimates: [row, ...data.estimates] });
    setModal(null);
    setTab("estimates");
    setNotice("Estimado guardado como borrador.");
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
  async function submitReport() {
    const values = reportSchema.parse(report);
    const id = reportEventId.current || crypto.randomUUID();
    reportEventId.current = id;
    let row = {
      ...values,
      id,
      created_at: new Date().toISOString(),
      author_id: userId,
    };
    if (!demo) {
      const { error } = await browserDb()
        .from("field_reports")
        .upsert(
          { ...values, id, author_id: userId },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (error)
        throw new Error(
          "No se pudo enviar. Conserva el borrador en este teléfono y vuelve a intentar.",
        );
      const received = await browserDb()
        .from("field_reports")
        .select("*")
        .eq("id", id)
        .single();
      if (received.error)
        throw new Error(
          "No pudimos confirmar la recepción. Conserva el borrador y vuelve a intentar.",
        );
      row = received.data;
    }
    persist({
      ...data,
      reports: [row, ...data.reports.filter((r) => r.id !== id)],
    });
    reportEventId.current = null;
    localStorage.removeItem(draftKey);
    setReport({ project_id: "", notes: "", hours: "", rolls: "" });
    setNotice(
      "Reporte recibido. Las horas y el material quedan pendientes de revisión.",
    );
  }
  function exportEstimate(e: Estimate) {
    const p = data.projects.find((x) => x.id === e.project_id);
    const text = `Quality Housewrap\nHOUSEWRAP ESTIMATE - ${e.status === "approved" ? "INTERNALLY APPROVED" : "DRAFT"}\n${demo ? "DEMONSTRATION - NOT A COMMERCIAL QUOTE\n" : ""}Project: ${p?.name}\nBuilder: ${p?.builder}\nAddress: ${p?.address}\nGross billable area: ${num(e.area)} ft2\nRate: ${money(e.rate)} / ft2\nTotal: ${money(e.total)}\n\nScope: housewrap installation only. No opening deductions.\nMaterial quantities are preliminary. Product, overlap rules, terms and validity must be confirmed before sending.\nThis file does not record builder acceptance.`;
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
        <Link href="/">
          <Brand dark />
        </Link>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
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
                      if (result.error) throw new Error("No se pudo cerrar la sesión. Vuelve a intentar.");
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
              <Link href="/login">
                Acceder a mi equipo <ArrowUpRight size={14} />
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
                        overview: "Una buena vista de tu trabajo.",
                        projects: "Cada obra, en su lugar.",
                        estimates: "De las medidas al estimado.",
                        field: "Cuéntanos cómo va la obra.",
                        settings: "La base de tu espacio.",
                      }[tab]
                    }
                  </h1>
                  <p>
                    {
                      {
                        overview:
                          "Obras, estimados y equipo. Todo lo importante, aquí.",
                        projects:
                          "Organiza tus proyectos y prepara el siguiente paso.",
                        estimates:
                          "Cantidades claras. Precios revisados. Sin perder el detalle.",
                        field:
                          "Escribe lo que hiciste y revisa los datos antes de enviar.",
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
                    onClick={() => setModal("estimate")}
                    disabled={!data.projects.length}
                  >
                    <Plus size={18} /> Nuevo estimado
                  </button>
                )}
              </div>
              {tab === "overview" && (
                <>
                  <div className="stats">
                    <article>
                      <span>
                        Obras activas <Building2 size={18} />
                      </span>
                      <strong>
                        {data.projects
                          .filter((p) => p.status === "active")
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <small>Proyectos en ejecución</small>
                    </article>
                    <article>
                      <span>
                        Por revisar <FileText size={18} />
                      </span>
                      <strong>
                        {pending.length.toString().padStart(2, "0")}
                      </strong>
                      <small>Estimados en borrador</small>
                    </article>
                    <article>
                      <span>
                        Valor aprobado <ArrowUpRight size={18} />
                      </span>
                      <strong>
                        {money(
                          approved.reduce((s, e) => s + Number(e.total), 0),
                        )}
                      </strong>
                      <small>Aprobación interna · sin envío</small>
                    </article>
                    <article>
                      <span>
                        Reportes recibidos <ClipboardList size={18} />
                      </span>
                      <strong>
                        {data.reports.length.toString().padStart(2, "0")}
                      </strong>
                      <small>Pendientes de revisión operativa</small>
                    </article>
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="section-head">
                        <h2>
                          Obras en movimiento{" "}
                          <span>{data.projects.length}</span>
                        </h2>
                        <button
                          className="text-link"
                          onClick={() => navigate("projects")}
                        >
                          Ver todas <ArrowRight size={15} />
                        </button>
                      </div>
                      <ProjectList
                        projects={data.projects.slice(0, 4)}
                        open={setSelected}
                      />
                    </section>
                    <section className="field-promo">
                      <div className="mini-icon">
                        <HardHat size={26} />
                      </div>
                      <p className="eyebrow">DESDE LA OBRA</p>
                      <h2>
                        Menos libreta.
                        <br />
                        Más claridad.
                      </h2>
                      <p>
                        Registra el trabajo del día y deja los pendientes a la
                        vista.
                      </p>
                      <button
                        className="button light"
                        onClick={() => navigate("field")}
                      >
                        Crear un reporte <ArrowRight size={17} />
                      </button>
                      <div className="promo-lines" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                    </section>
                  </div>
                  <section className="panel activity-panel">
                    <div className="section-head">
                      <h2>Lo último del equipo</h2>
                      <span className="muted small">Reportes de campo</span>
                    </div>
                    {data.reports.length ? (
                      data.reports.slice(0, 4).map((r) => (
                        <div className="activity" key={r.id}>
                          <span className="activity-icon">
                            <ClipboardList size={18} />
                          </span>
                          <div>
                            <strong>
                              {data.projects.find((p) => p.id === r.project_id)
                                ?.name || "Obra asignada"}
                            </strong>
                            <p>{r.notes}</p>
                          </div>
                          <span className="muted small">
                            {num(r.hours)} h · {num(r.rolls)} rollos
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-inline">
                        <Clock size={22} />
                        <span>Los reportes de tu equipo aparecerán aquí.</span>
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
                    <Layers size={19} /> Cálculo manual de área bruta. La
                    medición automática de planos y las recetas por fabricante
                    aún no están habilitadas.
                  </div>
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
                                  <strong>
                                    {
                                      data.projects.find(
                                        (p) => p.id === e.project_id,
                                      )?.name
                                    }
                                  </strong>
                                  <small>{e.id.slice(0, 8)}</small>
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
                </>
              )}
              {tab === "field" && (
                <div className="field-grid">
                  <section className="panel field-form">
                    <div className="section-head">
                      <h2>Reporte del día</h2>
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
                          onChange={(e) =>
                            setReport({ ...report, project_id: e.target.value })
                          }
                        >
                          <option value="">Selecciona una obra</option>
                          {data.projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        ¿Qué hiciste y qué quedó pendiente?
                        <textarea
                          required
                          minLength={5}
                          maxLength={2000}
                          rows={5}
                          placeholder="Por ejemplo: terminamos el muro norte. Falta revisar el flashing de dos ventanas."
                          value={report.notes}
                          onChange={(e) =>
                            setReport({ ...report, notes: e.target.value })
                          }
                        />
                      </label>
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
                      <p className="muted small">
                        Revisa los datos antes de enviarlos. Estas horas no se
                        suman automáticamente a nómina.
                      </p>
                      <div className="actions">
                        <button
                          className="button primary"
                          disabled={busy || !data.projects.length}
                        >
                          {busy ? "Enviando…" : "Confirmar y enviar"}{" "}
                          <ArrowRight size={18} />
                        </button>
                        <button
                          type="button"
                          className="button outline"
                          onClick={() => {
                            try {
                              localStorage.setItem(
                                draftKey,
                                JSON.stringify({
                                  ...report,
                                  client_id: reportEventId.current,
                                }),
                              );
                              setNotice(
                                "Borrador guardado solo en este teléfono. Ábrelo aquí y envíalo cuando tengas conexión.",
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
                      En esta versión la captura es por texto. Voz, fotos y
                      sincronización automática se incorporarán después de
                      validar este recorrido.
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
                            persist(demoData());
                            localStorage.removeItem(draftKey);
                            setReport({
                              project_id: "",
                              notes: "",
                              hours: "",
                              rolls: "",
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
                      <Check size={16} /> Obras, estimados manuales y reportes
                      de texto.
                    </p>
                    <p>
                      <Clock size={16} /> Medición IA, voz y archivos:
                      pendientes.
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
            <label>
              Builder
              <input name="builder" required minLength={2} maxLength={100} />
            </label>
            <label>
              Dirección de la obra
              <input name="address" required minLength={3} maxLength={200} />
            </label>
            <label>
              Fecha objetivo <span className="muted">(opcional)</span>
              <input name="target_date" type="date" />
            </label>
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
        <Modal title="Preparar estimado" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() => addEstimate(f));
            }}
          >
            <label>
              Obra
              <select name="project_id" aria-label="Obra" required autoFocus>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
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
                    label: "Desperdicio (%)",
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
                    onChange={(e) =>
                      setCalc({ ...calc, [f.id]: Number(e.target.value) })
                    }
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
              No se descuentan aberturas. La previsión de rollos incluye
              desperdicio; aún no calcula traslapes ni flashing. Verifica el
              producto antes de uso comercial.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy || !calculation}>
              {busy ? "Guardando…" : "Guardar borrador"}
              <Check size={18} />
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} close={() => setSelected(null)}>
          <div className="project-detail">
            <Status status={selected.status} />
            <p>
              <strong>Builder</strong>
              <br />
              {selected.builder}
            </p>
            <p>
              <strong>Dirección</strong>
              <br />
              {selected.address}
            </p>
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
              {data.reports.filter((r) => r.project_id === selected.id).length}{" "}
              reportes
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
            <button
              className="button outline"
              onClick={() => {
                setReport({ ...report, project_id: selected.id });
                setSelected(null);
                navigate("field");
              }}
            >
              Registrar reporte <ArrowRight size={16} />
            </button>
          </div>
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
      text="Agrega una obra para empezar a organizar estimados y reportes."
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
