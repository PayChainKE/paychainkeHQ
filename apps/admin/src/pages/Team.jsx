import React, { useState } from 'react'
import { useUsers } from '../context/UsersContext'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/layout/Layout'
import { Link } from 'react-router-dom'

function RoleBadge({ role }){ return <span style={{fontSize:12, padding:'4px 8px', background:'#eef', borderRadius:6}}>{role}</span> }

export default function Team(){
  const { users, addUser, removeUser } = useUsers()
  const { admin } = useAuth()
  const [form, setForm] = useState({ name:'', email:'', role:'Manager', canOnboard:false })
  const [msg, setMsg] = useState('')

  async function onAdd(e){
    e.preventDefault()
    if (!form.name || !form.email) return setMsg('Name and email required')
    addUser(form)
    setMsg('User added')
    setForm({ name:'', email:'', role:'Manager', canOnboard:false })
    setTimeout(()=>setMsg(''),2500)
  }

  return (
    <Layout>
      <div className="pc-page-head">
        <h2>Team</h2>
        <div>
          <small>Signed in as {admin?.name}</small>
        </div>
      </div>

      <section className="pc-section">
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <form onSubmit={onAdd} style={{display:'flex',gap:8,alignItems:'center'}}>
            <input placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            <input placeholder="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
              <option>Administrator</option>
              <option>Manager</option>
              <option>Onboarder</option>
            </select>
            <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.canOnboard} onChange={e=>setForm({...form,canOnboard:e.target.checked})} />Can onboard</label>
            <button className="pc-btn" type="submit">Add user</button>
          </form>
          <div style={{color:'#666'}}>{msg}</div>
        </div>
      </section>

      <section className="pc-section">
        <h3>Team members</h3>
        <div style={{display:'grid',gap:8}}>
          {users.map(u => (
            <div key={u.id} style={{display:'flex',justifyContent:'space-between',padding:12,background:'white',borderRadius:8}}>
              <div>
                <div style={{fontWeight:700}}>{u.name} <small style={{color:'#666'}}>• {u.email}</small></div>
                <div style={{marginTop:6}}><RoleBadge role={u.role} /> {u.canOnboard ? <small style={{marginLeft:8}}>Onboards merchants</small> : null}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <Link to={`/team/${u.id}/dashboard`}>View dashboard</Link>
                <button onClick={()=>removeUser(u.id)} style={{background:'transparent',border:'1px solid #eee',padding:'6px 8px'}}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  )
}
