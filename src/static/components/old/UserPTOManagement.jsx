import React from 'react';
import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { invoke } from '@forge/bridge';
import UserPicker from '../Common/UserPicker';
import EditPTOModal from './EditPTOModal';

const UserPTOManagement = ({ currentUser, showNotification, isAdmin }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]  // End of current year
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  useEffect(() => {
    if (selectedUser) {
      loadUserRequests();
    }
  }, [selectedUser, dateRange]);

  const loadUserData = async (userId) => {
    try {
      // Get user details from database
      const dbResponse = await invoke('getUsers');
      const dbUsers = dbResponse.success ? dbResponse.data || [] : [];
      const userDetails = dbUsers.find(u => 
        u.jira_account_id === userId || 
        u.id === userId
      );

      if (userDetails) {
        setSelectedUser(userDetails);
        // Load PTO requests for this user
        const requestsResponse = await invoke('getPTORequests');
        if (requestsResponse.success) {
          const allRequests = requestsResponse.data || [];
          const userRequests = allRequests.filter(request => 
            request.requester_id === userId || 
            request.requester_id === userDetails.jira_account_id
          );
          setRequests(userRequests);
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const loadUserRequests = async () => {
    setLoading(true);
    try {
      const response = await invoke('getPTORequests', {
        requester_id: selectedUser.accountId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      if (response.success) {
        setRequests(response.data || []);
      }
    } catch (error) {
      showNotification('Failed to load PTO requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRequest = (request) => {
    setEditingRequest(request);
  };

  const handleSaveEdit = async (updatedRequest) => {
    showNotification('PTO request updated successfully');
    loadUserRequests();
  };

  const handleDeleteRequest = async (request) => {
    if (!window.confirm('Are you sure you want to delete this PTO request?')) return;

    try {
      const response = await invoke('adminDeletePTORequest', {
        requestId: request.id,
        adminId: currentUser.accountId,
        reason: 'Admin deletion'
      });

      if (response.success) {
        showNotification('PTO request deleted successfully');
        loadUserRequests();
      } else {
        showNotification(response.message || 'Failed to delete request', 'error');
      }
    } catch (error) {
      showNotification('Failed to delete PTO request', 'error');
    }
  };

  // Calculate summary statistics
  const summary = {
    totalDays: requests.reduce((sum, req) => sum + (req.total_days || 0), 0),
    approved: requests.filter(req => req.status === 'approved').length,
    pending: requests.filter(req => req.status === 'pending').length,
    declined: requests.filter(req => req.status === 'declined').length
  };

  return (
    <div className="user-pto-management">
      <div className="user-pto-header">
        <h2>User PTO Management</h2>
        <div className="user-pto-controls">
          <UserPicker
            selectedUser={selectedUser}
            onSelect={setSelectedUser}
            placeholder="Search and select user"
            useBackendSearch={true}
          />
          <div className="date-range-filter">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="form-control"
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="form-control"
            />
          </div>
        </div>
      </div>

      {selectedUser && (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">
                <Calendar size={24} />
              </div>
              <div className="card-content">
                <div className="card-value">{summary.totalDays}</div>
                <div className="card-label">Total PTO Days</div>
              </div>
            </div>
            <div className="summary-card approved">
              <div className="card-icon">
                <CheckCircle size={24} />
              </div>
              <div className="card-content">
                <div className="card-value">{summary.approved}</div>
                <div className="card-label">Approved</div>
              </div>
            </div>
            <div className="summary-card pending">
              <div className="card-icon">
                <Clock size={24} />
              </div>
              <div className="card-content">
                <div className="card-value">{summary.pending}</div>
                <div className="card-label">Pending</div>
              </div>
            </div>
          </div>

          <div className="requests-table-container">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>PTO Date</th>
                  <th>Leave Type</th>
                  <th>Period</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id}>
                    <td>{new Date(request.start_date).toLocaleDateString()}</td>
                    <td>
                      <span className={`leave-type ${request.leave_type}`}>
                        {request.leave_type}
                      </span>
                    </td>
                    <td>
                      {request.start_date === request.end_date ? 
                        new Date(request.start_date).toLocaleDateString() :
                        `${new Date(request.start_date).toLocaleDateString()} - ${new Date(request.end_date).toLocaleDateString()}`
                      }
                    </td>
                    <td>{request.total_days}</td>
                    <td>{request.reason}</td>
                    <td>
                      <span className={`status-badge status-${request.status}`}>
                        {request.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="actions">
                        <button
                          onClick={() => handleEditRequest(request)}
                          className="action-btn edit"
                          title="Edit request"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(request)}
                          className="action-btn delete"
                          title="Delete request"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="empty-state">
                      <div className="empty-content">
                        <Calendar size={24} />
                        <p>No PTO requests found for this period</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedUser && (
        <div className="empty-state">
          <div className="empty-content">
            <AlertCircle size={32} />
            <p>Select a user to view their PTO requests</p>
          </div>
        </div>
      )}

      {editingRequest && (
        <EditPTOModal
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSave={handleSaveEdit}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default UserPTOManagement; 