import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import HubCard from '../../components/ui/HubCard';
import { MOCK_HUBS } from '../../data/mockData';
import { Building2, Plus, Search, Filter, MapPin, X } from 'lucide-react';

const HubsManagement = () => {
  const [hubs, setHubs] = useState(MOCK_HUBS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHubDetails, setSelectedHubDetails] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    address: '',
    longitude: 77.2090,
    latitude: 28.6139,
    capacity: 4000
  });

  useEffect(() => {
    const fetchHubs = async () => {
      try {
        const res = await axiosInstance.get('/hubs');
        if (res.data.data?.length) {
          setHubs(res.data.data);
        }
      } catch (err) {
        console.log('Using mock Pan-India hubs fallback');
      }
    };
    fetchHubs();
  }, []);

  const handleAddHub = async (e) => {
    e.preventDefault();
    try {
      const newHub = {
        ...formData,
        _id: `hub-${Date.now()}`,
        currentUtilization: 0,
        activeShipments: 0,
        vehicleCount: 0,
        status: 'ACTIVE'
      };
      await axiosInstance.post('/hubs', formData).catch(() => {});
      setHubs([newHub, ...hubs]);
      setShowAddModal(false);
    } catch (err) {
      alert('Error creating hub');
    }
  };

  const statesList = Array.from(new Set(hubs.map(h => h.state)));

  const filteredHubs = hubs.filter((hub) => {
    const matchesSearch =
      hub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hub.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (hub.code && hub.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesState = selectedState === 'ALL' || hub.state === selectedState;
    const matchesStatus = selectedStatus === 'ALL' || hub.status === selectedStatus;

    return matchesSearch && matchesState && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Pan-India Hub Network</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage warehouse capacity, storage utilization & regional distribution hubs across India
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Regional Hub</span>
        </button>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hubs by name, city, or Hub ID (e.g. BLR-01)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">State:</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All States</option>
              {statesList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHubs.map((hub) => (
          <HubCard
            key={hub._id}
            hub={hub}
            onViewDetails={(h) => setSelectedHubDetails(h)}
          />
        ))}
      </div>

      {/* Hub Details Modal */}
      {selectedHubDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-cyan-400 font-mono font-bold bg-slate-950 border border-cyan-500/30 px-2 py-0.5 rounded">
                  HUB ID: {selectedHubDetails.code || 'HUB-01'}
                </span>
                <h2 className="text-xl font-bold text-slate-100 mt-1">{selectedHubDetails.name}</h2>
              </div>
              <button
                onClick={() => setSelectedHubDetails(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300">
              <p><span className="text-slate-500">Location: </span>{selectedHubDetails.city}, {selectedHubDetails.state}</p>
              <p><span className="text-slate-500">Address: </span>{selectedHubDetails.address}</p>
              <p><span className="text-slate-500">Total Capacity: </span>{selectedHubDetails.capacity} Units</p>
              <p><span className="text-slate-500">Current Storage: </span>{selectedHubDetails.currentUtilization || 0} Units</p>
              <p><span className="text-slate-500">Assigned Fleet: </span>{selectedHubDetails.vehicleCount || 0} Transport Vehicles</p>
              <p><span className="text-slate-500">Coordinates: </span>{selectedHubDetails.location?.coordinates?.join(', ') || '77.06, 28.59'}</p>
            </div>

            <button
              onClick={() => setSelectedHubDetails(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
            >
              Close Hub Overview
            </button>
          </div>
        </div>
      )}

      {/* Add Hub Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100">Create New Regional Logistics Hub</h2>
            <form onSubmit={handleAddHub} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Hub Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  placeholder="e.g. Guwahati Logistics Hub"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Hub Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 uppercase"
                    placeholder="GAU-01"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Capacity</label>
                  <input
                    type="number"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Full Address</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-500"
                >
                  Save Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubsManagement;
