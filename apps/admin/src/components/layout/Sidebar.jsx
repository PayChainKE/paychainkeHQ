import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, BarChart2, MessageCircle, Settings, Mail } from 'lucide-react';

export default function Sidebar(){
  return (
    <aside className="pc-sidebar">
      <div className="pc-brand">PayChain Admin</div>
      <nav>
        <ul>
          <li><NavLink to="/overview"><Home size={16}/> Overview</NavLink></li>
            <li><NavLink to="/waitlist"><Users size={16}/> Waitlist</NavLink></li>
            <li><NavLink to="/newsletter"><Mail size={16}/> Newsletter</NavLink></li>
            <li><NavLink to="/team"><Users size={16}/> Team</NavLink></li>
          <li><NavLink to="/merchants"><Users size={16}/> Merchants</NavLink></li>
          <li><NavLink to="/analytics"><BarChart2 size={16}/> Analytics</NavLink></li>
          <li><NavLink to="/messages"><MessageCircle size={16}/> Messages</NavLink></li>
          <li><NavLink to="/settings"><Settings size={16}/> Settings</NavLink></li>
        </ul>
      </nav>
    </aside>
  );
}
