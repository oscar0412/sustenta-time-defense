import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Capacidad del equipo";
const D = "Uso de capacidad por colaborador y proyecto.";

export const Route = createFileRoute("/dashboard/capacidad")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
