import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';
import Avatar from '@atlaskit/avatar';
import { format } from 'date-fns';

const NoRequests = ({ onRefresh }) => (
  <div className="no-requests-state">
    <h3>No Pending Requests</h3>
    <p>There are currently no PTO requests requiring your approval.</p>
    <div style={{ marginTop: '16px' }}>
      <Button appearance="primary" onClick={onRefresh}>
        Refresh List
      </Button>
    </div>
  </div>
);

const ApprovalList = ({ currentUser, showNotification }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    if (currentUser) {
      loadPendingRequests();
    }
  }, [currentUser]);

  const loadPendingRequests = async () => {
    setLoading(true);
    try {
      const response = await invoke('getPendingRequests', {
        managerEmail: currentUser.emailAddress
      });
      
      if (response.success) {
        setRequests(response.data || []);
      } else {
        showNotification(response.message, 'error');
      }
    } catch (error) {
      showNotification('Failed to load pending requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, status) => {
    setProcessing(prev => ({ ...prev, [requestId]: true }));
    
    try {
      const response = await invoke('updatePTORequest', {
        requestId,
        status
      });

      if (response.success) {
        showNotification(`Request ${status.toLowerCase()} successfully`);
        loadPendingRequests(); // Refresh list
      } else {
        showNotification(response.message, 'error');
      }
    } catch (error) {
      showNotification('Failed to process request', 'error');
    } finally {
      setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p>Loading pending requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="no-requests-state">
        <h3>No Pending Requests</h3>
        <p>There are currently no PTO requests requiring your approval.</p>
      </div>
    );
  }

  return (
    <div className="approval-list">
      <h2>Pending PTO Requests</h2>
      
      <div className="requests-grid">
        {requests.map(request => (
          <div key={request.id} className="request-card">
            <div className="request-header">
              <div className="requester-info">
                <div className="user-avatar">
                  <div className="avatar-placeholder">
                    {request.requester_name?.charAt(0) || '?'}
                  </div>
                </div>
                <div className="requester-details">
                  <h4>{request.requester_name}</h4>
                  <span className="request-type">{request.leave_type}</span>
                </div>
              </div>
              <div className="request-dates">
                <div className="date-range">
                  {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                </div>
                <div className="duration">
                  {request.total_days} days ({request.total_hours}h)
                </div>
              </div>
            </div>

            <div className="request-reason">
              <strong>Reason:</strong>
              <p>{request.reason}</p>
            </div>

            <div className="request-actions">
              <div className="action-buttons">
                <button
                  className="approve-btn"
                  onClick={() => handleApproval(request.id, 'approved')}
                  disabled={processing[request.id]}
                >
                  {processing[request.id] ? '...' : '✅ Approve'}
                </button>
                <button
                  className="decline-btn"
                  onClick={() => handleApproval(request.id, 'declined')}
                  disabled={processing[request.id]}
                >
                  {processing[request.id] ? '...' : '❌ Decline'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApprovalList;