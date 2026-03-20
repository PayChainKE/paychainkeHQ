import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUsers } from '../context/UsersContext'
import Layout from '../components/layout/Layout'

function StatCard({ title, value }){
  return (
    <div className="pc-statcard">
      <div style={{fontSize:12,color:'#666'}}>{title}</div>
      <div style={{fontSize:20,fontWeight:700}}>{value}</div>
    </div>
  )
}

export default function UserDashboard(){
  const { id } = useParams()
  const { users } = useUsers()
  const user = users.find(u=>u.id === id)
  if (!user) return <Layout><div className="pc-content">User not found</div></Layout>

  // Simple role-based widgets — can be extended for high-standard dashboards
  return (
    <Layout>
      <div className="pc-page-head">
        <h2>{user.name} — {user.role}</h2>
        <div><small>Joined: {new Date(user.createdAt).toLocaleString()}</small></div>
      </div>

      <div className="pc-grid" style={{marginTop:12}}>
        <StatCard title="Tasks assigned" value={user.role === 'Onboarder' ? 24 : 8} />
        <StatCard title="Merchants onboarded" value={user.canOnboard ? 42 : 0} />
        <StatCard title="Pending approvals" value={user.role === 'Manager' ? 5 : 0} />
      </div>

      <section className="pc-section">
        <h3>Activity</h3>
        <div style={{background:'white',padding:12,borderRadius:8}}>
          <p style={{margin:0}}>This is a role-custom dashboard view. For first-world standard polish, we can integrate charts, KPIs, and detailed analytics tailored per role.</p>
        </div>
      </section>

      <section className="pc-section">
        <Link to="/team">← Back to team</Link>
      </section>
    </Layout>
  )
}
