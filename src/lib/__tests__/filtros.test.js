import { describe, it, expect } from 'vitest'
import { filtrarEntradas, periodos } from '../filtros.js'

// Fixed reference date — use noon local time to avoid timezone edge issues
const AHORA = new Date(2026, 2, 15, 12, 0, 0) // March 15, 2026 12:00 local

function entrada(fechaStr, tipo_sesion = 'psicología') {
  return { fecha: fechaStr, tipo_sesion }
}

// Helper: create a local-time ISO string N days before AHORA at noon
function daysAgo(n) {
  const d = new Date(AHORA)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const ENTRADAS = [
  entrada(daysAgo(0)),    // today
  entrada(daysAgo(1)),    // 1 day ago
  entrada(daysAgo(5)),    // 5 days ago
  entrada(daysAgo(6)),    // 6 days ago (inside 1 week)
  entrada(daysAgo(8)),    // 8 days ago (outside 1 week)
  entrada(daysAgo(25)),   // inside 1 month
  entrada(daysAgo(29)),   // inside 1 month
  entrada(daysAgo(31)),   // outside 1 month
  entrada(daysAgo(85)),   // inside 3 months
  entrada(daysAgo(89)),   // inside 3 months
  entrada(daysAgo(91)),   // outside 3 months
  entrada(daysAgo(175)),  // inside 6 months
  entrada(daysAgo(181)),  // outside 6 months
  entrada(daysAgo(360)),  // inside 1 year
  entrada(daysAgo(364)),  // inside 1 year
  entrada(daysAgo(366)),  // outside 1 year
  entrada(daysAgo(800)),  // very old
]

describe('filtrarEntradas — período', () => {
  it('periodos array has all expected keys', () => {
    const keys = periodos.map((p) => p.key)
    expect(keys).toEqual(['1s', '1m', '3m', '6m', '1a', 'todo'])
  })

  it('"1s" returns entries from last 7 days', () => {
    const result = filtrarEntradas(ENTRADAS, '1s', null, AHORA)
    // 0d, 1d, 5d, 6d = 4 entries (8d is out)
    expect(result.length).toBe(4)
  })

  it('"1m" returns entries from last 30 days', () => {
    const result = filtrarEntradas(ENTRADAS, '1m', null, AHORA)
    // 0d, 1d, 5d, 6d, 8d, 25d, 29d = 7 entries (31d is out)
    expect(result.length).toBe(7)
  })

  it('"3m" returns entries from last 90 days', () => {
    const result = filtrarEntradas(ENTRADAS, '3m', null, AHORA)
    // previous 7 + 31d, 85d, 89d = 10 entries (91d is out)
    expect(result.length).toBe(10)
  })

  it('"6m" returns entries from last 180 days', () => {
    const result = filtrarEntradas(ENTRADAS, '6m', null, AHORA)
    // previous 10 + 91d, 175d = 12 entries (181d is out)
    expect(result.length).toBe(12)
  })

  it('"1a" returns entries from last 365 days', () => {
    const result = filtrarEntradas(ENTRADAS, '1a', null, AHORA)
    // previous 12 + 181d, 360d, 364d = 15 entries (366d is out)
    expect(result.length).toBe(15)
  })

  it('"todo" returns all entries', () => {
    const result = filtrarEntradas(ENTRADAS, 'todo', null, AHORA)
    expect(result.length).toBe(ENTRADAS.length)
  })

  it('empty entries returns empty', () => {
    expect(filtrarEntradas([], '3m', null, AHORA)).toEqual([])
    expect(filtrarEntradas([], 'todo', null, AHORA)).toEqual([])
  })

  it('unknown period key returns all (like "todo")', () => {
    const result = filtrarEntradas(ENTRADAS, 'unknown_key', null, AHORA)
    expect(result.length).toBe(ENTRADAS.length)
  })
})

describe('filtrarEntradas — área', () => {
  const mixed = [
    entrada(daysAgo(0), 'psicología'),
    entrada(daysAgo(1), 'fonoaudiología'),
    entrada(daysAgo(2), 'psicopedagogía'),
    entrada(daysAgo(3), 'terapia ocupacional'),
    entrada(daysAgo(4), 'kinesiología'),
    entrada(daysAgo(5), 'interdisciplinaria'),
    entrada(daysAgo(6), 'psicología'),
  ]

  it('null areas returns all (no area filter)', () => {
    const result = filtrarEntradas(mixed, 'todo', null, AHORA)
    expect(result.length).toBe(7)
  })

  it('single area filters correctly', () => {
    const result = filtrarEntradas(mixed, 'todo', ['psicología'], AHORA)
    expect(result.length).toBe(2)
    expect(result.every((e) => e.tipo_sesion === 'psicología')).toBe(true)
  })

  it('multiple areas filter correctly', () => {
    const result = filtrarEntradas(mixed, 'todo', ['psicología', 'fonoaudiología'], AHORA)
    expect(result.length).toBe(3)
  })

  it('empty areas array returns nothing', () => {
    const result = filtrarEntradas(mixed, 'todo', [], AHORA)
    expect(result.length).toBe(0)
  })
})

describe('filtrarEntradas — período + área combined', () => {
  const mixed = [
    entrada(daysAgo(0), 'psicología'),       // today
    entrada(daysAgo(1), 'fonoaudiología'),   // yesterday
    entrada(daysAgo(5), 'psicología'),       // 5d ago
    entrada(daysAgo(29), 'psicología'),      // 29d ago
    entrada(daysAgo(73), 'fonoaudiología'),  // 73d ago
    entrada(daysAgo(400), 'psicología'),     // old
  ]

  it('1 week + psicología returns only recent psicología', () => {
    const result = filtrarEntradas(mixed, '1s', ['psicología'], AHORA)
    expect(result.length).toBe(2) // today + 5d ago
  })

  it('1 month + fonoaudiología returns only recent fono', () => {
    const result = filtrarEntradas(mixed, '1m', ['fonoaudiología'], AHORA)
    expect(result.length).toBe(1) // yesterday only
  })

  it('3 months + all areas is same as 3 months without area filter', () => {
    const withNull = filtrarEntradas(mixed, '3m', null, AHORA)
    const withAll = filtrarEntradas(mixed, '3m', ['psicología', 'fonoaudiología'], AHORA)
    expect(withAll.length).toBe(withNull.length)
  })
})

describe('filtrarEntradas — boundary: exact cutoff', () => {
  // cutoff for "1s" from AHORA: 7 days back, at local midnight
  const cutoff = new Date(AHORA)
  cutoff.setDate(cutoff.getDate() - 7)
  cutoff.setHours(0, 0, 0, 0)

  it('entry at exactly the cutoff is included (>=)', () => {
    const borderEntry = [entrada(cutoff.toISOString())]
    const result = filtrarEntradas(borderEntry, '1s', null, AHORA)
    expect(result.length).toBe(1)
  })

  it('entry 1ms before cutoff is excluded', () => {
    const beforeCutoff = new Date(cutoff.getTime() - 1)
    const borderEntry = [entrada(beforeCutoff.toISOString())]
    const result = filtrarEntradas(borderEntry, '1s', null, AHORA)
    expect(result.length).toBe(0)
  })
})
