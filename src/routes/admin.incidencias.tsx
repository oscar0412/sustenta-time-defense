import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Incidencias del personal";
const D = "Vacaciones, licencias y ausencias que afectan la capacidad.";

export const Route = createFileRoute("/admin/incidencias")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
