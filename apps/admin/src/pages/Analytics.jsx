import React from 'react';
import Layout from '../components/layout/Layout';
import { signupsOverTime, businessTypeData, revenueRangeData, topChallenges } from '../mockData/analytics';
import { Line } from 'react-chartjs-2';

export default function Analytics(){
  const signupsCfg = {
    labels: signupsOverTime.labels,
    datasets: [{ label: 'Signups', data: signupsOverTime.data, borderColor: '#0B4D2E', backgroundColor: 'rgba(11,77,46,0.08)' }]
  };

  return (
    <Layout>
      <div className="pc-page-head"><h2>Analytics</h2></div>
      <div className="pc-section">
        <div style={{height:240}}>
          {/* Chart.js charts */}
          <Line data={signupsCfg} />
        </div>
        <section className="pc-analytics-grid">
          <div>
            <h4>Business types (waitlist)</h4>
            <ul>{businessTypeData.labels.map((l,i)=>(<li key={l}>{l}: {businessTypeData.waitlist[i]}</li>))}</ul>
          </div>
          <div>
            <h4>Revenue ranges</h4>
            <ul>{revenueRangeData.labels.map((l,i)=>(<li key={l}>{l}: {revenueRangeData.data[i]}</li>))}</ul>
          </div>
          <div>
            <h4>Top challenges</h4>
            <ol>{topChallenges.map(t=>(<li key={t.phrase}>{t.phrase} — {t.count}</li>))}</ol>
          </div>
        </section>
      </div>
    </Layout>
  );
}
