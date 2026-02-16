import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const GoogleAuthContext = createContext(null)

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_URL
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

export function GoogleAuthProvider({ children }) {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(() => {
    const email = localStorage.getItem('gauth_email')
    const name = localStorage.getItem('gauth_name')
    return email ? { email, name } : null
  })

  const tokenRef = useRef(null)
  const expiryRef = useRef(0)
  const tokenClientRef = useRef(null)
  const pendingResolveRef = useRef(null)
  const pendingRejectRef = useRef(null)

  // Initialize the token client (lazy, on first sign-in attempt)
  const initTokenClient = useCallback(async () => {
    if (tokenClientRef.current) return tokenClientRef.current
    await loadGisScript()
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          tokenRef.current = null
          expiryRef.current = 0
          setIsSignedIn(false)
          pendingRejectRef.current?.(new Error(response.error))
          pendingResolveRef.current = null
          pendingRejectRef.current = null
          return
        }
        tokenRef.current = response.access_token
        expiryRef.current = Date.now() + (response.expires_in - 60) * 1000
        setIsSignedIn(true)
        // Fetch user info
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        })
          .then(r => r.json())
          .then(info => {
            const u = { email: info.email, name: info.name, picture: info.picture }
            setUser(u)
            localStorage.setItem('gauth_email', u.email)
            localStorage.setItem('gauth_name', u.name || '')
          })
          .catch(() => {})
        pendingResolveRef.current?.(response.access_token)
        pendingResolveRef.current = null
        pendingRejectRef.current = null
      },
    })
    tokenClientRef.current = client
    return client
  }, [])

  const signIn = useCallback(async () => {
    setIsLoading(true)
    try {
      const client = await initTokenClient()
      return new Promise((resolve, reject) => {
        pendingResolveRef.current = resolve
        pendingRejectRef.current = reject
        client.requestAccessToken()
      })
    } finally {
      setIsLoading(false)
    }
  }, [initTokenClient])

  const signOut = useCallback(() => {
    if (tokenRef.current) {
      window.google?.accounts?.oauth2?.revoke?.(tokenRef.current)
    }
    tokenRef.current = null
    expiryRef.current = 0
    setIsSignedIn(false)
    setUser(null)
    localStorage.removeItem('gauth_email')
    localStorage.removeItem('gauth_name')
  }, [])

  const ensureToken = useCallback(async () => {
    // Valid token exists
    if (tokenRef.current && Date.now() < expiryRef.current) {
      return tokenRef.current
    }
    // Try silent re-auth
    try {
      const client = await initTokenClient()
      return new Promise((resolve, reject) => {
        pendingResolveRef.current = resolve
        pendingRejectRef.current = reject
        client.requestAccessToken({ prompt: '' })
      })
    } catch {
      // Silent failed, need interactive
      return signIn()
    }
  }, [initTokenClient, signIn])

  // On mount, if we have a cached email, try silent token refresh
  useEffect(() => {
    if (!CLIENT_ID) return
    const email = localStorage.getItem('gauth_email')
    if (email) {
      initTokenClient()
        .then(client => {
          return new Promise((resolve, reject) => {
            pendingResolveRef.current = resolve
            pendingRejectRef.current = reject
            client.requestAccessToken({ prompt: '' })
          })
        })
        .catch(() => {
          // Silent refresh failed, user will need to sign in again
        })
    }
  }, [initTokenClient])

  const value = {
    isSignedIn,
    isLoading,
    user,
    signIn,
    signOut,
    ensureToken,
    hasClientId: !!CLIENT_ID,
  }

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  )
}

export function useGoogleAuth() {
  const ctx = useContext(GoogleAuthContext)
  if (!ctx) throw new Error('useGoogleAuth must be used within GoogleAuthProvider')
  return ctx
}
