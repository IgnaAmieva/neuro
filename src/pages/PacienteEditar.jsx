import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import PacienteForm from '../components/PacienteForm.jsx'

export default function PacienteEditar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paciente, setPaciente] = useState(null)
  const [equipo, setEquipo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    setError(null)
    const [{ data: pac, error: pacErr }, { data: team }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id', id).single(),
      supabase
        .from('paciente_profesional')
        .select('profesional:profesionales ( id, nombre, especialidad )')
        .eq('paciente_id', id),
    ])
    if (pacErr) {
      setError('No se pudo cargar el paciente.')
      setLoading(false)
      return
    }
    setPaciente(pac)
    setEquipo(team?.map((t) => t.profesional) || [])
    setLoading(false)
  }

  async function handleSave(form, equipoIds) {
    setError(null)
    setGuardando(true)

    // Update patient data
    const { error: updateErr } = await supabase
      .from('pacientes')
      .update({
        nombre: form.nombre,
        fecha_nacimiento: form.fecha_nacimiento,
        diagnostico: form.diagnostico || null,
        notas_generales: form.notas_generales || null,
        activo: form.activo,
      })
      .eq('id', id)

    if (updateErr) {
      setError('No se pudieron guardar los cambios. Intentá de nuevo.')
      setGuardando(false)
      return
    }

    // Sync team assignments: delete removed, add new
    const currentIds = equipo.map((p) => p.id)
    const toRemove = currentIds.filter((pid) => !equipoIds.includes(pid))
    const toAdd = equipoIds.filter((pid) => !currentIds.includes(pid))

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('paciente_profesional')
        .delete()
        .eq('paciente_id', id)
        .in('profesional_id', toRemove)

      if (delErr) {
        setError('No se pudieron quitar profesionales del equipo.')
        setGuardando(false)
        return
      }
    }

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase
        .from('paciente_profesional')
        .insert(toAdd.map((profId) => ({
          paciente_id: id,
          profesional_id: profId,
        })))

      if (addErr) {
        setError('No se pudieron asignar los profesionales nuevos.')
        setGuardando(false)
        return
      }
    }

    navigate(`/pacientes/${id}`, { replace: true })
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
        Paciente no encontrado.
        <br />
        <Link to="/pacientes" className="text-teal-600 hover:text-teal-700 text-sm mt-2 inline-block">
          Volver al listado
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-sage-500 mb-6">
        <Link to="/pacientes" className="hover:text-teal-600 transition-colors">Pacientes</Link>
        <span>/</span>
        <Link to={`/pacientes/${id}`} className="hover:text-teal-600 transition-colors">{paciente.nombre}</Link>
        <span>/</span>
        <span className="text-sage-800">Editar</span>
      </div>

      <h2 className="font-display text-2xl font-medium text-sage-900 mb-6">Editar paciente</h2>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      <PacienteForm paciente={paciente} equipoInicial={equipo} onSave={handleSave} guardando={guardando} />
    </div>
  )
}
