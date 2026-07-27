/**
 * Formatea una fecha clínica (YYYY-MM-DD, un día de calendario, no un instante) para mostrarla
 * en pantalla. Ancla al mediodía UTC y formatea con timeZone: "UTC" para que la fecha nunca se
 * desplace por la zona horaria del navegador (p.ej. America/Santiago mostrando el día anterior).
 * No usar `new Date(clinicalDateString)` directamente para mostrar estas fechas.
 */
export function formatClinicalDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
