import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }){
  return (
    <div className="pc-app">
      <Sidebar />
      <div className="pc-main">
        <Header />
        <main className="pc-content">{children}</main>
      </div>
    </div>
  );
}
