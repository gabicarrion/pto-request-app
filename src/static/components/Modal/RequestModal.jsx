import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { Calendar, Clock, User, Users, X, Check, FileText } from 'lucide-react';
import './RequestModal.css';

/**
 * Request Modal for creating and editing PTO requests
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Object} props.currentUser - Current user information
 * @param {Array} props.teams - Array of teams
 * @param {Array} props.users - Array of users
 * @param {Function} props.onSubmit - Handler for form submission
 * @param {Object} props.editRequest - Request to edit (if editing)
 */
function RequestModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  teams, 
  users, 
  onSubmit,
  editRequest = null
}) {
  // Form state
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'vacation',
    reason: '',
    requestType: 'full-day',
    startTime: '09:00',
    endTime: '17:00',
    hours: 8,
    managerId: '',
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [dailySchedules, setDailySchedules] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [manager, setManager] = useState(null);
  
  // Populating form when editing a request
  useEffect(() => {
    if (editRequest) {
      setFormData({
        startDate: editRequest.start_date || '',
        endDate: editRequest.end_date || '',
        leaveType: editRequest.leave_type || 'vacation',
        reason: editRequest.reason || '',
        requestType: 'full-day', // Default, will be updated from schedules
        startTime: '09:00',
        endTime: '17:00',
        hours: editRequest.total_hours || 8,
        managerId: editRequest.manager_id || '',
      });
      
      // Load daily schedules for this request if available
      if (editRequest.id) {
        loadRequestSchedules(editRequest.id);
      }
    }
  }, [editRequest]);
  
  // Load daily schedules for a request when editing
  const loadRequestSchedules = async (requestId) => {
    try {
      const response = await invoke('getRequestSchedules', { requestId });
      if (response.success && response.data) {
        setDailySchedules(response.data);
        
        // Determine requestType from the first schedule
        if (response.data.length > 0) {
          const firstSchedule = response.data[0];
          setFormData(prev => ({
            ...prev,
            requestType: firstSchedule.type === 'FULL_DAY' ? 'full-day' : 'partial-day',
            hours: firstSchedule.hours || 8,
            startTime: firstSchedule.start_time || '09:00',
            endTime: firstSchedule.end_time || '17:00',
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load request schedules:", error);
    }
  };
  
  // Load current user's team and manager
  useEffect(() => {
    if (currentUser && teams && teams.length > 0 && users && users.length > 0) {
      // Find current user's team(s)
      let userTeam = null;
      
      // Check if user has team_memberships
      if (currentUser.team_memberships && currentUser.team_memberships.length > 0) {
        const teamId = currentUser.team_memberships[0].team_id;
        userTeam = teams.find(team => team.id === teamId);
      } else if (currentUser.team_id) {
        // Legacy support for team_id
        userTeam = teams.find(team => team.id === currentUser.team_id);
      }
      
      setCurrentTeam(userTeam);
      
      // Find manager from team or user data
      let userManager = null;
      
      // First try to get manager from user's direct manager field
      if (currentUser.manager) {
        userManager = users.find(u => 
          u.id === currentUser.manager || 
          u.jira_account_id === currentUser.manager
        );
      }
      
      // If no direct manager, try team manager
      if (!userManager && userTeam && userTeam.manager) {
        userManager = users.find(u => 
          u.id === userTeam.manager || 
          u.jira_account_id === userTeam.manager
        );
      }
      
      // If no team manager, try to find team member with 'Manager' role
      if (!userManager && userTeam) {
        const teamMembers = users.filter(user => {
          if (user.team_memberships && Array.isArray(user.team_memberships)) {
            return user.team_memberships.some(membership => 
              membership.team_id === userTeam.id && membership.role === 'Manager'
            );
          }
          return false;
        });
        
        if (teamMembers.length > 0) {
          userManager = teamMembers[0];
        }
      }
      
      if (userManager) {
        setManager(userManager);
        setFormData(prev => ({
          ...prev,
          managerId: userManager.id || userManager.jira_account_id || ''
        }));
      }
    }
  }, [currentUser, teams, users]);
  
  // Reset form when opening the modal
  useEffect(() => {
    if (isOpen && !editRequest) {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        startDate: today,
        endDate: today,
        leaveType: 'vacation',
        reason: '',
        requestType: 'full-day',
        startTime: '09:00',
        endTime: '17:00',
        hours: 8,
        managerId: manager ? (manager.id || manager.jira_account_id || '') : '',
      });
      setDailySchedules([]);
      setErrors({});
    }
  }, [isOpen, editRequest, manager]);
  
  // Update days when date range changes
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      // Clear old schedules
      setDailySchedules([]);
      
      // Only generate schedules if dates are valid
      if (start && end && start <= end) {
        const newSchedules = [];
        const currentDate = new Date(start);
        
        // Loop through dates
        while (currentDate <= end) {
          // Skip weekends (0 = Sunday, 6 = Saturday)
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            newSchedules.push({
              date: currentDate.toISOString().split('T')[0],
              type: formData.requestType === 'full-day' ? 'FULL_DAY' : 'HALF_DAY',
              period: 'full_time', // Default period
              leaveType: formData.leaveType,
              hours: formData.requestType === 'full-day' ? 8 : formData.hours,
              start_time: formData.startTime,
              end_time: formData.endTime
            });
          }
          
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        setDailySchedules(newSchedules);
      }
    }
  }, [formData.startDate, formData.endDate, formData.requestType, formData.leaveType, formData.hours]);
  
  // Calculate hours when time changes
  useEffect(() => {
    if (formData.requestType === 'partial-day' && formData.startTime && formData.endTime) {
      const start = new Date(`2000-01-01T${formData.startTime}`);
      const end = new Date(`2000-01-01T${formData.endTime}`);
      
      if (start && end && end > start) {
        // Calculate hours difference
        const hours = (end - start) / (1000 * 60 * 60);
        setFormData(prev => ({ ...prev, hours }));
        
        // Update hours in daily schedules
        setDailySchedules(prev => 
          prev.map(schedule => ({
            ...schedule,
            hours,
            start_time: formData.startTime,
            end_time: formData.endTime
          }))
        );
      }
    }
  }, [formData.startTime, formData.endTime, formData.requestType]);
  
  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };
  
  // Handle request type change
  const handleRequestTypeChange = (type) => {
    setFormData(prev => ({ 
      ...prev, 
      requestType: type,
      hours: type === 'full-day' ? 8 : prev.hours
    }));
    
    // Update all daily schedules with new type
    setDailySchedules(prev => 
      prev.map(schedule => ({
        ...schedule,
        type: type === 'full-day' ? 'FULL_DAY' : 'HALF_DAY',
        hours: type === 'full-day' ? 8 : formData.hours
      }))
    );
  };
  
  // Validate form before submission
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        newErrors.endDate = 'End date cannot be before start date';
      }
    }
    
    if (!formData.leaveType) {
      newErrors.leaveType = 'Leave type is required';
    }
    
    if (!formData.managerId) {
      newErrors.managerId = 'Manager is required';
    }
    
    if (formData.requestType === 'partial-day') {
      if (!formData.startTime) {
        newErrors.startTime = 'Start time is required';
      }
      
      if (!formData.endTime) {
        newErrors.endTime = 'End time is required';
      }
      
      if (formData.startTime && formData.endTime) {
        const start = new Date(`2000-01-01T${formData.startTime}`);
        const end = new Date(`2000-01-01T${formData.endTime}`);
        
        if (end <= start) {
          newErrors.endTime = 'End time must be after start time';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const selectedManager = users.find(u => u.id === formData.managerId || u.jira_account_id === formData.managerId);
      
      // Ensure each daily schedule has all necessary data
      const finalDailySchedules = dailySchedules.map(schedule => {
        // Set appropriate times based on period
        let startTime = schedule.start_time || formData.startTime;
        let endTime = schedule.end_time || formData.endTime;
        let hours = schedule.hours;
        
        if (schedule.period === 'half_day_morning') {
          startTime = '09:00';
          endTime = '13:00';
          hours = 4;
        } else if (schedule.period === 'half_day_afternoon') {
          startTime = '13:00';
          endTime = '17:00';
          hours = 4;
        } else if (schedule.type === 'FULL_DAY') {
          startTime = '09:00';
          endTime = '17:00';
          hours = 8;
        }
        
        return {
          ...schedule,
          start_time: startTime,
          end_time: endTime,
          hours: hours
        };
      });
      
      const requestData = {
        id: editRequest?.id,
        requester_id: currentUser.id || currentUser.accountId || currentUser.jira_account_id,
        requester_name: currentUser.display_name || currentUser.displayName || `${currentUser.first_name} ${currentUser.last_name}`,
        requester_email: currentUser.email_address || currentUser.emailAddress,
        manager_id: selectedManager?.id || selectedManager?.jira_account_id,
        manager_name: selectedManager?.display_name || selectedManager?.displayName || `${selectedManager?.first_name} ${selectedManager?.last_name}`,
        manager_email: selectedManager?.email_address || selectedManager?.emailAddress,
        start_date: formData.startDate,
        end_date: formData.endDate,
        total_days: finalDailySchedules.length,
        total_hours: finalDailySchedules.reduce((sum, day) => sum + day.hours, 0),
        reason: formData.reason,
        leave_type: formData.leaveType,
        daily_schedules: finalDailySchedules
      };
      
      console.log('Submitting PTO request:', requestData);
      
      if (onSubmit) {
        await onSubmit(requestData);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to submit PTO request:', error);
      setErrors(prev => ({ ...prev, submit: 'Failed to submit request: ' + error.message }));
    } finally {
      setLoading(false);
    }
  };
  
  // Render nothing if the modal is closed
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="request-modal">
        <div className="request-modal-header">
          <h2>{editRequest ? 'Edit PTO Request' : 'New PTO Request'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="request-modal-content">
          <form onSubmit={handleSubmit}>
            {/* Requester information */}
            <div className="form-section">
              <h3 className="section-title">Requester Information</h3>
              
              <div className="user-info">
                {currentUser && (
                  <>
                    <div className="user-avatar">
                      {currentUser.avatarUrl ? (
                        <img src={currentUser.avatarUrl} alt="User Avatar" />
                      ) : (
                        <div className="avatar-placeholder">
                          {(currentUser.display_name || currentUser.displayName || '').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="user-details">
                      <div className="user-name">
                        {currentUser.display_name || currentUser.displayName || `${currentUser.first_name} ${currentUser.last_name}`}
                      </div>
                      <div className="user-email">
                        {currentUser.email_address || currentUser.emailAddress}
                      </div>
                      {currentTeam && (
                        <div className="user-team">
                          <span>Team:</span> {currentTeam.name}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Leave details */}
            <div className="form-section">
              <h3 className="section-title">Leave Details</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="leaveType">
                    <Calendar size={16} />
                    Leave Type
                  </label>
                  <select
                    id="leaveType"
                    value={formData.leaveType}
                    onChange={(e) => handleInputChange('leaveType', e.target.value)}
                    className={errors.leaveType ? 'error' : ''}
                  >
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal Leave</option>
                    <option value="holiday">Holiday</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.leaveType && <div className="error-message">{errors.leaveType}</div>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="manager">
                    <User size={16} />
                    Manager
                  </label>
                  <select
                    id="manager"
                    value={formData.managerId}
                    onChange={(e) => handleInputChange('managerId', e.target.value)}
                    className={errors.managerId ? 'error' : ''}
                  >
                    <option value="">Select Manager</option>
                    {users.map(user => (
                      <option 
                        key={user.id || user.jira_account_id} 
                        value={user.id || user.jira_account_id}
                      >
                        {user.display_name || user.displayName || `${user.first_name} ${user.last_name}`}
                      </option>
                    ))}
                  </select>
                  {errors.managerId && <div className="error-message">{errors.managerId}</div>}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startDate">
                    <Calendar size={16} />
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    className={errors.startDate ? 'error' : ''}
                  />
                  {errors.startDate && <div className="error-message">{errors.startDate}</div>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="endDate">
                    <Calendar size={16} />
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    className={errors.endDate ? 'error' : ''}
                  />
                  {errors.endDate && <div className="error-message">{errors.endDate}</div>}
                </div>
              </div>
              
              <div className="form-group">
                <label>Request Type</label>
                <div className="request-type-selector">
                  <button 
                    type="button"
                    className={`request-type-btn ${formData.requestType === 'full-day' ? 'active' : ''}`}
                    onClick={() => handleRequestTypeChange('full-day')}
                  >
                    <Check size={16} className="check-icon" />
                    Full Day
                  </button>
                  <button 
                    type="button"
                    className={`request-type-btn ${formData.requestType === 'partial-day' ? 'active' : ''}`}
                    onClick={() => handleRequestTypeChange('partial-day')}
                  >
                    <Check size={16} className="check-icon" />
                    Partial Day
                  </button>
                </div>
              </div>
              
              {formData.requestType === 'partial-day' && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="startTime">
                      <Clock size={16} />
                      Start Time
                    </label>
                    <input
                      type="time"
                      id="startTime"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className={errors.startTime ? 'error' : ''}
                    />
                    {errors.startTime && <div className="error-message">{errors.startTime}</div>}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="endTime">
                      <Clock size={16} />
                      End Time
                    </label>
                    <input
                      type="time"
                      id="endTime"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      className={errors.endTime ? 'error' : ''}
                    />
                    {errors.endTime && <div className="error-message">{errors.endTime}</div>}
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label htmlFor="reason">
                  <FileText size={16} />
                  Reason (Optional)
                </label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Provide a reason for this time off request"
                  rows="3"
                />
              </div>
            </div>
            
            {/* Request Summary */}
            <div className="form-section">
              <h3 className="section-title">Request Summary</h3>
              
              <div className="summary-box">
                <div className="summary-item">
                  <span className="summary-label">Total Days:</span>
                  <span className="summary-value">{dailySchedules.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Hours:</span>
                  <span className="summary-value">
                    {dailySchedules.reduce((sum, day) => sum + day.hours, 0).toFixed(1)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Leave Type:</span>
                  <span className="summary-value capitalize">{formData.leaveType}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Dates:</span>
                  <span className="summary-value">
                    {formData.startDate === formData.endDate 
                      ? formData.startDate 
                      : `${formData.startDate} to ${formData.endDate}`}
                  </span>
                </div>
              </div>
              
              {dailySchedules.length > 0 && (
                <div className="daily-schedules">
                  <h4>Daily Schedule</h4>
                  <div className="schedules-list">
                    {dailySchedules.map((schedule, index) => (
                      <div key={index} className="schedule-item-detailed">
                        <div className="schedule-date-header">
                          <span className="schedule-date">{formatDate(schedule.date)}</span>
                        </div>
                        <div className="schedule-settings">
                          <div className="schedule-setting">
                            <label>Leave Type</label>
                            <select 
                              value={schedule.leaveType}
                              onChange={(e) => {
                                const updatedSchedules = [...dailySchedules];
                                updatedSchedules[index].leaveType = e.target.value;
                                setDailySchedules(updatedSchedules);
                              }}
                            >
                              <option value="vacation">Vacation</option>
                              <option value="sick">Sick Leave</option>
                              <option value="personal">Personal Leave</option>
                              <option value="holiday">Holiday</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          
                          <div className="schedule-setting">
                            <label>Period</label>
                            <select 
                              value={schedule.period || 'full_time'}
                              onChange={(e) => {
                                const updatedSchedules = [...dailySchedules];
                                updatedSchedules[index].period = e.target.value;
                                
                                // Update hours and type based on period
                                if (e.target.value === 'full_time') {
                                  updatedSchedules[index].type = 'FULL_DAY';
                                  updatedSchedules[index].hours = 8;
                                } else {
                                  updatedSchedules[index].type = 'HALF_DAY';
                                  updatedSchedules[index].hours = 4;
                                }
                                
                                setDailySchedules(updatedSchedules);
                              }}
                            >
                              <option value="full_time">Full Day</option>
                              <option value="half_day_morning">Half Day (Morning)</option>
                              <option value="half_day_afternoon">Half Day (Afternoon)</option>
                            </select>
                          </div>
                          
                          <div className="schedule-hours">
                            {schedule.hours} hrs
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {errors.submit && (
              <div className="form-error">
                {errors.submit}
              </div>
            )}
            
            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Submitting...' : (editRequest ? 'Update Request' : 'Submit Request')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Helper function to format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export default RequestModal;