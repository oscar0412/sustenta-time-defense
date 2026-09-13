import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Info, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Aviso, Badge, Button, Card, CardHeader, Etiqueta, Num, Vacio } from "@/components/ui-kit";
import { useSesion } from "@/context/session";
import { mensajeDeError, sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type {
  Actividad,
  Asignacion,
  EmpresaVinculada,
  Feriado,
  Incidencia,
  RegistroHora,
} from "@/integrations/sustenta/types";
import { nombreEmpresa } from "@/integrations/sustenta/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/horas/registro")({
  head: () => ({
    meta: [
      { title: "Registro de horas — Sustenta" },
      {
        name: "description",
        content:
          "Registro diario de horas por proyecto con evidencia y clasificación automática de cobrabilidad.",
      },
      { property: "og:title", content: "Registro de horas — Sustenta" },
      {
        property: "og:description",
        content: "Registro diario de horas por proyecto con evidencia y clasificación automática.",
      },
    ],
  }),
  component: RegistroHoras,
});

const HORAS_JORNADA = 8;

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function dedicacionDe(a: Asignacion): number | null {
  const v = a.dedicacion_pct ?? a.dedicacion;
  if (v == null) return null;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function RegistroHoras() {
  const { colaborador } = useSesion();
  const qc = useQueryClient();
  const colaboradorId = colaborador?.id ?? null;

  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [asignacionId, setAsignacionId] = useState<string>("");
  const [dia, setDia] = useState<Date | null>(null);
  const [actividadId, setActividadId] = useState("");
  const [horas, setHoras] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorBD, setErrorBD] = useState<string | null>(null);

  const habilitado = sustentaConfigurado && !!colaboradorId;

  const asignacionesQ = useQuery({
    queryKey: ["asignaciones", colaboradorId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await sustenta
        .from("hr_asignacion")
        .select("*, proyecto:proyecto_id(*)")
        .eq("colaborador_id", colaboradorId);
      if (error) throw error;
      return (data ?? []) as Asignacion[];
    },
  });

  const actividadesQ = useQuery({
    queryKey: ["actividades"],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_actividad").select("*");
      if (error) throw error;
      return (data ?? []) as Actividad[];
    },
  });

  const empresasQ = useQuery({
    queryKey: ["empresas"],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_empresa_vinculada").select("*");
      if (error) throw error;
      return (data ?? []) as EmpresaVinculada[];
    },
  });

  const desde = iso(startOfMonth(mes));
  const hasta = iso(endOfMonth(mes));

  const registrosQ = useQuery({
    queryKey: ["registros", colaboradorId, desde],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await sustenta
        .from("hr_registro_hora")
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .gte("fecha", desde)
        .lte("fecha", hasta);
      if (error) throw error;
      return (data ?? []) as RegistroHora[];
    },
  });

  const feriadosQ = useQuery({
    queryKey: ["feriados", desde],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_feriado").select("*").gte("fecha", desde).lte("fecha", hasta);
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
  });

  const incidenciasQ = useQuery({
    queryKey: ["incidencias", colaboradorId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_incidencia").select("*").eq("colaborador_id", colaboradorId);
      if (error) throw error;
      return (data ?? []) as Incidencia[];
    },
  });

  const asignaciones = asignacionesQ.data ?? [];
  const asignacionesVigentes = useMemo(
    () =>
      asignaciones.filter((a) => {
        const fin = a.fecha_fin ? parseISO(a.fecha_fin) : null;
        return !fin || !isBefore(fin, new Date());
      }),
    [asignaciones],
  );
  const asignacion = asignaciones.find((a) => a.id === asignacionId) ?? asignacionesVigentes[0] ?? null;

  const registros = registrosQ.data ?? [];
  const feriados = feriadosQ.data ?? [];
  const incidencias = incidenciasQ.data ?? [];

  const dias = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) }),
    [mes],
  );

  function estadoDia(d: Date) {
    const f = iso(d);
    if (feriados.some((h) => h.fecha === f)) return "feriado" as const;
    if (d.getDay() === 0 || d.getDay() === 6) return "no_laborable" as const;
    if (
      incidencias.some((i) => {
        const ini = i.fecha_inicio ? parseISO(i.fecha_inicio) : null;
        const fin = i.fecha_fin ? parseISO(i.fecha_fin) : ini;
        return ini && fin && !isBefore(d, ini) && !isAfter(d, fin);
      })
    )
      return "incidencia" as const;
    const total = registros.filter((r) => r.fecha === f).reduce((s, r) => s + Number(r.horas ?? 0), 0);
    if (total >= HORAS_JORNADA) return "completo" as const;
    if (total > 0) return "parcial" as const;
    return "pendiente" as const;
  }

  function dentroDeVigencia(d: Date) {
    if (!asignacion) return false;
    const ini = asignacion.fecha_inicio ? parseISO(asignacion.fecha_inicio) : null;
    const fin = asignacion.fecha_fin ? parseISO(asignacion.fecha_fin) : null;
    if (ini && isBefore(d, ini)) return false;
    if (fin && isAfter(d, fin)) return false;
    return true;
  }

  const empresaReceptora = empresasQ.data?.find((e) => e.id === asignacion?.proyecto?.empresa_id) ?? null;
  const cobrable = asignacion?.cobrable ?? asignacion?.proyecto?.cobrable ?? null;
  const cobrabilidad = asignacion?.cobrabilidad ?? (cobrable == null ? null : cobrable ? "Cobrable" : "No cobrable");

  const registrosDelDia = dia ? registros.filter((r) => r.fecha === iso(dia)) : [];
  const pendientes = dias.filter((d) => estadoDia(d) === "pendiente" && dentroDeVigencia(d)).length;

  const guardar = useMutation({
    mutationFn: async () => {
      if (!dia || !asignacion || !colaboradorId) throw new Error("Selecciona un día y un proyecto.");
      const fila: Record<string, unknown> = {
        colaborador_id: colaboradorId,
        proyecto_id: asignacion.proyecto_id,
        asignacion_id: asignacion.id,
        actividad_id: actividadId || null,
        fecha: iso(dia),
        horas: Number(horas),
        descripcion,
      };
      const { data, error } = await sustenta.from("hr_registro_hora").insert(fila).select("*").single();
      if (error) throw error;
      const registro = data as RegistroHora;

      if (archivo) {
        const ruta = `${colaboradorId}/${iso(dia)}/${Date.now()}-${archivo.name}`;
        const up = await sustenta.storage.from("sustentos").upload(ruta, archivo);
        if (up.error) throw up.error;
        const { error: errSustento } = await sustenta.from("hr_sustento").insert({
          registro_hora_id: registro.id,
          archivo: ruta,
          nombre: archivo.name,
        });
        if (errSustento) throw errSustento;
      }
      return registro;
    },
    onSuccess: () => {
      setErrorBD(null);
      setHoras("");
      setDescripcion("");
      setArchivo(null);
      toast.success("Registro guardado");
      qc.invalidateQueries({ queryKey: ["registros"] });
    },
    onError: (e) => {
      const msg = mensajeDeError(e);
      setErrorBD(msg);
      toast.error(msg);
    },
  });

  const descripcionValida = descripcion.trim().length >= 10;

  return (
    <AppShell>
      <PageHeader
        titulo="Registro de horas"
        descripcion="Cada hora registrada es evidencia: proyecto, actividad, descripción y sustento."
        acciones={[
          { label: "Días pendientes del mes", contador: pendientes },
          { label: "Mi capacidad", to: "/horas/capacidad" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader titulo="Proyecto y calendario" descripcion="Solo tus asignaciones vigentes." />
          <div className="space-y-4 p-4">
            <div>
              <Etiqueta>Proyecto asignado</Etiqueta>
              <select
                className="field mt-1"
                value={asignacion?.id ?? ""}
                onChange={(e) => {
                  setAsignacionId(e.target.value);
                  setDia(null);
                }}
              >
                {asignacionesVigentes.length === 0 ? <option value="">Sin asignaciones vigentes</option> : null}
                {asignacionesVigentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.proyecto?.nombre ?? a.proyecto?.codigo ?? a.proyecto_id.slice(0, 8)}
                  </option>
                ))}
              </select>
              {asignacion ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span>
                    Vigencia{" "}
                    <Num>
                      {asignacion.fecha_inicio ?? "—"} → {asignacion.fecha_fin ?? "sin fin"}
                    </Num>
                  </span>
                  {dedicacionDe(asignacion) != null ? (
                    <Badge tono="info">
                      Dedicación <Num>{dedicacionDe(asignacion)}%</Num>
                    </Badge>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Button variante="fantasma" onClick={() => setMes(subMonths(mes, 1))} aria-label="Mes anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Num className="text-[13px] font-semibold capitalize">
                  {format(mes, "MMMM yyyy", { locale: es })}
                </Num>
                <Button variante="fantasma" onClick={() => setMes(addMonths(mes, 1))} aria-label="Mes siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <span key={i} className="label-xs py-1">
                    {d}
                  </span>
                ))}
                {Array.from({ length: (startOfMonth(mes).getDay() + 6) % 7 }).map((_, i) => (
                  <span key={`e${i}`} />
                ))}
                {dias.map((d) => {
                  const st = estadoDia(d);
                  const activo = dia && isSameDay(d, dia);
                  const permitido = dentroDeVigencia(d) && st !== "feriado" && st !== "no_laborable";
                  const estilos: Record<string, string> = {
                    completo: "bg-success-soft text-success border-success/25",
                    parcial: "bg-warning-soft text-warning border-warning/25",
                    pendiente: "bg-surface text-foreground border-border",
                    incidencia: "bg-info-soft text-info border-info/25",
                    feriado: "bg-accent-soft text-accent border-accent/20",
                    no_laborable: "bg-surface-muted text-muted-foreground border-border",
                  };
                  return (
                    <button
                      key={iso(d)}
                      disabled={!permitido}
                      onClick={() => setDia(d)}
                      className={cn(
                        "num rounded-[6px] border py-2 text-[12px] transition-colors disabled:opacity-40",
                        estilos[st],
                        activo && "ring-2 ring-accent",
                        permitido && "hover:border-accent",
                      )}
                      title={st}
                    >
                      {format(d, "d")}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tono="exito">Completo</Badge>
                <Badge tono="alerta">Parcial</Badge>
                <Badge tono="neutro">Pendiente</Badge>
                <Badge tono="info">Incidencia</Badge>
                <Badge tono="acento">Feriado</Badge>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titulo={dia ? `Día ${format(dia, "dd/MM/yyyy")}` : "Selecciona un día"}
              descripcion="Registra horas con actividad, descripción y evidencia."
            />
            {!dia ? (
              <Vacio mensaje="Elige una fecha habilitada del calendario para registrar horas." />
            ) : (
              <div className="space-y-4 p-4">
                {registrosDelDia.length > 0 ? (
                  <div className="rounded-[6px] border border-border">
                    {registrosDelDia.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0"
                      >
                        <span className="text-[13px]">{r.descripcion ?? "—"}</span>
                        <Num className="text-[13px] font-semibold">{Number(r.horas).toFixed(2)} h</Num>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Etiqueta>Actividad</Etiqueta>
                    <select
                      className="field mt-1"
                      value={actividadId}
                      onChange={(e) => setActividadId(e.target.value)}
                    >
                      <option value="">Selecciona una actividad</option>
                      {(actividadesQ.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre ?? a.codigo ?? a.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Etiqueta>Horas</Etiqueta>
                    <input
                      className="field num mt-1"
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={horas}
                      onChange={(e) => setHoras(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Etiqueta>Descripción del trabajo (mínimo 10 caracteres)</Etiqueta>
                  <textarea
                    className="field mt-1 min-h-24"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Describe la actividad realizada, entregable y contraparte."
                  />
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      descripcionValida ? "text-muted-foreground" : "text-accent",
                    )}
                  >
                    <Num>{descripcion.trim().length}</Num> / <Num>10</Num> caracteres mínimos
                  </p>
                </div>

                <div>
                  <Etiqueta>Evidencia (se guarda en el repositorio de sustentos)</Etiqueta>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-[6px] border border-dashed border-border-strong px-3 py-4 text-[13px] text-muted-foreground hover:border-accent">
                    <Upload className="h-4 w-4" />
                    {archivo ? (
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        {archivo.name}
                      </span>
                    ) : (
                      "Arrastra o selecciona un archivo de respaldo"
                    )}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                {errorBD ? <Aviso tono="acento" titulo="La base rechazó el registro">{errorBD}</Aviso> : null}

                <div className="flex justify-end gap-2">
                  <Button variante="secundario" onClick={() => setDia(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variante="primario"
                    cargando={guardar.isPending}
                    disabled={!descripcionValida || !horas || !asignacion}
                    onClick={() => guardar.mutate()}
                  >
                    Guardar registro
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              titulo="Cómo se clasificó este registro"
              descripcion="Resuelto por el sistema según la asignación. No editable."
            />
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              <div>
                <Etiqueta>Cobrabilidad</Etiqueta>
                <div className="mt-1">
                  {cobrabilidad ? (
                    <Badge tono={cobrable === false ? "neutro" : "exito"}>{cobrabilidad}</Badge>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div>
                <Etiqueta>Empresa receptora</Etiqueta>
                <p className="mt-1 text-[13px] font-medium">{nombreEmpresa(empresaReceptora)}</p>
                {empresaReceptora?.ruc ? <Num className="text-[12px] text-muted-foreground">RUC {empresaReceptora.ruc}</Num> : null}
              </div>
              <div>
                <Etiqueta>Canal</Etiqueta>
                <p className="mt-1 text-[13px] font-medium">
                  {asignacion?.proyecto?.codigo ? `Proyecto ${asignacion.proyecto.codigo}` : "Servicio intragrupo"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              La clasificación final se confirma al cerrar el periodo y valorizar las horas.
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
