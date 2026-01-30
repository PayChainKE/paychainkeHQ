import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4" style={{ backgroundImage: 'url("/under construction .png")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Back to Home Button at top */}
      <Link to="/" className="absolute top-4 left-4 z-20">
        <button className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </Link>

      <div className="text-center max-w-md mx-auto bg-white bg-opacity-90 p-8 rounded-lg shadow-lg">
        {/* Logo */}
        <div className="mb-8">
          <img src="/logo 2.png" alt="PayChain KE Logo" className="h-24 w-auto mx-auto" />
        </div>

        {/* Under Construction Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Under Construction</h1>
        <p className="text-gray-600 mb-8 text-lg">
          We're building something amazing! The dashboard will be available soon.
        </p>

        {/* Join Waitlist Button */}
        <button 
          onClick={() => window.open('https://forms.gle/eJQVeiSGioHN4t6s7', '_blank')}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Join Waitlist
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
