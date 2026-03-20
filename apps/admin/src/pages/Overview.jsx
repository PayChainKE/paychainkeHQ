import React from 'react';
import Layout from '../components/layout/Layout';
import StatCard from '../components/ui/StatCard';
import { merchantsData } from '../mockData/merchants';
import { waitlistData } from '../mockData/waitlist';
import { messagesData } from '../mockData/messages';

export default function Overview(){
  const totalMerchants = merchantsData.length;
  const totalWaitlist = waitlistData.length;
  const totalMessages = messagesData.length;

  return (
    <Layout>
      <div className="pc-grid">
        <StatCard title="Merchants" value={totalMerchants} />
        <StatCard title="Waitlist" value={totalWaitlist} />
        <StatCard title="Messages" value={totalMessages} />
      </div>
      <section className="pc-section">
        <h3>Recent signups</h3>
        <table className="pc-table">
          <thead><tr><th>Name</th><th>Business</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>
            {merchantsData.slice(0,8).map(m=> (
              <tr key={m.id}><td>{m.name}</td><td>{m.businessName}</td><td>{m.accountStatus}</td><td>{new Date(m.joinedAt).toLocaleDateString()}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </Layout>
  );
}
