import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, MessageSquareWarning, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Aviso, Badge, Button, Card, CardHeader, Num, Vacio } from "@/components/ui-kit";
import { useSesion } from "@/context/session";
import { mensajeDeError, sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type { AprobacionFila, RegistroDetalle } from "@/integrations/sustenta/vistas";
import { ETIQUETA_ESTADO, TONO_ESTADO, normalizarEstado } from "@/lib/aprobacion";
import { codigoPeriodo, etiquetaPeriodo, fechaCorta, horasMinutos, n } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/horas/aprobaciones")({
  head: () => ({
    meta: [
      { title: "Aprobaciones — Sustenta" },
      { name: "description", content: "Bandeja de aprobación de horas por jefatura directa." },
      { property: "og:title", content: "Aprobaciones — Sustenta" },
      { property: "og:description", content: "Aprueba u observa las horas enviadas por tu equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Aprobaciones,
});

type Filtro = "enviado" | "aprobado" | "observado" | "todos";

const PESTANAS: { valor: Filtro; label: string }[] = [
  { valor: "enviado", label: "Pendientes" },
  { valor: "aprobado", label: "Aprobadas" },
  { valor: "observado", label: "Observadas" },
  { valor: "todos", label: "Todas" },
];

function Aprobaciones() {
  const qc = useQueryClient();
  const { colaborador, rol, periodos, periodoActivo } = useSesion();
  const [periodoSel, setPeriodoSel] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("enviado");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [observando, setObservando] = useState<AprobacionFila | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const periodo = periodos.find((p) => p.id === periodoSel) ?? periodoActivo ?? periodos[0] ?? null;
  const periodoId = periodo?.id ?? "";
  const esAdministracion = rol === "administracion";
  const habilitado = sustentaConfigurado && !!periodoId && (esAdministracion || !!colaborador?.id);

  const unidadesQ = useQuery({
    queryKey: ["aprobaciones", periodoId, esAdministracion ? "todas" : colaborador?.id],
    enabled: habilitado,
    queryFn: async () => {
      let consulta = sustenta.from("hr_v_aprobacion").select("*").eq("periodo_id", periodoId);
      if (!esAdministracion) consulta = consulta.eq("jefe_id", colaborador?.id ?? "");
      const { data, error: err } = await consulta.order("enviado_en", { ascending: true });
      if (err) throw err;
      return (data ?? []) as AprobacionFila[];
    },
  });

  const unidades = unidadesQ.data ?? [];
  const visibles = useMemo(
    () => (filtro === "todos" ? unidades : unidades.filter((u) => normalizarEstado(u.estado) === filtro)),
    [unidades, filtro],
  );

  const pendientes = unidades.filter((u) => normalizarEstado(u.estado) === "enviado");
  const horasPendientes = pendientes.reduce((s, u) => s + Number(u.horas_enviadas ?? 0), 0);
  const aprobadas = unidades.filter((u) => normalizarEstado(u.estado) === "aprobado").length;
  const observadas = unidades.filter((u) => normalizarEstado(u.estado) === "observado").length;

  const seleccionables = visibles.filter((u) => normalizarEstado(u.estado) === "enviado").map((u) => u.id);
  const marcadas = seleccion.filter((id) => seleccionables.includes(id));

  async function refrescar() {
    setSeleccion([]);
    await qc.invalidateQueries({ queryKey: ["aprobaciones"] });
  }

  const aprobarLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error: err } = await sustenta.rpc("hr_aprobar_lote", {
        p_ids: ids,
        p_usuario: colaborador?.id,
      });
      if (err) throw err;
      return typeof data === "string" ? data : `${ids.length} unidades aprobadas`;
    },
    onSuccess: async (texto) => {
      setError(null);
      toast.success(texto);
      await refrescar();
    },
    onError: (e) => {
      const m = mensajeDeError(e);
      setError(m);
      toast.error(m);
    },
  });

  const resolver = useMutation({
    mutationFn: async (args: { id: string; estado: "aprobado" | "observado"; comentario: string }) => {
      const { data, error: err } = await sustenta.rpc("hr_resolver_aprobacion", {
        p_id: args.id,
        p_estado: args.estado,
        p_usuario: colaborador?.id,
        p_comentario: args.comentario || null,
      });
      if (err) throw err;
      return typeof data === "string" ? data : "Unidad resuelta";
    },
    onSuccess: async (texto) => {
      setError(null);
      setObservando(null);
      setMotivo("");
      toast.success(texto);
      await refrescar();
    },
    onError: (e) => {
      const m = mensajeDeError(e);
      setError(m);
      toast.error(m);
    },
  });

  return (
    <AppShell>
      <PageHeader
        titulo="Aprobaciones"
        descripcion="Cada unidad es un colaborador en un proyecto durante el periodo. Aprueba u observa lo que envió tu equipo."
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="label-xs" htmlFor="periodo">Periodo</label>
          <select
            id="periodo"
            className="field mt-1"
            value={periodo?.id ?? ""}
            onChange={(e) => {
              setPeriodoSel(e.target.value);
              setSeleccion([]);
            }}
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {codigoPeriodo(p.anio, p.mes)} · {p.estado}
              </option>
            ))}
          </select>
        </div>
        <Button
          variante="primario"
          disabled={marcadas.length === 0}
          cargando={aprobarLote.isPending}
          onClick={() => aprobarLote.mutate(marcadas)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aprobar seleccionadas {marcadas.length > 0 ? `(${marcadas.length})` : ""}
        </Button>
      </div>

      {error ? (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="La base de datos respondió">{error}</Aviso>
        </div>
      ) : null}
      {unidadesQ.error ? (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="La base de datos respondió">{mensajeDeError(unidadesQ.error)}</Aviso>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-border bg-border sm:grid-cols-4">
        <Indicador etiqueta="Unidades pendientes" valor={n(pendientes.length, 0)} />
        <Indicador etiqueta="Horas pendientes" valor={horasMinutos(horasPendientes)} />
        <Indicador etiqueta="Aprobadas del periodo" valor={n(aprobadas, 0)} />
        <Indicador etiqueta="Observadas" valor={n(observadas, 0)} />
      </div>

      <Card>
        <CardHeader
          titulo={`Bandeja · ${etiquetaPeriodo(periodo?.anio, periodo?.mes)}`}
          descripcion={esAdministracion ? "Administración ve todas las unidades." : "Unidades de tu equipo directo."}
          accion={
            <div className="flex flex-wrap gap-1">
              {PESTANAS.map((p) => (
                <button
                  key={p.valor}
                  onClick={() => setFiltro(p.valor)}
                  className={cn(
                    "rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold",
                    filtro === p.valor ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-surface-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        />
        {unidadesQ.isLoading ? (
          <Vacio mensaje="Cargando unidades…" />
        ) : visibles.length === 0 ? (
          <Vacio mensaje="No hay unidades en este estado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="w-8 px-1 py-2"></th>
                  <th className="px-3 py-2">Colaborador</th>
                  <th className="px-3 py-2">Proyecto</th>
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2 text-right">Horas</th>
                  <th className="px-3 py-2 text-right">Registros</th>
                  <th className="px-3 py-2 text-right">Sin evidencia</th>
                  <th className="px-3 py-2">Enviado</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((u) => {
                  const estado = normalizarEstado(u.estado);
                  const sinEvidencia = Number(u.registros_sin_evidencia ?? 0);
                  const abierta = expandida === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr className="border-b border-border align-top">
                        <td className="px-3 py-2">
                          {estado === "enviado" ? (
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar ${u.colaborador ?? ""} ${u.proyecto_codigo ?? ""}`}
                              checked={seleccion.includes(u.id)}
                              onChange={(e) =>
                                setSeleccion((prev) =>
                                  e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                                )
                              }
                            />
                          ) : null}
                        </td>
                        <td className="px-1 py-2">
                          <button
                            aria-label={abierta ? "Ocultar detalle" : "Ver detalle"}
                            onClick={() => setExpandida(abierta ? null : u.id)}
                            className="rounded-[4px] p-1 text-muted-foreground hover:bg-surface-muted"
                          >
                            {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-semibold">{u.colaborador ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground"><Num>{u.documento ?? "—"}</Num></p>
                        </td>
                        <td className="px-3 py-2">
                          <Num className="font-semibold">{u.proyecto_codigo ?? "—"}</Num>
                          <p className="text-[11px] text-muted-foreground">{u.proyecto_nombre ?? "—"}</p>
                        </td>
                        <td className="px-3 py-2">{u.empresa ?? "—"}</td>
                        <td className="px-3 py-2 text-right"><Num>{horasMinutos(u.horas_enviadas)}</Num></td>
                        <td className="px-3 py-2 text-right"><Num>{n(u.registros ?? 0, 0)}</Num></td>
                        <td className="px-3 py-2 text-right">
                          <Num className={cn(sinEvidencia > 0 && "rounded-[4px] bg-warning-soft px-1.5 py-0.5 font-bold text-warning")}>
                            {n(sinEvidencia, 0)}
                          </Num>
                        </td>
                        <td className="px-3 py-2"><Num>{fechaCorta(u.enviado_en?.slice(0, 10))}</Num></td>
                        <td className="px-3 py-2">
                          <Badge tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Badge>
                          {u.comentario ? (
                            <p className="mt-1 max-w-[220px] text-[11px] text-muted-foreground">{u.comentario}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {estado === "enviado" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variante="secundario"
                                className="h-7 px-2 text-[11px]"
                                cargando={resolver.isPending && resolver.variables?.id === u.id}
                                onClick={() => resolver.mutate({ id: u.id, estado: "aprobado", comentario: "" })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                              </Button>
                              <Button
                                variante="peligro"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => {
                                  setError(null);
                                  setMotivo("");
                                  setObservando(u);
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Observar
                              </Button>
                            </div>
                          ) : (
                            <p className="text-right text-[11px] text-muted-foreground">
                              {u.resuelto_por_nombre ?? "—"}
                              <br />
                              <Num>{fechaCorta(u.resuelto_en?.slice(0, 10))}</Num>
                            </p>
                          )}
                        </td>
                      </tr>
                      {abierta ? (
                        <tr className="border-b border-border bg-surface-muted/40">
                          <td colSpan={11} className="px-3 py-3">
                            <DetalleUnidad
                              colaboradorId={u.colaborador_id}
                              proyectoId={u.proyecto_id}
                              periodoId={u.periodo_id}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {observando ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4">
          <div className="w-full max-w-lg rounded-[8px] bg-surface shadow-lg">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-[15px] font-semibold">Observar horas</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {observando.colaborador} · {observando.proyecto_codigo} · {horasMinutos(observando.horas_enviadas)}
              </p>
            </div>
            <div className="space-y-3 px-4 py-4">
              <label className="label-xs" htmlFor="motivo-obs">Motivo de la observación (mínimo 10 caracteres)</label>
              <textarea
                id="motivo-obs"
                className="field mt-1 h-24 w-full"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explica qué debe corregir el colaborador."
              />
              <p className="text-[11px] text-muted-foreground"><Num>{motivo.trim().length}</Num> / <Num>10</Num></p>
              {error ? <Aviso tono="alerta" titulo="La base de datos respondió">{error}</Aviso> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <Button variante="secundario" onClick={() => setObservando(null)}>Cancelar</Button>
              <Button
                variante="primario"
                disabled={motivo.trim().length < 10}
                cargando={resolver.isPending}
                onClick={() =>
                  resolver.mutate({ id: observando.id, estado: "observado", comentario: motivo.trim() })
                }
              >
                <MessageSquareWarning className="h-3.5 w-3.5" />
                Observar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="bg-surface p-3">
      <span className="text-muted-foreground"><Clock3 className="h-4 w-4" /></span>
      <p className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">{etiqueta}</p>
      <Num className="mt-1 block text-[17px] font-semibold">{valor}</Num>
    </div>
  );
}

function DetalleUnidad({
  colaboradorId,
  proyectoId,
  periodoId,
}: {
  colaboradorId: string;
  proyectoId: string;
  periodoId: string;
}) {
  const q = useQuery({
    queryKey: ["detalle-aprobacion", colaboradorId, proyectoId, periodoId],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta
        .from("hr_v_registro_detalle")
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .eq("proyecto_id", proyectoId)
        .eq("periodo_id", periodoId)
        .order("fecha");
      if (error) throw error;
      return (data ?? []) as RegistroDetalle[];
    },
  });

  if (q.isLoading) return <p className="text-[12px] text-muted-foreground">Cargando registros…</p>;
  if (q.error) return <Aviso tono="alerta" titulo="La base de datos respondió">{mensajeDeError(q.error)}</Aviso>;
  const filas = q.data ?? [];
  if (filas.length === 0) return <p className="text-[12px] text-muted-foreground">Sin registros en el periodo.</p>;

  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-1 pr-3">Fecha</th>
          <th className="py-1 pr-3">Actividad</th>
          <th className="py-1 pr-3 text-right">Horas</th>
          <th className="py-1 pr-3">Descripción</th>
          <th className="py-1 text-right">Sustentos</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((r) => (
          <tr key={r.id} className="border-b border-border/60 last:border-0">
            <td className="py-1 pr-3"><Num>{fechaCorta(r.fecha)}</Num></td>
            <td className="py-1 pr-3">{r.actividad ?? "—"}</td>
            <td className="py-1 pr-3 text-right"><Num>{horasMinutos(r.horas)}</Num></td>
            <td className="py-1 pr-3 text-muted-foreground">{r.descripcion ?? "—"}</td>
            <td className={cn("py-1 text-right", Number(r.sustentos ?? 0) === 0 && "font-bold text-warning")}>
              <Num>{n(r.sustentos ?? 0, 0)}</Num>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
