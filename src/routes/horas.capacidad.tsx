import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Aviso, Badge, Card, CardHeader, Num, Vacio } from "@/components/ui-kit";
import { BarraH, KPI, KPIGrid } from "@/components/metrics";
import { SelectorPeriodo, usePeriodoSeleccionado } from "@/components/PeriodoSelector";
import { useSesion } from "@/context/session";
import { mensajeDeError, sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type { AsignacionDetalle, CapacidadFila, IncidenciaFila } from "@/integrations/sustenta/vistas";
import { COLORES, etiquetaPeriodo, fechaCorta, n, rangoMes } from "@/lib/formato";

export const Route = createFileRoute("/horas/capacidad")({
  head: () => ({
    meta: [
      { title: "Mi capacidad — Sustenta" },
      { name: "description", content: "Capacidad disponible, incidencias y consumo por proyecto del colaborador." },
      { property: "og:title", content: "Mi capacidad — Sustenta" },
      { property: "og:description", content: "Capacidad productiva frente a horas registradas." },
    ],
  }),
  component: MiCapacidad,
});

function MiCapacidad() {
  const { colaborador } = useSesion();
  const { periodo, periodoId, setPeriodoId, periodos } = usePeriodoSeleccionado();

  const capacidadQ = useQuery({
    queryKey: ["mi-capacidad", periodoId, colaborador?.id],
    enabled: sustentaConfigurado && !!periodoId && !!colaborador?.id,
    queryFn: async () => {
      const { data, error } = await sustenta
        .from("hr_v_capacidad")
        .select("*")
        .eq("periodo_id", periodoId)
        .eq("colaborador_id", colaborador!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CapacidadFila | null;
    },
  });

  const asignacionesQ = useQuery({
    queryKey: ["mis-asignaciones-detalle", colaborador?.id],
    enabled: sustentaConfigurado && !!colaborador?.id,
    queryFn: async () => {
      const { data, error } = await sustenta
        .from("hr_v_asignacion_detalle")
        .select("*")
        .eq("colaborador_id", colaborador!.id);
      if (error) throw error;
      return (data ?? []) as AsignacionDetalle[];
    },
  });

  const rango = periodo?.anio && periodo?.mes ? rangoMes(periodo.anio, periodo.mes) : null;

  const incidenciasQ = useQuery({
    queryKey: ["mis-incidencias", colaborador?.id, rango?.inicio],
    enabled: sustentaConfigurado && !!colaborador?.id && !!rango,
    queryFn: async () => {
      const { data, error } = await sustenta
        .from("hr_incidencia")
        .select("*")
        .eq("colaborador_id", colaborador!.id)
        .lte("fecha_inicio", rango!.fin)
        .gte("fecha_fin", rango!.inicio)
        .order("fecha_inicio");
      if (error) throw error;
      return (data ?? []) as IncidenciaFila[];
    },
  });

  const cap = capacidadQ.data;
  const error = capacidadQ.error ?? asignacionesQ.error ?? incidenciasQ.error;
  const asignaciones = asignacionesQ.data ?? [];
  const incidencias = incidenciasQ.data ?? [];

  return (
    <AppShell>
      <PageHeader
        titulo="Mi capacidad"
        descripcion="Capacidad productiva del mes, incidencias y consumo por proyecto."
      />
      <div className="mb-4">
        <SelectorPeriodo periodos={periodos} valor={periodoId} onChange={setPeriodoId} />
      </div>

      {error ? (
        <Aviso tono="alerta" titulo="La base de datos respondió">
          {mensajeDeError(error)}
        </Aviso>
      ) : null}

      {!capacidadQ.isLoading && !cap ? (
        <Card className="mb-5">
          <Vacio
            mensaje={`No hay capacidad calculada para ${etiquetaPeriodo(periodo?.anio, periodo?.mes)} en tu usuario.`}
          />
        </Card>
      ) : (
        <KPIGrid>
          <KPI etiqueta="Capacidad bruta" valor={n(cap?.capacidad_bruta)} unidad="h" />
          <KPI
            etiqueta="Horas de incidencia"
            valor={n(cap?.horas_incidencia)}
            unidad="h"
            tono={Number(cap?.horas_incidencia ?? 0) > 0 ? "advertencia" : "neutro"}
          />
          <KPI etiqueta="Capacidad productiva" valor={n(cap?.capacidad_productiva)} unidad="h" />
          <KPI
            etiqueta="Horas registradas"
            valor={n(cap?.horas_registradas)}
            unidad="h"
            tono="exito"
            nota={
              cap?.capacidad_productiva
                ? `${n((Number(cap.horas_registradas ?? 0) / Number(cap.capacidad_productiva)) * 100)}% de la capacidad productiva`
                : undefined
            }
          />
        </KPIGrid>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader titulo="Consumo por proyecto" descripcion="Horas registradas frente a la dedicación pactada." />
          {asignaciones.length === 0 ? (
            <Vacio mensaje="No tienes asignaciones vigentes registradas." />
          ) : (
            <div className="space-y-4 px-4 py-4">
              {asignaciones.map((a) => {
                const jornada = Number(a.jornada_horas ?? 8);
                const objetivo = (Number(cap?.capacidad_productiva ?? jornada * 20) * Number(a.dedicacion_pct ?? 0)) / 100;
                return (
                  <div key={a.id}>
                    <BarraH
                      etiqueta={`${a.proyecto_codigo ?? ""} · ${a.proyecto_nombre ?? ""}`}
                      detalle={`${n(a.horas_registradas)} h / ${n(objetivo)} h`}
                      valor={Number(a.horas_registradas ?? 0)}
                      maximo={objetivo || Number(a.horas_registradas ?? 1)}
                      color={
                        objetivo > 0 && Number(a.horas_registradas ?? 0) > objetivo
                          ? COLORES.advertencia
                          : COLORES.ejecutado
                      }
                    />
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{a.empresa}</span>
                      <span>·</span>
                      <Num>{n(a.dedicacion_pct, 0)}%</Num>
                      <span>dedicación</span>
                      <Badge tono={a.cobrable ? "exito" : "neutro"}>{a.cobrable ? "cobrable" : "no cobrable"}</Badge>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            titulo="Incidencias del mes"
            descripcion="Descuentan capacidad productiva y afectan el costo por hora."
          />
          {incidencias.length === 0 ? (
            <Vacio mensaje="Sin incidencias registradas en este periodo." />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 label-xs">Tipo</th>
                  <th className="px-4 py-2 label-xs">Desde</th>
                  <th className="px-4 py-2 label-xs">Hasta</th>
                  <th className="px-4 py-2 label-xs">Origen</th>
                </tr>
              </thead>
              <tbody>
                {incidencias.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{i.tipo}</td>
                    <td className="px-4 py-2 num tabular-nums">{fechaCorta(i.fecha_inicio)}</td>
                    <td className="px-4 py-2 num tabular-nums">{fechaCorta(i.fecha_fin)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{i.origen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
