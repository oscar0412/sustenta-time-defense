import { createFileRoute } from "@tanstack/react-router";
import { Proximamente, metaProximamente } from "@/components/Proximamente";

const T = "Proyectos";
const D = "Catálogo de proyectos intragrupo y su empresa receptora.";

export const Route = createFileRoute("/proyectos/")({
  head: () => metaProximamente(T, D),
  component: () => <Proximamente titulo={T} descripcion={D} />,
});
