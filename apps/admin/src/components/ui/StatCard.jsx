import React from 'react';

export default function StatCard({ title, value, delta }){
  return (
    <div className="pc-statcard">
      <div className="pc-stat-title">{title}</div>
      <div className="pc-stat-value">{value}</div>
      {delta !== undefined && <div className="pc-stat-delta">{delta}</div>}
    </div>
  );
}
