import React from 'react';

export default function StatusBadge({ status }){
  const cls = `pc-badge pc-badge-${status}`;
  return <span className={cls}>{status.replace('_',' ')}</span>;
}
