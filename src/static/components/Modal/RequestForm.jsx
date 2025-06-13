import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Users, FileText, Check } from 'lucide-react';
import UserPicker from '../Common/UserPicker';
import { getLeaveTypesArray } from '../Common/leaveTypeUtils';

/**
 * Request Form component for creating and editing PTO requests
 * 
 * @param {Object} props
 * @param {Object} props.currentUser - Current user information
 * @param {Array} props.teams - List of teams
 * @param {Array} props.users - List of users
 * @param {Object} props.initialValues - Initial form values (for editing)
 * @param {Function} props.onSubmit - Handler for form submission
 * @param {Function} props.onCancel - Handler for form cancellation
 */
const RequestForm = ({ 
  currentUser, 
  teams = [], 
  users = [], 
  initialValues = null, 
  onSubmit, 
  onCancel 
}) => {
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
  
  // Populating form with initial values
  useEffect(() => {
    if (initialValues) {
      setFormData({
        startDate: initialValues.start_date || '',
        endDate: initialValues.end_date || '',
        leaveType: initialValues.leave_type || 'vacation',
        reason: initialValues.reason || '',
        requestType: 'full-day', // Default, will be updated from schedules
        startTime: '09:00',
        endTime: '17:00',
        hours: initialValues.total_hours || 8,
        managerId: initialValues.manager_id || '',
      });
      
      // Load daily schedules if available
      if (initialValues.daily_schedules && initialValues.daily_schedules.length > 0) {
        setDailySchedules(initialValues.daily_schedules);
        
        // Determine requestType from the first schedule
        const firstSchedule = initialValues.daily_schedules[0];
        setFormData(prev => ({
          ...prev,
          requestType: firstSchedule.type === 'FULL_DAY' ? 'full-day' : 'partial-day',
          hours: firstSchedule.hours || 8,
          startTime: firstSchedule.start_time || '09:00',
          endTime: firstSchedule.end_time || '17:00',
        }));
      }
    } else {
      // Set default values for new request
      const today = new Date().toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        startDate: today,
        endDate: today
      }));
    }
  }, [initialValues]);
  
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
  
  // Handle manager selection
  const handleManagerChange = (manager) => {
    setFormData(prev => ({
      ...prev,
      managerId: manager ? (manager.id || manager.jira_account_id) : ''
    }));
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
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
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
        id: initialValues?.id,
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
      
      if (onSubmit) {
        await onSubmit(requestData);
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
      setErrors(prev => ({ ...prev, submit: 'Failed to submit request: ' + error.message }));
    } finally {
      setLoading(false);
    }
  };
  
  return (
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
              {getLeaveTypesArray().map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
            {errors.leaveType && <div className="error-message">{errors.leaveType}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="manager">
              <User size={16} />
              Manager
            </label>
            <UserPicker
              selectedUser={users.find(u => u.id === formData.managerId || u.jira_account_id === formData.managerId)}
              onSelect={handleManagerChange}
              placeholder="Search and select manager"
              disabled={loading}
              error={errors.manager}
              useBackendSearch={false}
              allUsers={users}
            />
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
                        {getLeaveTypesArray().map(type => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
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
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Submitting...' : (initialValues ? 'Update Request' : 'Submit Request')}
        </button>
      </div>
    </form>
  );
};

export default RequestForm;