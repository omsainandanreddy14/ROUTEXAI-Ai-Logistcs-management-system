import React from 'react';
import { Compass } from 'lucide-react';

const LoadingState = ({ message = 'Loading RouteXAI Intelligence...' }) => {
  return (
    <div className="py-16 flex flex-col items-center justify-center space-y-3">
      <Compass className="w-8 h-8 text-cyan-400 animate-spin" />
      <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{message}</span>
    </div>
  );
};

export default LoadingState;
