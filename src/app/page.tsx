import Link from "next/link";
import {
  ArrowUpRight,
  Layers,
  ClipboardCheck,
  HardHat,
  ArrowRight,
} from "lucide-react";
import { Brand } from "@/components/brand";
export default function Home() {
  return (
    <div className="landing">
      <header>
        <Brand />
        <Link className="button outline" href="/login">
          Acceso al equipo <ArrowUpRight size={17} />
        </Link>
      </header>
      <main id="main">
        <div className="landing-hero">
          <div>
            <p className="eyebrow">QUALITY HOUSEWRAP / ATLANTA</p>
            <h1>
              El trabajo bien hecho.
              <br />
              <em>De principio a fin.</em>
            </h1>
            <p className="lead">
              Un solo lugar para preparar estimados, organizar las obras y
              registrar lo que pasa en campo.
            </p>
            <div className="actions">
              <Link className="button primary" href="/login">
                Entrar a mi espacio <ArrowRight size={18} />
              </Link>
              <Link className="button outline" href="/demo">
                Explorar demostración
              </Link>
            </div>
            <p className="muted small">
              Hecho para la oficina. Pensado para la cuadrilla.
            </p>
          </div>
          <div className="envelope-art" aria-hidden="true">
            <div className="roof" />
            <div className="layer l1" />
            <div className="layer l2" />
            <div className="layer l3" />
            <span>BUILT ON THE DETAILS.</span>
          </div>
        </div>
        <div className="feature-grid">
          {[
            [
              Layers,
              "01",
              "Estimados con orden",
              "Área, material y precio. Cada cálculo, a la vista.",
            ],
            [
              HardHat,
              "02",
              "Cada obra, conectada",
              "Proyectos y prioridades en un mismo espacio.",
            ],
            [
              ClipboardCheck,
              "03",
              "Campo sin libreta",
              "Reportes claros en español, desde el teléfono.",
            ],
          ].map(([Icon, n, title, body]) => {
            const I = Icon as typeof Layers;
            return (
              <article key={String(n)}>
                <div className="feature-top">
                  <I size={25} />
                  <span>{String(n)}</span>
                </div>
                <h2>{String(title)}</h2>
                <p>{String(body)}</p>
              </article>
            );
          })}
        </div>
      </main>
      <footer>
        Quality Housewrap <span>Espacio de operaciones · Atlanta, GA</span>
      </footer>
    </div>
  );
}
