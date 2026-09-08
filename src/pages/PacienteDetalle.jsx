import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { especialidadLabel, especialidadColor } from '../lib/especialidades.js'
import HistoriaClinica from '../components/HistoriaClinica.jsx'
import ObjetivosEquipo from '../components/ObjetivosEquipo.jsx'

export default function PacienteDetalle() {
  const { id } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [equipo, setEquipo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('historia')

  useEffect(() => {
    loadPaciente()
  }, [id])

  async function loadPaciente() {
    setLoading(true)
    setError(null)
    const [{ data: pac, error: pacErr }, { data: team, error: teamErr }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id', id).single(),
      supabase
        .from('paciente_profesional')
        .select('profesional:profesionales ( id, nombre, especialidad, email )')
        .eq('paciente_id', id),
    ])
    if (pacErr) {
      setError('No se pudo cargar el paciente. Verificá tu conexión e intentá de nuevo.')
      setLoading(false)
      return
    }
    if (teamErr) {
      setError('No se pudo cargar el equipo del paciente.')
    }
    setPaciente(pac)
    setEquipo(team?.map((t) => t.profesional) || [])
    setLoading(false)
  }

  function calcularEdad(fechaNac) {
    const hoy = new Date()
    const nac = new Date(fechaNac)
    let edad = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
    return edad
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="text-center py-20 text-sage-500">
        {error || 'Paciente no encontrado.'}
        <br />
        <Link to="/pacientes" className="text-teal-600 hover:text-teal-700 text-sm mt-2 inline-block">
          Volver al listado
        </Link>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-sage-500">
          <Link to="/pacientes" className="hover:text-teal-600 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-sage-800">{paciente.nombre}</span>
        </div>
        <Link
          to={`/pacientes/${id}/editar`}
          className="inline-flex items-center gap-2 bg-white border border-sage-300 hover:border-teal-400 text-sage-700 hover:text-teal-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          Editar
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-sage-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium shrink-0 ${
            paciente.activo ? 'bg-teal-100 text-teal-700' : 'bg-sage-200 text-sage-500'
          }`}>
            {paciente.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-medium text-sage-900 truncate">{paciente.nombre}</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                paciente.activo ? 'bg-teal-100 text-teal-700' : 'bg-sage-200 text-sage-600'
              }`}>
                {paciente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-sage-500 text-sm mt-1">
              {calcularEdad(paciente.fecha_nacimiento)} años &middot; Nacimiento: {formatFecha(paciente.fecha_nacimiento)}
            </p>
            {paciente.diagnostico && (
              <p className="text-sage-600 text-sm mt-1">{paciente.diagnostico}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sage-200 mb-6">
        {[
          { key: 'historia', label: 'Historia clínica' },
          { key: 'objetivos', label: 'Objetivos' },
          { key: 'info', label: 'Información' },
          { key: 'equipo', label: `Equipo (${equipo.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-sage-500 hover:text-sage-700 hover:border-sage-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'historia' && <HistoriaClinica pacienteId={id} paciente={paciente} />}

      {tab === 'objetivos' && <ObjetivosEquipo pacienteId={id} />}

      {tab === 'info' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-sage-200 p-6">
            <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-3">Diagnóstico / Discapacidad</h3>
            <p className="text-sage-800 leading-relaxed">
              {paciente.diagnostico || <span className="text-sage-400 italic">Sin diagnóstico cargado</span>}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-sage-200 p-6">
            <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-3">Notas generales</h3>
            <p className="text-sage-800 leading-relaxed whitespace-pre-line">
              {paciente.notas_generales || <span className="text-sage-400 italic">Sin notas</span>}
            </p>
          </div>
        </div>
      )}

      {tab === 'equipo' && (
        <div className="bg-white rounded-2xl border border-sage-200 p-6">
          <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-4">
            Equipo asignado
          </h3>
          {equipo.length === 0 ? (
            <p className="text-sage-400 italic text-sm">Sin profesionales asignados</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {equipo.map((prof) => (
                <div
                  key={prof.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-sage-50 border border-sage-100"
                >
                  <div className="w-9 h-9 rounded-full bg-sage-200 flex items-center justify-center text-sage-700 text-sm font-medium shrink-0">
                    {prof.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sage-800 truncate">{prof.nombre}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${especialidadColor[prof.especialidad] || 'bg-sage-100 text-sage-600'}`}>
                      {especialidadLabel[prof.especialidad] || prof.especialidad}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
