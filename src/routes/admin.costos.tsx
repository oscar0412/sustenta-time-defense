import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Costos del personal";
const D = "Costo mensual por colaborador utilizado en la valorización.";

export const Route = createFileRoute("/admin/costos")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
