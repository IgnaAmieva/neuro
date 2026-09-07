import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { tipoSesionLabel, tiposSesion, especialidadColor } from '../lib/especialidades.js'

const periodos = [
  { key: '1s', label: '1 semana', days: 7 },
  { key: '1m', label: '1 mes', days: 30 },
  { key: '3m', label: '3 meses', days: 90 },
  { key: '6m', label: '6 meses', days: 180 },
  { key: '1a', label: '1 año', days: 365 },
  { key: 'todo', label: 'Todo', days: null },
]

export default function GenerarInforme({ paciente, entradas, onClose }) {
  const { profesional } = useAuth()
  const [paso, setPaso] = useState('config') // config | generando | editor
  const [periodoInforme, setPeriodoInforme] = useState('3m')
  const [areasInforme, setAreasInforme] = useState(() => tiposSesion.map((t) => t.value))
  const [destinatario, setDestinatario] = useState('')
  const [informe, setInforme] = useState('')
  const [error, setError] = useState(null)

  const entradasFiltradas = useMemo(() => {
    let resultado = entradas
    const p = periodos.find((x) => x.key === periodoInforme)
    if (p && p.days) {
      const desde = new Date()
      desde.setDate(desde.getDate() - p.days)
      desde.setHours(0, 0, 0, 0)
      resultado = resultado.filter((e) => new Date(e.fecha) >= desde)
    }
    if (areasInforme.length < tiposSesion.length) {
      resultado = resultado.filter((e) => areasInforme.includes(e.tipo_sesion))
    }
    return resultado
  }, [entradas, periodoInforme, areasInforme])

  const todasAreasSeleccionadas = areasInforme.length === tiposSesion.length

  function toggleAreaInforme(value) {
    setAreasInforme((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev
        return prev.filter((a) => a !== value)
      }
      return [...prev, value]
    })
  }

  function filtroResumen() {
    const periodoLabel = periodos.find((p) => p.key === periodoInforme)?.label || ''
    const areasLabel = todasAreasSeleccionadas
      ? 'todas las áreas'
      : areasInforme.map((a) => tipoSesionLabel[a] || a).join(', ')
    return `${periodoLabel} · ${areasLabel}`
  }

  function fechaRango() {
    if (entradasFiltradas.length === 0) return 'Sin entradas'
    const fechas = entradasFiltradas.map((e) => new Date(e.fecha)).sort((a, b) => a - b)
    const fmt = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${fmt(fechas[0])} — ${fmt(fechas[fechas.length - 1])}`
  }

  async function handleGenerar() {
    if (entradasFiltradas.length === 0) {
      setError('No hay entradas en el período seleccionado.')
      return
    }
    setError(null)
    setPaso('generando')

    // Fetch active objectives
    const { data: objetivos } = await supabase
      .from('objetivos')
      .select('*, creador:profesionales!creado_por ( nombre )')
      .eq('paciente_id', paciente.id)
      .in('estado', ['en progreso', 'pausado'])

    const payload = {
      paciente: {
        nombre: paciente.nombre,
        fecha_nacimiento: paciente.fecha_nacimiento,
        diagnostico: paciente.diagnostico,
      },
      entradas: entradasFiltradas
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .map((e) => ({
          fecha: new Date(e.fecha).toLocaleDateString('es-AR'),
          tipo_sesion: tipoSesionLabel[e.tipo_sesion] || e.tipo_sesion,
          profesional_nombre: e.profesional?.nombre,
          especialidad: tipoSesionLabel[e.profesional?.especialidad] || e.profesional?.especialidad,
          contenido: e.contenido,
          conceptos_clave: e.conceptos_clave,
        })),
      objetivos: (objetivos || []).map((o) => ({
        descripcion: o.descripcion,
        plazo: o.plazo,
        estado: o.estado,
        fecha_inicio: o.fecha_inicio,
      })),
      destinatario: destinatario.trim() || null,
    }

    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'generar-informe',
        { body: payload },
      )

      if (fnErr) throw new Error(fnErr.message)
      if (data?.error) throw new Error(data.error)

      setInforme(data.informe)
      setPaso('editor')
    } catch (err) {
      setError('Error al generar informe: ' + err.message)
      setPaso('config')
    }
  }

  async function handleDescargarPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginL = 20
    const marginR = 20
    const maxW = pageW - marginL - marginR
    let y = 20

    function checkPage(needed = 12) {
      if (y + needed > pageH - 20) {
        doc.addPage()
        y = 20
      }
    }

    function writeLines(text, fontSize, opts = {}) {
      const { bold, color, lineHeight } = { bold: false, color: [47, 54, 43], lineHeight: 1.4, ...opts }
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(text, maxW)
      const lh = fontSize * 0.3528 * lineHeight // mm per line
      for (const line of lines) {
        checkPage(lh + 2)
        doc.text(line, marginL, y)
        y += lh
      }
    }

    // Header
    doc.setFillColor(42, 111, 103) // teal-600
    doc.rect(0, 0, pageW, 36, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Neuroestima', marginL, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Informe clínico interdisciplinario', marginL, 23)
    doc.text(`Generado: ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`, marginL, 29)
    if (profesional?.nombre) {
      doc.text(`Profesional: ${profesional.nombre}`, pageW - marginR, 29, { align: 'right' })
    }
    y = 46

    // Patient data box
    doc.setDrawColor(209, 215, 203) // sage-200
    doc.setFillColor(246, 247, 245) // sage-50
    doc.roundedRect(marginL, y, maxW, 28, 3, 3, 'FD')
    y += 7
    writeLines(`Paciente: ${paciente.nombre}`, 10, { bold: true })
    y += 1
    const edad = Math.floor((new Date() - new Date(paciente.fecha_nacimiento)) / 31557600000)
    writeLines(`Fecha de nacimiento: ${new Date(paciente.fecha_nacimiento).toLocaleDateString('es-AR')} (${edad} años)`, 9, { color: [110, 127, 96] })
    if (paciente.diagnostico) {
      writeLines(`Diagnóstico: ${paciente.diagnostico}`, 9, { color: [110, 127, 96] })
    }
    y += 3
    writeLines(`Filtro: ${filtroResumen()} — ${fechaRango()} — ${entradasFiltradas.length} entradas`, 8, { color: [141, 155, 128] })
    if (destinatario.trim()) {
      writeLines(`Destinatario: ${destinatario}`, 8, { color: [141, 155, 128] })
    }
    y += 8

    // Divider
    doc.setDrawColor(209, 215, 203)
    doc.line(marginL, y, pageW - marginR, y)
    y += 8

    // Informe body
    const paragraphs = informe.split('\n')
    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (!trimmed) { y += 3; continue }
      if (trimmed.startsWith('## ')) {
        y += 4
        writeLines(trimmed.replace('## ', ''), 12, { bold: true, color: [42, 111, 103] })
        y += 2
      } else if (trimmed.startsWith('### ')) {
        y += 3
        writeLines(trimmed.replace('### ', ''), 10, { bold: true })
        y += 1
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        y += 2
        writeLines(trimmed.replace(/\*\*/g, ''), 10, { bold: true })
        y += 1
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        writeLines('  •  ' + trimmed.slice(2), 9)
        y += 1
      } else {
        writeLines(trimmed.replace(/\*\*/g, ''), 9)
        y += 1
      }
    }

    // Entries appendix
    doc.addPage()
    y = 20
    doc.setFillColor(42, 111, 103)
    doc.rect(0, 0, pageW, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Respaldo: entradas de historia clínica', marginL, 10)
    y = 24

    const sorted = [...entradasFiltradas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    for (const entrada of sorted) {
      checkPage(20)
      // Entry header
      doc.setDrawColor(209, 215, 203)
      doc.setFillColor(246, 247, 245)
      doc.roundedRect(marginL, y, maxW, 6, 1, 1, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(57, 66, 51)
      const fechaStr = new Date(entrada.fecha).toLocaleDateString('es-AR')
      const tipoStr = tipoSesionLabel[entrada.tipo_sesion] || entrada.tipo_sesion
      doc.text(`${fechaStr}  —  ${tipoStr}  —  ${entrada.profesional?.nombre || ''}`, marginL + 2, y + 4)
      y += 9

      // Entry content
      writeLines(entrada.contenido, 8, { color: [57, 66, 51], lineHeight: 1.35 })

      if (entrada.conceptos_clave?.length) {
        y += 1
        writeLines('Conceptos: ' + entrada.conceptos_clave.join(', '), 7, { color: [141, 155, 128] })
      }
      y += 5
    }

    // Footer on last page
    const totalPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(141, 155, 128)
      doc.text(
        `Neuroestima — Informe de ${paciente.nombre} — Página ${i} de ${totalPages}`,
        pageW / 2, pageH - 8, { align: 'center' },
      )
    }

    const fileName = `Informe_${paciente.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(fileName)
  }

  const inputClasses =
    'w-full rounded-lg border border-sage-300 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-sage-950/40 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl border border-sage-200 shadow-xl w-full max-w-3xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sage-200">
          <h3 className="font-display text-lg font-medium text-sage-900">Generar informe</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sage-400 hover:text-sage-600 hover:bg-sage-100 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Config */}
          {paso === 'config' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  Período de entradas a incluir
                </label>
                <div className="flex flex-wrap rounded-lg border border-sage-300 overflow-hidden text-xs w-fit">
                  {periodos.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPeriodoInforme(p.key)}
                      className={`px-3 py-2 transition-colors cursor-pointer ${
                        periodoInforme === p.key
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-sage-600 hover:bg-sage-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-sage-400 mt-2">
                  {entradasFiltradas.length} entrada{entradasFiltradas.length !== 1 ? 's' : ''} en este período
                  {entradasFiltradas.length > 0 && ` — ${fechaRango()}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  Áreas a incluir
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      setAreasInforme(
                        todasAreasSeleccionadas ? [tiposSesion[0].value] : tiposSesion.map((t) => t.value),
                      )
                    }
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                      todasAreasSeleccionadas
                        ? 'bg-sage-800 text-white border-sage-800'
                        : 'bg-white text-sage-500 border-sage-300 hover:border-sage-400'
                    }`}
                  >
                    Todas
                  </button>
                  {tiposSesion.map((t) => {
                    const activa = areasInforme.includes(t.value)
                    return (
                      <button
                        key={t.value}
                        onClick={() => toggleAreaInforme(t.value)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          activa
                            ? (especialidadColor[t.value] || 'bg-sage-100 text-sage-700') + ' border-transparent'
                            : 'bg-white text-sage-400 border-sage-200 hover:border-sage-300'
                        }`}
                      >
                        {t.short}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="destinatario" className="block text-sm font-medium text-sage-700 mb-1.5">
                  Destinatario del informe <span className="text-sage-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="destinatario"
                  type="text"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder='Ej: "informe para neuróloga", "devolución para la familia"'
                  className={inputClasses}
                />
                <p className="text-xs text-sage-400 mt-1.5">
                  Esto ayuda a la IA a adaptar el tono y tecnicismo del informe.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-sage-600 hover:bg-sage-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerar}
                  disabled={entradasFiltradas.length === 0}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5.5-4 7.5V19a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2.5C6.5 14.5 5 12 5 9a7 7 0 0 1 7-7z" />
                    <path d="M9 22h6" />
                  </svg>
                  Generar con IA
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Generating */}
          {paso === 'generando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-10 w-10 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
              <div className="text-center">
                <p className="text-sage-700 font-medium">Generando informe...</p>
                <p className="text-sage-400 text-sm mt-1">
                  Analizando {entradasFiltradas.length} entradas con IA
                </p>
                <p className="text-sage-400 text-xs mt-0.5">
                  {filtroResumen()}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Editor */}
          {paso === 'editor' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-sage-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                {filtroResumen()} · {entradasFiltradas.length} entradas · Revisá y editá antes de descargar.
              </div>

              <textarea
                value={informe}
                onChange={(e) => setInforme(e.target.value)}
                rows={18}
                className={inputClasses + ' resize-y font-mono text-xs leading-relaxed'}
              />

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
                <button
                  onClick={() => setPaso('config')}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-sage-600 hover:bg-sage-100 transition-colors cursor-pointer"
                >
                  Volver a configurar
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleGenerar}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-sage-600 border border-sage-300 hover:border-teal-400 hover:text-teal-700 transition-colors cursor-pointer"
                  >
                    Regenerar
                  </button>
                  <button
                    onClick={handleDescargarPDF}
                    className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Descargar PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
