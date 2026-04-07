import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MonthProvider } from './hooks/useMonth'
import App from './App.jsx'
import './styles/global.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ color: '#1A1412' }}>Something went wrong</h2>
          <pre style={{ color: '#B85450', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 20, padding: '10px 24px', background: '#1A1412',
            color: '#FAF7F2', border: 'none', cursor: 'pointer', fontSize: 13
          }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <MonthProvider>
            <App />
          </MonthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e) {
  document.getElementById('root').innerHTML = `
    <div style="padding:40px;font-family:sans-serif">
      <h2>Failed to start app</h2>
      <pre style="color:red">${e.message}\n${e.stack}</pre>
    </div>
  `
}
