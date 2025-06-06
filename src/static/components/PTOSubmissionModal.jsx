import React, { useState, useEffect } from 'react';
import { Calendar, X, User, AlertTriangle, Trash2, Copy } from 'lucide-react';
import UserPicker from './UserPicker';
import { getLeaveTypeEmoji } from './leaveTypeUtils';

const PTOSubmissionModal = ({
  selectedDates = [],
  onClose,
  onSubmit,
  currentUser,
  currentUserData,
  userManager,
  allUsers = [],
  allTeams = [],
  allRequests = [],
  isAdmin = false,
  isAdminMode = false,
}) => {
  const [formData, setFormData] = useState({
    targetUser: currentUser,
    manager: userManager,
    startDate: selectedDates[0] || '',
    endDate: selectedDates[selectedDates.length - 1] || '',
    reason: '',
    dailySchedules: [],
  });
  
  const [errors, setErrors] = useState({});
  const [showUserNotInSystemAlert, setShowUserNotInSystemAlert] = useState(false);

  // Initialize form when component mounts or data changes
  useEffect(() => {
    // Check if current user is in the system
    if (!isAdmin && !currentUserData) {
      setShowUserNotInSystemAlert(true);
    }

    // Initialize daily schedules from selected dates
    const schedules = selectedDates.map(date => ({
      date,
      type: 'FULL_DAY',
      leaveType: 'vacation'
    }));

    setFormData(prev => ({
      ...prev,
      targetUser: isAdmin ? prev.targetUser : currentUser,
      manager: userManager || prev.manager,
      startDate: selectedDates[0] || '',
      endDate: selectedDates[selectedDates.length - 1] || '',
      dailySchedules: schedules
    }));
  }, [selectedDates, currentUser, currentUserData, userManager, isAdmin]);

  // Update daily schedules when date range changes
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const dates = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
      
      // Keep existing schedules for dates that are still in range, add new ones
      const existingSchedules = formData.dailySchedules.filter(schedule => 
        dates.includes(schedule.date)
      );
      
      const newDates = dates.filter(date => 
        !existingSchedules.find(schedule => schedule.date === date)
      );
      
      const newSchedules = newDates.map(date => ({
        date,
        type: 'FULL_DAY',
        leaveType: 'vacation'
      }));
      
      setFormData(prev => ({
        ...prev,
        dailySchedules: [...existingSchedules, ...newSchedules].sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        )
      }));
    }
  }, [formData.startDate, formData.endDate]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.targetUser) {
      newErrors.targetUser = 'User is required';
    }
    
    if (!isAdmin && !formData.manager) {
      newErrors.manager = 'Manager is required';
    }
    
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    if (formData.dailySchedules.length === 0) {
      newErrors.dailySchedules = 'Please select at least one day';
    }

    // Check for duplicate PTO requests
    const targetUserId = formData.targetUser?.accountId || formData.targetUser?.jira_account_id;
    if (targetUserId) {
      const conflictingDates = formData.dailySchedules.filter(schedule => {
        return allRequests.some(request => 
          (request.requester_id === targetUserId || request.requester_email === formData.targetUser?.emailAddress) &&
          request.status !== 'declined' &&
          request.start_date <= schedule.date && 
          request.end_date >= schedule.date
        );
      });
      
      if (conflictingDates.length > 0) {
        newErrors.duplicate = `This user already has PTO requests for: ${conflictingDates.map(d => new Date(d.date).toLocaleDateString()).join(', ')}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const totalDays = formData.dailySchedules.reduce(
      (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5),
      0
    );
    
    const totalHours = formData.dailySchedules.reduce(
      (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 8 : 4),
      0
    );

    const submissionData = {
      reporter: isAdmin ? formData.targetUser : currentUser,
      manager: formData.manager,
      startDate: formData.startDate,
      endDate: formData.endDate,
      leaveType: formData.dailySchedules[0]?.leaveType || 'vacation', // Primary leave type
      reason: formData.reason,
      dailySchedules: formData.dailySchedules,
      totalDays,
      totalHours,
      ...(isAdmin && { targetUser: formData.targetUser })
    };

    onSubmit(submissionData);
  };

  const updateSchedule = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: prev.dailySchedules.map((schedule, i) =>
        i === index ? { ...schedule, [field]: value } : schedule
      )
    }));
  };

  const removeScheduleDay = (index) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: prev.dailySchedules.filter((_, i) => i !== index)
    }));
  };

  const markAllDaysWithLeaveType = (leaveType) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: prev.dailySchedules.map(schedule => ({
        ...schedule,
        leaveType
      }))
    }));
  };

  const scheduleTypes = [
    { value: 'FULL_DAY', label: 'Full Day (8h)' },
    { value: 'HALF_DAY_MORNING', label: 'Morning Half (4h)' },
    { value: 'HALF_DAY_AFTERNOON', label: 'Afternoon Half (4h)' }
  ];

  const leaveTypes = [
    { value: 'vacation', label: '🏖️ Vacation', emoji: '🏖️' },
    { value: 'sick', label: '🤒 Sick Leave', emoji: '🤒' },
    { value: 'personal', label: '👤 Personal Day', emoji: '👤' },
    { value: 'holiday', label: '🎉 Holiday', emoji: '🎉' }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content pto-submission-modal">
        <div className="modal-header">
          <h3 className="modal-title">
            <Calendar size={22} style={{ marginRight: 8, marginBottom: -3 }} />
            {isAdmin ? 'Create PTO Request (Admin)' : 'Submit PTO Request'}
          </h3>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* User Not in System Alert */}
          {showUserNotInSystemAlert && (
            <div className="alert alert-warning">
              <AlertTriangle size={20} />
              <div>
                <strong>User Not in System</strong>
                <p>Your user is not added to Team Manager. Please ask HR to update it.</p>
              </div>
            </div>
          )}

          {/* Target User Section */}
          <div className="form-section">
            <label className="form-label">
              Employee {isAdmin ? '*' : ''}
            </label>
            
            {isAdmin ? (
              <UserPicker
                selectedUser={formData.targetUser}
                onSelect={user => {
                  setFormData(prev => ({ ...prev, targetUser: user }));
                  // Auto-set manager if user is in system
                  const userData = allUsers.find(u => 
                    u.jira_account_id === user?.accountId ||
                    u.email_address === user?.emailAddress
                  );
                  if (userData?.team_id) {
                    const userTeam = allTeams.find(team => team.id === userData.team_id);
                    if (userTeam?.manager) {
                      setFormData(prev => ({ ...prev, manager: userTeam.manager }));
                    }
                  }
                }}
                placeholder="Search and select employee"
                required
                error={errors.targetUser}
              />
            ) : (
              <div className="user-display">
                <div className="user-avatar">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.displayName} />
                  ) : (
                    <div className="avatar-placeholder">
                      {currentUser?.displayName?.charAt(0) || <User size={16} />}
                    </div>
                  )}
                </div>
                <div className="user-info">
                  <div className="user-name">{currentUser?.displayName}</div>
                  <div className="user-email">{currentUser?.emailAddress}</div>
                </div>
              </div>
            )}
          </div>

          {/* Manager Section */}
          {!isAdmin && (
            <div className="form-section">
              <label className="form-label">Manager *</label>
              {formData.manager ? (
                <div className="user-display">
                  <div className="user-avatar">
                    {formData.manager.avatarUrl ? (
                      <img src={formData.manager.avatarUrl} alt={formData.manager.displayName} />
                    ) : (
                      <div className="avatar-placeholder">
                        {formData.manager.displayName?.charAt(0) || <User size={16} />}
                      </div>
                    )}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{formData.manager.displayName}</div>
                    <div className="user-email">{formData.manager.emailAddress}</div>
                  </div>
                </div>
              ) : (
                <UserPicker
                  selectedUser={formData.manager}
                  onSelect={manager => setFormData(prev => ({ ...prev, manager }))}
                  placeholder="Search and select your manager"
                  required
                  error={errors.manager}
                />
              )}
              {errors.manager && <div className="error-text">{errors.manager}</div>}
            </div>
          )}

          {/* Date Range Section */}
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`form-control ${errors.startDate ? 'error' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.startDate && <div className="error-text">{errors.startDate}</div>}
              </div>
              
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className={`form-control ${errors.endDate ? 'error' : ''}`}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
                {errors.endDate && <div className="error-text">{errors.endDate}</div>}
              </div>
            </div>
          </div>

          {/* Reason Section */}
          <div className="form-section">
            <label className="form-label">Reason (Optional)</label>
            <textarea
              value={formData.reason}
              onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="form-control"
              rows="3"
              placeholder="Please provide additional details about your PTO request"
            />
          </div>

          {/* Daily Schedule Section */}
          {formData.dailySchedules.length > 0 && (
            <div className="form-section">
              <div className="schedule-header">
                <label className="form-label">Schedule Details</label>
                
                {/* Quick Actions */}
                <div className="quick-actions">
                  <span className="quick-actions-label">Mark all days:</span>
                  {leaveTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => markAllDaysWithLeaveType(type.value)}
                      className="btn btn-sm btn-secondary"
                      title={`Mark all days as ${type.label}`}
                    >
                      <span>{type.emoji}</span>
                      <span>{type.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="schedule-list">
                {formData.dailySchedules.map((schedule, index) => (
                  <div key={schedule.date} className="schedule-day-row">
                    <div className="schedule-day-info">
                      <div className="day-date">
                        {new Date(schedule.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>

                    <div className="schedule-controls">
                      <select
                        value={schedule.leaveType}
                        onChange={e => updateSchedule(index, 'leaveType', e.target.value)}
                        className="form-control schedule-select"
                      >
                        {leaveTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={schedule.type}
                        onChange={e => updateSchedule(index, 'type', e.target.value)}
                        className="form-control schedule-select"
                      >
                        {scheduleTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeScheduleDay(index)}
                        className="btn btn-sm btn-danger"
                        title="Remove this day"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {errors.dailySchedules && <div className="error-text">{errors.dailySchedules}</div>}
            </div>
          )}

          {/* Request Summary */}
          {formData.dailySchedules.length > 0 && (
            <div className="form-section">
              <div className="request-summary">
                <h4>Request Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total Days:</span>
                    <span className="summary-value">
                      {formData.dailySchedules.reduce((sum, s) => sum + (s.type === 'FULL_DAY' ? 1 : 0.5), 0)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Hours:</span>
                    <span className="summary-value">
                      {formData.dailySchedules.reduce((sum, s) => sum + (s.type === 'FULL_DAY' ? 8 : 4), 0)}h
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Date Range:</span>
                    <span className="summary-value">
                      {formData.startDate && formData.endDate && 
                        `${new Date(formData.startDate).toLocaleDateString()} - ${new Date(formData.endDate).toLocaleDateString()}`
                      }
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{isAdmin ? 'For User:' : 'Manager:'}</span>
                    <span className="summary-value">
                      {isAdmin 
                        ? formData.targetUser?.displayName || 'Not selected'
                        : formData.manager?.displayName || 'Not selected'
                      }
                    </span>
                  </div>
                </div>

                {/* Leave Type Breakdown */}
                <div className="leave-type-breakdown">
                  <span className="breakdown-label">Leave Types:</span>
                  <div className="breakdown-items">
                    {Object.entries(
                      formData.dailySchedules.reduce((acc, schedule) => {
                        acc[schedule.leaveType] = (acc[schedule.leaveType] || 0) + (schedule.type === 'FULL_DAY' ? 1 : 0.5);
                        return acc;
                      }, {})
                    ).map(([type, days]) => (
                      <span key={type} className="breakdown-item">
                        {getLeaveTypeEmoji(type)} {type}: {days} days
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {errors.duplicate && (
            <div className="alert alert-error">
              <AlertTriangle size={20} />
              <div>
                <strong>Scheduling Conflict</strong>
                <p>{errors.duplicate}</p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !formData.targetUser ||
                (!isAdmin && !formData.manager) ||
                !formData.startDate ||
                !formData.endDate ||
                formData.dailySchedules.length === 0 ||
                !!errors.duplicate ||
                showUserNotInSystemAlert
              }
              className="btn btn-primary"
            >
              {isAdmin ? 'Create PTO Request' : 'Submit Request'}
            </button>
          </div>

          {/* Admin Mode Notice */}
          {isAdmin && (
            <div className="admin-notice">
              <strong>Admin Mode:</strong> This PTO request will be created with admin privileges.
            </div>
          )}

          {/* Instructions */}
          {formData.dailySchedules.length === 0 && (
            <div className="instructions">
              <strong>Tip:</strong> Select start and end dates to configure your PTO schedule, or go back to select dates on the calendar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PTOSubmissionModal;