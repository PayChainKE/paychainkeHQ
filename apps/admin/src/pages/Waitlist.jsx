import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { exportCSV } from '../utils/exportCSV';

export default function Waitlist(){
  const [waitlistData, setWaitlistData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/waitlist`);
        if (!response.ok) {
          throw new Error('Failed to fetch waitlist');
        }
        const data = await response.json();
        setWaitlistData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const waitlistStats = {
    total: waitlistData.length,
    pending: waitlistData.filter(w => w.status !== 'Approved').length, // Assuming a status field might exist or be added later
    approved: waitlistData.filter(w => w.status === 'Approved').length
  };

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
          {/* We'll keep these stats for now, even if they don't fully map to the new schema yet */}
        </div>
        {loading ? (
          <div>Loading waitlist...</div>
        ) : error ? (
          <div className="error-message">Error: {error}</div>
        ) : (
          <table className="pc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Business</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Challenge</th>
                <th>Date Joined</th>
              </tr>
            </thead>
            <tbody>
              {waitlistData.map(w => (
                <tr key={w._id}>
                  <td>{w.fullName}</td>
                  <td>{w.businessName}</td>
                  <td>{w.phone}</td>
                  <td>{w.businessType}</td>
                  <td>{w.challenge || 'N/A'}</td>
                  <td>{new Date(w.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
