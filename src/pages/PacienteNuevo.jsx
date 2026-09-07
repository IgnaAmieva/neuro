import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import PacienteForm from '../components/PacienteForm.jsx'

export default function PacienteNuevo() {
  const navigate = useNavigate()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(form, equipoIds) {
    setError(null)
    setGuardando(true)

    const { data: paciente, error: insertErr } = await supabase
      .from('pacientes')
      .insert({
        nombre: form.nombre,
        fecha_nacimiento: form.fecha_nacimiento,
        diagnostico: form.diagnostico || null,
        notas_generales: form.notas_generales || null,
        activo: form.activo,
      })
      .select('id')
      .single()

    if (insertErr) {
      setError('Error al crear paciente: ' + insertErr.message)
      setGuardando(false)
      return
    }

    // Assign team
    if (equipoIds.length > 0) {
      const { error: assignErr } = await supabase
        .from('paciente_profesional')
        .insert(equipoIds.map((profId) => ({
          paciente_id: paciente.id,
          profesional_id: profId,
        })))

      if (assignErr) {
        setError('Paciente creado pero error al asignar equipo: ' + assignErr.message)
        setGuardando(false)
        return
      }
    }

    navigate(`/pacientes/${paciente.id}`, { replace: true })
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-sage-500 mb-6">
        <Link to="/pacientes" className="hover:text-teal-600 transition-colors">Pacientes</Link>
        <span>/</span>
        <span className="text-sage-800">Nuevo paciente</span>
      </div>

      <h2 className="font-display text-2xl font-medium text-sage-900 mb-6">Nuevo paciente</h2>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      <PacienteForm onSave={handleSave} guardando={guardando} />
    </div>
  )
}
