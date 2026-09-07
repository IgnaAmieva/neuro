import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { especialidades, especialidadLabel, especialidadColor } from '../lib/especialidades.js'

const plazos = [
  { value: 'mensual', label: 'Mensual', icon: '1M' },
  { value: '3 meses', label: 'Trimestral', icon: '3M' },
  { value: '6 meses', label: 'Semestral', icon: '6M' },
  { value: 'anual', label: 'Anual', icon: '1A' },
]

const estadoConfig = {
  'en progreso': { label: 'En progreso', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  'logrado': { label: 'Logrado', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  'pausado': { label: 'Pausado', bg: 'bg-sage-200', text: 'text-sage-600', dot: 'bg-sage-400' },
}

const estados = ['en progreso', 'logrado', 'pausado']

function todayISO() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function ObjetivosEquipo({ pacienteId }) {
  const { profesional } = useAuth()
  const [objetivos, setObjetivos] = useState([])
  const [historial, setHistorial] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('activos')

  // Inline form state: { plazo, area } identifies the cell being edited
  const [editingCell, setEditingCell] = useState(null) // { plazo, area, objetivo? }
  const [cellForm, setCellForm] = useState({ descripcion: '', fecha_inicio: todayISO() })
  const [guardando, setGuardando] = useState(false)

  const miArea = profesional?.especialidad

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

  function startCreate(plazo, area) {
    setEditingCell({ plazo, area })
    setCellForm({ descripcion: '', fecha_inicio: todayISO() })
  }

  function startEdit(objetivo) {
    setEditingCell({ plazo: objetivo.plazo, area: objetivo.area, objetivo })
    setCellForm({ descripcion: objetivo.descripcion, fecha_inicio: objetivo.fecha_inicio })
  }

  function cancelEdit() {
    setEditingCell(null)
    setCellForm({ descripcion: '', fecha_inicio: todayISO() })
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)

    if (editingCell.objetivo) {
      // Update
      const { error: err } = await supabase
        .from('objetivos')
        .update({
          descripcion: cellForm.descripcion,
          fecha_inicio: cellForm.fecha_inicio,
        })
        .eq('id', editingCell.objetivo.id)
      if (err) {
        setError('Error al actualizar: ' + err.message)
        setGuardando(false)
        return
      }
    } else {
      // Create
      const { error: err } = await supabase
        .from('objetivos')
        .insert({
          paciente_id: pacienteId,
          descripcion: cellForm.descripcion,
          plazo: editingCell.plazo,
          area: editingCell.area,
          fecha_inicio: cellForm.fecha_inicio,
          creado_por: profesional.id,
        })
      if (err) {
        setError('Error al crear objetivo: ' + err.message)
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    cancelEdit()
    loadObjetivos()
  }

  async function cambiarEstado(objetivo, nuevoEstado) {
    if (nuevoEstado === objetivo.estado) return
    const estadoAnterior = objetivo.estado

    const { error: updErr } = await supabase
      .from('objetivos')
      .update({ estado: nuevoEstado })
      .eq('id', objetivo.id)
    if (updErr) {
      setError('Error al actualizar estado: ' + updErr.message)
      return
    }

    await supabase.from('objetivo_historial').insert({
      objetivo_id: objetivo.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: nuevoEstado,
      cambiado_por: profesional.id,
    })

    if (expandedId === objetivo.id) {
      setHistorial((h) => ({ ...h, [objetivo.id]: undefined }))
      loadHistorial(objetivo.id)
    }

    loadObjetivos()
  }

  // Build a lookup: { [plazo]: { [area]: objetivo } }
  const grilla = useMemo(() => {
    let filtered = objetivos
    if (filtroEstado === 'activos') filtered = filtered.filter((o) => o.estado !== 'logrado')
    else if (filtroEstado === 'logrados') filtered = filtered.filter((o) => o.estado === 'logrado')

    const g = {}
    for (const p of plazos) {
      g[p.value] = {}
      for (const esp of especialidades) {
        const obj = filtered.find((o) => o.plazo === p.value && o.area === esp.value)
        if (obj) g[p.value][esp.value] = obj
      }
    }
    return g
  }, [objetivos, filtroEstado])

  // Which areas actually have any objectives (or is it the user's area)?
  const areasActivas = useMemo(() => {
    const withData = new Set()
    if (miArea) withData.add(miArea)
    for (const obj of objetivos) {
      if (obj.area) withData.add(obj.area)
    }
    return especialidades.filter((e) => withData.has(e.value))
  }, [objetivos, miArea])

  const hasAnyData = objetivos.length > 0

  function formatFechaCorta(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }

  function formatFechaHora(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const inputClasses =
    'w-full rounded-lg border border-sage-300 bg-sage-50/50 px-3 py-2 text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors'

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider">
          Objetivos por área ({objetivos.length})
        </h3>
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
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      {!hasAnyData && !editingCell ? (
        <div className="text-center py-12 text-sage-400 text-sm">
          No hay objetivos cargados. Usá los botones "+" en tu columna para agregar.
        </div>
      ) : null}

      {/* Grid */}
      <div className="space-y-6">
        {plazos.map((plazo) => {
          const row = grilla[plazo.value]
          const hasContent = Object.keys(row).length > 0
          const isEditingThisRow = editingCell?.plazo === plazo.value

          if (!hasContent && !isEditingThisRow && filtroEstado !== 'todos' && hasAnyData) return null

          return (
            <div key={plazo.value}>
              {/* Plazo header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center text-warm-700 text-xs font-semibold">
                  {plazo.icon}
                </span>
                <h4 className="text-sm font-medium text-sage-800">{plazo.label}</h4>
              </div>

              {/* Area columns */}
              <div className="grid gap-3" style={{
                gridTemplateColumns: `repeat(${areasActivas.length}, minmax(0, 1fr))`,
              }}>
                {areasActivas.map((area) => {
                  const obj = row[area.value]
                  const isMyArea = area.value === miArea
                  const isEditing = editingCell?.plazo === plazo.value && editingCell?.area === area.value

                  return (
                    <div key={area.value} className="min-w-0">
                      {/* Area label */}
                      <div className="mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${especialidadColor[area.value] || 'bg-sage-100 text-sage-600'}`}>
                          {area.short}
                        </span>
                      </div>

                      {isEditing ? (
                        /* Inline edit form */
                        <form onSubmit={handleSave} className="bg-white rounded-xl border-2 border-teal-400 p-3 space-y-3">
                          <textarea
                            required
                            rows={3}
                            value={cellForm.descripcion}
                            onChange={(e) => setCellForm((f) => ({ ...f, descripcion: e.target.value }))}
                            placeholder="Descripción del objetivo..."
                            className={inputClasses + ' resize-y text-xs'}
                            autoFocus
                          />
                          <input
                            type="date"
                            required
                            value={cellForm.fecha_inicio}
                            onChange={(e) => setCellForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                            className={inputClasses + ' text-xs'}
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={guardando}
                              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-medium py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              {guardando ? '...' : editingCell.objetivo ? 'Guardar' : 'Crear'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-3 py-1.5 text-xs text-sage-500 hover:bg-sage-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : obj ? (
                        /* Objective card */
                        <ObjetivoCard
                          obj={obj}
                          isMyArea={isMyArea}
                          expandedId={expandedId}
                          historial={historial}
                          onToggleHistorial={loadHistorial}
                          onCambiarEstado={cambiarEstado}
                          onEdit={() => startEdit(obj)}
                          formatFechaCorta={formatFechaCorta}
                          formatFechaHora={formatFechaHora}
                        />
                      ) : (
                        /* Empty cell */
                        <div className={`rounded-xl border border-dashed p-3 min-h-[80px] flex items-center justify-center ${
                          isMyArea ? 'border-sage-300' : 'border-sage-200'
                        }`}>
                          {isMyArea ? (
                            <button
                              onClick={() => startCreate(plazo.value, area.value)}
                              className="text-sage-400 hover:text-teal-600 transition-colors cursor-pointer flex flex-col items-center gap-1"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              <span className="text-xs">Agregar</span>
                            </button>
                          ) : (
                            <span className="text-xs text-sage-300 italic">Sin objetivo</span>
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
    </div>
  )
}

function ObjetivoCard({
  obj, isMyArea, expandedId, historial,
  onToggleHistorial, onCambiarEstado, onEdit,
  formatFechaCorta, formatFechaHora,
}) {
  const est = estadoConfig[obj.estado]
  const isExpanded = expandedId === obj.id
  const hist = historial[obj.id]

  return (
    <div className="bg-white rounded-xl border border-sage-200 overflow-hidden">
      <div className="p-3">
        {/* Status dot + description */}
        <div className="flex items-start gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${est.dot}`} />
          <p className="text-xs text-sage-800 leading-relaxed flex-1">
            {obj.descripcion}
          </p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5 ml-[16px] mb-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${est.bg} ${est.text}`}>
            {est.label}
          </span>
          <span className="text-[10px] text-sage-400">
            {formatFechaCorta(obj.fecha_inicio)}
          </span>
        </div>

        {/* Actions — only for own area */}
        {isMyArea && (
          <div className="flex flex-wrap items-center gap-1 ml-[16px]">
            {estados
              .filter((e) => e !== obj.estado)
              .map((nuevoEstado) => {
                const cfg = estadoConfig[nuevoEstado]
                return (
                  <button
                    key={nuevoEstado}
                    onClick={() => onCambiarEstado(obj, nuevoEstado)}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${cfg.bg} ${cfg.text} border-transparent hover:border-current`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            <button
              onClick={onEdit}
              title="Editar"
              className="p-1 rounded text-sage-400 hover:text-teal-600 transition-colors cursor-pointer ml-auto"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          </div>
        )}

        {/* History toggle */}
        <button
          onClick={() => onToggleHistorial(obj.id)}
          className="text-[10px] text-sage-400 hover:text-sage-600 transition-colors cursor-pointer mt-2 ml-[16px]"
        >
          {isExpanded ? 'Ocultar historial' : 'Historial'}
        </button>
      </div>

      {/* History panel */}
      {isExpanded && (
        <div className="border-t border-sage-100 bg-sage-50/50 px-3 py-2">
          {!hist ? (
            <div className="flex justify-center py-1">
              <div className="h-3 w-3 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
            </div>
          ) : hist.length === 0 ? (
            <p className="text-[10px] text-sage-400 italic">Sin cambios.</p>
          ) : (
            <div className="space-y-1.5">
              {hist.map((h) => {
                const desde = estadoConfig[h.estado_anterior]
                const hasta = estadoConfig[h.estado_nuevo]
                return (
                  <div key={h.id} className="text-[10px] text-sage-500 leading-tight">
                    <span className="text-sage-400">{formatFechaHora(h.fecha)}</span>
                    {' '}{h.profesional?.nombre}:{' '}
                    <span className={`px-1 py-0.5 rounded ${desde.bg} ${desde.text}`}>{desde.label}</span>
                    {' → '}
                    <span className={`px-1 py-0.5 rounded ${hasta.bg} ${hasta.text}`}>{hasta.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
