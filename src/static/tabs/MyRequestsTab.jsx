import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { Calendar, Clock, RefreshCw, Filter, Plus } from 'lucide-react';
import StatusBadge from '../components/Common/StatusBadge';
import RequestModal from '../components/Modal/RequestModal';
import DateRangeFilter from '../components/Common/DateRangeFilter';
import { getLeaveTypeEmoji, getLeaveTypeLabel } from '../components/Common/leaveTypeUtils';

/**
 * MyRequestsTab component displays the user's PTO requests
 * 
 * @param {Object} props
 * @param {Object} props.currentUser - Current user information
 */
const MyRequestsTab = ({ currentUser }) => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: { preset: 'all', from: '', to: '' },
    leaveType: 'all'
  });

  // Load user's requests on component mount
  useEffect(() => {
    if (currentUser) {
      loadRequests();
      loadTeamsAndUsers();
    }
  }, [currentUser]);

  // Filter requests when filters or requests change
  useEffect(() => {
    filterRequests();
  }, [requests, filters]);

  // Load user's PTO requests
  const loadRequests = async () => {
    setLoading(true);
    
    try {
      const response = await invoke('getUserPtoRequests', {
        userId: currentUser.id || currentUser.accountId || currentUser.jira_account_id
      });
      
      if (response.success) {
        setRequests(response.data || []);
      } else {
        console.error('Failed to load requests:', response.message);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load teams and users for the request modal
  const loadTeamsAndUsers = async () => {
    try {
      // Load teams
      const teamsResponse = await invoke('getTeams');
      if (teamsResponse.success) {
        setTeams(teamsResponse.data || []);
      }
      
      // Load users
      const usersResponse = await invoke('getUsers');
      if (usersResponse.success) {
        setUsers(usersResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load teams and users:', error);
    }
  };

  // Filter requests based on current filters
  const filterRequests = () => {
    let filtered = [...requests];
    
    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(request => request.status === filters.status);
    }
    
    // Filter by leave type
    if (filters.leaveType !== 'all') {
      filtered = filtered.filter(request => request.leave_type === filters.leaveType);
    }
    
    // Filter by date range
    if (filters.dateRange.preset !== 'all') {
      const { preset, from, to } = filters.dateRange;
      
      if (preset === 'custom' && from && to) {
        // Custom date range
        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999); // End of day
        
        filtered = filtered.filter(request => {
          const startDate = new Date(request.start_date);
          const endDate = new Date(request.end_date);
          
          return (startDate >= fromDate && startDate <= toDate) || 
                 (endDate >= fromDate && endDate <= toDate) || 
                 (startDate <= fromDate && endDate >= toDate);
        });
      } else if (preset === 'current_year') {
        // Current year
        const currentYear = new Date().getFullYear();
        
        filtered = filtered.filter(request => {
          const requestYear = new Date(request.start_date).getFullYear();
          return requestYear === currentYear;
        });
      } else if (preset === 'last_30_days') {
        // Last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        filtered = filtered.filter(request => {
          const startDate = new Date(request.start_date);
          return startDate >= thirtyDaysAgo;
        });
      } else if (preset === 'last_90_days') {
        // Last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        filtered = filtered.filter(request => {
          const startDate = new Date(request.start_date);
          return startDate >= ninetyDaysAgo;
        });
      }
    }
    
    setFilteredRequests(filtered);
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle creating or updating a request
  const handleSubmitRequest = async (requestData) => {
    try {
      if (requestData.id) {
        // Update existing request
        await invoke('updatePtoRequest', requestData);
      } else {
        // Create new request
        await invoke('createPtoRequest', requestData);
      }
      
      // Refresh requests
      await loadRequests();
      
      return true;
    } catch (error) {
      console.error('Failed to submit request:', error);
      return false;
    }
  };

  // Handle cancellation of a request
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) {
      return;
    }
    
    setLoading(true);
    
    try {
      await invoke('cancelPtoRequest', { requestId });
      
      // Refresh requests
      await loadRequests();
    } catch (error) {
      console.error('Failed to cancel request:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format date range for display
  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Format the dates
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    
    if (startDate === endDate) {
      return start.toLocaleDateString(undefined, options);
    }
    
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  };

  return (
    <div className="my-requests-tab">
      <div className="tab-header">
        <h2>My PTO Requests</h2>
        
        <div className="tab-actions">
          <button 
            className="refresh-button" 
            onClick={loadRequests} 
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          
          <button 
            className="create-request-button" 
            onClick={() => {
              setSelectedRequest(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            New Request
          </button>
        </div>
      </div>
      
      <div className="filters-section">
        <div className="filter-group">
          <label>Status:</label>
          <div className="button-filter">
            <button 
              className={filters.status === 'all' ? 'active' : ''} 
              onClick={() => handleFilterChange('status', 'all')}
            >
              All
            </button>
            <button 
              className={filters.status === 'pending' ? 'active' : ''} 
              onClick={() => handleFilterChange('status', 'pending')}
            >
              Pending
            </button>
            <button 
              className={filters.status === 'approved' ? 'active' : ''} 
              onClick={() => handleFilterChange('status', 'approved')}
            >
              Approved
            </button>
            <button 
              className={filters.status === 'declined' ? 'active' : ''} 
              onClick={() => handleFilterChange('status', 'declined')}
            >
              Declined
            </button>
          </div>
        </div>
        
        <div className="filter-group">
          <label>Date Range:</label>
          <DateRangeFilter 
            value={filters.dateRange} 
            onChange={value => handleFilterChange('dateRange', value)} 
          />
        </div>
        
        <div className="filter-group">
          <label>Leave Type:</label>
          <select 
            value={filters.leaveType} 
            onChange={e => handleFilterChange('leaveType', e.target.value)}
            className="form-control"
          >
            <option value="all">All Types</option>
            <option value="vacation">Vacation</option>
            <option value="sick">Sick Leave</option>
            <option value="personal">Personal Leave</option>
            <option value="holiday">Holiday</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      
      {loading && requests.length === 0 ? (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" />
          <p>Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>No Requests Found</h3>
          <p>
            {requests.length === 0 ? 
              "You haven't made any PTO requests yet." : 
              "No requests match your current filters."}
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setSelectedRequest(null);
              setShowModal(true);
            }}
          >
            Create Your First Request
          </button>
        </div>
      ) : (
        <div className="requests-list">
          {filteredRequests.map(request => (
            <div key={request.id} className="request-card">
              <div className="request-card-header">
                <div className="request-type">
                  <span className="leave-type-emoji">
                    {getLeaveTypeEmoji(request.leave_type)}
                  </span>
                  <span className="leave-type-label">
                    {getLeaveTypeLabel(request.leave_type)}
                  </span>
                </div>
                <StatusBadge status={request.status} />
              </div>
              
              <div className="request-card-body">
                <div className="request-date">
                  <Calendar size={16} />
                  <span>{formatDateRange(request.start_date, request.end_date)}</span>
                </div>
                
                <div className="request-duration">
                  <Clock size={16} />
                  <span>
                    {request.total_days} day{request.total_days !== 1 ? 's' : ''} 
                    ({request.total_hours} hours)
                  </span>
                </div>
                
                {request.reason && (
                  <div className="request-reason">
                    <p>"{request.reason}"</p>
                  </div>
                )}
              </div>
              
              <div className="request-card-footer">
                {request.status === 'pending' && (
                  <div className="request-actions">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleCancelRequest(request.id)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                <div className="request-meta">
                  <span className="request-date-submitted">
                    Submitted: {new Date(request.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Request Modal */}
      {showModal && (
        <RequestModal
          isOpen={showModal}
          onClose={() => {
            setSelectedRequest(null);
            setShowModal(false);
          }}
          currentUser={currentUser}
          teams={teams || []}
          users={users || []}
          onSubmit={handleSubmitRequest}
          editRequest={selectedRequest}
        />
      )}
    </div>
  );
};

export default MyRequestsTab;