import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Aviso, Badge, Card, CardHeader, Num, Vacio } from "@/components/ui-kit";
import { KPI, KPIGrid } from "@/components/metrics";
import { SelectorPeriodo, usePeriodoSeleccionado } from "@/components/PeriodoSelector";
import { mensajeDeError, sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type { LiquidacionFila } from "@/integrations/sustenta/vistas";
import { etiquetaPeriodo, n, pct, soles } from "@/lib/formato";

export const Route = createFileRoute("/admin/liquidacion")({
  head: () => ({
    meta: [
      { title: "Liquidación — Sustenta" },
      { name: "description", content: "Importe a facturar por empresa vinculada: costo, margen y horas cobrables." },
      { property: "og:title", content: "Liquidación — Sustenta" },
      { property: "og:description", content: "Costo, margen y total a facturar por empresa vinculada." },
    ],
  }),
  component: Liquidacion,
});

interface Agrupado {
  empresa_id: string;
  razon_social: string;
  margen_pct: number;
  horas_cobrables: number;
  horas_no_cobrables: number;
  costo_cobrable: number;
  costo_no_cobrable: number;
  margen: number;
  total: number;
}

function Liquidacion() {
  const { periodo, periodoId, setPeriodoId, periodos } = usePeriodoSeleccionado(true);

  const filasQ = useQuery({
    queryKey: ["liquidacion", periodoId],
    enabled: sustentaConfigurado && !!periodoId,
    queryFn: async () => {
      const { data, error } = await sustenta.from("hr_liquidacion").select("*").eq("periodo_id", periodoId);
      if (error) throw error;
      return (data ?? []) as LiquidacionFila[];
    },
  });

  const empresas = useMemo(() => {
    const mapa = new Map<string, Agrupado>();
    for (const f of filasQ.data ?? []) {
      const a =
        mapa.get(f.empresa_id) ??
        ({
          empresa_id: f.empresa_id,
          razon_social: f.razon_social ?? "—",
          margen_pct: Number(f.margen_pct ?? 0),
          horas_cobrables: 0,
          horas_no_cobrables: 0,
          costo_cobrable: 0,
          costo_no_cobrable: 0,
          margen: 0,
          total: 0,
        } as Agrupado);
      a.horas_cobrables += Number(f.horas_cobrables ?? 0);
      a.horas_no_cobrables += Number(f.horas_no_cobrables ?? 0);
      a.costo_cobrable += Number(f.costo_cobrable ?? 0);
      a.costo_no_cobrable += Number(f.costo_no_cobrable ?? 0);
      a.margen += Number(f.margen ?? 0);
      a.total += Number(f.total_facturar ?? 0);
      mapa.set(f.empresa_id, a);
    }
    return [...mapa.values()].sort((x, y) => y.total - x.total);
  }, [filasQ.data]);

  const totales = empresas.reduce(
    (acc, e) => ({
      horas_cobrables: acc.horas_cobrables + e.horas_cobrables,
      horas_no_cobrables: acc.horas_no_cobrables + e.horas_no_cobrables,
      costo_cobrable: acc.costo_cobrable + e.costo_cobrable,
      costo_no_cobrable: acc.costo_no_cobrable + e.costo_no_cobrable,
      margen: acc.margen + e.margen,
      total: acc.total + e.total,
    }),
    { horas_cobrables: 0, horas_no_cobrables: 0, costo_cobrable: 0, costo_no_cobrable: 0, margen: 0, total: 0 },
  );

  const aCostoPuro = empresas.filter((e) => e.margen_pct === 0);

  return (
    <AppShell>
      <PageHeader
        titulo="Liquidación"
        descripcion="Importe a facturar a cada empresa vinculada del grupo, con su costo y margen."
      />
      <div className="mb-4">
        <SelectorPeriodo periodos={periodos} valor={periodoId} onChange={setPeriodoId} />
      </div>

      {filasQ.error ? (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="La base de datos respondió">{mensajeDeError(filasQ.error)}</Aviso>
        </div>
      ) : null}

      {periodos.length === 0 ? (
        <Card>
          <Vacio mensaje="No hay periodos cerrados: la liquidación se genera después del cierre." />
        </Card>
      ) : filasQ.isLoading ? (
        <Card><Vacio mensaje="Cargando liquidación…" /></Card>
      ) : empresas.length === 0 ? (
        <Card>
          <Vacio mensaje={`No hay liquidación registrada para ${etiquetaPeriodo(periodo?.anio, periodo?.mes)}.`} />
        </Card>
      ) : (
        <>
          <KPIGrid>
            <KPI etiqueta="Empresas vinculadas" valor={n(empresas.length, 0)} />
            <KPI etiqueta="Horas cobrables" valor={n(totales.horas_cobrables)} unidad="h" />
            <KPI etiqueta="Margen del periodo" valor={soles(totales.margen)} tono="exito" />
            <KPI etiqueta="Total a facturar" valor={soles(totales.total)} grande />
          </KPIGrid>

          <Card>
            <CardHeader
              titulo="Detalle por empresa vinculada"
              descripcion={etiquetaPeriodo(periodo?.anio, periodo?.mes)}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 label-xs">Empresa</th>
                    <th className="px-4 py-2 label-xs text-right">H. cobrables</th>
                    <th className="px-4 py-2 label-xs text-right">H. no cobrables</th>
                    <th className="px-4 py-2 label-xs text-right">Costo cobrable</th>
                    <th className="px-4 py-2 label-xs text-right">Margen</th>
                    <th className="px-4 py-2 label-xs text-right">Costo no cobrable</th>
                    <th className="px-4 py-2 label-xs text-right">Total a facturar</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((e) => (
                    <tr key={e.empresa_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        {e.razon_social}
                        {e.margen_pct === 0 ? (
                          <Badge tono="info" className="ml-2">a costo puro</Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(e.horas_cobrables)}</Num></td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(e.horas_no_cobrables)}</Num></td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{soles(e.costo_cobrable)}</Num></td>
                      <td className="px-4 py-2 text-right">
                        <Num className="tabular-nums">{soles(e.margen)}</Num>
                        <span className="ml-1 text-[11px] text-muted-foreground">{pct(e.margen_pct, 0)}</span>
                      </td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{soles(e.costo_no_cobrable)}</Num></td>
                      <td className="px-4 py-2 text-right font-semibold"><Num className="tabular-nums">{soles(e.total)}</Num></td>
                    </tr>
                  ))}
                  <tr className="border-t border-border-strong bg-surface-muted font-semibold">
                    <td className="px-4 py-2">Totales</td>
                    <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(totales.horas_cobrables)}</Num></td>
                    <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(totales.horas_no_cobrables)}</Num></td>
                    <td className="px-4 py-2 text-right"><Num className="tabular-nums">{soles(totales.costo_cobrable)}</Num></td>
                    <td className="px-4 py-2 text-right"><Num className="tabular-nums">{soles(totales.margen)}</Num></td>
                    <td className="px-4 py-2 text-right"><Num className="tabular-nums">{soles(totales.costo_no_cobrable)}</Num></td>
                    <td className="px-4 py-2 text-right"><Num className="tabular-nums">{soles(totales.total)}</Num></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {aCostoPuro.length > 0 ? (
            <div className="mt-4">
              <Aviso tono="info" titulo="Empresas facturadas a costo puro">
                {aCostoPuro.map((e) => e.razon_social).join(", ")} tienen margen 0%. Es una política de precios
                válida y deliberada del grupo, no una configuración faltante: se factura el costo sin utilidad.
              </Aviso>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
