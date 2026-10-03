// Catálogos del SAT para CFDI 4.0 (los más usados en una imprenta).

export const REGIMENES_FISCALES = [
  ["601", "General de Ley Personas Morales"],
  ["603", "Personas Morales con Fines no Lucrativos"],
  ["605", "Sueldos y Salarios"],
  ["606", "Arrendamiento"],
  ["612", "Personas Físicas con Actividades Empresariales y Profesionales"],
  ["616", "Sin obligaciones fiscales"],
  ["621", "Incorporación Fiscal"],
  ["625", "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas"],
  ["626", "Régimen Simplificado de Confianza (RESICO)"],
] as const;

export const USOS_CFDI = [
  ["G01", "Adquisición de mercancías"],
  ["G03", "Gastos en general"],
  ["I08", "Otra maquinaria y equipo"],
  ["S01", "Sin efectos fiscales"],
  ["CP01", "Pagos"],
] as const;

export const RFC_VALIDO = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
