import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Global styles in the order the site was built with: pages are lazy-loaded, so styles that
// every page relies on (App.css, Bootstrap's grid/.container) must load here, not in one page
import './App.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
