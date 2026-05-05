import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CustomerProvider } from '@/contexts/CustomerContext'
import { KpiProvider } from '@/contexts/KpiContext'
import './index.css'
import './App.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomerProvider>
      <KpiProvider>
        <App />
      </KpiProvider>
    </CustomerProvider>
  </StrictMode>,
)
