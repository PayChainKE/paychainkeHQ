import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthRouter from './auth/AuthRouter'
import './index.css'

function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AuthRouter />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)
