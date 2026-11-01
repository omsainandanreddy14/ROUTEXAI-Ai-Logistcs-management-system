import React from 'react';
import { PackageX } from 'lucide-react';

const EmptyState = ({ icon: Icon = PackageX, title = 'No Data Found', description = 'There are no records matching your criteria right now.', actionText, onAction }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-lg transition"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
