export const especialidades = [
  { value: 'psicopedagogía', label: 'Psicopedagogía', short: 'Psicoped.' },
  { value: 'psicología', label: 'Psicología', short: 'Psicol.' },
  { value: 'fonoaudiología', label: 'Fonoaudiología', short: 'Fono.' },
  { value: 'terapia ocupacional', label: 'Terapia Ocupacional', short: 'T.O.' },
  { value: 'kinesiología', label: 'Kinesiología', short: 'Kinesio.' },
]

export const especialidadLabel = Object.fromEntries(
  especialidades.map((e) => [e.value, e.label])
)

export const tiposSesion = [
  ...especialidades,
  { value: 'interdisciplinaria', label: 'Interdisciplinaria', short: 'Interdis.' },
]

export const tipoSesionLabel = Object.fromEntries(
  tiposSesion.map((e) => [e.value, e.label])
)

export const especialidadColor = {
  'psicopedagogía': 'bg-amber-100 text-amber-800',
  'psicología': 'bg-violet-100 text-violet-800',
  'fonoaudiología': 'bg-sky-100 text-sky-800',
  'terapia ocupacional': 'bg-emerald-100 text-emerald-800',
  'kinesiología': 'bg-rose-100 text-rose-800',
}
