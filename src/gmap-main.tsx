import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import GmapApp from './gmap/GmapApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GmapApp />
  </StrictMode>,
)
