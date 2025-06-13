// src/static/components/Modal/RequestModal.jsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './RequestModal.css';
import UserPicker from '../Common/UserPicker';

const RequestModal = ({
  isOpen,
  onClose,
  selectedDates,
  currentUser,
  isAdmin,
  onRequestSubmitted
}) => {
  // State for the request form
  const [formData, setFormData] = useState({
    requester_id: currentUser ? currentUser.user_id : '',
    requester_name: currentUser ? currentUser.display_name : '',
    requester_email: currentUser ? currentUser.email_address : '',
    manager_id: '',
    manager_name: '',
    manager_email: '',
    executive_manager_id: '',
    executive_manager_name: '',
    executive_manager_email: '',
    leave_type: 'vacation',
    reason: '',
    daily_schedules: [],
    total_days: 0,
    total_hours: 0
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isAdminRequest, setIsAdminRequest] = useState(false);
  const [selectedRequester, setSelectedRequester] = useState(null);
  
  // Initialize daily schedules from selected dates
  useEffect(() => {
    if (selectedDates && selectedDates.length > 0) {
      const schedules = selectedDates.map(date => ({
        date,
        schedule_type: 'FULL_DAY',
        hours: 8
      }));
      
      const totalDays = schedules.length;
      const totalHours = schedules.reduce((sum, schedule) => sum + schedule.hours, 0);
      
      setFormData(prev => ({
        ...prev,
        daily_schedules: schedules,
        total_days: totalDays,
        total_hours: totalHours
      }));
    }
  }, [selectedDates]);
  
  // If admin changes the requester, fetch their manager info
  useEffect(() => {
    if (isAdminRequest && selectedRequester) {
      const fetchManagerInfo = async () => {
        try {
          const managers = await invoke('getUserManagers', { userId: selectedRequester.user_id });
          
          if (managers && managers.length > 0) {
            // Find first manager and executive manager if available
            const manager = managers.find(m => m.id);
            
            setFormData(prev => ({
              ...prev,
              requester_id: selectedRequester.user_id,
              requester_name: selectedRequester.display_name,
              requester_email: selectedRequester.email_address,
              manager_id: manager ? manager.id : '',
              manager_name: manager ? manager.name : '',
              manager_email: manager ? manager.email : '',
              // Executive manager could be added here if you have a way to determine it
            }));
          }
        } catch (error) {
          console.error('Error fetching manager info:', error);
        }
      };
      
      fetchManagerInfo();
    } else {
      // If not an admin request, reset to current user
      if (currentUser) {
        const fetchCurrentUserManagers = async () => {
          try {
            const managers = await invoke('getUserManagers', { userId: currentUser.user_id });
            
            if (managers && managers.length > 0) {
              // Find first manager and executive manager if available
              const manager = managers.find(m => m.id);
              const execManager = managers.find(m => m.role === 'Executive Manager');
              
              setFormData(prev => ({
                ...prev,
                requester_id: currentUser.user_id,
                requester_name: currentUser.display_name,
                requester_email: currentUser.email_address,
                manager_id: manager ? manager.id : '',
                manager_name: manager ? manager.name : '',
                manager_email: manager ? manager.email : '',
                executive_manager_id: execManager ? execManager.id : '',
                executive_manager_name: execManager ? execManager.name : '',
                executive_manager_email: execManager ? execManager.email : ''
              }));
            }
          } catch (error) {
            console.error('Error fetching current user manager info:', error);
          }
        };
        
        fetchCurrentUserManagers();
      }
    }
  }, [isAdminRequest, selectedRequester, currentUser]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle schedule type change for a specific date
  const handleScheduleTypeChange = (index, type) => {
    const updatedSchedules = [...formData.daily_schedules];
    updatedSchedules[index].schedule_type = type;
    updatedSchedules[index].hours = type === 'FULL_DAY' ? 8 : 4;
    
    const totalHours = updatedSchedules.reduce((sum, schedule) => sum + schedule.hours, 0);
    const totalDays = totalHours / 8; // Convert hours to days equivalent
    
    setFormData(prev => ({
      ...prev,
      daily_schedules: updatedSchedules,
      total_hours: totalHours,
      total_days: totalDays
    }));
  };
  
  // Toggle admin request mode
  const toggleAdminRequest = () => {
    setIsAdminRequest(!isAdminRequest);
    
    // Reset selected requester if turning off admin mode
    if (isAdminRequest) {
      setSelectedRequester(null);
      
      // Reset to current user
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          requester_id: currentUser.user_id,
          requester_name: currentUser.display_name,
          requester_email: currentUser.email_address
        }));
      }
    }
  };
  
  // Handle requester selection (for admin requests)
  const handleRequesterSelected = (user) => {
    setSelectedRequester(user);
  };
  
  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.requester_id) {
      newErrors.requester = 'Requester is required';
    }
    
    if (!formData.leave_type) {
      newErrors.leave_type = 'Leave type is required';
    }
    
    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    }
    
    if (!formData.manager_id) {
      newErrors.manager = 'Manager information is missing';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await invoke('createPTORequest', {
        requestData: formData
      });
      
      // Notify parent component about successful submission
      onRequestSubmitted();
    } catch (error) {
      console.error('Error submitting PTO request:', error);
      setErrors({ submit: 'Failed to submit request. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">Request Time Off</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          {/* Admin toggle (only shown for admins) */}
          {isAdmin && (
            <div className="form-group">
              <label className="form-switch">
                <input 
                  type="checkbox" 
                  checked={isAdminRequest} 
                  onChange={toggleAdminRequest} 
                />
                <span className="form-switch-label">Submit as admin (on behalf of another user)</span>
              </label>
            </div>
          )}
          
          {/* Requester section - editable for admins */}
          <div className="form-group">
            <label className="form-label">Requester</label>
            {isAdminRequest ? (
              <UserPicker 
                value={selectedRequester}
                onChange={handleRequesterSelected}
              />
            ) : (
              <div className="form-control-static">
                {formData.requester_name} ({formData.requester_email})
              </div>
            )}
            {errors.requester && <div className="form-error">{errors.requester}</div>}
          </div>
          
          {/* Manager info (non-editable) */}
          <div className="form-group">
            <label className="form-label">Manager</label>
            <div className="form-control-static">
              {formData.manager_name ? 
                `${formData.manager_name} (${formData.manager_email})` : 
                'No manager assigned'}
            </div>
            {errors.manager && <div className="form-error">{errors.manager}</div>}
          </div>
          
          {/* Executive Manager info (non-editable) */}
          <div className="form-group">
            <label className="form-label">Executive Manager</label>
            <div className="form-control-static">
              {formData.executive_manager_name ? 
                `${formData.executive_manager_name} (${formData.executive_manager_email})` : 
                'No executive manager assigned'}
            </div>
          </div>
          
          {/* Leave type */}
          <div className="form-group">
            <label className="form-label">Leave Type</label>
            <select 
              name="leave_type" 
              value={formData.leave_type}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="vacation">Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="holiday">Holiday</option>
              <option value="other">Other</option>
            </select>
            {errors.leave_type && <div className="form-error">{errors.leave_type}</div>}
          </div>
          
          {/* Reason */}
          <div className="form-group">
            <label className="form-label">Reason</label>
            <textarea 
              name="reason" 
              value={formData.reason}
              onChange={handleInputChange}
              className="form-control"
              rows="3"
              placeholder="Provide a reason for your time off request"
            ></textarea>
            {errors.reason && <div className="form-error">{errors.reason}</div>}
          </div>
          
          {/* Selected dates with schedule type options */}
          <div className="form-group">
            <label className="form-label">Selected Dates</label>
            <div className="daily-schedule-list">
              {formData.daily_schedules.map((schedule, index) => (
                <div key={index} className="daily-schedule-item">
                  <div className="daily-schedule-date">
                    {formatDate(schedule.date)}
                  </div>
                  <div className="daily-schedule-actions">
                    <select 
                      value={schedule.schedule_type}
                      onChange={(e) => handleScheduleTypeChange(index, e.target.value)}
                      className="form-select-sm"
                    >
                      <option value="FULL_DAY">Full Day</option>
                      <option value="HALF_DAY_MORNING">Half Day (Morning)</option>
                      <option value="HALF_DAY_AFTERNOON">Half Day (Afternoon)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Summary */}
          <div className="modal-summary">
            <h3>Request Summary</h3>
            <div className="summary-item">
              <span>Total Days:</span>
              <span>{formData.total_days}</span>
            </div>
            <div className="summary-item">
              <span>Total Hours:</span>
              <span>{formData.total_hours}</span>
            </div>
            <div className="summary-item">
              <span>Leave Type:</span>
              <span className={`leave-type-${formData.leave_type}`}>{formData.leave_type}</span>
            </div>
          </div>
          
          {errors.submit && <div className="form-error">{errors.submit}</div>}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestModal;