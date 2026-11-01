import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
      <Compass className="w-16 h-16 text-cyan-400 animate-spin mb-4" />
      <h1 className="text-4xl font-black text-slate-100 mb-2">404 - Page Not Found</h1>
      <p className="text-sm text-slate-400 max-w-sm mb-6">The requested route or module does not exist on RouteXAI Platform.</p>
      <Link
        to="/login"
        className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-lg transition"
      >
        Return to Portal
      </Link>
    </div>
  );
};

export default NotFound;
