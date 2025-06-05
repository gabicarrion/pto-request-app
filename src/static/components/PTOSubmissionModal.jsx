import React, { useState, useEffect } from 'react';
import { Calendar, X, User, Users, Clock, AlertCircle } from 'lucide-react';
import UserPicker from './UserPicker';
import { invoke } from '@forge/bridge';

const LEAVE_TYPES = [
  { value: 'vacation', label: '🏖️ Vacation', emoji: '🏖️' },
  { value: 'sick', label: '🤒 Sick Leave', emoji: '🤒' },
  { value: 'personal', label: '👤 Personal Day', emoji: '👤' },
  { value: 'holiday', label: '🎉 Holiday', emoji: '🎉' },
  { value: 'other', label: '📋 Other type of leave', emoji: '📋' }
];

function findManagerForUser(selectedUser, allUsers, allTeams) {
  if (!selectedUser || !allTeams?.length || !allUsers?.length) return null;
  
  // Find user's team
  const userTeam = allTeams.find(team => 
    team.members?.some(member => 
      member.accountId === selectedUser.accountId || 
      member.jira_account_id === selectedUser.accountId ||
      member.emailAddress === selectedUser.emailAddress ||
      member.email_address === selectedUser.emailAddress
    )
  );
  
  if (!userTeam) return null;
  
  // Find manager from team
  if (userTeam.manager) {
    if (typeof userTeam.manager === 'object') return userTeam.manager;
    return allUsers.find(u => 
      u.accountId === userTeam.manager || 
      u.jira_account_id === userTeam.manager ||
      u.id === userTeam.manager
    );
  }
  
  // Fallback to team lead
  if (userTeam.team_lead) {
    return allUsers.find(u => 
      u.displayName === userTeam.team_lead ||
      u.display_name === userTeam.team_lead
    );
  }
  
  return null;
}

function checkDuplicatePTO({ allRequests, userId, dates }) {
  if (!userId || !dates?.length || !allRequests?.length) return false;
  
  const userRequests = allRequests.filter(req => {
    if (!req) return false;
    return (
      req.userId === userId ||
      req.accountId === userId ||
      req.requester_id === userId ||
      (req.targetUser && (req.targetUser.id === userId || req.targetUser.accountId === userId))
    );
  });
  
  return userRequests.some(req =>
    req.dailySchedules?.some(existing =>
      dates.includes(existing.date)
    ) ||
    // Check date range overlap
    dates.some(date => {
      const requestDate = new Date(date);
      const reqStart = new Date(req.start_date);
      const reqEnd = new Date(req.end_date);
      return requestDate >= reqStart && requestDate <= reqEnd;
    })
  );
}

