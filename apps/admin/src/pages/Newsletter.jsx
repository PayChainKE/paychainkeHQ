import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { exportCSV } from '../utils/exportCSV';
import { Mail } from 'lucide-react';

export default function Newsletter(){
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');
        const response = await fetch(`${apiUrl}/api/newsletter`);
        if (!response.ok) {
          throw new Error('Failed to fetch subscribers');
        }
        const data = await response.json();
        setSubscribers(data);
      } catch (err) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
          setError(`Could not connect to the API server. Please ensure the API is running and VITE_API_URL is correctly configured. (Attempted: ${apiUrl})`);
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      <div className="pc-page-head">
        <div className="flex items-center gap-2">
          <Mail className="text-emerald-500" size={24} />
          <h2>Newsletter Subscribers</h2>
        </div>
        <div className="pc-actions">
          <button 
            className="pc-btn pc-btn-primary"
            onClick={()=>{
              const cleaned = subscribers.map(s => ({
                'Email Address': s.email,
                'Status': s.status || 'active',
                'Date Subscribed': new Date(s.subscribedAt).toLocaleString()
              }));
              exportCSV('newsletter_subscribers.csv', cleaned);
            }}
          >
            Export CSV
          </button>
        </div>
      </div>
      
      <div className="pc-section">
        <div className="pc-stats-row mb-6">
          <div className="pc-stat-card">
            <span className="pc-stat-label">Total Subscribers</span>
            <span className="pc-stat-value">{subscribers.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="pc-loading">
            <div className="pc-spinner"></div>
            <span>Loading subscribers...</span>
          </div>
        ) : error ? (
          <div className="pc-error">Error: {error}</div>
        ) : (
          <div className="pc-table-container">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Email Address</th>
                  <th>Status</th>
                  <th>Date Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map(s => (
                  <tr key={s._id}>
                    <td className="font-medium text-emerald-400">{s.email}</td>
                    <td>
                      <span className={`pc-badge pc-badge-${s.status === 'active' ? 'success' : 'warning'}`}>
                        {s.status || 'active'}
                      </span>
                    </td>
                    <td>{new Date(s.subscribedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {subscribers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-500">
                      No subscribers found.
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
