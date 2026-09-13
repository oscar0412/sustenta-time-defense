import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Card, Vacio } from "@/components/ui-kit";

export const Route = createFileRoute("/horas/capacidad")({
  head: () => ({
    meta: [
      { title: "Mi capacidad — Sustenta" },
      { name: "description", content: "Capacidad disponible y dedicación comprometida del colaborador." },
      { property: "og:title", content: "Mi capacidad — Sustenta" },
      { property: "og:description", content: "Capacidad disponible y dedicación comprometida." },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader titulo="Mi capacidad" descripcion="Dedicación comprometida frente a horas disponibles." />
      <Card>
        <Vacio mensaje="Esta pantalla llega en la siguiente entrega." />
      </Card>
    </AppShell>
  ),
});
