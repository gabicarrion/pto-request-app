import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Eye, Edit, Trash2, RotateCcw, BarChart3, Filter } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';

const RequestsPage = ({ requests, currentUser, onEditRequest, onCancelRequest, onRequestChange }) => {
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Filter options
  const filterOptions = [
    { value: 'this_month', label: 'This Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_semester', label: 'This Semester' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom_range', label: 'Custom Range' }
  ];

  // Get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (dateFilter) {
      case 'this_month':
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: new Date(currentYear, currentMonth + 1, 0)
        };
      case 'this_quarter':
        const quarterStart = Math.floor(currentMonth / 3) * 3;
        return {
          start: new Date(currentYear, quarterStart, 1),
          end: new Date(currentYear, quarterStart + 3, 0)
        };
      case 'this_semester':
        const semesterStart = currentMonth < 6 ? 0 : 6;
        return {
          start: new Date(currentYear, semesterStart, 1),
          end: new Date(currentYear, semesterStart + 6, 0)
        };
      case 'this_year':
        return {
          start: new Date(currentYear, 0, 1),
          end: new Date(currentYear, 11, 31)
        };
      case 'custom_range':
        return {
          start: customStartDate ? new Date(customStartDate) : new Date(0),
          end: customEndDate ? new Date(customEndDate) : new Date(2099, 11, 31)
        };
      default:
        return { start: new Date(0), end: new Date(2099, 11, 31) };
    }
  };

  // Filter requests based on selected date range
  const filteredRequests = useMemo(() => {
    const { start, end } = getDateRange();
    return requests.filter(request => {
      const requestStart = new Date(request.start_date);
      const requestEnd = new Date(request.end_date);
      return (requestStart >= start && requestStart <= end) ||
             (requestEnd >= start && requestEnd <= end) ||
             (requestStart <= start && requestEnd >= end);
    });
  }, [requests, dateFilter, customStartDate, customEndDate]);

  // Calculate statistics
  const stats = useMemo(() => {
    const pending = filteredRequests.filter(r => r.status === 'pending').length;
    const approved = filteredRequests.filter(r => r.status === 'approved').length;
    const total = filteredRequests.length;
    
    // PTO by leave type
    const leaveTypeStats = filteredRequests.reduce((acc, request) => {
      const type = request.leave_type || 'unknown';
      if (!acc[type]) {
        acc[type] = { count: 0, days: 0 };
      }
      acc[type].count += 1;
      acc[type].days += request.total_days || 0;
      return acc;
    }, {});

    return { pending, approved, total, leaveTypeStats };
  }, [filteredRequests]);

  // Helper functions
  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

  const formatDateTime = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  const canEditRequest = (request) =>
    request.status === 'pending' && request.requester_id === currentUser.accountId;

  const canDeleteRequest = (request) =>
    request.status === 'pending' && request.requester_id === currentUser.accountId;

  const canRequestChange = (request) => {
    const requestStart = new Date(request.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return request.status === 'approved' && 
           request.requester_id === currentUser.accountId &&
           requestStart >= today;
  };

  const isFutureOrToday = (request) => {
    const requestStart = new Date(request.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return requestStart >= today;
  };

  if (!requests.length) {
    return (
      <div className="card requests-card">
        <h2 className="card-title">My PTO Requests</h2>
        <div className="requests-empty">
          <Calendar size={48} className="requests-empty-icon" />
          <h3 className="requests-empty-title">No PTO requests found</h3>
          <p>You haven't submitted any PTO requests yet.</p>
          <p className="requests-empty-desc">Go to the Calendar tab to submit your first request!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card requests-card">
      <div className="requests-header">
        <h2 className="card-title">My PTO Requests</h2>
        <div className="requests-count">
          Showing {filteredRequests.length} of {requests.length} requests
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="requests-filter-section">
        <div className="requests-filter-header">
          <Filter size={20} className="requests-filter-icon" />
          <h3>Filter by Date Range</h3>
        </div>
        <div className="requests-filter-controls">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="requests-filter-select"
          >
            {filterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          {dateFilter === 'custom_range' && (
            <div className="requests-custom-range">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="requests-date-input"
                placeholder="Start date"
              />
              <span className="requests-date-separator">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="requests-date-input"
                placeholder="End date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="requests-summary-section">
        <div className="requests-summary-cards">
          <div className="requests-summary-card requests-card-pending">
            <div className="requests-summary-content">
              <div className="requests-summary-text">
                <p className="requests-summary-label">Pending</p>
                <p className="requests-summary-value">{stats.pending}</p>
              </div>
              <Clock className="requests-summary-icon" size={24} />
            </div>
          </div>
          <div className="requests-summary-card requests-card-approved">
            <div className="requests-summary-content">
              <div className="requests-summary-text">
                <p className="requests-summary-label">Approved</p>
                <p className="requests-summary-value">{stats.approved}</p>
              </div>
              <Calendar className="requests-summary-icon" size={24} />
            </div>
          </div>
          <div className="requests-summary-card requests-card-total">
            <div className="requests-summary-content">
              <div className="requests-summary-text">
                <p className="requests-summary-label">Total</p>
                <p className="requests-summary-value">{stats.total}</p>
              </div>
              <Eye className="requests-summary-icon" size={24} />
            </div>
          </div>
          <div className="requests-summary-card requests-card-chart">
            <div className="requests-summary-content">
              <div className="requests-summary-text">
                <p className="requests-summary-label">PTO by Type</p>
                <BarChart3 className="requests-summary-icon" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* PTO by Leave Type Chart */}
        <div className="requests-chart-section">
          <h4 className="requests-chart-title">PTO Breakdown by Leave Type</h4>
          <div className="requests-chart-container">
            {Object.keys(stats.leaveTypeStats).length > 0 ? (
              <div className="requests-chart-bars">
                {Object.entries(stats.leaveTypeStats).map(([type, data]) => {
                  const maxCount = Math.max(...Object.values(stats.leaveTypeStats).map(s => s.count));
                  const percentage = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={type} className="requests-chart-bar-item">
                      <div className="requests-chart-bar-header">
                        <span className="requests-chart-bar-emoji">{getLeaveTypeEmoji(type)}</span>
                        <span className="requests-chart-bar-label">
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </span>
                        <span className="requests-chart-bar-count">{data.count}</span>
                      </div>
                      <div className="requests-chart-bar-container">
                        <div 
                          className="requests-chart-bar"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="requests-chart-bar-details">
                        {data.days} days total
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="requests-chart-empty">
                <BarChart3 size={32} className="requests-chart-empty-icon" />
                <p>No data available for the selected period</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="requests-table-section">
        <h3 className="requests-table-title">PTO Requests</h3>
        {filteredRequests.length === 0 ? (
          <div className="requests-table-empty">
            <Calendar size={32} className="requests-table-empty-icon" />
            <p>No requests found for the selected date range</p>
          </div>
        ) : (
          <div className="requests-table-container">
            <table className="requests-table">
              <thead className="requests-table-head">
                <tr>
                  <th className="requests-table-header">Type</th>
                  <th className="requests-table-header">Date Range</th>
                  <th className="requests-table-header">Duration</th>
                  <th className="requests-table-header">Reason</th>
                  <th className="requests-table-header">Status</th>
                  <th className="requests-table-header">Submitted</th>
                  <th className="requests-table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="requests-table-body">
                {filteredRequests.map(request => (
                  <tr key={request.id} className="requests-table-row">
                    <td className="requests-table-cell">
                      <div className="requests-table-type">
                        <span className="requests-table-emoji">{getLeaveTypeEmoji(request.leave_type)}</span>
                        <span className="requests-table-type-text">
                          {request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="requests-table-cell">
                      <div className="requests-table-dates">
                        <div className="requests-table-date-range">
                          {formatDate(request.start_date)} - {formatDate(request.end_date)}
                        </div>
                      </div>
                    </td>
                    <td className="requests-table-cell">
                      <div className="requests-table-duration">
                        <span className="requests-table-days">{request.total_days} days</span>
                        <span className="requests-table-hours">({request.total_hours}h)</span>
                      </div>
                    </td>
                    <td className="requests-table-cell">
                      <div className="requests-table-reason" title={request.reason}>
                        {request.reason}
                      </div>
                    </td>
                    <td className="requests-table-cell">
                      <StatusBadge status={request.status} />
                      {request.status !== 'pending' && request.reviewed_at && (
                        <div className="requests-table-review-date">
                          {formatDate(request.reviewed_at)}
                        </div>
                      )}
                    </td>
                    <td className="requests-table-cell">
                      <div className="requests-table-submitted">
                        {formatDateTime(request.submitted_at)}
                      </div>
                    </td>
                    <td className="requests-table-cell">
                      <div className="requests-table-actions">
                        {isFutureOrToday(request) && canEditRequest(request) && (
                          <button
                            onClick={() => onEditRequest && onEditRequest(request)}
                            className="requests-action-btn requests-action-edit"
                            title="Edit Request"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {isFutureOrToday(request) && canRequestChange(request) && (
                          <button
                            onClick={() => onRequestChange && onRequestChange(request)}
                            className="requests-action-btn requests-action-change"
                            title="Request Change"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        {isFutureOrToday(request) && canDeleteRequest(request) && (
                          <button
                            onClick={() => onCancelRequest && onCancelRequest(request)}
                            className="requests-action-btn requests-action-delete"
                            title="Delete Request"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comments Section for Approved/Declined Requests */}
      {filteredRequests.some(r => r.reviewer_comments && r.status !== 'pending') && (
        <div className="requests-comments-section">
          <h4 className="requests-comments-title">Manager Comments</h4>
          <div className="requests-comments-list">
            {filteredRequests
              .filter(r => r.reviewer_comments && r.status !== 'pending')
              .map(request => (
                <div key={request.id} className="requests-comment-item">
                  <div className="requests-comment-header">
                    <span className="requests-comment-emoji">{getLeaveTypeEmoji(request.leave_type)}</span>
                    <span className="requests-comment-type">
                      {request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)} Leave
                    </span>
                    <span className="requests-comment-date">
                      {formatDate(request.start_date)} - {formatDate(request.end_date)}
                    </span>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="requests-comment-text">
                    {request.reviewer_comments}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;