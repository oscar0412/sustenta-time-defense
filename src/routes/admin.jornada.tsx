import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Jornada y feriados";
const D = "Configuración de jornada laboral y calendario de feriados.";

export const Route = createFileRoute("/admin/jornada")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
