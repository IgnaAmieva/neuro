import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { especialidadLabel, especialidadColor } from '../lib/especialidades.js'

export default function Pacientes() {
  const { profesional } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('activos')

  useEffect(() => {
    if (!profesional) return
    loadPacientes()
  }, [profesional])

  async function loadPacientes() {
    setLoading(true)
    setError(null)
    const { data, error: queryErr } = await supabase
      .from('paciente_profesional')
      .select(`
        paciente:pacientes (
          id, nombre, fecha_nacimiento, diagnostico, activo,
          paciente_profesional (
            profesional:profesionales ( id, nombre, especialidad )
          )
        )
      `)
      .eq('profesional_id', profesional.id)

    if (queryErr) {
      setError('No se pudieron cargar los pacientes. Intentá de nuevo en unos segundos.')
      setLoading(false)
      return
    }

    const mapped = (data || []).map((row) => ({
      ...row.paciente,
      equipo: row.paciente.paciente_profesional.map((pp) => pp.profesional),
    }))
    const unique = [...new Map(mapped.map((p) => [p.id, p])).values()]
    setPacientes(unique)
    setLoading(false)
  }

  const filtrados = useMemo(() => {
    let list = pacientes
    if (filtroActivo === 'activos') list = list.filter((p) => p.activo)
    else if (filtroActivo === 'inactivos') list = list.filter((p) => !p.activo)

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.diagnostico && p.diagnostico.toLowerCase().includes(q))
      )
    }

    return list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [pacientes, busqueda, filtroActivo])

  function calcularEdad(fechaNac) {
    const hoy = new Date()
    const nac = new Date(fechaNac)
    let edad = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
    return edad
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-2xl font-medium text-sage-900">Pacientes</h2>
          <p className="text-sage-500 text-sm mt-0.5">{pacientes.filter((p) => p.activo).length} activos</p>
        </div>
        <Link
          to="/pacientes/nuevo"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo paciente
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o diagnóstico..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-sage-300 bg-white text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
          />
        </div>
        <div className="flex rounded-lg border border-sage-300 overflow-hidden text-sm">
          {[
            { key: 'activos', label: 'Activos' },
            { key: 'todos', label: 'Todos' },
            { key: 'inactivos', label: 'Inactivos' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltroActivo(f.key)}
              className={`px-4 py-2 transition-colors cursor-pointer ${
                filtroActivo === f.key
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
        <div className="mb-6 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      {/* List */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-sage-400">
          {busqueda ? 'Sin resultados para esta búsqueda.' : 'No hay pacientes cargados.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map((paciente) => (
            <Link
              key={paciente.id}
              to={`/pacientes/${paciente.id}`}
              className="bg-white rounded-xl border border-sage-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all group block"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    paciente.activo ? 'bg-teal-100 text-teal-700' : 'bg-sage-200 text-sage-500'
                  }`}>
                    {paciente.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sage-900 group-hover:text-teal-700 transition-colors truncate">
                        {paciente.nombre}
                      </h3>
                      {!paciente.activo && (
                        <span className="text-xs bg-sage-200 text-sage-600 px-2 py-0.5 rounded-full shrink-0">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-sage-500 mt-0.5">
                      {calcularEdad(paciente.fecha_nacimiento)} años
                      {paciente.diagnostico && (
                        <span> &middot; {paciente.diagnostico}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Team badges */}
                <div className="hidden sm:flex flex-wrap gap-1 justify-end shrink-0 max-w-[280px]">
                  {paciente.equipo.map((prof) => (
                    <span
                      key={prof.id}
                      className={`text-xs px-2 py-0.5 rounded-full ${especialidadColor[prof.especialidad] || 'bg-sage-100 text-sage-600'}`}
                    >
                      {especialidadLabel[prof.especialidad] || prof.especialidad}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
