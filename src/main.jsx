import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { StorageModeProvider } from './contexts/StorageModeContext'
import { migrateFromLocalStorage } from './utils/idbStorage'
import './index.css'
import App from './App.jsx'

migrateFromLocalStorage().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <StorageModeProvider>
          <App />
        </StorageModeProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})
