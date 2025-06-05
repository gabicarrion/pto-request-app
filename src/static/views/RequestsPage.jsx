import React from 'react';
import { Calendar, Clock, Eye, Edit, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';

const RequestsPage = ({ requests, currentUser, onEditRequest, onCancelRequest }) => {
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
  const canCancelRequest = (request) =>
    (request.status === 'pending' || request.status === 'approved') &&
    request.requester_id === currentUser.accountId;

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
        <div className="requests-count">Total requests: {requests.length}</div>
      </div>

      {/* Summary Cards */}
      <div className="requests-summary-cards">
        <div className="requests-summary-card stat-yellow">
          <div className="requests-summary-content">
            <div>
              <p className="requests-summary-label">Pending</p>
              <p className="requests-summary-value">
                {requests.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <Clock className="requests-summary-icon" size={24} />
          </div>
        </div>
        <div className="requests-summary-card stat-green">
          <div className="requests-summary-content">
            <div>
              <p className="requests-summary-label">Approved</p>
              <p className="requests-summary-value">
                {requests.filter(r => r.status === 'approved').length}
              </p>
            </div>
            <Calendar className="requests-summary-icon" size={24} />
          </div>
        </div>
        <div className="requests-summary-card stat-blue">
          <div className="requests-summary-content">
            <div>
              <p className="requests-summary-label">Total Days</p>
              <p className="requests-summary-value">
                {requests.reduce((sum, r) => sum + r.total_days, 0)}
              </p>
            </div>
            <Eye className="requests-summary-icon" size={24} />
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="requests-list">
        {requests.map(request => (
          <div key={request.id} className="request-row">
            <div className="request-row-content">
              <div className="request-main">
                <div className="request-type-row">
                  <span className="request-type-emoji">{getLeaveTypeEmoji(request.leave_type)}</span>
                  <div>
                    <h3 className="request-type-title">
                      {request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)} Leave
                    </h3>
                    <p className="request-type-reason">{request.reason}</p>
                  </div>
                </div>
                <div className="request-details-row">
                  <div className="request-detail">
                    <Calendar size={14} className="request-detail-icon" />
                    <div>
                      <div className="request-detail-label">Date Range</div>
                      <div>{formatDate(request.start_date)} - {formatDate(request.end_date)}</div>
                    </div>
                  </div>
                  <div className="request-detail">
                    <Clock size={14} className="request-detail-icon" />
                    <div>
                      <div className="request-detail-label">Duration</div>
                      <div>{request.total_days} days ({request.total_hours}h)</div>
                    </div>
                  </div>
                  <div className="request-detail">
                    <Eye size={14} className="request-detail-icon" />
                    <div>
                      <div className="request-detail-label">Submitted</div>
                      <div>{formatDateTime(request.submitted_at)}</div>
                    </div>
                  </div>
                </div>
                {/* Approved/Declined Info */}
                {request.status !== 'pending' && (
                  <div className="request-review-info">
                    <div>
                      <span className="request-review-label">
                        {request.status === 'approved' ? 'Approved' : 'Declined'}
                        {request.reviewed_at && ` on ${formatDate(request.reviewed_at)}`}
                      </span>
                      {request.reviewer_comments && (
                        <div className="request-review-comments">
                          <span className="request-review-comments-label">Manager Comments:</span> {request.reviewer_comments}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="request-actions">
                <StatusBadge status={request.status} />
                <div className="request-actions-btns">
                  {canEditRequest(request) && (
                    <button
                      onClick={() => onEditRequest && onEditRequest(request)}
                      className="btn btn-ghost btn-edit"
                      title="Edit Request"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                  {canCancelRequest(request) && (
                    <button
                      onClick={() => onCancelRequest && onCancelRequest(request)}
                      className="btn btn-ghost btn-cancel"
                      title="Cancel Request"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RequestsPage;
