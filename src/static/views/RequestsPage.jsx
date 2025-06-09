import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Eye, Edit, Trash2, TrendingUp, BarChart3, Filter } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { getLeaveTypeEmoji, getLeaveTypeColor } from '../components/leaveTypeUtils';
import DateRangeFilter from '../components/DateRangeFilter';
import EditPTOModal from '../components/EditPTOModal';


const RequestsPage = ({ requests, currentUser, onEditRequest, onCancelRequest }) => {
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ preset: 'all', from: '', to: '' });
  const [editingRequest, setEditingRequest] = useState(null);


  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

  const formatDateTime = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  // Check if request can be edited/cancelled
  const canEditRequest = (request) => {
    if (request.requester_id !== currentUser.accountId) return false;
    
    // Can always edit pending requests
    if (request.status === 'pending') return true;
    
    // For approved requests, can only edit if no past dates
    if (request.status === 'approved') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(request.start_date);
      return startDate >= today;
    }
    
    return false;
  };

  const canCancelRequest = (request) => {
    if (request.requester_id !== currentUser.accountId) return false;
    
    // Can't cancel if approved and all dates are in the past
    if (request.status === 'approved') {
      const endDate = new Date(request.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return endDate >= today;
    }
    
    // Can cancel pending requests
    return request.status === 'pending';
  };

  const handleEditRequest = (request) => {
    if (canEditRequest(request)) {
      setEditingRequest(request);
    }
  };

  const handleSaveEdit = (updatedRequest) => {
    onEditRequest(updatedRequest);
    setEditingRequest(null);
  };

  // Filter requests based on selected filters
  const filteredRequests = useMemo(() => {
    let filtered = Array.isArray(requests) ? [...requests] : [];

    // Date filter
    if (dateRange && dateRange.preset !== 'all') {
      let startDate, endDate;
      const now = new Date();
      switch (dateRange.preset) {
        case 'current_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'last_90_days':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 90);
          break;
        case 'last_30_days':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        case 'custom':
          startDate = dateRange.from ? new Date(dateRange.from) : null;
          endDate = dateRange.to ? new Date(dateRange.to) : null;
          break;
        default:
          startDate = null;
      }
      filtered = filtered.filter(request => {
        const submitted = new Date(request.submitted_at);
        if (dateRange.preset === 'custom') {
          if (startDate && submitted < startDate) return false;
          if (endDate && submitted > endDate) return false;
          return true;
        }
        return !startDate || submitted >= startDate;
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    return filtered;
  }, [requests, dateRange, statusFilter]);
  // Calculate statistics
  const stats = useMemo(() => {
    const safeRequests = Array.isArray(filteredRequests) ? filteredRequests : [];
    const totalRequests = safeRequests.length;
    const pendingRequests = safeRequests.filter(r => r.status === 'pending').length;
    const approvedRequests = safeRequests.filter(r => r.status === 'approved').length;
    const declinedRequests = safeRequests.filter(r => r.status === 'declined').length;
    const totalDays = safeRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.total_days || 0), 0);

    const ptoByType = safeRequests
      .filter(r => r.status === 'approved')
      .reduce((acc, request) => {
        const type = request.leave_type || 'unknown';
        acc[type] = (acc[type] || 0) + (request.total_days || 0);
        return acc;
      }, {});

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
      declinedRequests,
      totalDays,
      ptoByType
    };
  }, [filteredRequests]);

  if (requests.length === 0) {
    return (
      <div className="requests-container">
        <div className="card requests-card">
          <h2 className="card-title">My PTO Requests</h2>
          <div className="requests-empty">
            <Calendar size={48} className="requests-empty-icon" />
            <h3 className="requests-empty-title">No PTO requests found</h3>
            <p>You haven't submitted any PTO requests yet.</p>
            <p className="requests-empty-desc">Go to the Calendar tab to submit your first request!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-container">
      <div className="requests-header-section">
        <div className="requests-page-header">
          <h2 className="page-title">My PTO Requests</h2>
          <div className="requests-page-controls">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-secondary ${showFilters ? 'active' : ''}`}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-row">
              <div className="filter-group">
                <label>Date Range</label>
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
              </div>
              
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-control"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards - More compact */}
        <div className="summary-cards-container">
          <div className="summary-card stat-blue">
            <div className="summary-icon">
              <Calendar size={20} />
            </div>
            <div className="summary-content">
              <div className="summary-value">{stats.totalRequests}</div>
              <div className="summary-label">Total</div>
            </div>
          </div>

          <div className="summary-card stat-yellow">
            <div className="summary-icon">
              <Clock size={20} />
            </div>
            <div className="summary-content">
              <div className="summary-value">{stats.pendingRequests}</div>
              <div className="summary-label">Pending</div>
            </div>
          </div>

          <div className="summary-card stat-green">
            <div className="summary-icon">
              <TrendingUp size={20} />
            </div>
            <div className="summary-content">
              <div className="summary-value">{stats.approvedRequests}</div>
              <div className="summary-label">Approved</div>
            </div>
          </div>

          <div className="summary-card stat-red">
            <div className="summary-icon">
              <BarChart3 size={20} />
            </div>
            <div className="summary-content">
              <div className="summary-value">{stats.declinedRequests}</div>
              <div className="summary-label">Declined</div>
            </div>
          </div>

          <div className="summary-card stat-purple">
            <div className="summary-icon">
              <Eye size={20} />
            </div>
            <div className="summary-content">
              <div className="summary-value">{stats.totalDays}</div>
              <div className="summary-label">Days Off</div>
            </div>
          </div>
        </div>
      </div>

      <div className="requests-content">
        {/* PTO Breakdown by Leave Type - FIXED */}
        {Object.keys(stats.ptoByType || {}).length > 0 && (
          <div className="card pto-breakdown-card">
            <div className="card-header">
              <h3>PTO Breakdown by Leave Type</h3>
            </div>
            <div className="card-body">
              <div className="pto-breakdown-grid">
                {Object.entries(stats.ptoByType || {}).map(([type, days]) => (
                  <div key={type} className="pto-breakdown-item">
                    <div className="breakdown-icon">
                      {getLeaveTypeEmoji(type)}
                    </div>
                    <div className="breakdown-details">
                      <div className="breakdown-type">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                      <div className="breakdown-days">
                        {days} {days === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                    <div className="breakdown-percentage">
                      {stats.totalDays > 0 ? ((days / stats.totalDays) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Requests List - Compact Cards */}
        <div className="card requests-list-card">
          <div className="card-header">
            <h3>Request History</h3>
            <div className="requests-count">
              {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'}
            </div>
          </div>
          
          <div className="card-body">
            {filteredRequests.length === 0 ? (
              <div className="no-results">
                <p>No requests found for the selected filters.</p>
              </div>
            ) : (
              <div className="requests-list compact">
                {filteredRequests.map(request => (
                  <div key={request.id} className="request-item compact">
                    <div className="request-header-compact">
                      <div className="request-type-info">
                        <span className="request-emoji">
                          {getLeaveTypeEmoji(request.leave_type)}
                        </span>
                        <div className="request-title-group">
                          <h4 className="request-title">
                            {request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)}
                          </h4>
                          <div className="request-dates">
                            {formatDate(request.start_date)} - {formatDate(request.end_date)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="request-status-section">
                        <StatusBadge status={request.status} />
                        <div className="request-duration">
                          {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="request-actions">
                        {canEditRequest(request) && (
                          <button
                            onClick={() => handleEditRequest(request)}
                            className="btn btn-sm btn-secondary"
                            title="Edit Request"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        
                        {canCancelRequest(request) && (
                          <button
                            onClick={() => onCancelRequest && onCancelRequest(request)}
                            className="btn btn-sm btn-danger"
                            title="Cancel Request"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {request.reason && (
                      <div className="request-reason compact">
                        <span className="reason-label">Reason:</span>
                        <span className="reason-text">{request.reason}</span>
                      </div>
                    )}

                    <div className="request-metadata compact">
                      <div className="metadata-item">
                        <span className="metadata-label">Submitted:</span>
                        <span className="metadata-value">{formatDate(request.submitted_at)}</span>
                      </div>
                      
                      {request.status !== 'pending' && request.reviewed_at && (
                        <div className="metadata-item">
                          <span className="metadata-label">
                            {request.status === 'approved' ? 'Approved:' : 'Declined:'}
                          </span>
                          <span className="metadata-value">{formatDate(request.reviewed_at)}</span>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add EditPTOModal */}
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

export default RequestsPage;