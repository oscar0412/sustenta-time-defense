import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Periodos";
const D = "Checklist de cierre y bloqueo de periodos mensuales.";

export const Route = createFileRoute("/admin/periodos")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
