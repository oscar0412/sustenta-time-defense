/** Estados de la unidad de aprobación (colaborador × proyecto × periodo). */

export type EstadoAprobacion = "sin_enviar" | "enviado" | "aprobado" | "observado";

export function normalizarEstado(estado?: string | null): EstadoAprobacion {
  const limpio = (estado ?? "").trim().toLowerCase();
  if (limpio === "enviado" || limpio === "aprobado" || limpio === "observado") return limpio;
  return "sin_enviar";
}

export const ETIQUETA_ESTADO: Record<EstadoAprobacion, string> = {
  sin_enviar: "Sin enviar",
  enviado: "Enviada",
  aprobado: "Aprobada",
  observado: "Observada",
};

export const TONO_ESTADO: Record<EstadoAprobacion, "neutro" | "alerta" | "exito" | "acento"> = {
  sin_enviar: "neutro",
  enviado: "alerta",
  aprobado: "exito",
  observado: "acento",
};

/** Enviado o aprobado bloquean cambios de horas en ese proyecto. */
export function bloqueaRegistro(estado?: string | null): boolean {
  const e = normalizarEstado(estado);
  return e === "enviado" || e === "aprobado";
}
