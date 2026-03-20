import React from 'react';
import Layout from '../components/layout/Layout';
import { messagesData, messageStats } from '../mockData/messages';

export default function Messages(){
  return (
    <Layout>
      <div className="pc-page-head"><h2>Messages</h2><div>Unread: {messageStats.unread}</div></div>
      <div className="pc-section">
        <table className="pc-table">
          <thead><tr><th>From</th><th>Subject</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {messagesData.map(m=> (
              <tr key={m.id}><td>{m.name}<div className="pc-sub">{m.email}{m.phone?` · ${m.phone}`:''}</div></td><td>{m.subject}</td><td>{m.contactType}</td><td>{new Date(m.createdAt).toLocaleDateString()}</td><td>{m.isRead ? 'Read' : 'Unread'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
