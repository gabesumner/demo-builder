import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleAuthProvider } from './contexts/GoogleAuthContext'
import { StorageModeProvider } from './contexts/StorageModeContext'
import { migrateFromLocalStorage } from './utils/idbStorage'
import './index.css'
import App from './App.jsx'

migrateFromLocalStorage().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <StorageModeProvider>
          <GoogleAuthProvider>
            <App />
          </GoogleAuthProvider>
        </StorageModeProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})
