import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import Google Fonts
const link = document.createElement('link')
link.rel = 'preconnect'
link.href = 'https://fonts.googleapis.com'
document.head.appendChild(link)

const link2 = document.createElement('link')
link2.rel = 'stylesheet'
link2.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
document.head.appendChild(link2)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
