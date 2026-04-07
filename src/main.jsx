import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MonthProvider } from './hooks/useMonth'
import App from './App.jsx'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MonthProvider>
        <App />
      </MonthProvider>
    </BrowserRouter>
  </StrictMode>,
)
// build-bust-20260407
