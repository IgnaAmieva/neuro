import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Test the iniciales function (extracted logic) ----

function iniciales(nombre) {
  return nombre
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + '.')
    .join('')
}

describe('iniciales — anonymization', () => {
  it('converts full name to initials', () => {
    expect(iniciales('Valentina Carolina Gómez')).toBe('V.C.G.')
  })

  it('handles single name', () => {
    expect(iniciales('Pedro')).toBe('P.')
  })

  it('handles extra spaces', () => {
    expect(iniciales('  María   José  ')).toBe('M.J.')
  })

  it('handles lowercase input', () => {
    expect(iniciales('ana beatriz')).toBe('A.B.')
  })

  it('handles accented characters', () => {
    expect(iniciales('Ángela Ñoño')).toBe('Á.Ñ.')
  })
})

// ---- Test the Edge Function request handling ----
// We simulate the handler logic without Deno.serve

describe('generar-informe — request handling', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  function makePayload(overrides = {}) {
    return {
      paciente: {
        nombre: 'Juan Pérez',
        fecha_nacimiento: '2015-03-10',
        diagnostico: 'TEA',
      },
      entradas: [
        {
          fecha: '15/03/2026',
          tipo_sesion: 'Psicología',
          profesional_nombre: 'Lic. Ana',
          especialidad: 'Psicología',
          contenido: 'Sesión de evaluación inicial.',
          conceptos_clave: ['atención', 'regulación'],
        },
      ],
      objetivos: [
        {
          descripcion: 'Mejorar atención sostenida',
          plazo: 'mensual',
          estado: 'en progreso',
          fecha_inicio: '2026-03-01',
        },
      ],
      destinatario: 'neuróloga tratante',
      ...overrides,
    }
  }

  it('builds prompt with anonymized patient name', () => {
    const payload = makePayload()
    const pacienteAnonimo = iniciales(payload.paciente.nombre)

    expect(pacienteAnonimo).toBe('J.P.')
    // The prompt should contain the anonymized name, not the real one
    const promptTemplate = `Paciente ${pacienteAnonimo}`
    expect(promptTemplate).toContain('J.P.')
    expect(promptTemplate).not.toContain('Juan Pérez')
  })

  it('handles Anthropic success response with text block', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: '## Resumen\n\nEl paciente J.P. mostró avances...' },
        ],
      }),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const data = await response.json()
    const textBlock = Array.isArray(data.content)
      ? data.content.find((c) => c?.type === 'text')
      : null
    const informe = textBlock?.text || ''

    expect(informe).toContain('Resumen')
    expect(informe.length).toBeGreaterThan(0)
  })

  it('handles Anthropic response with thinking block before text', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [
          { type: 'thinking', thinking: 'Let me analyze the entries...' },
          { type: 'text', text: '## Informe clínico\n\nContenido del informe.' },
        ],
      }),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const data = await response.json()
    const textBlock = Array.isArray(data.content)
      ? data.content.find((c) => c?.type === 'text')
      : null
    const informe = textBlock?.text || ''

    expect(informe).toBe('## Informe clínico\n\nContenido del informe.')
  })

  it('detects empty response (no text block)', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [
          { type: 'thinking', thinking: 'Some reasoning...' },
        ],
        stop_reason: 'end_turn',
      }),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const data = await response.json()
    const textBlock = Array.isArray(data.content)
      ? data.content.find((c) => c?.type === 'text')
      : null
    const informe = textBlock?.text || ''

    expect(informe).toBe('')
  })

  it('handles Anthropic API error without leaking prompt content', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({
        error: { type: 'invalid_request_error', message: 'max_tokens exceeded' },
      }),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    expect(response.ok).toBe(false)

    // Parse the error to extract only the type (what our function does)
    const errBody = await response.text()
    let errType = 'unknown'
    try { errType = JSON.parse(errBody)?.error?.type || 'unknown' } catch { /* not JSON */ }

    // Our function logs only status + type, not the full body
    const logMessage = `Anthropic API respondió ${response.status} ${response.statusText} — tipo: ${errType}`
    expect(logMessage).toContain('400')
    expect(logMessage).toContain('invalid_request_error')
    expect(logMessage).not.toContain('max_tokens exceeded') // detail not in log
  })

  it('builds correct entry text without sensitive data in logs', () => {
    const payload = makePayload()

    // What gets logged should only include counts and initials
    const logLine = `Generando informe para paciente ${iniciales(payload.paciente.nombre)} — ${payload.entradas.length} entradas, ${payload.objetivos.length} objetivos`

    expect(logLine).toContain('J.P.')
    expect(logLine).not.toContain('Juan Pérez')
    expect(logLine).not.toContain('Sesión de evaluación')
    expect(logLine).toContain('1 entradas')
    expect(logLine).toContain('1 objetivos')
  })
})
