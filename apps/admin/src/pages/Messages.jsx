import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';

export default function Messages(){
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiUrl = import.meta.env.VITE_API_URL || (isLocal ? '' : 'https://www.paychain.co.ke');
        const response = await fetch(`${apiUrl}/api/contact`);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        setMessages(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  const stats = {
    unread: messages.filter(m => !m.isRead).length
  };

  return (
    <Layout>
      <div className="pc-page-head">
        <h2>Messages</h2>
        <div>Unread: {stats.unread}</div>
      </div>
      <div className="pc-section">
        {loading ? (
          <div className="pc-loading">Loading messages...</div>
        ) : error ? (
          <div className="pc-error">Error: {error}</div>
        ) : (
          <div className="pc-table-container">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(m => (
                  <tr key={m._id}>
                    <td>
                      {m.name}
                      <div className="pc-sub">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
                    </td>
                    <td>{m.subject}</td>
                    <td>{m.contactType}</td>
                    <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`pc-badge pc-badge-${m.isRead ? 'success' : 'warning'}`}>
                        {m.isRead ? 'Read' : 'Unread'}
                      </span>
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No messages found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
