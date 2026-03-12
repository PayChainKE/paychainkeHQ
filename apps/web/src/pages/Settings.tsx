import React from 'react';

const Settings: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold mb-4">Settings</h1>
    <p className="text-gray-600 mb-6">Manage your account, preferences, and business settings. Update profile, change password, and configure notifications.</p>
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Business Name</label>
        <input type="text" className="border rounded px-3 py-2 w-64" placeholder="Enter business name" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" className="border rounded px-3 py-2 w-64" placeholder="Enter email" />
      </div>
      <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold">Save Changes</button>
    </div>
  </div>
);

export default Settings;
