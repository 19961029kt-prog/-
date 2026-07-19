import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SaseboApp from './sasebo/SaseboApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SaseboApp />
  </StrictMode>,
)
