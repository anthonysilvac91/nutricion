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

/**
 * Fecha clínica de "hoy" según el calendario local del usuario (no UTC) -- para que al registrar
 * una evaluación "de hoy" en, por ejemplo, America/Santiago a las 23:00, quede fechada el mismo
 * día que el usuario ve en su reloj, no el día siguiente en UTC.
 */
export function todayClinicalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
