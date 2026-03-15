import React from 'react';
import { useLocation } from 'react-router-dom';

// Embeds the dashboard app running on localhost:8081 under /paychain-dashboard/*
export default function PaychainDashboardProxy(){
  const loc = useLocation();
  // remove the leading /paychain-dashboard prefix
  const path = loc.pathname.replace(/^\/paychain-dashboard/, '') || '/';
  const src = `http://localhost:8083${path}`;

  return (
    <div className="min-h-screen">
      <iframe title="Paychain Dashboard" src={src} className="w-full h-screen border-0" />
    </div>
  );
}
