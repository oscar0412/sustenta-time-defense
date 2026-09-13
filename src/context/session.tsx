import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { sustenta, sustentaConfigurado } from "@/integrations/sustenta/client";
import type { Colaborador, Periodo, Rol } from "@/integrations/sustenta/types";

const CLAVE = "sustenta.colaborador";

interface SesionCtx {
  colaboradores: Colaborador[];
  colaborador: Colaborador | null;
  rol: Rol;
  setColaboradorId: (id: string) => void;
  periodoActivo: Periodo | null;
  periodos: Periodo[];
  cargando: boolean;
  configurado: boolean;
}

const Ctx = createContext<SesionCtx | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [colaboradorId, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(localStorage.getItem(CLAVE));
  }, []);

  const colaboradoresQ = useQuery({
    queryKey: ["colaboradores"],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("colaborador").select("*").limit(300);
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });

  const periodosQ = useQuery({
    queryKey: ["periodos"],
    enabled: sustentaConfigurado,
    queryFn: async () => {
      const { data, error } = await sustenta.from("periodo").select("*").limit(60);
      if (error) throw error;
      return (data ?? []) as Periodo[];
    },
  });

  const colaboradores = useMemo(() => colaboradoresQ.data ?? [], [colaboradoresQ.data]);
  const periodos = useMemo(() => {
    const lista = [...(periodosQ.data ?? [])];
    lista.sort((a, b) => String(b.fecha_inicio ?? b.codigo ?? "").localeCompare(String(a.fecha_inicio ?? a.codigo ?? "")));
    return lista;
  }, [periodosQ.data]);

  const colaborador = useMemo(
    () => colaboradores.find((c) => c.id === colaboradorId) ?? colaboradores[0] ?? null,
    [colaboradores, colaboradorId],
  );

  const periodoActivo = useMemo(
    () => periodos.find((p) => (p.estado ?? "").toLowerCase() === "abierto") ?? periodos[0] ?? null,
    [periodos],
  );

  const valor: SesionCtx = {
    colaboradores,
    colaborador,
    rol: (colaborador?.rol as Rol) ?? "colaborador",
    setColaboradorId: (id) => {
      localStorage.setItem(CLAVE, id);
      setId(id);
    },
    periodoActivo,
    periodos,
    cargando: colaboradoresQ.isLoading || periodosQ.isLoading,
    configurado: sustentaConfigurado,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion(): SesionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return ctx;
}
