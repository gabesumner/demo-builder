import { useEffect, useRef, useCallback } from 'react'
import { checkDriveModified, getDriveDemoData } from '../utils/driveStorage'

export function useDrivePolling(driveFileId, lastModifiedTime, {
  enabled = true,
  interval = 30000,
  getToken = null,
  onExternalChange = null,
} = {}) {
  const lastCheckedRef = useRef(lastModifiedTime)
  const pollActiveRef = useRef(false)

  // Update the ref when lastModifiedTime changes (e.g. after our own save)
  useEffect(() => {
    if (lastModifiedTime) {
      lastCheckedRef.current = lastModifiedTime
    }
  }, [lastModifiedTime])

  const poll = useCallback(async () => {
    if (!driveFileId || !getToken || pollActiveRef.current) return
    pollActiveRef.current = true
    try {
      const token = await getToken()
      const sinceTs = typeof lastCheckedRef.current === 'string'
        ? new Date(lastCheckedRef.current).getTime()
        : (lastCheckedRef.current || 0)

      const result = await checkDriveModified(token, driveFileId, sinceTs)
      if (result.modified) {
        const data = await getDriveDemoData(token, driveFileId)
        lastCheckedRef.current = result.modifiedTime
        onExternalChange?.(data, null, result.modifiedTime)
      }
    } catch (err) {
      // Silently ignore polling errors (network issues, expired tokens)
      console.warn('Drive polling error:', err.message)
    } finally {
      pollActiveRef.current = false
    }
  }, [driveFileId, getToken, onExternalChange])

  useEffect(() => {
    if (!enabled || !driveFileId || !getToken) return

    const id = setInterval(() => {
      // Skip polling when tab is hidden
      if (document.visibilityState === 'hidden') return
      poll()
    }, interval)

    return () => clearInterval(id)
  }, [enabled, driveFileId, getToken, interval, poll])
}
