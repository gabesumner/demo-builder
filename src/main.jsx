import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleAuthProvider } from './contexts/GoogleAuthContext'
import { migrateFromLocalStorage } from './utils/idbStorage'
import './index.css'
import App from './App.jsx'

migrateFromLocalStorage().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <GoogleAuthProvider>
          <App />
        </GoogleAuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})
