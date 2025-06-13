import * as React from 'react';
const { useState, useEffect } = React;
import { Calendar, X, User, AlertTriangle, Trash2, CheckCircle, Clock, Users, MapPin } from 'lucide-react';
import UserPicker from './UserPicker';
import { getLeaveTypeEmoji } from './leaveTypeUtils';
import { invoke } from '@forge/bridge';

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
  const [useFullRange, setUseFullRange] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  // Check if user is in the system on mount
  useEffect(() => {
    if (!isAdmin && !currentUserData) {
      setShowUserNotInSystemAlert(true);
    } else {
      setShowUserNotInSystemAlert(false);
    }
  }, [isAdmin, currentUserData]);

  // Auto-find manager for selected user
  const findManagerForUser = (user) => {
    if (!user) return null;
    // Find user in system database
    const userData = allUsers.find(u =>
      u.jira_account_id === user.accountId ||
      u.email_address === user.emailAddress
    );
    // 1. Prefer user's manager field
    if (userData?.manager) {
      return allUsers.find(u => u.id === userData.manager || u.jira_account_id === userData.manager);
    }
    // 2. Fallback to team manager
    if (userData?.team_id) {
      const userTeam = allTeams.find(team => team.id === userData.team_id);
      if (userTeam?.manager) {
        return allUsers.find(u => u.id === userTeam.manager || u.jira_account_id === userTeam.manager);
      }
    }
    return null;
  };

  // Initialize form when component mounts or data changes
  useEffect(() => {
    const initializeSchedules = () => {
      let dates = [];
      if (!useFullRange && selectedDates.length > 0) {
        dates = selectedDates.slice().sort();
      } else if ((useFullRange || selectedDates.length === 0) && formData.startDate && formData.endDate) {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
        }
      }
      const schedules = dates.map(date => ({
        date,
        type: 'FULL_DAY',
        leaveType: 'vacation'
      }));
      setFormData(prev => ({
        ...prev,
        targetUser: isAdmin ? prev.targetUser : currentUser,
        manager: findManagerForUser(isAdmin ? prev.targetUser : currentUser) || userManager || prev.manager,
        startDate: dates[0] || '',
        endDate: dates[dates.length - 1] || '',
        dailySchedules: schedules
      }));
    };
    initializeSchedules();
  // eslint-disable-next-line
  }, [selectedDates, currentUser, userManager, isAdmin, allUsers, allTeams, useFullRange]);

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
    
    if (!formData.manager) {
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

  // Add normalizeManager function
  const normalizeManager = (manager) => {
    if (!manager) return null;
    return {
      ...manager,
      accountId: manager.accountId || manager.jira_account_id || manager.id,
      displayName: manager.displayName || manager.display_name || manager.name,
      emailAddress: manager.emailAddress || manager.email_address,
      avatarUrl: manager.avatarUrl || manager.avatar_url,
    };
  };

  // Add normalizeUser function
  const normalizeUser = (user) => {
    if (!user) return null;
    return {
      ...user,
      accountId: user.accountId || user.jira_account_id || user.id,
      displayName: user.displayName || user.display_name || user.name,
      emailAddress: user.emailAddress || user.email_address,
      avatarUrl: user.avatarUrl || user.avatar_url,
    };
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const normalizedUser = normalizeUser(formData.targetUser);
    if (!normalizedUser || !normalizedUser.accountId || !normalizedUser.displayName || !normalizedUser.emailAddress) {
      setErrors(prev => ({ ...prev, targetUser: 'Please select a valid user.' }));
      return;
    }

    const totalDays = formData.dailySchedules.reduce(
      (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5),
      0
    );
    
    const totalHours = formData.dailySchedules.reduce(
      (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 8 : 4),
      0
    );

    const submissionData = {
      reporter: normalizedUser,
      manager: normalizeManager(formData.manager),
      startDate: formData.startDate,
      endDate: formData.endDate,
      leaveType: formData.dailySchedules[0]?.leaveType || 'vacation',
      reason: formData.reason,
      dailySchedules: formData.dailySchedules,
      totalDays,
      totalHours,
      isAdmin: adminMode,
      ...(adminMode && { targetUser: normalizedUser })
    };

    onSubmit(submissionData);
  };

  const handleUserChange = async (user) => {
    if (!user) {
      setFormData(prev => ({ ...prev, targetUser: null }));
      return;
    }

    try {
      // Get user details from database
      const dbResponse = await invoke('getUsers');
      const dbUsers = dbResponse.success ? dbResponse.data || [] : [];
      const userDetails = dbUsers.find(u => 
        u.jira_account_id === user.accountId || 
        u.email_address === user.emailAddress
      );

      if (userDetails) {
        setFormData(prev => ({ ...prev, targetUser: userDetails, manager: findManagerForUser(userDetails) }));
      } else {
        // If user not in database, use Jira user data
        setFormData(prev => ({ ...prev, targetUser: user, manager: null }));
      }
    } catch (error) {
      console.error('Failed to get user details:', error);
      setFormData(prev => ({ ...prev, targetUser: user }));
    }
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
    
    // Update date range if removing first or last day
    const updatedSchedules = formData.dailySchedules.filter((_, i) => i !== index);
    if (updatedSchedules.length > 0) {
      const dates = updatedSchedules.map(s => s.date).sort();
      setFormData(prev => ({
        ...prev,
        startDate: dates[0],
        endDate: dates[dates.length - 1]
      }));
    }
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
    { value: 'holiday', label: '🎉 Holiday', emoji: '🎉' },
    { value: 'other leave type', label: '📝 Other Leave Type', emoji: '📝' }
  ];

  // Calculate summary data
  const summaryData = {
    totalDays: formData.dailySchedules.reduce((sum, s) => sum + (s.type === 'FULL_DAY' ? 1 : 0.5), 0),
    totalHours: formData.dailySchedules.reduce((sum, s) => sum + (s.type === 'FULL_DAY' ? 8 : 4), 0),
    leaveTypeBreakdown: formData.dailySchedules.reduce((acc, schedule) => {
      acc[schedule.leaveType] = (acc[schedule.leaveType] || 0) + (schedule.type === 'FULL_DAY' ? 1 : 0.5);
      return acc;
    }, {}),
    workingDays: formData.dailySchedules.length,
    dateRange: formData.startDate && formData.endDate ? 
      `${new Date(formData.startDate).toLocaleDateString()} - ${new Date(formData.endDate).toLocaleDateString()}` : ''
  };

  // When toggling useFullRange, update dailySchedules immediately
  const handleToggleFullRange = (toFullRange) => {
    setUseFullRange(toFullRange);
    let dates = [];
    if (toFullRange && formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
    } else {
      dates = selectedDates.slice().sort();
    }
    const schedules = dates.map(date => ({
      date,
      type: 'FULL_DAY',
      leaveType: 'vacation'
    }));
    setFormData(prev => ({
      ...prev,
      dailySchedules: schedules
    }));
  };

  // On modal open, always default to selectedDates and useFullRange false
  useEffect(() => {
    setUseFullRange(false);
    const dates = selectedDates.slice().sort();
    const schedules = dates.map(date => ({
      date,
      type: 'FULL_DAY',
      leaveType: 'vacation'
    }));
    setFormData(prev => ({
      ...prev,
      startDate: dates[0] || '',
      endDate: dates[dates.length - 1] || '',
      dailySchedules: schedules
    }));
  // eslint-disable-next-line
  }, [selectedDates]);

  return (
    <div className="modal-overlay">
      <div className="modal-content pto-submission-modal">
        <div className="modal-header">
          <h3 className="modal-title">
            <Calendar size={20} />
            {isAdmin ? 'Create PTO Request (Admin)' : 'Submit PTO Request'}
          </h3>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* User Not in System Alert */}
          {showUserNotInSystemAlert && (
            <div className="alert alert-warning">
              <AlertTriangle size={20} />
              <div>
                <strong>User Not in System</strong>
                <p>Your user profile is not set up in the team management system. Please contact HR to complete your setup.</p>
              </div>
            </div>
          )}

          {/* Employee Selection */}
          <div className="form-section">
            <label className="form-label">
              Employee {isAdmin ? '*' : ''}
            </label>
            
            {isAdmin ? (
              <UserPicker
                selectedUser={formData.targetUser}
                onSelect={handleUserChange}
                placeholder="Search and select employee"
                required
                error={errors.targetUser}
                useBackendSearch={true}
              />
            ) : (
              <div className="user-display-card">
                <div className="user-avatar-large">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.displayName} />
                  ) : (
                    <div className="avatar-placeholder-large">
                      {currentUser?.displayName?.charAt(0) || <User size={20} />}
                    </div>
                  )}
                </div>
                <div className="user-info-detailed">
                  <div className="user-name-large">{currentUser?.displayName}</div>
                  <div className="user-email-large">{currentUser?.emailAddress}</div>
                  {currentUserData?.team_id && (
                    <div className="user-team">
                      <Users size={14} />
                      {allTeams.find(t => t.id === currentUserData.team_id)?.name || 'Team Member'}
                    </div>
                  )}
                </div>
              </div>
            )}
            {errors.targetUser && <div className="error-text">{errors.targetUser}</div>}
          </div>

          {/* Manager Section - Always show */}
          <div className="form-section">
            <label className="form-label">Manager *</label>
            {formData.manager ? (
              <div className="user-display-card manager-display">
                <div className="user-avatar-large">
                  {formData.manager.avatarUrl ? (
                    <img src={formData.manager.avatarUrl} alt={formData.manager.displayName} />
                  ) : (
                    <div className="avatar-placeholder-large">
                      {formData.manager.displayName?.charAt(0) || <User size={20} />}
                    </div>
                  )}
                </div>
                <div className="user-info-detailed">
                  <div className="user-name-large">{formData.manager.displayName}</div>
                  <div className="user-email-large">{formData.manager.emailAddress}</div>
                  <div className="manager-badge">
                    <CheckCircle size={14} />
                    Approving Manager
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, manager: null }))}
                    className="btn btn-sm btn-secondary"
                    title="Change Manager"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <UserPicker
                selectedUser={formData.manager}
                onSelect={manager => setFormData(prev => ({ ...prev, manager }))}
                placeholder="Search and select approving manager"
                required
                error={errors.manager}
                useBackendSearch={true}
              />
            )}
            {errors.manager && <div className="error-text">{errors.manager}</div>}
          </div>

          {/* Date Range Section */}
          <div className="pto-modal-section pto-modal-row">
            <div className="pto-modal-col">
              <label className="form-label">Start Date</label>
              <input type="text" className="form-control" value={formData.startDate} readOnly tabIndex={-1} />
            </div>
            <div className="pto-modal-col">
              <label className="form-label">End Date</label>
              <input type="text" className="form-control" value={formData.endDate} readOnly tabIndex={-1} />
            </div>
            <div className="pto-modal-col" style={{ alignSelf: 'end' }}>
              {!useFullRange && selectedDates.length > 1 && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ marginTop: 24 }}
                  onClick={() => handleToggleFullRange(true)}
                >
                  Add all dates in range
                </button>
              )}
              {useFullRange && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ marginTop: 24 }}
                  onClick={() => handleToggleFullRange(false)}
                >
                  Use only selected dates
                </button>
              )}
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
              placeholder="Please provide additional details about your PTO request..."
            />
          </div>

          {/* Daily Schedule Section */}
          {formData.dailySchedules.length > 0 && (
            <div className="form-section">
              <div className="schedule-header">
                <label className="form-label">Schedule Details</label>
                
                {/* Quick Actions */}
                <div className="quick-actions">
                  <span className="quick-actions-label">Apply to all:</span>
                  {leaveTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => markAllDaysWithLeaveType(type.value)}
                      className="btn btn-sm btn-secondary quick-action-btn"
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

          {/* Professional Request Summary */}
          {formData.dailySchedules.length > 0 && (
            <div className="form-section">
              <div className="request-summary-card">
                <div className="summary-header">
                  <h4>Request Summary</h4>
                  <div className="summary-status">
                    <Clock size={16} />
                    Ready to Submit
                  </div>
                </div>
                
                <div className="summary-content">
                  {/* Key Metrics */}
                  <div className="summary-metrics">
                    <div className="metric-item">
                      <div className="metric-value">{summaryData.totalDays}</div>
                      <div className="metric-label">Days Off</div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-value">{summaryData.totalHours}h</div>
                      <div className="metric-label">Total Hours</div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-value">{summaryData.workingDays}</div>
                      <div className="metric-label">Scheduled Days</div>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="summary-details">
                    <div className="detail-row">
                      <span className="detail-label">
                        <MapPin size={16} />
                        Date Range:
                      </span>
                      <span className="detail-value">{summaryData.dateRange}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">
                        <User size={16} />
                        {isAdmin ? 'Employee:' : 'Approver:'}
                      </span>
                      <span className="detail-value">
                        {isAdmin 
                          ? formData.targetUser?.displayName || 'Not selected'
                          : formData.manager?.displayName || 'Not selected'
                        }
                      </span>
                    </div>

                    {/* Leave Type Breakdown */}
                    {Object.keys(summaryData.leaveTypeBreakdown).length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">
                          <Calendar size={16} />
                          Leave Types:
                        </span>
                        <div className="leave-type-tags">
                          {Object.entries(summaryData.leaveTypeBreakdown).map(([type, days]) => (
                            <span key={type} className="leave-type-tag">
                              {getLeaveTypeEmoji(type)} {type}: {days} day{days !== 1 ? 's' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                !formData.manager ||
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
          {adminMode && (
            <div className="admin-notice">
              <strong>Admin Mode:</strong> This PTO request will be created with admin privileges and may be automatically approved.
            </div>
          )}

          {/* Instructions */}
          {formData.dailySchedules.length === 0 && (
            <div className="instructions">
              <strong>Next Step:</strong> Select start and end dates to configure your PTO schedule, or return to the calendar to select specific dates.
            </div>
          )}

          {/* Admin Mode Toggle */}
          {isAdmin && (
            <div className="pto-admin-mode-toggle" style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  checked={!adminMode}
                  onChange={() => setAdminMode(false)}
                  style={{ marginRight: 6 }}
                />
                Submit as Standard User
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  checked={adminMode}
                  onChange={() => setAdminMode(true)}
                  style={{ marginRight: 6 }}
                />
                Submit as Admin (auto-approve)
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PTOSubmissionModal;