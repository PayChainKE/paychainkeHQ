import React from 'react';
import Layout from '../components/layout/Layout';
import { merchantsData, merchantStats } from '../mockData/merchants';
import StatusBadge from '../components/ui/StatusBadge';

export default function Merchants(){
  return (
    <Layout>
      <div className="pc-page-head"><h2>Merchants</h2></div>
      <div className="pc-section">
        <div className="pc-stats-row">
          <div>Total merchants: {merchantStats.total}</div>
          <div>Active: {merchantStats.active}</div>
          <div>KYC Verified: {merchantStats.kycVerified}</div>
        </div>
        <table className="pc-table">
          <thead><tr><th>Business</th><th>Owner</th><th>Phone</th><th>Status</th><th>Till</th><th>Trust</th></tr></thead>
          <tbody>
            {merchantsData.map(m=> (
              <tr key={m.id}><td>{m.businessName}</td><td>{m.name}</td><td>{m.phone}</td><td><StatusBadge status={m.accountStatus} /></td><td>{m.tillNumber || '—'}</td><td>{m.trustScore.current}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
