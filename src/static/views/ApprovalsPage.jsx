import React, { useState } from 'react';
import { CheckCircle, User, Calendar, Clock, MessageSquare } from 'lucide-react';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';
import PTOApproval from '../components/PTOApproval';

const ApprovalsPage = ({ pendingRequests, onApproval }) => {
  const [comments, setComments] = useState({});
  const [processing, setProcessing] = useState({});

  const handleApproval = async (requestId, status) => {
    const comment = comments[requestId] || '';

    setProcessing(prev => ({ ...prev, [requestId]: true }));

    try {
      await onApproval(requestId, status, comment);
      setComments(prev => ({ ...prev, [requestId]: '' }));
    } finally {
      setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const updateComment = (requestId, comment) => {
    setComments(prev => ({ ...prev, [requestId]: comment }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (pendingRequests.length === 0) {
    return (
      <div className="card approval-card">
        <h2 className="card-title">Pending Approvals</h2>
        <div className="approval-empty">
          <CheckCircle size={48} className="approval-empty-icon" />
          <h3 className="approval-empty-title">All caught up!</h3>
          <p className="approval-empty-desc">There are no pending PTO requests to approve at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card approval-card">
      <div className="approval-header">
        <h2 className="card-title">Pending Approvals</h2>
        <div className="approval-pending-count">
          {pendingRequests.length} pending
        </div>
      </div>

      {/* Quick Actions Info */}
      <div className="approval-info">
        <div className="approval-info-content">
          <CheckCircle className="approval-info-icon" size={20} />
          <div className="approval-info-text">
            <p className="approval-info-title">Review Team PTO Requests</p>
            <p>Review each request carefully and add comments if needed. Your decision will be sent to the employee immediately.</p>
          </div>
        </div>
      </div>

      <div className="approval-list">
        {pendingRequests.map(request => (
          <div key={request.id} className="approval-request">
            <div className="approval-request-content">
              {/* Employee Avatar */}
              <div className="approval-avatar">
                {request.requester_name?.charAt(0) || <User size={20} />}
              </div>

              <div className="approval-request-main">
                {/* Header */}
                <div className="approval-request-header">
                  <div>
                    <h3 className="approval-request-name">{request.requester_name}</h3>
                    <p className="approval-request-email">{request.requester_email}</p>
                  </div>
                  <div className="approval-request-submitted">
                    <div className="approval-request-submitted-label">Submitted</div>
                    <div className="approval-request-submitted-date">
                      {formatDateTime(request.submitted_at)}
                    </div>
                  </div>
                </div>

                {/* Request Details */}
                <div className="approval-request-details">
                  <div className="approval-request-detail">
                    <span className="approval-request-emoji">{getLeaveTypeEmoji(request.leave_type)}</span>
                    <div>
                      <div className="approval-request-type">
                        {request.leave_type} Leave
                      </div>
                      <div className="approval-request-type-label">Type</div>
                    </div>
                  </div>
                  <div className="approval-request-detail">
                    <Calendar className="approval-request-detail-icon" size={20} />
                    <div>
                      <div className="approval-request-dates">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </div>
                      <div className="approval-request-dates-label">Date Range</div>
                    </div>
                  </div>
                  <div className="approval-request-detail">
                    <Clock className="approval-request-detail-icon" size={20} />
                    <div>
                      <div className="approval-request-duration">
                        {request.total_days} days ({request.total_hours}h)
                      </div>
                      <div className="approval-request-duration-label">Duration</div>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="approval-request-reason">
                  <div className="approval-request-reason-content">
                    <MessageSquare className="approval-request-reason-icon" size={16} />
                    <div>
                      <span className="approval-request-reason-label">Reason:</span>
                      <p className="approval-request-reason-text">{request.reason}</p>
                    </div>
                  </div>
                </div>

                {/* Manager Comments */}
                <div className="approval-request-comments">
                  <label className="approval-request-comments-label">
                    Manager Comments (Optional)
                  </label>
                  <textarea
                    value={comments[request.id] || ''}
                    onChange={(e) => updateComment(request.id, e.target.value)}
                    placeholder="Add any comments about this request..."
                    className="approval-request-comments-input"
                    rows="3"
                  />
                </div>

                {/* Action Buttons */}
                <div className="approval-request-actions">
                  <button
                    onClick={() => handleApproval(request.id, 'approved')}
                    disabled={processing[request.id]}
                    className="btn btn-primary"
                  >
                    {processing[request.id] ? (
                      <div className="approval-processing">
                        <div className="approval-processing-spinner"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="approval-btn-content">
                        <CheckCircle size={16} />
                        <span>Approve</span>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => handleApproval(request.id, 'declined')}
                    disabled={processing[request.id]}
                    className="btn btn-danger"
                  >
                    {processing[request.id] ? (
                      <div className="approval-processing">
                        <div className="approval-processing-spinner"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="approval-btn-content">
                        <span>✕</span>
                        <span>Decline</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Actions (if needed in the future) */}
      {pendingRequests.length > 3 && (
        <div className="approval-bulk-message">
          <div>
            <p>Need to approve multiple requests? Bulk actions coming soon!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
