import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import UserPicker from './UserPicker';

function findManagerForUser(selectedUser, allUsers, allTeams) {
  if (!selectedUser || !allTeams?.length || !allUsers?.length) return null;
  const userTeam = allTeams.find(
    team => team.id === selectedUser.team_id || team.id === selectedUser.teamId
  );
  if (!userTeam) return null;
  if (userTeam.manager) {
    if (typeof userTeam.manager === 'object') return userTeam.manager;
    return allUsers.find(
      u => u.accountId === userTeam.manager || u.id === userTeam.manager
    );
  }
  if (userTeam.team_lead) {
    return allUsers.find(
      u => u.accountId === userTeam.team_lead || u.displayName === userTeam.team_lead
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
    )
  );
}

const PTOSubmissionModal = ({
  selectedDates = [],
  onClose,
  onSubmit,
  isAdminMode = false,
  targetUser = null,
  allUsers = [],
  allTeams = [],
  allRequests = [],
}) => {
  const [formData, setFormData] = useState({
    leaveType: '',
    reason: '',
    manager: null,
    startDate: '',
    endDate: '',
    dailySchedules: [],
  });
  const [errors, setErrors] = useState({});
  const [adminDates, setAdminDates] = useState([]);
  const [adminSelectedUser, setAdminSelectedUser] = useState(targetUser || null);

  useEffect(() => {
    if (isAdminMode && adminSelectedUser) {
      const manager = findManagerForUser(adminSelectedUser, allUsers, allTeams);
      setFormData(prev => ({ ...prev, manager }));
    }
    // eslint-disable-next-line
  }, [isAdminMode, adminSelectedUser, allUsers, allTeams]);

  useEffect(() => {
    if (isAdminMode) {
      setFormData(prev => ({
        ...prev,
        dailySchedules: adminDates.map(date => ({
          date,
          type: 'FULL_DAY',
        })),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        dailySchedules: selectedDates.map(date => ({
          date,
          type: 'FULL_DAY',
        })),
      }));
    }
  }, [isAdminMode, adminDates, selectedDates]);

  useEffect(() => {
    if (isAdminMode && formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
      setAdminDates(dates);
    }
    // eslint-disable-next-line
  }, [formData.startDate, formData.endDate, isAdminMode]);

  const validateForm = () => {
    const newErrors = {};
    if (isAdminMode) {
      if (!adminSelectedUser) newErrors.adminUser = 'User is required';
      if (!formData.startDate) newErrors.startDate = 'Start date is required';
      if (!formData.endDate) newErrors.endDate = 'End date is required';
      if (
        formData.startDate &&
        formData.endDate &&
        new Date(formData.startDate) > new Date(formData.endDate)
      ) {
        newErrors.endDate = 'End date must be after start date';
      }
    } else {
      if (selectedDates.length === 0)
        newErrors.dates = 'Please select at least one date';
      if (!formData.manager)
        newErrors.manager = 'Manager selection is required';
    }
    if (!formData.leaveType) newErrors.leaveType = 'Leave type is required';
    if (!formData.reason.trim()) newErrors.reason = 'Reason is required';

    // Duplicate check!
    const userId = isAdminMode
      ? adminSelectedUser?.id || adminSelectedUser?.accountId
      : formData.manager?.id || formData.manager?.accountId;
    const requestedDates = isAdminMode
      ? adminDates
      : selectedDates;
    if (checkDuplicatePTO({ allRequests, userId, dates: requestedDates })) {
      newErrors.duplicate = 'This user already has a PTO request for one or more of these dates.';
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
      ...formData,
      totalDays,
      totalHours,
      ...(isAdminMode && {
        targetUser: adminSelectedUser,
        startDate: formData.startDate,
        endDate: formData.endDate,
      }),
    };
    onSubmit(submissionData);
  };

  const updateScheduleType = (date, type) => {
    setFormData(prev => ({
      ...prev,
      dailySchedules: prev.dailySchedules.map(schedule =>
        schedule.date === date ? { ...schedule, type } : schedule
      ),
    }));
  };

  const effectiveDates = isAdminMode ? adminDates : selectedDates;

  const leaveTypes = [
    { value: 'vacation', label: '🏖️ Vacation' },
    { value: 'sick', label: '🤒 Sick Leave' },
    { value: 'personal', label: '👤 Personal Day' },
    { value: 'holiday', label: '🎉 Holiday' },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            <Calendar size={22} style={{ marginRight: 8, marginBottom: -3 }} />
            {isAdminMode
              ? adminSelectedUser
                ? `Create PTO for ${adminSelectedUser.displayName}`
                : 'Create PTO Request (Select User)'
              : 'Submit PTO Request'}
          </h3>
          <button onClick={onClose} className="modal-close"><X size={24} /></button>
        </div>
        <div className="modal-body">
          {/* Admin Mode: User Picker */}
          {isAdminMode && (
            <div className="mb-4">
              <label className="form-label">User *</label>
              <UserPicker
                selectedUser={adminSelectedUser}
                onSelect={setAdminSelectedUser}
                placeholder="Search and select user"
                required
                disabled={!!targetUser}
              />
              {errors.adminUser && <div className="error-text">{errors.adminUser}</div>}
            </div>
          )}
          {isAdminMode && adminSelectedUser && (
            <div className="bg-purple-50 mb-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(120deg,#e9d5ff 60%,#ede9fe 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff'
                }}>
                  {adminSelectedUser.displayName?.charAt(0) || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#6d28d9' }}>PTO for:</div>
                  <div style={{ fontSize: 14, color: '#6d28d9' }}>
                    {adminSelectedUser.displayName} ({adminSelectedUser.emailAddress})
                  </div>
                </div>
              </div>
            </div>
          )}
          {isAdminMode && (
            <div className="mb-4" style={{ display: 'flex', gap: 18 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`form-control${errors.startDate ? ' error' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={!adminSelectedUser}
                />
                {errors.startDate && <div className="error-text">{errors.startDate}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className={`form-control${errors.endDate ? ' error' : ''}`}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  disabled={!adminSelectedUser}
                />
                {errors.endDate && <div className="error-text">{errors.endDate}</div>}
              </div>
            </div>
          )}
          {!isAdminMode && (
            <div className="mb-4">
              <label className="form-label">
                Manager *
                <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 6 }}>
                  (Required for approval)
                </span>
              </label>
              <UserPicker
                selectedUser={formData.manager}
                onSelect={manager => setFormData(prev => ({ ...prev, manager }))}
                placeholder="Search and select your manager"
                required
                error={errors.manager}
              />
              {errors.manager && <div className="error-text">{errors.manager}</div>}
            </div>
          )}
          <div className="mb-4">
            <label className="form-label">Leave Type *</label>
            <select
              value={formData.leaveType}
              onChange={e => setFormData(prev => ({ ...prev, leaveType: e.target.value }))}
              className={`form-control${errors.leaveType ? ' error' : ''}`}
              required
              disabled={isAdminMode && !adminSelectedUser}
            >
              <option value="">Select leave type</option>
              {leaveTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {errors.leaveType && <div className="error-text">{errors.leaveType}</div>}
          </div>
          <div className="mb-4">
            <label className="form-label">Reason *</label>
            <textarea
              value={formData.reason}
              onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className={`form-control${errors.reason ? ' error' : ''}`}
              rows="3"
              placeholder="Please provide a detailed reason for your PTO request"
              required
              disabled={isAdminMode && !adminSelectedUser}
            />
            {errors.reason && <div className="error-text">{errors.reason}</div>}
          </div>
          {effectiveDates.length > 0 && (
            <div className="mb-4">
              <label className="form-label">Daily Schedule</label>
              <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'grid', gap: 10, maxHeight: 170, overflowY: 'auto' }}>
                  {formData.dailySchedules.map(schedule => (
                    <div key={schedule.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: '10px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                      <select
                        value={schedule.type}
                        onChange={e => updateScheduleType(schedule.date, e.target.value)}
                        className="form-control"
                        style={{ width: 150 }}
                      >
                        <option value="FULL_DAY">Full Day (8h)</option>
                        <option value="HALF_DAY_MORNING">Morning Half (4h)</option>
                        <option value="HALF_DAY_AFTERNOON">Afternoon Half (4h)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {effectiveDates.length > 0 && (
            <div className="bg-blue-50 mb-4">
              <h4 style={{ fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Request Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 15, color: '#1e40af' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Days:</span>
                  <span style={{ fontWeight: 600 }}>
                    {formData.dailySchedules.reduce((sum, s) => sum + (s.type === 'FULL_DAY' ? 1 : 0.5), 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Hours:</span>
                  <span style={{ fontWeight: 600 }}>
                    {formData.dailySchedules.reduce((sum, s) => sum + (s.type === 'FULL_DAY' ? 8 : 4), 0)}h
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date Range:</span>
                  <span style={{ fontWeight: 600 }}>
                    {effectiveDates.length > 0 &&
                      `${new Date(effectiveDates[0]).toLocaleDateString()} - ${new Date(
                        effectiveDates[effectiveDates.length - 1]
                      ).toLocaleDateString()}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{isAdminMode ? 'For User:' : 'Manager:'}</span>
                  <span style={{ fontWeight: 600 }}>
                    {isAdminMode
                      ? adminSelectedUser?.displayName || 'N/A'
                      : formData.manager
                      ? formData.manager.displayName
                      : 'Not selected'}
                  </span>
                </div>
              </div>
            </div>
          )}
          {errors.duplicate && (
            <div className="bg-red-50 error-text" style={{ marginBottom: 14 }}>
              {errors.duplicate}
            </div>
          )}
          {errors.dates && (
            <div className="bg-red-50 error-text" style={{ marginBottom: 14 }}>
              {errors.dates}
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            <button type="button" onClick={onClose} className="btn" style={{ flex: 1 }}>Cancel</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isAdminMode
                  ? !adminSelectedUser ||
                    !formData.leaveType ||
                    !formData.reason.trim() ||
                    !formData.startDate ||
                    !formData.endDate ||
                    effectiveDates.length === 0 ||
                    !!errors.duplicate
                  : !formData.leaveType ||
                    !formData.reason.trim() ||
                    !formData.manager ||
                    effectiveDates.length === 0 ||
                    !!errors.duplicate
              }
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {isAdminMode ? 'Create PTO Request' : 'Submit Request'}
            </button>
          </div>
          {isAdminMode && (
            <div className="bg-yellow-50" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15 }}>
                <strong>Admin Mode:</strong> This PTO request will be automatically approved and created on behalf of the selected user.
              </div>
            </div>
          )}
          {!isAdminMode && selectedDates.length === 0 && (
            <div className="bg-blue-50" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 15 }}>
                <strong>Tip:</strong> Please select dates on the calendar first, then click "Request PTO" to open this form.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PTOSubmissionModal;
