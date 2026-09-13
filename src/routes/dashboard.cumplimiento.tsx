import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Cumplimiento por empresa";
const D = "Avance de registro y sustento por empresa vinculada.";

export const Route = createFileRoute("/dashboard/cumplimiento")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
