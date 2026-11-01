import React from 'react';
import { Brain, Zap, ShieldCheck, TrendingUp } from 'lucide-react';
import { MOCK_AI_INSIGHTS } from '../../data/mockData';

const AIInsightsView = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">AI Predictive Insights & Machine Intelligence</h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated recommendations for ETA prediction, route risk scoring & accessibility metrics
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
          Phase 3 ML Engine
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_AI_INSIGHTS.map((ai) => (
          <div key={ai.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Brain className="w-5 h-5" />
              </div>
              <span className="text-[10px] bg-slate-950 border border-purple-500/30 text-purple-300 px-2.5 py-0.5 rounded font-mono font-bold">
                Confidence: {ai.confidence}
              </span>
            </div>

            <h3 className="font-bold text-base text-slate-100">{ai.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">"{ai.insight}"</p>

            <div className="pt-3 border-t border-slate-800 flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Category: {ai.category}</span>
              <span className="text-cyan-400">Action Suggested</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIInsightsView;
