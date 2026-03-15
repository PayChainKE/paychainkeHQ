import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthRouter from './auth/AuthRouter'
import Overview from './pages/Overview'
import './index.css'

function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overview" element={<Overview/>} />
        <Route path="/*" element={<AuthRouter />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)
