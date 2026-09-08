export const periodos = [
  { key: '1s', label: '1 sem', labelLargo: '1 semana', days: 7 },
  { key: '1m', label: '1 mes', labelLargo: '1 mes', days: 30 },
  { key: '3m', label: '3 meses', labelLargo: '3 meses', days: 90 },
  { key: '6m', label: '6 meses', labelLargo: '6 meses', days: 180 },
  { key: '1a', label: '1 año', labelLargo: '1 año', days: 365 },
  { key: 'todo', label: 'Todo', labelLargo: 'Todo', days: null },
]

/**
 * Filters entries by period key and selected areas.
 * @param {Array} entradas - entries with { fecha, tipo_sesion }
 * @param {string} periodoKey - key from periodos array
 * @param {string[]|null} areas - selected tipo_sesion values, or null for all
 * @param {Date} [ahora] - reference "now" date (defaults to new Date())
 * @returns {Array} filtered entries
 */
export function filtrarEntradas(entradas, periodoKey, areas = null, ahora = new Date()) {
  let resultado = entradas

  const p = periodos.find((x) => x.key === periodoKey)
  if (p && p.days) {
    const desde = new Date(ahora)
    desde.setDate(desde.getDate() - p.days)
    desde.setHours(0, 0, 0, 0)
    resultado = resultado.filter((e) => new Date(e.fecha) >= desde)
  }

  if (areas !== null) {
    resultado = resultado.filter((e) => areas.includes(e.tipo_sesion))
  }

  return resultado
}
