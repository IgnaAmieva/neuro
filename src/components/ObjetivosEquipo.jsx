import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'

const plazos = [
  { value: 'mensual', label: 'Mensuales', icon: '1M' },
  { value: '3 meses', label: 'Trimestrales', icon: '3M' },
  { value: '6 meses', label: 'Semestrales', icon: '6M' },
  { value: 'anual', label: 'Anuales', icon: '1A' },
]

const estadoConfig = {
  'en progreso': { label: 'En progreso', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  'logrado': { label: 'Logrado', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  'pausado': { label: 'Pausado', bg: 'bg-sage-200', text: 'text-sage-600', dot: 'bg-sage-400' },
}

const estados = ['en progreso', 'logrado', 'pausado']

export default function ObjetivosEquipo({ pacienteId }) {
  const { profesional } = useAuth()
  const [objetivos, setObjetivos] = useState([])
  const [historial, setHistorial] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [form, setForm] = useState({
    descripcion: '',
    plazo: '',
    fecha_inicio: todayISO(),
  })

  function todayISO() {
    const d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }

  useEffect(() => {
    loadObjetivos()
  }, [pacienteId])

  async function loadObjetivos() {
    setLoading(true)
    const { data } = await supabase
      .from('objetivos')
      .select('*, creador:profesionales!creado_por ( id, nombre, especialidad )')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
    setObjetivos(data || [])
    setLoading(false)
  }

  async function loadHistorial(objetivoId) {
    if (historial[objetivoId]) {
      setExpandedId(expandedId === objetivoId ? null : objetivoId)
      return
    }
    const { data } = await supabase
      .from('objetivo_historial')
      .select('*, profesional:profesionales!cambiado_por ( id, nombre )')
      .eq('objetivo_id', objetivoId)
      .order('fecha', { ascending: false })
    setHistorial((h) => ({ ...h, [objetivoId]: data || [] }))
    setExpandedId(objetivoId)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    if (!form.plazo) {
      setError('Seleccioná un plazo.')
      return
    }
    setGuardando(true)
    const { error: err } = await supabase
      .from('objetivos')
      .insert({
        paciente_id: pacienteId,
        descripcion: form.descripcion,
        plazo: form.plazo,
        fecha_inicio: form.fecha_inicio,
        creado_por: profesional.id,
      })
    setGuardando(false)
    if (err) {
      setError('Error al crear objetivo: ' + err.message)
      return
    }
    setShowForm(false)
    setForm({ descripcion: '', plazo: '', fecha_inicio: todayISO() })
    loadObjetivos()
  }

  async function cambiarEstado(objetivo, nuevoEstado) {
    if (nuevoEstado === objetivo.estado) return
    const estadoAnterior = objetivo.estado

    // Update objetivo
    const { error: updErr } = await supabase
      .from('objetivos')
      .update({ estado: nuevoEstado })
      .eq('id', objetivo.id)
    if (updErr) {
      setError('Error al actualizar estado: ' + updErr.message)
      return
    }

    // Insert historial entry
    await supabase.from('objetivo_historial').insert({
      objetivo_id: objetivo.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: nuevoEstado,
      cambiado_por: profesional.id,
    })

    // Refresh historial if expanded
    if (expandedId === objetivo.id) {
      setHistorial((h) => ({ ...h, [objetivo.id]: undefined }))
      loadHistorial(objetivo.id)
    }

    loadObjetivos()
  }

  const agrupados = useMemo(() => {
    let filtered = objetivos
    if (filtroEstado === 'activos') filtered = filtered.filter((o) => o.estado !== 'logrado')
    else if (filtroEstado === 'logrados') filtered = filtered.filter((o) => o.estado === 'logrado')

    const groups = {}
    for (const plazo of plazos) {
      const items = filtered.filter((o) => o.plazo === plazo.value)
      if (items.length > 0) groups[plazo.value] = items
    }
    return groups
  }, [objetivos, filtroEstado])

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatFechaCorta(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    })
  }

  function formatFechaHora(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const inputClasses =
    'w-full rounded-lg border border-sage-300 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors'

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider">
          Objetivos del equipo ({objetivos.length})
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-sage-300 overflow-hidden text-xs">
            {[
              { key: 'activos', label: 'Activos' },
              { key: 'todos', label: 'Todos' },
              { key: 'logrados', label: 'Logrados' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltroEstado(f.key)}
                className={`px-3 py-1.5 transition-colors cursor-pointer ${
                  filtroEstado === f.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-sage-600 hover:bg-sage-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuevo objetivo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      {/* New objective form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-sage-200 p-6 mb-6">
          <h4 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-5">Nuevo objetivo</h4>
          <div className="space-y-5">
            <div>
              <label htmlFor="obj-desc" className="block text-sm font-medium text-sage-700 mb-1.5">
                Descripción del objetivo
              </label>
              <textarea
                id="obj-desc"
                required
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Lograr regulación emocional en contexto de aula..."
                className={inputClasses + ' resize-y'}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="obj-plazo" className="block text-sm font-medium text-sage-700 mb-1.5">
                  Plazo
                </label>
                <select
                  id="obj-plazo"
                  required
                  value={form.plazo}
                  onChange={(e) => setForm((f) => ({ ...f, plazo: e.target.value }))}
                  className={`${inputClasses} ${!form.plazo ? 'text-sage-400' : ''}`}
                >
                  <option value="" disabled>Elegir plazo...</option>
                  {plazos.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="obj-fecha" className="block text-sm font-medium text-sage-700 mb-1.5">
                  Fecha de inicio
                </label>
                <input
                  id="obj-fecha"
                  type="date"
                  required
                  value={form.fecha_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-sage-600 hover:bg-sage-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer"
            >
              {guardando ? 'Creando...' : 'Crear objetivo'}
            </button>
          </div>
        </form>
      )}

      {/* Grouped objectives */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
        </div>
      ) : Object.keys(agrupados).length === 0 ? (
        <div className="text-center py-12 text-sage-400 text-sm">
          {filtroEstado === 'logrados'
            ? 'No hay objetivos logrados aún.'
            : 'No hay objetivos cargados.'}
        </div>
      ) : (
        <div className="space-y-8">
          {plazos.map((plazo) => {
            const items = agrupados[plazo.value]
            if (!items) return null
            return (
              <div key={plazo.value}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-lg bg-warm-100 flex items-center justify-center text-warm-700 text-xs font-semibold">
                    {plazo.icon}
                  </span>
                  <div>
                    <h4 className="text-sm font-medium text-sage-800">{plazo.label}</h4>
                    <p className="text-xs text-sage-400">{items.length} objetivo{items.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Objectives in this group */}
                <div className="space-y-3 ml-[48px]">
                  {items.map((obj) => {
                    const est = estadoConfig[obj.estado]
                    const isExpanded = expandedId === obj.id
                    const hist = historial[obj.id]
                    return (
                      <div
                        key={obj.id}
                        className="bg-white rounded-xl border border-sage-200 overflow-hidden"
                      >
                        <div className="p-4">
                          {/* Status + description */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${est.dot}`} />
                            <p className="text-sm text-sage-800 leading-relaxed flex-1">
                              {obj.descripcion}
                            </p>
                          </div>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ml-[22px]">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${est.bg} ${est.text}`}>
                              {est.label}
                            </span>
                            <span className="text-xs text-sage-400">
                              Inicio: {formatFechaCorta(obj.fecha_inicio)}
                            </span>
                            <span className="text-xs text-sage-400">
                              Creado por {obj.creador?.nombre}
                            </span>
                          </div>

                          {/* State change buttons + history toggle */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 ml-[22px]">
                            {estados
                              .filter((e) => e !== obj.estado)
                              .map((nuevoEstado) => {
                                const cfg = estadoConfig[nuevoEstado]
                                return (
                                  <button
                                    key={nuevoEstado}
                                    onClick={() => cambiarEstado(obj, nuevoEstado)}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${cfg.bg} ${cfg.text} border-transparent hover:border-current`}
                                  >
                                    Marcar {cfg.label.toLowerCase()}
                                  </button>
                                )
                              })}
                            <button
                              onClick={() => loadHistorial(obj.id)}
                              className="text-xs text-sage-400 hover:text-sage-600 transition-colors cursor-pointer ml-auto"
                            >
                              {isExpanded ? 'Ocultar historial' : 'Ver historial'}
                            </button>
                          </div>
                        </div>

                        {/* History panel */}
                        {isExpanded && (
                          <div className="border-t border-sage-100 bg-sage-50/50 px-4 py-3">
                            {!hist ? (
                              <div className="flex justify-center py-2">
                                <div className="h-4 w-4 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
                              </div>
                            ) : hist.length === 0 ? (
                              <p className="text-xs text-sage-400 italic">Sin cambios de estado registrados.</p>
                            ) : (
                              <div className="space-y-2">
                                {hist.map((h) => {
                                  const desde = estadoConfig[h.estado_anterior]
                                  const hasta = estadoConfig[h.estado_nuevo]
                                  return (
                                    <div key={h.id} className="flex items-center gap-2 text-xs">
                                      <span className="text-sage-400 shrink-0">{formatFechaHora(h.fecha)}</span>
                                      <span className="text-sage-500">&mdash;</span>
                                      <span className="text-sage-600">{h.profesional?.nombre}</span>
                                      <span className={`px-1.5 py-0.5 rounded ${desde.bg} ${desde.text}`}>{desde.label}</span>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sage-400 shrink-0">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                      </svg>
                                      <span className={`px-1.5 py-0.5 rounded ${hasta.bg} ${hasta.text}`}>{hasta.label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
