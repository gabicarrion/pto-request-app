import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { invoke } from '@forge/bridge';

const EditPTOModal = ({ request, onClose, onSave, currentUser }) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    leaveType: '',
    reason: '',
    dailySchedules: []
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (request) {
      setFormData({
        startDate: request.start_date,
        endDate: request.end_date,
        leaveType: request.leave_type,
        reason: request.reason || '',
        dailySchedules: request.daily_schedules || []
      });
    }
  }, [request]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Check if request can be edited
      if (request.status === 'approved') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(request.start_date);
        
        if (startDate < today) {
          setError('Cannot edit approved requests with past dates. Please contact an admin for assistance.');
          return;
        }
      }

      const response = await invoke('editPTORequest', {
        requestId: request.id,
        editedBy: currentUser.accountId,
        updatedData: {
          startDate: formData.startDate,
          endDate: formData.endDate,
          leaveType: formData.leaveType,
          reason: formData.reason,
          dailySchedules: formData.dailySchedules
        }
      });

      if (response.success) {
        onSave(response.data);
        onClose();
      } else {
        setError(response.message || 'Failed to update PTO request');
      }
    } catch (error) {
      setError('Failed to update PTO request: ' + error.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit PTO Request</h3>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>Leave Type</label>
            <select
              value={formData.leaveType}
              onChange={(e) => setFormData(prev => ({ ...prev, leaveType: e.target.value }))}
              className="form-control"
              required
            >
              <option value="vacation">Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reason</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="form-control"
              rows="3"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPTOModal; 