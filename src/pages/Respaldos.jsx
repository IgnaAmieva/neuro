import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useNavigate } from 'react-router-dom'

export default function Respaldos() {
  const { profesional } = useAuth()
  const navigate = useNavigate()
  const [archivos, setArchivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  // Redirect non-admin
  useEffect(() => {
    if (profesional && profesional.rol !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [profesional, navigate])

  useEffect(() => {
    loadArchivos()
  }, [])

  async function loadArchivos() {
    setLoading(true)
    const { data, error: listErr } = await supabase.storage
      .from('respaldos')
      .list('', { sortBy: { column: 'created_at', order: 'desc' } })

    if (listErr) {
      setError('Error al listar respaldos: ' + listErr.message)
    } else {
      // Filter out .emptyFolderPlaceholder and non-xlsx
      setArchivos((data || []).filter((f) => f.name.endsWith('.xlsx')))
    }
    setLoading(false)
  }

  async function handleGenerar() {
    setError(null)
    setExito(null)
    setGenerando(true)

    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'respaldo-excel',
        { body: {} },
      )

      if (fnErr) throw new Error(fnErr.message)
      if (data?.error) throw new Error(data.error)

      setExito(`Respaldo generado: ${data.fileName}`)
      loadArchivos()
    } catch (err) {
      setError(err.message || 'No se pudo generar el respaldo. Intentá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleDescargar(fileName) {
    const { data, error: dlErr } = await supabase.storage
      .from('respaldos')
      .download(fileName)

    if (dlErr) {
      setError('Error al descargar: ' + dlErr.message)
      return
    }

    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function formatFecha(isoStr) {
    if (!isoStr) return '—'
    return new Date(isoStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (profesional?.rol !== 'admin') return null

  return (
    <div>
      <h2 className="font-display text-2xl font-medium text-sage-900 mb-1">Respaldos</h2>
      <p className="text-sm text-sage-500 mb-6">
        Exportación completa de la base de datos en formato Excel. Se genera automáticamente cada domingo.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
          {error}
        </div>
      )}

      {exito && (
        <div className="mb-4 p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-700 text-sm">
          {exito}
        </div>
      )}

      <button
        onClick={handleGenerar}
        disabled={generando}
        className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-colors cursor-pointer mb-8"
      >
        {generando ? (
          <>
            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Generando respaldo...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Generar respaldo ahora
          </>
        )}
      </button>

      <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-4">
        Respaldos existentes ({archivos.length})
      </h3>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
        </div>
      ) : archivos.length === 0 ? (
        <div className="text-center py-12 text-sage-400 text-sm">
          No hay respaldos generados aún.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-sage-200 divide-y divide-sage-100">
          {archivos.map((archivo) => (
            <div
              key={archivo.name}
              className="flex items-center justify-between px-5 py-4 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M8 13h8M8 17h8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sage-800 truncate">
                    {archivo.name}
                  </p>
                  <p className="text-xs text-sage-400">
                    {formatFecha(archivo.created_at)} · {formatSize(archivo.metadata?.size)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDescargar(archivo.name)}
                className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Descargar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
