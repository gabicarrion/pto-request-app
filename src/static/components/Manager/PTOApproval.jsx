import React from 'react';
import { useState, useEffect } from 'react';
import { invoke } from "@forge/bridge";

const PTOApproval = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managerEmail, setManagerEmail] = useState('');

  const fetchPendingRequests = async () => {
    if (!managerEmail) {
      setError('Please enter your manager email');
      return;
    }

    setLoading(true);
    try {
      const response = await invoke('getPendingRequests', { 
        payload: { managerEmail } 
      });
      
      if (response.success) {
        setPendingRequests(response.data || []);
        setError('');
      } else {
        setError(response.message || 'Failed to load pending requests');
      }
    } catch (err) {
      setError('Error loading pending requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, isApproved) => {
    try {
      await invoke('updatePTORequest', {
        payload: {
          requestId,
          managerEmail,
          status: isApproved ? 'approved' : 'rejected'
        }
      });
      
      // Refresh the list after approval/rejection
      fetchPendingRequests();
    } catch (err) {
      setError('Failed to process approval');
      console.error(err);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Manager Email:
        </label>
        <div className="flex gap-4">
          <input
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Enter your manager email"
          />
          <button
            onClick={fetchPendingRequests}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Requests'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-auto">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left border">Requester</th>
              <th className="p-2 text-left border">Dates</th>
              <th className="p-2 text-left border">Type</th>
              <th className="p-2 text-left border">Reason</th>
              <th className="p-2 text-left border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingRequests.map((request) => (
              <tr key={request.id} className="border-t">
                <td className="p-2 border">{request.email}</td>
                <td className="p-2 border">
                  {request.startDate} to {request.endDate}
                </td>
                <td className="p-2 border">{request.requestType}</td>
                <td className="p-2 border">{request.reason}</td>
                <td className="p-2 border">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(request.id, true)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(request.id, false)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PTOApproval;