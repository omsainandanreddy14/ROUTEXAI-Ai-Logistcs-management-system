import React, { useState } from 'react';
import { AlertTriangle, Send, CheckCircle2 } from 'lucide-react';

const DriverReportIssue = () => {
  const [submitted, setSubmitted] = useState(false);
  const [issueType, setIssueType] = useState('TRAFFIC_BLOCK');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Report Road & Route Issue</h1>
        <p className="text-xs text-slate-400 mt-1">Notify Owner and AI Rerouting Engine of road disruptions</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-100">Disruption Reported Successfully</h3>
            <p className="text-xs text-slate-400">
              The Owner Command Center and AI Rerouting System have been notified of your report.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-2 px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Report Another Issue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Disruption Classification
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100"
              >
                <option value="TRAFFIC_BLOCK">Heavy Traffic Congestion / Toll Bottleneck</option>
                <option value="WEATHER_HAZARD">Heavy Rain / Monsoon Flooding</option>
                <option value="ROAD_DAMAGE">Landslide / Road Construction Damage</option>
                <option value="VEHICLE_BREAKDOWN">Vehicle Mechanical Failure</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Location & Details
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100"
                placeholder="Describe landmark, highway kilometer marker, and estimated delay..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-500/20 transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Submit Disruption Alert</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DriverReportIssue;
