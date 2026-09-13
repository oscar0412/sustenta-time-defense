import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Eye,
  CircleDot,
  AlertCircle,
  LogOut,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { gruposPorRol, ROLES } from "@/lib/nav";
import { useSesion } from "@/context/session";
import { nombreColaborador, nombrePeriodo } from "@/integrations/sustenta/types";
import { Badge, Num } from "@/components/ui-kit";

function Sidebar() {
  const { rol } = useSesion();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const grupos = useMemo(() => gruposPorRol(rol), [rol]);
  const [abiertos, setAbiertos] = useState<string[]>([]);

  useEffect(() => {
    setAbiertos(grupos.map((g) => g.id));
  }, [grupos]);

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-accent">
          <ShieldCheck className="h-4 w-4 text-accent-foreground" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Sustenta</p>
          <p className="text-[11px] text-sidebar-muted">Claro Empresas</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {grupos.map((grupo) => {
          const abierto = abiertos.includes(grupo.id);
          return (
            <div key={grupo.id} className="mb-1">
              <button
                onClick={() =>
                  setAbiertos((prev) =>
                    prev.includes(grupo.id) ? prev.filter((g) => g !== grupo.id) : [...prev, grupo.id],
                  )
                }
                className="flex w-full items-center justify-between rounded-[6px] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted hover:bg-sidebar-elevated"
              >
                {grupo.label}
                {abierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {abierto ? (
                <ul className="mt-0.5 space-y-0.5">
                  {grupo.items.map((item) => {
                    const activo = pathname === item.to;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={cn(
                            "flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] transition-colors",
                            activo
                              ? "bg-sidebar-elevated font-semibold text-white"
                              : "text-sidebar-foreground hover:bg-sidebar-elevated hover:text-white",
                          )}
                        >
                          <item.icon
                            className={cn("h-4 w-4", activo ? "text-accent" : "text-sidebar-muted")}
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-muted">
        AC Corporativo del Perú S.A.C.
      </div>
    </aside>
  );
}

function Topbar() {
  const { colaborador, session, cerrarSesion, periodoActivo, rol } = useSesion();
  const alcance = ROLES.find((r) => r.valor === rol);
  const estado = (periodoActivo?.estado ?? "—").toLowerCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="label-xs">Periodo</span>
          <Num className="text-[13px] font-semibold">{nombrePeriodo(periodoActivo)}</Num>
          <Badge tono={estado === "abierto" ? "exito" : estado === "cerrado" ? "neutro" : "alerta"}>
            <CircleDot className="h-3 w-3" />
            {periodoActivo?.estado ?? "sin periodo"}
          </Badge>
        </div>
        <span className="h-5 w-px bg-border" />
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {alcance?.alcance ?? "Alcance limitado"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-[6px] p-2 text-muted-foreground hover:bg-surface-muted">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>
        <div className="flex items-center gap-3 border-l border-border pl-3">
          <div className="text-right leading-tight">
            <p className="text-[13px] font-semibold">{nombreColaborador(colaborador)}</p>
            <p className="text-[11px] text-muted-foreground">
              <span className="capitalize">{rol}</span>
              {session?.user?.email ? ` · ${session.user.email}` : ""}
            </p>
          </div>
          <button
            onClick={() => void cerrarSesion()}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border-strong px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-surface-muted"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}


export interface AccionRapida {
  label: string;
  to?: string;
  contador?: number;
  onClick?: () => void;
}

export function PageHeader({
  titulo,
  descripcion,
  acciones = [],
}: {
  titulo: string;
  descripcion?: string;
  acciones?: AccionRapida[];
}) {
  return (
    <div className="mb-5">
      <h1 className="text-[22px] font-semibold text-foreground">{titulo}</h1>
      {descripcion ? <p className="mt-1 text-[13px] text-muted-foreground">{descripcion}</p> : null}
      {acciones.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {acciones.map((a) => {
            const contenido = (
              <>
                {a.label}
                {a.contador ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground num">
                    {a.contador}
                  </span>
                ) : null}
              </>
            );
            const clase =
              "inline-flex items-center gap-1.5 rounded-[6px] border border-border-strong bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-surface-muted";
            return a.to ? (
              <Link key={a.label} to={a.to} className={clase}>
                {contenido}
              </Link>
            ) : (
              <button key={a.label} onClick={a.onClick} className={clase}>
                {contenido}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { configurado, session, autenticando } = useSesion();
  const navigate = useNavigate();

  useEffect(() => {
    if (!autenticando && !session) navigate({ to: "/auth", replace: true });
  }, [autenticando, session, navigate]);

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-[13px] text-muted-foreground">Verificando sesión…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {!configurado ? (
          <div className="flex items-center gap-2 border-b border-warning/20 bg-warning-soft px-5 py-2 text-[12px] text-warning">
            <AlertCircle className="h-4 w-4" />
            Falta la clave pública de la base de datos: la interfaz está lista pero no puede leer datos.
          </div>
        ) : null}
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
