import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { especialidadColor, tipoSesionLabel, tiposSesion } from '../lib/especialidades.js'
import EntradaForm from './EntradaForm.jsx'
import GenerarInforme from './GenerarInforme.jsx'

export default function HistoriaClinica({ pacienteId, paciente }) {
  const { profesional } = useAuth()
  const [entradas, setEntradas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [periodo, setPeriodo] = useState('3m')
  const [areasSeleccionadas, setAreasSeleccionadas] = useState(() => tiposSesion.map((t) => t.value))
  const [showInforme, setShowInforme] = useState(false)

  useEffect(() => {
    loadEntradas()
  }, [pacienteId])

  async function loadEntradas() {
    setLoading(true)
    const { data } = await supabase
      .from('entradas_historia_clinica')
      .select('*, profesional:profesionales ( id, nombre, especialidad )')
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false })
    setEntradas(data || [])
    setLoading(false)
  }

  async function handleCreate(formData) {
    setError(null)
    setGuardando(true)
    const { error: err } = await supabase
      .from('entradas_historia_clinica')
      .insert({
        paciente_id: pacienteId,
        profesional_id: profesional.id,
        ...formData,
      })
    setGuardando(false)
    if (err) {
      setError('Error al cargar entrada: ' + err.message)
      return
    }
    setShowForm(false)
    loadEntradas()
  }

  async function handleUpdate(formData) {
    setError(null)
    setGuardando(true)
    const { error: err } = await supabase
      .from('entradas_historia_clinica')
      .update(formData)
      .eq('id', editando.id)
    setGuardando(false)
    if (err) {
      setError('Error al actualizar: ' + err.message)
      return
    }
    setEditando(null)
    loadEntradas()
  }

  async function handleDelete(entradaId) {
    const { error: err } = await supabase
      .from('entradas_historia_clinica')
      .delete()
      .eq('id', entradaId)
    setConfirmDelete(null)
    if (err) {
      setError('Error al eliminar: ' + err.message)
      return
    }
    loadEntradas()
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const periodos = [
    { key: '1s', label: '1 sem', days: 7 },
    { key: '1m', label: '1 mes', days: 30 },
    { key: '3m', label: '3 meses', days: 90 },
    { key: '6m', label: '6 meses', days: 180 },
    { key: '1a', label: '1 año', days: 365 },
    { key: 'todo', label: 'Todo', days: null },
  ]

  const filtradas = useMemo(() => {
    let resultado = entradas
    // Filter by period
    const p = periodos.find((x) => x.key === periodo)
    if (p && p.days) {
      const desde = new Date()
      desde.setDate(desde.getDate() - p.days)
      desde.setHours(0, 0, 0, 0)
      resultado = resultado.filter((e) => new Date(e.fecha) >= desde)
    }
    // Filter by area
    if (areasSeleccionadas.length < tiposSesion.length) {
      resultado = resultado.filter((e) => areasSeleccionadas.includes(e.tipo_sesion))
    }
    return resultado
  }, [entradas, periodo, areasSeleccionadas])

  function toggleArea(value) {
    setAreasSeleccionadas((prev) => {
      if (prev.includes(value)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev
        return prev.filter((a) => a !== value)
      }
      return [...prev, value]
    })
  }

  const todasSeleccionadas = areasSeleccionadas.length === tiposSesion.length

  const isOwn = (entrada) => entrada.profesional_id === profesional?.id

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider">
          Historia clínica ({filtradas.length}{filtradas.length !== entradas.length ? ` de ${entradas.length}` : ''})
        </h3>
        {!showForm && !editando && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInforme(true)}
              disabled={entradas.length === 0}
              className="inline-flex items-center gap-2 bg-white border border-sage-300 hover:border-teal-400 text-sage-700 hover:text-teal-700 disabled:opacity-50 font-medium py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              Generar informe
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nueva entrada
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Period filter */}
        <div className="flex rounded-lg border border-sage-300 overflow-hidden text-xs w-fit">
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-3 py-1.5 transition-colors cursor-pointer ${
                periodo === p.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-sage-600 hover:bg-sage-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Area filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              setAreasSeleccionadas(
                todasSeleccionadas ? [tiposSesion[0].value] : tiposSesion.map((t) => t.value),
              )
            }
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
              todasSeleccionadas
                ? 'bg-sage-800 text-white border-sage-800'
                : 'bg-white text-sage-500 border-sage-300 hover:border-sage-400'
            }`}
          >
            Todas
          </button>
          {tiposSesion.map((t) => {
            const activa = areasSeleccionadas.includes(t.value)
            return (
              <button
                key={t.value}
                onClick={() => toggleArea(t.value)}
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

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      {/* New entry form */}
      {showForm && (
        <div className="mb-6">
          <EntradaForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            guardando={guardando}
          />
        </div>
      )}

      {/* Edit form */}
      {editando && (
        <div className="mb-6">
          <EntradaForm
            entrada={editando}
            onSave={handleUpdate}
            onCancel={() => setEditando(null)}
            guardando={guardando}
          />
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-sage-400 text-sm">
          {entradas.length === 0
            ? 'No hay entradas registradas aún.'
            : 'No hay entradas con los filtros seleccionados.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtradas.map((entrada) => (
            <div
              key={entrada.id}
              className="bg-white rounded-2xl border border-sage-200 p-5 group"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-sage-500 shrink-0">
                    {formatFecha(entrada.fecha)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    especialidadColor[entrada.tipo_sesion] || 'bg-sage-100 text-sage-600'
                  }`}>
                    {tipoSesionLabel[entrada.tipo_sesion] || entrada.tipo_sesion}
                  </span>
                </div>

                {/* Actions — only own entries */}
                {isOwn(entrada) && !editando && !showForm && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setEditando(entrada)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-sage-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    {confirmDelete === entrada.id ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => handleDelete(entrada.id)}
                          className="text-xs bg-clay-500 hover:bg-clay-600 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-sage-500 hover:text-sage-700 px-2 py-1 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(entrada.id)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg text-sage-400 hover:text-clay-600 hover:bg-clay-500/10 transition-colors cursor-pointer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <p className="text-sage-800 text-sm leading-relaxed whitespace-pre-line mb-3">
                {entrada.contenido}
              </p>

              {/* Conceptos clave */}
              {entrada.conceptos_clave && entrada.conceptos_clave.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {entrada.conceptos_clave.map((concepto, i) => (
                    <span
                      key={i}
                      className="text-xs bg-warm-100 text-warm-700 px-2 py-0.5 rounded-full"
                    >
                      {concepto}
                    </span>
                  ))}
                </div>
              )}

              {/* Author */}
              <div className="flex items-center gap-2 pt-2 border-t border-sage-100">
                <div className="w-6 h-6 rounded-full bg-sage-200 flex items-center justify-center text-sage-600 text-xs font-medium">
                  {entrada.profesional?.nombre?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-sage-500">
                  {entrada.profesional?.nombre}
                  {isOwn(entrada) && <span className="text-sage-400"> (vos)</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report modal */}
      {showInforme && paciente && (
        <GenerarInforme
          paciente={paciente}
          entradas={filtradas}
          onClose={() => setShowInforme(false)}
        />
      )}
    </div>
  )
}
