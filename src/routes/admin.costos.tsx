import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Aviso, Badge, Button, Card, CardHeader, Num, Vacio } from "@/components/ui-kit";
import { SelectorPeriodo, usePeriodoSeleccionado } from "@/components/PeriodoSelector";
import { mensajeDeError, sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type { CapacidadFila } from "@/integrations/sustenta/vistas";
import { cn } from "@/lib/utils";
import { etiquetaPeriodo, n, soles } from "@/lib/formato";

export const Route = createFileRoute("/admin/costos")({
  head: () => ({
    meta: [
      { title: "Costos del personal — Sustenta" },
      { name: "description", content: "Costo mensual, capacidad productiva y costo por hora de cada colaborador." },
      { property: "og:title", content: "Costos del personal — Sustenta" },
      { property: "og:description", content: "Costo por hora calculado sobre la capacidad productiva." },
    ],
  }),
  component: Costos,
});

function Costos() {
  const qc = useQueryClient();
  const { periodo, periodoId, setPeriodoId, periodos } = usePeriodoSeleccionado();
  const [editando, setEditando] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const anterior = useMemo(() => {
    if (!periodo?.anio || !periodo?.mes) return null;
    const mes = periodo.mes === 1 ? 12 : periodo.mes - 1;
    const anio = periodo.mes === 1 ? periodo.anio - 1 : periodo.anio;
    return periodos.find((p) => p.anio === anio && p.mes === mes) ?? null;
  }, [periodo, periodos]);

  const filasQ = useQuery({
    queryKey: ["costos-capacidad", periodoId],
    enabled: sustentaConfigurado && !!periodoId,
    queryFn: async () => {
      const { data, error: err } = await sustenta
        .from("hr_v_capacidad")
        .select("*")
        .eq("periodo_id", periodoId)
        .order("colaborador");
      if (err) throw err;
      return (data ?? []) as CapacidadFila[];
    },
  });

  const previoQ = useQuery({
    queryKey: ["costos-capacidad-previo", anterior?.id],
    enabled: sustentaConfigurado && !!anterior?.id,
    queryFn: async () => {
      const { data, error: err } = await sustenta
        .from("hr_v_capacidad")
        .select("colaborador_id, costo_hora")
        .eq("periodo_id", anterior!.id);
      if (err) throw err;
      return (data ?? []) as Pick<CapacidadFila, "colaborador_id" | "costo_hora">[];
    },
  });

  const previo = useMemo(
    () => new Map((previoQ.data ?? []).map((f) => [f.colaborador_id, Number(f.costo_hora ?? 0)])),
    [previoQ.data],
  );

  const guardar = useMutation({
    mutationFn: async ({ fila, valor }: { fila: CapacidadFila; valor: number }) => {
      const { data: existente, error: errSel } = await sustenta
        .from("hr_costo_mensual")
        .select("id")
        .eq("colaborador_id", fila.colaborador_id)
        .eq("periodo_id", periodoId)
        .maybeSingle();
      if (errSel) throw errSel;
      if (existente?.id) {
        const { error: err } = await sustenta
          .from("hr_costo_mensual")
          .update({ costo_mensual: valor })
          .eq("id", existente.id);
        if (err) throw err;
      } else {
        const { error: err } = await sustenta.from("hr_costo_mensual").insert({
          colaborador_id: fila.colaborador_id,
          periodo_id: periodoId,
          costo_mensual: valor,
          capacidad_horas: Number(fila.capacidad_bruta ?? 0),
          horas_incidencia: Number(fila.horas_incidencia ?? 0),
          horas_productivas: Number(fila.capacidad_productiva ?? 0),
        });
        if (err) throw err;
      }
    },
    onSuccess: () => {
      setError(null);
      setEditando(null);
      toast.success("Costo mensual actualizado");
      qc.invalidateQueries({ queryKey: ["costos-capacidad"] });
    },
    onError: (e) => {
      const m = mensajeDeError(e);
      setError(m);
      toast.error(m);
    },
  });

  const calcular = useMutation({
    mutationFn: async () => {
      const { error: err } = await sustenta.rpc("hr_calcular_costos", { p_periodo: periodoId });
      if (err) throw err;
    },
    onSuccess: () => {
      setError(null);
      toast.success("Costos recalculados");
      qc.invalidateQueries({ queryKey: ["costos-capacidad"] });
    },
    onError: (e) => {
      const m = mensajeDeError(e);
      setError(m);
      toast.error(m);
    },
  });

  const filas = filasQ.data ?? [];

  return (
    <AppShell>
      <PageHeader
        titulo="Costos del personal"
        descripcion="El costo por hora resulta del costo mensual dividido entre la capacidad productiva."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SelectorPeriodo periodos={periodos} valor={periodoId} onChange={setPeriodoId} />
        <Button variante="primario" cargando={calcular.isPending} onClick={() => calcular.mutate()} disabled={!periodoId}>
          <Calculator className="h-3.5 w-3.5" />
          Calcular costos del periodo
        </Button>
      </div>

      {error ? (
        <div className="mb-4">
          <Aviso tono="alerta" titulo="La base de datos respondió">{error}</Aviso>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-warning" /> Desviación mayor a 15% frente a{" "}
          {anterior ? etiquetaPeriodo(anterior.anio, anterior.mes) : "el mes anterior"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" /> Sin costo por hora calculable
        </span>
      </div>

      <Card>
        <CardHeader
          titulo="Costo por colaborador"
          descripcion={etiquetaPeriodo(periodo?.anio, periodo?.mes)}
        />
        {filasQ.isLoading ? (
          <Vacio mensaje="Cargando costos…" />
        ) : filas.length === 0 ? (
          <Vacio mensaje={`No hay datos de capacidad ni costos para ${etiquetaPeriodo(periodo?.anio, periodo?.mes)}.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 label-xs">Colaborador</th>
                  <th className="px-4 py-2 label-xs text-right">Costo mensual</th>
                  <th className="px-4 py-2 label-xs text-right">Capacidad</th>
                  <th className="px-4 py-2 label-xs text-right">Incidencias</th>
                  <th className="px-4 py-2 label-xs text-right">Horas productivas</th>
                  <th className="px-4 py-2 label-xs text-right">Costo por hora</th>
                  <th className="px-4 py-2 label-xs text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const ch = Number(f.costo_hora ?? 0);
                  const sinCosto = !f.costo_hora || ch <= 0;
                  const base = previo.get(f.colaborador_id) ?? 0;
                  const desvio = base > 0 && ch > 0 ? ((ch - base) / base) * 100 : 0;
                  const desviado = Math.abs(desvio) > 15;
                  return (
                    <tr
                      key={f.colaborador_id}
                      className={cn(
                        "border-b border-border last:border-0",
                        sinCosto ? "bg-accent-soft" : desviado ? "bg-warning-soft" : "",
                      )}
                    >
                      <td className="px-4 py-2">
                        {f.colaborador}
                        {sinCosto ? (
                          <Badge tono="acento" className="ml-2">sin costo</Badge>
                        ) : desviado ? (
                          <Badge tono="alerta" className="ml-2">
                            {desvio > 0 ? "+" : ""}
                            {n(desvio)}%
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {editando === f.colaborador_id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              className="field num w-28 text-right"
                              value={monto}
                              onChange={(e) => setMonto(e.target.value)}
                              inputMode="decimal"
                              autoFocus
                            />
                            <Button
                              variante="primario"
                              cargando={guardar.isPending}
                              onClick={() =>
                                guardar.mutate({ colaboradorId: f.colaborador_id, valor: Number(monto) })
                              }
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variante="fantasma" onClick={() => setEditando(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Num className="tabular-nums">{soles(f.costo_mensual)}</Num>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(f.capacidad_bruta)}</Num></td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(f.horas_incidencia)}</Num></td>
                      <td className="px-4 py-2 text-right"><Num className="tabular-nums">{n(f.capacidad_productiva)}</Num></td>
                      <td className="px-4 py-2 text-right">
                        <Num className="tabular-nums font-semibold">{sinCosto ? "—" : soles(ch, 4)}</Num>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {editando === f.colaborador_id ? null : (
                          <Button
                            variante="secundario"
                            onClick={() => {
                              setEditando(f.colaborador_id);
                              setMonto(String(f.costo_mensual ?? ""));
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
