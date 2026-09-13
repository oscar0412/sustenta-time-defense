import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import { etiquetaPeriodo, fechaCorta, n, pct, soles } from "@/lib/formato";

export const Route = createFileRoute("/admin/defense-file/$id/documento")({
  head: () => ({
    meta: [
      { title: "Expediente de sustento de servicios intragrupo — Sustenta" },
      {
        name: "description",
        content:
          "Documento formal de sustento de servicios intragrupo para el test de beneficio del artículo 32-A de la LIR.",
      },
      { property: "og:title", content: "Expediente de sustento de servicios intragrupo" },
      { property: "og:description", content: "Documento imprimible con horas, evidencia y valorización del periodo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Documento,
});

const NO_DISPONIBLE = "No disponible en esta versión";

type Json = Record<string, unknown>;

function obj(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}
/** Acepta tanto el objeto de la versión actual como el texto plano de versiones anteriores. */
function parte(v: unknown): Json | null {
  if (typeof v === "string") return { razon_social: v };
  return obj(v);
}
function lista(v: unknown): Json[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : [];
}
function txt(v: unknown): string {
  if (v === null || v === undefined || v === "") return NO_DISPONIBLE;
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}
function num(v: unknown, d = 1): string {
  return v === null || v === undefined ? NO_DISPONIBLE : n(v, d);
}
function tamano(v: unknown): string {
  const b = Number(v);
  if (!Number.isFinite(b)) return NO_DISPONIBLE;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function Seccion({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="doc-seccion">
      <h2 className="doc-h2">
        {numero}. {titulo}
      </h2>
      {children}
    </section>
  );
}

function Vacia({ mensaje = NO_DISPONIBLE }: { mensaje?: string }) {
  return <p className="doc-vacia">{mensaje}</p>;
}

function Documento() {
  const { id } = Route.useParams();

  const expedienteQ = useQuery({
    queryKey: ["defense-file-documento", id],
    enabled: sustentaConfigurado && !!id,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_defense_file").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Json | null;
    },
  });

  const expediente = expedienteQ.data ?? null;
  const c = useMemo(() => obj(expediente?.["contenido"]) ?? {}, [expediente]);

  // Las versiones antiguas guardaban textos planos donde ahora hay objetos.
  const periodo = obj(c["periodo"]);
  const periodoTexto = typeof c["periodo"] === "string" ? String(c["periodo"]) : null;
  const prestador = parte(c["prestador"]);
  const receptor = parte(c["receptor"]);
  const servicios: Json[] = lista(c["servicios"]).map((s) => ({
    ...s,
    descripcion: s["descripcion"] ?? s["servicio"] ?? null,
  }));
  const personal: Json[] = lista(c["personal"]).map((p) => ({
    ...p,
    horas_periodo: p["horas_periodo"] ?? p["horas"] ?? null,
    condicion: p["condicion"] ?? p["dedicacion"] ?? null,
    vigencia_asignacion: p["vigencia_asignacion"] ?? p["vigencia"] ?? null,
  }));
  const detalle = lista(c["horas_detalle"]);
  const evidencia = lista(c["evidencia"]);
  const criterio = obj(c["criterio_asignacion"]);
  const criterioTexto = typeof c["criterio_asignacion"] === "string" ? String(c["criterio_asignacion"]) : null;
  const valorizacion = lista(c["valorizacion"]);
  const totales = obj(c["totales"]);
  const completitud = obj(c["completitud"]);

  const estado = String(expediente?.["estado"] ?? "").toLowerCase();
  const sellado = estado === "definitivo" || estado === "confirmado";
  const hash = (expediente?.["hash_sha256"] as string | null) ?? null;
  const version = expediente?.["version"] ?? c["version"] ?? null;

  const etiquetaMes = periodo
    ? etiquetaPeriodo(Number(periodo["anio"]), Number(periodo["mes"]))
    : (periodoTexto ?? NO_DISPONIBLE);
  const nombreReceptor = receptor ? txt(receptor["razon_social"]) : NO_DISPONIBLE;

  // Resumen de horas por colaborador y proyecto, derivado del detalle diario.
  const resumenHoras = useMemo(() => {
    const mapa = new Map<string, { colaborador: string; proyecto: string; horas: number; registros: number }>();
    for (const r of detalle) {
      const colaborador = String(r["colaborador"] ?? "—");
      const proyecto = String(r["proyecto"] ?? "—");
      const clave = `${colaborador}|${proyecto}`;
      const actual = mapa.get(clave) ?? { colaborador, proyecto, horas: 0, registros: 0 };
      actual.horas += Number(r["horas"] ?? 0);
      actual.registros += 1;
      mapa.set(clave, actual);
    }
    return [...mapa.values()].sort((a, b) => a.colaborador.localeCompare(b.colaborador));
  }, [detalle]);

  if (expedienteQ.isLoading) {
    return <p style={{ padding: "2rem", fontFamily: "Georgia, serif" }}>Cargando expediente…</p>;
  }
  if (!expediente) {
    return (
      <p style={{ padding: "2rem", fontFamily: "Georgia, serif" }}>
        No se encontró el expediente solicitado, o tu perfil no tiene permiso para leerlo.
      </p>
    );
  }

  return (
    <div className="doc-raiz">
      <style>{CSS_DOCUMENTO}</style>

      <button className="doc-boton-pdf" onClick={() => window.print()}>
        <Printer size={16} />
        Descargar PDF
      </button>

      {!sellado ? <div className="doc-marca-agua" aria-hidden>BORRADOR — SIN CONFIRMAR</div> : null}

      <div className="doc-pie-fijo">
        Expediente {nombreReceptor} · {etiquetaMes} · v{txt(version)}
        <span className="doc-pagina" />
      </div>

      <article className="doc-hoja">
        {/* Carátula */}
        <header className="doc-caratula">
          <p className="doc-sello-emisor">AC Corporativo del Perú S.A.C.</p>
          <h1 className="doc-h1">Expediente de Sustento de Servicios Intragrupo</h1>
          <p className="doc-subtitulo">Test de beneficio — Artículo 32-A de la Ley del Impuesto a la Renta</p>
          <table className="doc-tabla doc-tabla-caratula">
            <tbody>
              <tr>
                <th>Periodo</th>
                <td>{etiquetaMes}{periodo?.["codigo"] ? ` (${txt(periodo["codigo"])})` : ""}</td>
              </tr>
              <tr>
                <th>Prestador</th>
                <td>
                  {prestador ? txt(prestador["razon_social"]) : NO_DISPONIBLE}
                  {prestador?.["ruc"] ? ` · RUC ${txt(prestador["ruc"])}` : ""}
                </td>
              </tr>
              <tr>
                <th>Receptor</th>
                <td>
                  {nombreReceptor}
                  {receptor?.["ruc"] ? ` · RUC ${txt(receptor["ruc"])}` : ""}
                </td>
              </tr>
              <tr>
                <th>Versión</th>
                <td>v{txt(version)}</td>
              </tr>
              <tr>
                <th>Estado</th>
                <td>
                  <span className={sellado ? "doc-estado doc-estado-ok" : "doc-estado doc-estado-borrador"}>
                    {sellado ? "DEFINITIVO" : "PROPUESTO"}
                  </span>
                </td>
              </tr>
              <tr>
                <th>Marco normativo</th>
                <td>{txt(c["marco_normativo"])}</td>
              </tr>
              <tr>
                <th>Generado</th>
                <td>{txt(c["generado_en"]).slice(0, 19).replace("T", " ")}</td>
              </tr>
              {sellado ? (
                <tr>
                  <th>Hash SHA-256</th>
                  <td className="doc-mono doc-hash">{txt(hash)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </header>

        <Seccion numero="I" titulo="Identificación de las partes">
          <table className="doc-tabla">
            <thead>
              <tr>
                <th style={{ width: "22%" }}></th>
                <th>Prestador del servicio</th>
                <th>Receptor del servicio</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Razón social</th>
                <td>{prestador ? txt(prestador["razon_social"]) : NO_DISPONIBLE}</td>
                <td>{receptor ? txt(receptor["razon_social"]) : NO_DISPONIBLE}</td>
              </tr>
              <tr>
                <th>RUC</th>
                <td className="doc-mono">{prestador ? txt(prestador["ruc"]) : NO_DISPONIBLE}</td>
                <td className="doc-mono">{receptor ? txt(receptor["ruc"]) : NO_DISPONIBLE}</td>
              </tr>
              <tr>
                <th>Domicilio fiscal</th>
                <td>{prestador ? txt(prestador["domicilio"]) : NO_DISPONIBLE}</td>
                <td>{receptor ? txt(receptor["domicilio"]) : NO_DISPONIBLE}</td>
              </tr>
              <tr>
                <th>Representante</th>
                <td>
                  {prestador ? txt(prestador["representante"]) : NO_DISPONIBLE}
                  {prestador?.["cargo"] ? ` — ${txt(prestador["cargo"])}` : ""}
                </td>
                <td>—</td>
              </tr>
              <tr>
                <th>Contrato de referencia</th>
                <td colSpan={2}>{receptor ? txt(receptor["contrato_referencia"]) : NO_DISPONIBLE}</td>
              </tr>
            </tbody>
          </table>
        </Seccion>

        <Seccion numero="II" titulo="Naturaleza de los servicios y beneficio para el receptor">
          {servicios.length === 0 ? (
            <Vacia />
          ) : (
            servicios.map((s, i) => (
              <div key={i} className="doc-bloque">
                <h3 className="doc-h3">
                  <span className="doc-mono">{txt(s["proyecto"])}</span> · {txt(s["nombre"])}
                </h3>
                <p className="doc-parrafo">
                  <strong>Descripción del servicio.</strong> {txt(s["descripcion"])}
                </p>
                <p className="doc-parrafo">
                  <strong>Beneficio para el receptor.</strong> {txt(s["beneficio_receptor"])}
                </p>
                <table className="doc-tabla doc-tabla-compacta">
                  <tbody>
                    <tr>
                      <th>Vigencia</th>
                      <td>{txt(s["vigencia"])}</td>
                      <th>Horas del periodo</th>
                      <td className="doc-mono">{num(s["horas"])}</td>
                      <th>Margen</th>
                      <td className="doc-mono">
                        {s["margen_pct"] == null
                          ? NO_DISPONIBLE
                          : Number(s["margen_pct"]) === 0
                            ? "0% — a costo puro"
                            : pct(s["margen_pct"])}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))
          )}
        </Seccion>

        <Seccion numero="III" titulo="Personal asignado y vinculación">
          {personal.length === 0 ? (
            <Vacia />
          ) : (
            <table className="doc-tabla doc-tabla-compacta">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Documento</th>
                  <th>En planilla</th>
                  <th>Proyecto</th>
                  <th>Rol</th>
                  <th>Dedicación</th>
                  <th>Vigencia</th>
                  <th>Condición</th>
                  <th>Otras vinculadas</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {personal.map((p, i) => (
                  <tr key={i}>
                    <td>{txt(p["colaborador"])}</td>
                    <td className="doc-mono">{txt(p["documento"])}</td>
                    <td>{txt(p["en_planilla_prestador"])}</td>
                    <td className="doc-mono">{txt(p["proyecto"])}</td>
                    <td>{txt(p["rol"])}</td>
                    <td className="doc-mono">{p["dedicacion_pct"] == null ? NO_DISPONIBLE : pct(p["dedicacion_pct"], 0)}</td>
                    <td>{txt(p["vigencia_asignacion"])}</td>
                    <td>{txt(p["condicion"])}</td>
                    <td>{txt(p["otras_vinculadas"])}</td>
                    <td className="doc-mono doc-der">{num(p["horas_periodo"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Seccion>

        <Seccion numero="IV" titulo="Horas incurridas">
          <h3 className="doc-h3">Resumen por colaborador y proyecto</h3>
          {resumenHoras.length === 0 ? (
            <Vacia />
          ) : (
            <table className="doc-tabla doc-tabla-compacta">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Proyecto</th>
                  <th className="doc-der">Registros</th>
                  <th className="doc-der">Horas</th>
                </tr>
              </thead>
              <tbody>
                {resumenHoras.map((r) => (
                  <tr key={`${r.colaborador}-${r.proyecto}`}>
                    <td>{r.colaborador}</td>
                    <td className="doc-mono">{r.proyecto}</td>
                    <td className="doc-mono doc-der">{n(r.registros, 0)}</td>
                    <td className="doc-mono doc-der">{n(r.horas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="doc-h3">Detalle diario</h3>
          {detalle.length === 0 ? (
            <Vacia />
          ) : (
            <table className="doc-tabla doc-tabla-compacta doc-tabla-detalle">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Colaborador</th>
                  <th>Proyecto</th>
                  <th>Actividad</th>
                  <th className="doc-der">Horas</th>
                  <th>Descripción</th>
                  <th>Cobrable</th>
                  <th className="doc-der">Sustentos</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((r, i) => (
                  <tr key={i}>
                    <td className="doc-mono">{fechaCorta(String(r["fecha"] ?? ""))}</td>
                    <td>{txt(r["colaborador"])}</td>
                    <td className="doc-mono">{txt(r["proyecto"])}</td>
                    <td>{txt(r["actividad"])}</td>
                    <td className="doc-mono doc-der">{num(r["horas"])}</td>
                    <td className="doc-descripcion">{txt(r["descripcion"])}</td>
                    <td>{txt(r["cobrable"])}</td>
                    <td className="doc-mono doc-der">{r["sustentos"] == null ? "0" : n(r["sustentos"], 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Seccion>

        <Seccion numero="V" titulo="Evidencia documental">
          {evidencia.length === 0 ? (
            <Vacia />
          ) : (
            <>
              <table className="doc-tabla doc-tabla-compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Colaborador</th>
                    <th>Proyecto</th>
                    <th>Archivo</th>
                    <th>Tipo</th>
                    <th className="doc-der">Tamaño</th>
                    <th>Hash SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  {evidencia.map((e, i) => {
                    const h = e["hash_sha256"] == null ? null : String(e["hash_sha256"]);
                    return (
                      <tr key={i}>
                        <td className="doc-mono">{fechaCorta(String(e["fecha_registro"] ?? ""))}</td>
                        <td>{txt(e["colaborador"])}</td>
                        <td className="doc-mono">{txt(e["proyecto"])}</td>
                        <td>{txt(e["archivo"])}</td>
                        <td>{txt(e["tipo"])}</td>
                        <td className="doc-mono doc-der">{tamano(e["tamano_bytes"])}</td>
                        <td className="doc-mono" title={h ?? undefined}>
                          {h ? `${h.slice(0, 16)}…` : NO_DISPONIBLE}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="doc-nota">
                Nota: los hashes se muestran abreviados a 16 caracteres. El valor completo de cada archivo consta en
                el registro de sustentos del sistema y es verificable contra el archivo almacenado.
              </p>
            </>
          )}
        </Seccion>

        <Seccion numero="VI" titulo="Criterio de asignación de costos y valorización">
          {criterio ? (
            <p className="doc-parrafo">
              La asignación del costo se realiza mediante {String(criterio["metodo"] ?? NO_DISPONIBLE).toLowerCase()}.
              La base de costo corresponde a {String(criterio["base_costo"] ?? NO_DISPONIBLE).toLowerCase()}. El margen
              aplicado es {String(criterio["margen"] ?? NO_DISPONIBLE).toLowerCase()}.{" "}
              {criterio["sin_prorrateo"] === true
                ? "No se emplean claves de prorrateo ni distribuciones indirectas: cada hora facturada corresponde a un registro individual con su respectiva evidencia."
                : ""}
            </p>
          ) : (
            <Vacia />
          )}

          {valorizacion.length === 0 ? (
            <Vacia />
          ) : (
            <table className="doc-tabla doc-tabla-compacta">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th className="doc-der">Horas cobrables</th>
                  <th className="doc-der">Horas no cobrables</th>
                  <th className="doc-der">Costo cobrable</th>
                  <th className="doc-der">Margen</th>
                  <th className="doc-der">Total</th>
                </tr>
              </thead>
              <tbody>
                {valorizacion.map((v, i) => (
                  <tr key={i}>
                    <td className="doc-mono">{txt(v["proyecto"])}</td>
                    <td className="doc-mono doc-der">{num(v["horas_cobrables"])}</td>
                    <td className="doc-mono doc-der">{v["horas_no_cobrables"] == null ? "0.0" : n(v["horas_no_cobrables"])}</td>
                    <td className="doc-mono doc-der">{v["costo_cobrable"] == null ? NO_DISPONIBLE : soles(v["costo_cobrable"])}</td>
                    <td className="doc-mono doc-der">
                      {v["margen"] == null ? NO_DISPONIBLE : soles(v["margen"])}
                      {v["margen_pct"] != null && Number(v["margen_pct"]) === 0 ? " (a costo puro)" : ""}
                    </td>
                    <td className="doc-mono doc-der">{v["total_facturar"] == null ? NO_DISPONIBLE : soles(v["total_facturar"])}</td>
                  </tr>
                ))}
              </tbody>
              {totales ? (
                <tfoot>
                  <tr>
                    <th>Totales</th>
                    <th className="doc-mono doc-der">{num(totales["horas_cobrables"])}</th>
                    <th className="doc-der">—</th>
                    <th className="doc-mono doc-der">{totales["costo_cobrable"] == null ? NO_DISPONIBLE : soles(totales["costo_cobrable"])}</th>
                    <th className="doc-mono doc-der">{totales["margen"] == null ? NO_DISPONIBLE : soles(totales["margen"])}</th>
                    <th className="doc-mono doc-der">{totales["total_facturar"] == null ? NO_DISPONIBLE : soles(totales["total_facturar"])}</th>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          )}
        </Seccion>

        <Seccion numero="VII" titulo="Informe de completitud">
          {completitud ? (
            <p className="doc-parrafo">
              De {num(completitud["registros_total"], 0)} registros de horas del periodo,{" "}
              {num(completitud["registros_con_evidencia"], 0)} cuentan con evidencia documental adjunta (
              {completitud["pct_con_evidencia"] == null ? NO_DISPONIBLE : pct(completitud["pct_con_evidencia"])}).{" "}
              {Number(completitud["registros_sin_evidencia"] ?? 0) > 0 ? (
                <>
                  {num(completitud["registros_sin_evidencia"], 0)} registros por{" "}
                  {num(completitud["horas_sin_evidencia"])} horas no tienen sustento adjunto; esta situación se declara
                  expresamente y no se omite del expediente.
                </>
              ) : (
                <>La totalidad de los registros cuenta con sustento adjunto.</>
              )}{" "}
              El expediente incorpora {num(completitud["documentos_total"], 0)} documentos de evidencia y registra{" "}
              {num(completitud["sobrescrituras_cobrabilidad"], 0)} sobrescrituras manuales del criterio de cobrabilidad.
            </p>
          ) : (
            <Vacia />
          )}
        </Seccion>

        <Seccion numero="VIII" titulo="Declaración y sello">
          <p className="doc-parrafo doc-declaracion">{txt(c["declaracion"])}</p>

          {sellado ? (
            <div className="doc-firma">
              <div className="doc-firma-linea" />
              <p className="doc-firma-nombre">{prestador ? txt(prestador["representante"]) : NO_DISPONIBLE}</p>
              <p className="doc-firma-cargo">{prestador ? txt(prestador["cargo"]) : NO_DISPONIBLE}</p>
              <p className="doc-firma-cargo">
                Confirmado el {txt(expediente["confirmado_en"]).slice(0, 19).replace("T", " ")}
              </p>
              <p className="doc-firma-hash doc-mono">Hash SHA-256: {txt(hash)}</p>
            </div>
          ) : (
            <div className="doc-borrador-aviso">
              Este expediente se encuentra en estado propuesto: aún no ha sido confirmado ni sellado, por lo que no
              constituye el documento definitivo del periodo.
            </div>
          )}
        </Seccion>
      </article>
    </div>
  );
}

const CSS_DOCUMENTO = `
.doc-raiz {
  background: #f1f1ef;
  min-height: 100vh;
  padding: 24px 0 64px;
  color: #111;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 10.5pt;
  line-height: 1.5;
}
.doc-hoja {
  background: #fff;
  width: 21cm;
  margin: 0 auto;
  padding: 2.5cm;
  box-shadow: 0 2px 12px rgba(0,0,0,.12);
  position: relative;
}
.doc-h1 {
  font-family: Montserrat, sans-serif;
  font-size: 21pt;
  line-height: 1.2;
  font-weight: 700;
  margin: 6px 0 4px;
}
.doc-subtitulo { font-size: 12pt; font-style: italic; margin: 0 0 18px; }
.doc-sello-emisor {
  font-family: Montserrat, sans-serif;
  font-size: 9pt;
  letter-spacing: .14em;
  text-transform: uppercase;
  margin: 0;
  color: #555;
}
.doc-caratula { border-bottom: 2px solid #111; padding-bottom: 18px; margin-bottom: 20px; }
.doc-seccion { margin-top: 22px; break-inside: auto; }
.doc-h2 {
  font-family: Montserrat, sans-serif;
  font-size: 12pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  border-bottom: 1px solid #111;
  padding-bottom: 4px;
  margin: 0 0 10px;
  break-after: avoid;
}
.doc-h3 {
  font-family: Montserrat, sans-serif;
  font-size: 10pt;
  font-weight: 700;
  margin: 14px 0 6px;
  break-after: avoid;
}
.doc-parrafo { margin: 0 0 8px; text-align: justify; }
.doc-declaracion { font-style: italic; }
.doc-bloque { margin-bottom: 14px; break-inside: avoid; }
.doc-nota { font-size: 8.5pt; color: #444; margin-top: 6px; }
.doc-vacia { font-style: italic; color: #666; margin: 4px 0; }
.doc-tabla { width: 100%; border-collapse: collapse; margin: 6px 0 4px; }
.doc-tabla th, .doc-tabla td {
  border: 1px solid #bbb;
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
.doc-tabla thead th, .doc-tabla tfoot th {
  background: #f0efec;
  font-family: Montserrat, sans-serif;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.doc-tabla tbody th { background: #f7f7f5; width: 22%; font-weight: 700; }
.doc-tabla-compacta th, .doc-tabla-compacta td { font-size: 8.5pt; padding: 3px 5px; }
.doc-tabla-detalle .doc-descripcion { max-width: 7cm; }
.doc-tabla-caratula tbody th { width: 26%; }
.doc-mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 8.5pt; }
.doc-hash { word-break: break-all; }
.doc-der { text-align: right; }
.doc-estado {
  font-family: Montserrat, sans-serif;
  font-weight: 700;
  font-size: 9pt;
  padding: 2px 8px;
  border-radius: 3px;
}
.doc-estado-ok { background: #e4f2ee; color: #0f6e56; border: 1px solid #0f6e56; }
.doc-estado-borrador { background: #fbf0dc; color: #a9670c; border: 1px solid #a9670c; }
.doc-firma { margin-top: 28px; break-inside: avoid; }
.doc-firma-linea { border-top: 1px solid #111; width: 8cm; margin-bottom: 6px; }
.doc-firma-nombre { font-weight: 700; margin: 0; }
.doc-firma-cargo { margin: 0; font-size: 9.5pt; color: #333; }
.doc-firma-hash { margin-top: 8px; word-break: break-all; font-size: 8pt; }
.doc-borrador-aviso {
  margin-top: 16px;
  border: 1px dashed #a9670c;
  background: #fbf0dc;
  color: #7a4a09;
  padding: 10px 12px;
  break-inside: avoid;
}
.doc-boton-pdf {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #df3e3f;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font-family: Montserrat, sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,.2);
}
.doc-marca-agua { display: none; }
.doc-pie-fijo { display: none; }

@media print {
  @page { size: A4; margin: 2.5cm; }
  .doc-raiz { background: #fff; padding: 0; }
  .doc-hoja { width: auto; margin: 0; padding: 0; box-shadow: none; }
  .doc-boton-pdf { display: none !important; }
  .doc-caratula { break-after: page; }
  .doc-tabla { break-inside: auto; }
  .doc-tabla thead { display: table-header-group; }
  .doc-tabla tfoot { display: table-footer-group; }
  .doc-tabla tr { break-inside: avoid; break-after: auto; }
  .doc-seccion { break-before: auto; }
  .doc-pie-fijo {
    display: block;
    position: fixed;
    bottom: -1.6cm;
    left: 0;
    right: 0;
    text-align: center;
    font-family: Montserrat, sans-serif;
    font-size: 7.5pt;
    color: #555;
    border-top: 1px solid #ccc;
    padding-top: 3px;
  }
  .doc-pagina::before { content: " · Página " counter(page); }
  .doc-marca-agua {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    inset: 0;
    font-family: Montserrat, sans-serif;
    font-size: 48pt;
    font-weight: 700;
    color: rgba(169, 103, 12, .13);
    transform: rotate(-32deg);
    letter-spacing: .05em;
    pointer-events: none;
    z-index: 5;
  }
}
`;
