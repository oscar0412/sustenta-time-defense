import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Liquidación";
const D = "Valorización de horas por empresa vinculada y periodo.";

export const Route = createFileRoute("/admin/liquidacion")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
