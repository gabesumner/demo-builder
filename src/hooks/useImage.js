import { useState, useEffect } from 'react'
import { useStorageMode } from '../contexts/StorageModeContext'
import { idbGetImage } from '../utils/idbStorage'

// Resolves any image value to a displayable src:
//   ''         → null
//   'data:...' → returned as-is (old inline format or Postgres fallback)
//   'img_...'  → loaded from IDB (local) or constructed as /images/:id URL (Postgres)
export function useImage(value) {
  const { mode } = useStorageMode()
  const isPostgres = mode === 'postgres'

  const [src, setSrc] = useState(() => {
    if (!value) return null
    if (value.startsWith('data:')) return value
    if (isPostgres) return `/images/${value}`
    return null // IDB load is async
  })

  useEffect(() => {
    if (!value) { setSrc(null); return }
    if (value.startsWith('data:')) { setSrc(value); return }
    if (isPostgres) { setSrc(`/images/${value}`); return }

    // Local: async IDB load
    let objectUrl = null
    let cancelled = false
    idbGetImage(value).then(blob => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [value, isPostgres])

  return src
}
