import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import './styles/globals.css'
import '@/i18n'

const rootElement = document.getElementById('root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </React.StrictMode>
  )
}
