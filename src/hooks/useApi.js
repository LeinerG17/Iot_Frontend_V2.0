import { useState, useEffect, useCallback } from 'react'

export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchFn()
      const d = res.data
      setData(d?.resultados ?? d?.results ?? (Array.isArray(d) ? d : d?.vehiculos ?? []))
    } catch (e) {
      setError('Error al cargar datos.')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => { cargar() }, [cargar])

  return { data, loading, error, recargar: cargar }
}
