import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Aviso, Badge, Button, Card, CardHeader, Etiqueta, Num, Progress, Vacio } from "@/components/ui-kit";
import { SelectorPeriodo, usePeriodoSeleccionado } from "@/components/PeriodoSelector";
import { mensajeDeError, sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type { Asignacion, Proyecto } from "@/integrations/sustenta/types";
import type { AsignacionPeriodo } from "@/integrations/sustenta/vistas";
import { nombreColaborador } from "@/integrations/sustenta/types";
import { horasMinutos } from "@/lib/formato";

export const Route = createFileRoute("/proyectos/asignaciones")({
  head: () => ({
    meta: [
      { title: "Asigna colaboradores — Sustenta" },
      {
        name: "description",
        content: "Asignaciones de colaboradores por proyecto: dedicación, vigencia, cobrabilidad y capacidad usada.",
      },
      { property: "og:title", content: "Asigna colaboradores — Sustenta" },
      {
        property: "og:description",
        content: "Dedicación, vigencia, cobrabilidad y capacidad usada por colaborador.",
      },
    ],
  }),
  component: Asignaciones,
});

function dedicacionPct(a: Asignacion): number {
  const v = a.dedicacion_pct ?? a.dedicacion ?? 0;
  return Number(v) <= 1 ? Number(v) * 100 : Number(v);
}

function Asignaciones() {
  const qc = useQueryClient();
  const { periodoId, setPeriodoId, periodos } = usePeriodoSeleccionado();
  const [proyectoId, setProyectoId] = useState("");
  const [editando, setEditando] = useState<Asignacion | null>(null);
  const [form, setForm] = useState({
    rol_proyecto: "",
    dedicacion_pct: "100",
    cobrable: true,
    fecha_inicio: "",
    fecha_fin: "",
  });
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  function abrirEditor(a: Asignacion | null, finSugerido?: string) {
    setErrorEdicion(null);
    setEditando(a);
    if (!a) return;
    setForm({
      rol_proyecto: a.rol_proyecto ?? a.rol ?? "",
      dedicacion_pct: String(dedicacionPct(a)),
      cobrable: a.cobrable !== false,
      fecha_inicio: a.fecha_inicio ?? "",
      fecha_fin: finSugerido ?? a.fecha_fin ?? "",
    });
  }
  const [errorBorrado, setErrorBorrado] = useState<{ id: string; mensaje: string } | null>(null);

  const proyectosQ = useQuery({
    queryKey: ["proyectos"],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_proyecto").select("*");
      if (error) throw error;
      return (data ?? []) as Proyecto[];
    },
  });

  const proyectos = proyectosQ.data ?? [];
  const proyectoActual = proyectos.find((p) => p.id === proyectoId) ?? proyectos[0] ?? null;

  const asignacionesQ = useQuery({
    queryKey: ["asignaciones-proyecto-periodo", proyectoActual?.id, periodoId],
    enabled: sustentaConfigurado && !!proyectoActual && !!periodoId,
    queryFn: async () => {
      // La vista mensual trae la expectativa y ejecución acotadas al periodo.
      const { data, error } = await sustenta
        .from("hr_v_asignacion_periodo")
        .select("*")
        .eq("proyecto_id", proyectoActual!.id)
        .eq("periodo_id", periodoId);
      if (error) throw error;
      return (data ?? []) as AsignacionPeriodo[];
    },
  });

  const detalle = useMemo(() => asignacionesQ.data ?? [], [asignacionesQ.data]);

  const asignaciones = useMemo(
    () =>
      detalle.map((d) => ({
        id: d.id,
        proyecto_id: d.proyecto_id,
        colaborador_id: d.colaborador_id,
        rol_proyecto: d.rol_proyecto,
        dedicacion_pct: d.dedicacion_pct,
        fecha_inicio: d.fecha_inicio,
        fecha_fin: d.fecha_fin,
        cobrable: d.cobrable,
        colaborador: { id: d.colaborador_id, nombre: d.colaborador, rol: "colaborador" },
      })) as Asignacion[],
    [detalle],
  );


  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sustenta.from("hr_asignacion").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      setErrorBorrado(null);
      toast.success("Asignación eliminada");
      qc.invalidateQueries({ queryKey: ["asignaciones-proyecto"] });
    },
    onError: (e, id) => {
      const msg = mensajeDeError(e);
      setErrorBorrado({ id, mensaje: msg });
      toast.error(msg);
    },
  });

  const actualizar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sustenta
        .from("hr_asignacion")
        .update({
          rol_proyecto: form.rol_proyecto.trim() || null,
          dedicacion_pct: Number(form.dedicacion_pct),
          cobrable: form.cobrable,
          fecha_inicio: form.fecha_inicio || null,
          fecha_fin: form.fecha_fin || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asignación actualizada");
      setEditando(null);
      setErrorEdicion(null);
      setErrorBorrado(null);
      qc.invalidateQueries({ queryKey: ["asignaciones-proyecto-periodo"] });
    },
    onError: (e) => {
      const m = mensajeDeError(e);
      setErrorEdicion(m);
      toast.error(m);
    },
  });

  return (
    <AppShell>
      <PageHeader
        titulo="Asigna colaboradores"
        descripcion="Quién participa en el proyecto, con qué dedicación y desde cuándo."
        acciones={[
          { label: "Asignaciones activas", contador: asignaciones.length },
          { label: "Proyectos", to: "/proyectos" },
        ]}
      />

      <div className="mb-4">
        <SelectorPeriodo periodos={periodos} valor={periodoId} onChange={setPeriodoId} />
      </div>

      <Card>
        <CardHeader
          titulo="Asignaciones del proyecto"
          descripcion="La capacidad usada compara horas registradas contra la dedicación comprometida."
          accion={
            <select
              className="field w-64"
              value={proyectoActual?.id ?? ""}
              onChange={(e) => setProyectoId(e.target.value)}
              aria-label="Proyecto"
            >
              {proyectos.length === 0 ? <option value="">Sin proyectos</option> : null}
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre ?? p.codigo ?? p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          }
        />

        {asignaciones.length === 0 ? (
          <Vacio mensaje="Este proyecto todavía no tiene colaboradores asignados." />
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border">
                {["Colaborador", "Rol", "Dedicación", "Vigencia", "Cobrabilidad", "Capacidad usada", ""].map((h) => (
                  <th key={h} className="label-xs px-4 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a) => {
                const ded = dedicacionPct(a);
                const filaPeriodo = detalle.find((d) => d.id === a.id);
                const usadas = Number(filaPeriodo?.horas_registradas ?? 0);
                const capacidad = Number(filaPeriodo?.horas_esperadas ?? 0);
                const avance = capacidad > 0 ? Math.round((usadas / capacidad) * 100) : 0;
                const cobra = a.cobrabilidad ?? (a.cobrable == null ? null : a.cobrable ? "Cobrable" : "No cobrable");
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 align-middle">
                    <td className="px-4 py-3 font-medium">{nombreColaborador(a.colaborador)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.rol_proyecto ?? a.rol ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Num>{ded.toFixed(0)}%</Num>
                    </td>
                    <td className="px-4 py-3">
                      <Num className="text-[12px]">
                        {a.fecha_inicio ?? "—"} → {a.fecha_fin ?? "sin fin"}
                      </Num>
                    </td>
                    <td className="px-4 py-3">
                      {cobra ? <Badge tono={a.cobrable === false ? "neutro" : "exito"}>{cobra}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-36">
                        <div className="mb-1 flex justify-between">
                          <Num className="text-[12px]">{horasMinutos(usadas)} / {horasMinutos(capacidad)}</Num>
                          <Num className="text-[12px] text-muted-foreground">{avance}%</Num>
                        </div>
                        <Progress valor={avance} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variante="fantasma"
                          aria-label="Editar"
                          onClick={() => abrirEditor(a)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variante="peligro"
                          aria-label="Eliminar"
                          cargando={eliminar.isPending && eliminar.variables === a.id}
                          onClick={() => eliminar.mutate(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {errorBorrado ? (
        <div className="mt-4">
          <Aviso tono="acento" titulo="No se pudo eliminar la asignación">
            <p className="mt-1">{errorBorrado.mensaje}</p>
            <div className="mt-2">
              <Button
                variante="primario"
                onClick={() => {
                  const a = asignaciones.find((x) => x.id === errorBorrado.id) ?? null;
                  setEditando(a);
                  setFechaFin(new Date().toISOString().slice(0, 10));
                }}
              >
                Cerrar la asignación anticipadamente
              </Button>
            </div>
          </Aviso>
        </div>
      ) : null}

      {editando ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-md">
            <CardHeader
              titulo="Editar asignación"
              descripcion={nombreColaborador(editando.colaborador)}
              accion={
                <Button variante="fantasma" onClick={() => setEditando(null)} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </Button>
              }
            />
            <div className="space-y-4 p-4">
              <div>
                <Etiqueta>Fecha de fin de la asignación</Etiqueta>
                <input
                  type="date"
                  className="field num mt-1"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Cerrar la asignación conserva las horas ya registradas y evita nuevos registros.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variante="secundario" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button
                  variante="primario"
                  cargando={actualizar.isPending}
                  onClick={() => actualizar.mutate({ id: editando.id, fecha_fin: fechaFin || null })}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
