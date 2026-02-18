import { useEffect, useRef, useCallback } from 'react'
import { checkPgModified, getDemoDataFromApi } from '../utils/apiStorage'

export function useApiPolling(demoId, lastModifiedTime, {
  enabled = true,
  interval = 30000,
  onExternalChange = null,
} = {}) {
  const lastCheckedRef = useRef(lastModifiedTime)
  const pollActiveRef = useRef(false)

  useEffect(() => {
    if (lastModifiedTime) lastCheckedRef.current = lastModifiedTime
  }, [lastModifiedTime])

  const poll = useCallback(async () => {
    if (!demoId || pollActiveRef.current) return
    pollActiveRef.current = true
    try {
      const { modified, lastModified } = await checkPgModified(demoId, lastCheckedRef.current)
      if (modified) {
        const result = await getDemoDataFromApi(demoId)
        lastCheckedRef.current = lastModified
        onExternalChange?.(result.data, lastModified)
      }
    } catch (err) {
      console.warn('API polling error:', err.message)
    } finally {
      pollActiveRef.current = false
    }
  }, [demoId, onExternalChange])

  useEffect(() => {
    if (!enabled || !demoId) return
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      poll()
    }, interval)
    return () => clearInterval(id)
  }, [enabled, demoId, interval, poll])
}
