import React, { createContext, useContext, useEffect, useState } from 'react'

const UsersContext = createContext()

const STORAGE_KEY = 'paychain_admin_users'

const DEFAULT_USERS = [
  { id: 'u_admin_1', name: 'PayChain Admin', email: 'administrator@paychain.co.ke', role: 'Administrator', canOnboard: true, createdAt: new Date().toISOString() }
]

export function UsersProvider({ children }){
  const [users, setUsers] = useState([])

  useEffect(()=>{
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw){
      try{ setUsers(JSON.parse(raw)) }catch(e){ setUsers(DEFAULT_USERS) }
    } else {
      setUsers(DEFAULT_USERS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS))
    }
  },[])

  function persist(next){
    setUsers(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function addUser(payload){
    const id = `u_${Date.now()}`
    const next = [{ id, ...payload, createdAt: new Date().toISOString() }, ...users]
    persist(next)
    return id
  }

  function updateUser(id, patch){
    const next = users.map(u => u.id === id ? { ...u, ...patch } : u)
    persist(next)
  }

  function removeUser(id){
    const next = users.filter(u => u.id !== id)
    persist(next)
  }

  return (
    <UsersContext.Provider value={{ users, addUser, updateUser, removeUser }}>
      {children}
    </UsersContext.Provider>
  )
}

export function useUsers(){
  return useContext(UsersContext)
}

export default UsersContext
