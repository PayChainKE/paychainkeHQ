import React from 'react';
import Layout from '../components/layout/Layout';
import { waitlistData, waitlistStats } from '../mockData/waitlist';
import { exportCSV } from '../utils/exportCSV';

export default function Waitlist(){
  return (
    <Layout>
      <div className="pc-page-head">
        <h2>Waitlist</h2>
        <div className="pc-actions">
          <button onClick={()=>exportCSV('waitlist.csv', waitlistData)}>Export CSV</button>
        </div>
      </div>
      <div className="pc-section">
        <div className="pc-stats-row">
          <div>Total: {waitlistStats.total}</div>
          <div>Pending: {waitlistStats.pending}</div>
          <div>Approved: {waitlistStats.approved}</div>
        </div>
        <table className="pc-table">
          <thead><tr><th>Name</th><th>Business</th><th>Phone</th><th>Type</th><th>Revenue</th><th>Status</th></tr></thead>
          <tbody>
            {waitlistData.map(w=> (
              <tr key={w.id}><td>{w.name}</td><td>{w.businessName}</td><td>{w.phone}</td><td>{w.businessType}</td><td>{w.revenueRange}</td><td>{w.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
