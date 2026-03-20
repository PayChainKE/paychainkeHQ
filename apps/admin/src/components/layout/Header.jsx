import React from 'react'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const { admin, logout } = useAuth()
  return (
    <header className="pc-header">
      <div className="pc-header-left">Dashboard</div>
      <div className="pc-header-right">
        {admin && (
          <div className="pc-admin">{admin.name} <button onClick={logout} className="pc-logout">Logout</button></div>
        )}
      </div>
    </header>
  )
}
