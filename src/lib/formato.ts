export const COLORES = {
  ejecutado: "#0F6E56",
  advertencia: "#A9670C",
  alerta: "#DF3E3F",
  referencia: "#C9C6C0",
};

const nf = (d: number) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });

export function n(valor: unknown, decimales = 1): string {
  const v = Number(valor);
  if (valor === null || valor === undefined || Number.isNaN(v)) return "—";
  return nf(decimales).format(v);
}

export function soles(valor: unknown, decimales = 2): string {
  const v = Number(valor);
  if (valor === null || valor === undefined || Number.isNaN(v)) return "—";
  return `S/ ${nf(decimales).format(v)}`;
}

export function pct(valor: unknown, decimales = 1): string {
  const v = Number(valor);
  if (valor === null || valor === undefined || Number.isNaN(v)) return "—";
  return `${nf(decimales).format(v)}%`;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function etiquetaPeriodo(anio?: number | null, mes?: number | null): string {
  if (!anio || !mes) return "—";
  return `${MESES[mes - 1]} ${anio}`;
}

export function codigoPeriodo(anio?: number | null, mes?: number | null): string {
  if (!anio || !mes) return "—";
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/** Rango [inicio, fin] del mes en formato ISO. */
export function rangoMes(anio: number, mes: number): { inicio: string; fin: string } {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return {
    inicio: `${anio}-${String(mes).padStart(2, "0")}-01`,
    fin: `${anio}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`,
  };
}

export function esFinDeSemana(iso: string): boolean {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, (m ?? 1) - 1, d)).getUTCDay();
  return dia === 0 || dia === 6;
}

export function fechaCorta(iso?: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
