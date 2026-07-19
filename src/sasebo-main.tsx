import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SaseboLandingPage from './SaseboLandingPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SaseboLandingPage />
  </StrictMode>,
)