const PTOSubmissionModal = ({
  selectedDates = [],
  onClose,
  onSubmit,
  currentUser,
  isAdmin = false,
  targetUser = null,
  allUsers = [],
  allTeams = [],
  allRequests = [],
}) => {
  const [formData, setFormData] = useState({
    selectedUser: currentUser,
    manager: null,
    leaveType: '',
    reason: '',
    startDate: '',
    endDate: '',
    dailySchedules: [],
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [autoManagerSearch, setAutoManagerSearch] = useState(false);

  // Initialize form with current user or target user
  useEffect(() => {
    const userToSet = targetUser || currentUser;
    if (userToSet) {
      setFormData(prev => ({
        ...prev,
        selectedUser: userToSet
      }));
      
      // Auto-find manager
      findAndSetManager(userToSet);
    }
  }, [targetUser, currentUser, allUsers, allTeams]);

  // Handle selected dates
  useEffect(() => {
    if (selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort();
      setFormData(prev => ({
        ...prev,
        startDate: sortedDates[0],
        endDate: sortedDates[sortedDates.length - 1],
        dailySchedules: sortedDates.map(date => ({
          date,
          type: 'FULL_DAY',
        })),
      }));
    }
  }, [selectedDates]);

  const findAndSetManager = async (user) => {
    if (!user) return;
    
    setAutoManagerSearch(true);
    try {
      const manager = findManagerForUser(user, allUsers, allTeams);
      setFormData(prev => ({ ...prev, manager }));
      
      if (!manager) {
        // Try to find manager from Jira users if not in our database
        try {
          const jiraUsers = await invoke('getJiraUsers', { query: 'manager' });
          if (jiraUsers.success && jiraUsers.data.length > 0) {
            // This is a fallback - in a real app you'd have better manager detection
            console.log('Could not auto-detect manager. Please select manually.');
          }
        } catch (error) {
          console.warn('Could not search for managers:', error);
        }
      }
    } finally {
      setAutoManagerSearch(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.selectedUser) {
      newErrors.selectedUser = 'User is required';
    }
    
    if (!formData.manager) {
      newErrors.manager = 'Manager selection is required';
    }
    
    if (!formData.leaveType) {
      newErrors.leaveType = 'Leave type is required';
    }
    
    if (selectedDates.length === 0) {
      newErrors.dates = 'Please select at least one date';
    }
    
    // Check for duplicates
    const userId = formData.selectedUser?.accountId || formData.selectedUser?.id;
    if (checkDuplicatePTO({ allRequests, userId, dates: selectedDates })) {
      newErrors.duplicate = 'This user already has a PTO request for one or more of these dates.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const totalDays = formData.dailySchedules.reduce(
        (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5),
        0
      );
      
      const totalHours = formData.dailySchedules.reduce(
        (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 8 : 4),
        0
      );

      const submissionData = {
        reporter: formData.selectedUser,
        manager: formData.manager,
        startDate: formData.startDate,
        endDate: formData.endDate,
        leaveType: formData.leaveType,
        reason: formData.reason.trim() || 'No reason provided',
        dailySchedules: formData.dailySchedules,
        totalDays,
        totalHours,
      };

      await onSubmit(submissionData);
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to submit PTO request' });
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleType = (date, type) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: prev.dailySchedules.map(schedule =>
        schedule.date === date ? { ...schedule, type } : schedule
      ),
    }));
  };

  const handleUserSelect = (user) => {
    setFormData(prev => ({ ...prev, selectedUser: user, manager: null }));
    if (user) {
      findAndSetManager(user);
    }
    // Clear user-related errors
    setErrors(prev => ({ ...prev, selectedUser: null, manager: null }));
  };

  const totalDays = formData.dailySchedules.reduce(
    (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5),
    0
  );
  
  const totalHours = formData.dailySchedules.reduce(
    (sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 8 : 4),
    0
  );

  return (
    <div className="pto-modal-overlay">
      <div className="pto-modal-content">
        {/* Header */}
        <div className="pto-modal-header">
          <div className="pto-modal-title">
            <Calendar size={24} className="pto-modal-icon" />
            <h3>Request Time Off</h3>
          </div>
          <button onClick={onClose} className="pto-modal-close">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="pto-modal-body">
          {/* User Selection */}
          <div className="pto-form-section">
            <label className="pto-form-label">
              <User size={16} />
              Request for {isAdmin ? '*' : ''}
            </label>
            
            {isAdmin ? (
              <UserPicker
                selectedUser={formData.selectedUser}
                onSelect={handleUserSelect}
                placeholder="Search and select user"
                required
                error={errors.selectedUser}
              />
            ) : (
              <div className="pto-user-display">
                <div className="pto-user-avatar">
                  {formData.selectedUser?.avatarUrl ? (
                    <img 
                      src={formData.selectedUser.avatarUrl} 
                      alt={formData.selectedUser.displayName}
                    />
                  ) : (
                    formData.selectedUser?.displayName?.charAt(0) || <User size={16} />
                  )}
                </div>
                <div className="pto-user-info">
                  <div className="pto-user-name">{formData.selectedUser?.displayName}</div>
                  <div className="pto-user-email">{formData.selectedUser?.emailAddress}</div>
                </div>
                <div className="pto-user-badge">You</div>
              </div>
            )}
            {errors.selectedUser && <div className="pto-error-text">{errors.selectedUser}</div>}
          </div>

          {/* Manager Selection */}
          <div className="pto-form-section">
            <label className="pto-form-label">
              <Users size={16} />
              Manager *
              {autoManagerSearch && (
                <span className="pto-loading-text">
                  <div className="pto-spinner"></div>
                  Finding manager...
                </span>
              )}
            </label>
            
            <UserPicker
              selectedUser={formData.manager}
              onSelect={(manager) => {
                setFormData(prev => ({ ...prev, manager }));
                setErrors(prev => ({ ...prev, manager: null }));
              }}
              placeholder={formData.manager ? "Manager found automatically" : "Search and select manager"}
              required
              error={errors.manager}
            />
            {errors.manager && <div className="pto-error-text">{errors.manager}</div>}
          </div>

          {/* Leave Type */}
          <div className="pto-form-section">
            <label className="pto-form-label">
              <Calendar size={16} />
              Leave Type *
            </label>
            <div className="pto-leave-types">
              {LEAVE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, leaveType: type.value }));
                    setErrors(prev => ({ ...prev, leaveType: null }));
                  }}
                  className={`pto-leave-type-btn ${formData.leaveType === type.value ? 'selected' : ''}`}
                >
                  <span className="pto-leave-emoji">{type.emoji}</span>
                  <span className="pto-leave-label">{type.label.replace(/^🏖️|🤒|👤|🎉|📋\s/, '')}</span>
                </button>
              ))}
            </div>
            {errors.leaveType && <div className="pto-error-text">{errors.leaveType}</div>}
          </div>

          {/* Reason */}
          <div className="pto-form-section">
            <label className="pto-form-label">
              Reason (Optional)
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="pto-textarea"
              rows="3"
              placeholder="Provide additional details about your time off request..."
            />
          </div>

          {/* Selected Dates */}
          {selectedDates.length > 0 && (
            <div className="pto-form-section">
              <label className="pto-form-label">
                <Clock size={16} />
                Schedule Details
              </label>
              <div className="pto-schedule-container">
                {formData.dailySchedules.map(schedule => (
                  <div key={schedule.date} className="pto-schedule-day">
                    <div className="pto-schedule-date">
                      {new Date(schedule.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <select
                      value={schedule.type}
                      onChange={(e) => updateScheduleType(schedule.date, e.target.value)}
                      className="pto-schedule-select"
                    >
                      <option value="FULL_DAY">Full Day (8h)</option>
                      <option value="HALF_DAY_MORNING">Morning Half (4h)</option>
                      <option value="HALF_DAY_AFTERNOON">Afternoon Half (4h)</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedDates.length > 0 && (
            <div className="pto-summary">
              <h4 className="pto-summary-title">Request Summary</h4>
              <div className="pto-summary-grid">
                <div className="pto-summary-item">
                  <span className="pto-summary-label">Total Days:</span>
                  <span className="pto-summary-value">{totalDays}</span>
                </div>
                <div className="pto-summary-item">
                  <span className="pto-summary-label">Total Hours:</span>
                  <span className="pto-summary-value">{totalHours}h</span>
                </div>
                <div className="pto-summary-item">
                  <span className="pto-summary-label">Date Range:</span>
                  <span className="pto-summary-value">
                    {new Date(formData.startDate).toLocaleDateString()} - {new Date(formData.endDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="pto-summary-item">
                  <span className="pto-summary-label">Requesting User:</span>
                  <span className="pto-summary-value">{formData.selectedUser?.displayName || 'Not selected'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {errors.duplicate && (
            <div className="pto-error-banner">
              <AlertCircle size={16} />
              {errors.duplicate}
            </div>
          )}
          
          {errors.dates && (
            <div className="pto-error-banner">
              <AlertCircle size={16} />
              {errors.dates}
            </div>
          )}

          {errors.submit && (
            <div className="pto-error-banner">
              <AlertCircle size={16} />
              {errors.submit}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pto-modal-footer">
          <button 
            type="button" 
            onClick={onClose} 
            className="pto-btn pto-btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || selectedDates.length === 0 || !formData.selectedUser || !formData.manager || !formData.leaveType}
            className="pto-btn pto-btn-primary"
          >
            {loading ? (
              <>
                <div className="pto-spinner"></div>
                Submitting...
              </>
            ) : (
              <>
                <Calendar size={16} />
                Submit Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PTOSubmissionModal;