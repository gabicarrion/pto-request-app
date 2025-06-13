import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, Eye, Edit, Trash2, TrendingUp, BarChart3, Filter } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { getLeaveTypeEmoji, getLeaveTypeColor } from '../components/leaveTypeUtils';
import DateRangeFilter from '../components/DateRangeFilter';
import EditPTOModal from '../components/EditPTOModal';

const PTO_LEAVE_TYPES = [
  { key: 'vacation', label: 'Vacation', color: 'stat-blue' },
  { key: 'holiday', label: 'Holiday', color: 'stat-yellow' },
  { key: 'personal', label: 'Personal', color: 'stat-purple' }
];

const RequestsPage = ({ requests, currentUser, onEditRequest, onCancelRequest }) => {
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ preset: 'all', from: '', to: '' });
  const [editingRequest, setEditingRequest] = useState(null);
  const [ptoBalances, setPtoBalances] = useState(null);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balanceError, setBalanceError] = useState(null);

  useEffect(() => {
    async function fetchBalances() {
      setLoadingBalances(true);
      setBalanceError(null);
      try {
        // Replace this with your actual resolver call method
        const response = await window.forgeResolver.invoke('getUserPTOBalances', { accountId: currentUser.accountId });
        if (response.success) {
          setPtoBalances(response.data);
        } else {
          setBalanceError(response.message || 'Failed to fetch PTO balances');
        }
      } catch (err) {
        setBalanceError(err.message || 'Failed to fetch PTO balances');
      } finally {
        setLoadingBalances(false);
      }
    }
    if (currentUser?.accountId) fetchBalances();
  }, [currentUser?.accountId]);

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

    // Date filter (by scheduled PTO days, not submitted_at)
    if (dateRange && dateRange.preset !== 'all') {
      let filterStart, filterEnd;
      const now = new Date();
      switch (dateRange.preset) {
        case 'current_year':
          filterStart = new Date(now.getFullYear(), 0, 1);
          filterEnd = new Date(now.getFullYear(), 11, 31);
          break;
        case 'last_90_days':
          filterStart = new Date(now);
          filterStart.setDate(now.getDate() - 90);
          filterEnd = now;
          break;
        case 'last_30_days':
          filterStart = new Date(now);
          filterStart.setDate(now.getDate() - 30);
          filterEnd = now;
          break;
        case 'custom':
          filterStart = dateRange.from ? new Date(dateRange.from) : null;
          filterEnd = dateRange.to ? new Date(dateRange.to) : null;
          break;
        default:
          filterStart = null;
          filterEnd = null;
      }
      filtered = filtered.filter(request => {
        const reqStart = new Date(request.start_date);
        const reqEnd = new Date(request.end_date);
        // Overlap: (request ends after filter starts) && (request starts before filter ends)
        if (dateRange.preset === 'custom') {
          if (filterStart && reqEnd < filterStart) return false;
          if (filterEnd && reqStart > filterEnd) return false;
          return true;
        }
        return (!filterStart || reqEnd >= filterStart) && (!filterEnd || reqStart <= filterEnd);
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    return filtered;
  }, [requests, dateRange, statusFilter]);

  // Sort filteredRequests by start_date descending (most recent first)
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  }, [filteredRequests]);

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

  // Calculate Days Off (approved, excluding sick/other)
  const approvedRequests = useMemo(() =>
    (Array.isArray(requests) ? requests : []).filter(r => r.status === 'approved'),
    [requests]
  );
  const daysOffTypes = ['vacation', 'holiday', 'personal'];
  const daysOffBreakdown = daysOffTypes.reduce((acc, type) => {
    acc[type] = approvedRequests.filter(r => r.leave_type === type).reduce((sum, r) => sum + (r.total_days || 0), 0);
    return acc;
  }, {});
  const totalDaysOff = Object.values(daysOffBreakdown).reduce((a, b) => a + b, 0);

  // Sick days (approved only)
  const sickDays = approvedRequests.filter(r => r.leave_type === 'sick').reduce((sum, r) => sum + (r.total_days || 0), 0);

  // Utility to expand requests into daily schedule rows
  const scheduledRows = useMemo(() => {
    const rows = [];
    sortedRequests.forEach(request => {
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Clone date to avoid mutation
        const day = new Date(d);
        rows.push({
          ...request,
          scheduled_date: new Date(day),
        });
      }
    });
    // Sort by scheduled_date descending
    return rows.sort((a, b) => b.scheduled_date - a.scheduled_date);
  }, [sortedRequests]);

  // Calculate stats based on scheduledRows (filtered by date range)
  const scheduledStats = useMemo(() => {
    const daysOffTypes = ['vacation', 'holiday', 'personal'];
    const sickType = 'sick';
    const daysOffBreakdown = daysOffTypes.reduce((acc, type) => {
      acc[type] = scheduledRows.filter(row => row.leave_type === type).length;
      return acc;
    }, {});
    const totalDaysOff = Object.values(daysOffBreakdown).reduce((a, b) => a + b, 0);
    const sickDays = scheduledRows.filter(row => row.leave_type === sickType).length;
    // PTO breakdown by leave type
    const ptoByType = scheduledRows.reduce((acc, row) => {
      acc[row.leave_type] = (acc[row.leave_type] || 0) + 1;
      return acc;
    }, {});
    const totalScheduled = scheduledRows.length;
    return { daysOffBreakdown, totalDaysOff, sickDays, ptoByType, totalScheduled };
  }, [scheduledRows]);

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
          <div className="requests-counts-header">
            <span className="requests-count total">Total: {requests.length}</span>
            <span className="requests-count pending">Pending: {stats.pendingRequests}</span>
            <span className="requests-count approved">Approved: {stats.approvedRequests}</span>
          </div>
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

        {/* Filters Panel - moved above summary cards */}
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

        {/* PTO Stats Cards */}
        <div className="summary-cards-container pto-balances-cards">
          {PTO_LEAVE_TYPES.map(type => (
            <div key={type.key} className={`summary-card ${type.color}`}> 
              <div className="summary-icon">{getLeaveTypeEmoji(type.key)}</div>
              <div className="summary-content">
                <div className="summary-value">
                  {loadingBalances ? '...' : (ptoBalances?.[type.key]?.remaining_days ?? '-')}
                </div>
                <div className="summary-label">Available {type.label} Days</div>
              </div>
            </div>
          ))}
          <div className="summary-card stat-green">
            <div className="summary-icon"><TrendingUp size={20} /></div>
            <div className="summary-content">
              <div className="summary-value">{scheduledStats.totalDaysOff}</div>
              <div className="summary-label">Days Off</div>
              <div className="summary-breakdown">
                {Object.keys(scheduledStats.daysOffBreakdown).map(type => (
                  <div key={type} className="breakdown-row">
                    <span className="breakdown-label">{type.charAt(0).toUpperCase() + type.slice(1)}:</span>
                    <span className="breakdown-value">{scheduledStats.daysOffBreakdown[type]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="summary-card stat-red">
            <div className="summary-icon"><BarChart3 size={20} /></div>
            <div className="summary-content">
              <div className="summary-value">{scheduledStats.sickDays}</div>
              <div className="summary-label">Sick Days</div>
            </div>
          </div>
        </div>

        {/* PTO Breakdown by Leave Type - RESTYLED */}
        {Object.keys(scheduledStats.ptoByType || {}).length > 0 && (
          <div className="card pto-breakdown-card restyled">
            <div className="card-header">
              <h3>PTO Breakdown by Leave Type</h3>
            </div>
            <div className="card-body">
              <div className="pto-breakdown-flex">
                {Object.entries(scheduledStats.ptoByType || {}).map(([type, days]) => (
                  <div key={type} className={`pto-breakdown-pill pill-${type}`}>
                    <span className="pill-emoji">{getLeaveTypeEmoji(type)}</span>
                    <span className="pill-type">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <span className="pill-days">{days} {days === 1 ? 'day' : 'days'}</span>
                    <span className="pill-percent">{scheduledStats.totalScheduled > 0 ? ((days / scheduledStats.totalScheduled) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="requests-content">
        {/* Requests Table - replaces card list */}
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
              <div className="requests-table-wrapper">
                <table className="requests-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Submitted</th>
                      <th>Reviewed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledRows.map((row, idx) => (
                      <tr key={row.id + '-' + row.scheduled_date.toISOString()} className="request-row">
                        <td>
                          <span className="request-emoji">{getLeaveTypeEmoji(row.leave_type)}</span>
                          {row.leave_type.charAt(0).toUpperCase() + row.leave_type.slice(1)}
                        </td>
                        <td>{formatDate(row.scheduled_date)}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td>{row.reason || '-'}</td>
                        <td>{formatDate(row.submitted_at)}</td>
                        <td>{row.status !== 'pending' && row.reviewed_at ? formatDate(row.reviewed_at) : '-'}</td>
                        <td>
                          {canEditRequest(row) && (
                            <button
                              onClick={() => handleEditRequest(row)}
                              className="btn btn-sm btn-secondary"
                              title="Edit Request"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {canCancelRequest(row) && (
                            <button
                              onClick={() => onCancelRequest && onCancelRequest(row)}
                              className="btn btn-sm btn-danger"
                              title="Cancel Request"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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