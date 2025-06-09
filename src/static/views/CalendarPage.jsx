import React, { useState, useEffect } from 'react';
import { Plus, Filter, X, Calendar, Users, User } from 'lucide-react';
import PTOSubmissionModal from '../components/PTOSubmissionModal';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';
import EditPTOModal from '../components/EditPTOModal';

const CalendarPage = ({ events, onDateSelect, selectedDates, onSubmitPTO, currentUser, allUsers, allTeams, isAdmin }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [filters, setFilters] = useState({
    team: 'all',
    user: 'all',
    leaveType: 'all',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');

  // Find current user in the users database
  const currentUserData = allUsers?.find(user => 
    user.jira_account_id === currentUser?.accountId ||
    user.email_address === currentUser?.emailAddress
  );

  // Get user's manager if they exist in the system
  const getUserManager = () => {
    if (!currentUserData?.team_id) return null;
    
    const userTeam = allTeams?.find(team => team.id === currentUserData.team_id);
    if (!userTeam?.manager) return null;
    
    return userTeam.manager;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const formatDate = (date) => date.toISOString().split('T')[0];

  const isDateSelected = (date) => selectedDates.includes(formatDate(date));

  // Apply filters to events - FIXED
  const getFilteredEvents = () => {
    if (!events) return [];

    return events.filter(event => {
      // Team filter
      if (filters.team !== 'all') {
        const eventUser = allUsers?.find(user => 
          user.jira_account_id === event.requester_id ||
          user.email_address === event.requester_email
        );
        if (!eventUser || eventUser.team_id !== filters.team) return false;
      }

      // User filter - FIXED
      if (filters.user === 'me') {
        // Check both accountId and email to match current user
        if (event.requester_id !== currentUser?.accountId && 
            event.requester_email !== currentUser?.emailAddress) return false;
      } else if (filters.user !== 'all') {
        // Check if the selected user matches the event
        const selectedUser = allUsers?.find(user => 
          user.jira_account_id === filters.user || user.id === filters.user
        );
        if (selectedUser) {
          if (event.requester_id !== selectedUser.jira_account_id && 
              event.requester_email !== selectedUser.email_address) return false;
        }
      }

      // Leave type filter
      if (filters.leaveType !== 'all' && event.leave_type !== filters.leaveType) return false;

      // Status filter
      if (filters.status !== 'all' && event.status !== filters.status) return false;

      return true;
    });
  };

  const hasEvent = (date) => {
    const dateStr = formatDate(date);
    return getFilteredEvents().some(event => 
      dateStr >= event.start_date && dateStr <= event.end_date
    );
  };

  const getEventsForDate = (date) => {
    const dateStr = formatDate(date);
    return getFilteredEvents().filter(event => 
      dateStr >= event.start_date && dateStr <= event.end_date
    );
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // FIXED: Clear all filters function
  const clearAllFilters = () => {
    setFilters({
      team: 'all',
      user: 'all',
      leaveType: 'all',
      status: 'all'
    });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== 'all');
  };

  const handlePTOSubmit = async (ptoData) => {
    const result = await onSubmitPTO(ptoData);
    if (result?.success) {
      setShowSubmitModal(false);
    }
  };

  // Get teams for filter dropdown
  const getTeamsForFilter = () => {
    if (!allTeams) return [];
    
    if (isAdmin) {
      return allTeams; // Admins can see all teams
    }
    
    // For non-admins, show teams they manage
    return allTeams.filter(team => 
      team.manager?.accountId === currentUser?.accountId ||
      team.manager?.jira_account_id === currentUser?.accountId
    );
  };

  // Helper: can the request be edited?
  const canEditRequest = (request) => {
    if (!request) return false;
    if (request.requester_id !== currentUser.accountId) return false;
    if (request.status === 'pending') return true;
    if (request.status === 'approved') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(request.start_date);
      return startDate >= today;
    }
    return false;
  };

  // Updated day click handler
  const handleDayClick = (day) => {
    const dateStr = formatDate(day);
    // Find a request for the current user on this day
    const userRequests = events.filter(event =>
      (event.requester_id === currentUser.accountId || event.requester_email === currentUser.emailAddress) &&
      dateStr >= event.start_date && dateStr <= event.end_date
    );
    const editableRequest = userRequests.find(canEditRequest);
    if (editableRequest) {
      setEditingRequest(editableRequest);
      return;
    }
    if (userRequests.length > 0) {
      setInfoMessage('You already have a PTO request this day and it is not editable.');
      return;
    }
    // Otherwise, proceed with normal selection
    if (!day || day < new Date(new Date().setHours(0, 0, 0, 0))) return;
    onDateSelect(day);
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const leaveTypes = [
    'vacation', 
    'sick', 
    'personal', 
    'holiday',
    'other leave type'
  ];
  const statusTypes = ['pending', 'approved', 'declined'];

  return (
    <div className="card calendar-card">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-header-controls">
          <button onClick={() => navigateMonth(-1)} className="calendar-nav-btn">←</button>
          <h2 className="calendar-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={() => navigateMonth(1)} className="calendar-nav-btn">→</button>
        </div>
        
        <div className="calendar-header-actions">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-secondary calendar-filter-btn ${hasActiveFilters() ? 'has-filters' : ''}`}
          >
            <Filter size={16} />
            <span>Filters</span>
            {hasActiveFilters() && <span className="filter-indicator">●</span>}
          </button>
          
          {selectedDates.length > 0 && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="btn btn-primary calendar-submit-btn"
            >
              <Plus size={16} />
              <span>Request PTO ({selectedDates.length} days)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="calendar-filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Team</label>
              <select
                value={filters.team}
                onChange={(e) => handleFilterChange('team', e.target.value)}
                className="form-control"
              >
                <option value="all">All Teams</option>
                {getTeamsForFilter().map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>User</label>
              <select
                value={filters.user}
                onChange={(e) => handleFilterChange('user', e.target.value)}
                className="form-control"
              >
                <option value="all">All Users</option>
                <option value="me">Me</option>
                {allUsers?.map(user => (
                  <option key={user.id} value={user.jira_account_id || user.id}>
                    {user.display_name || user.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Leave Type</label>
              <select
                value={filters.leaveType}
                onChange={(e) => handleFilterChange('leaveType', e.target.value)}
                className="form-control"
              >
                <option value="all">All Types</option>
                {leaveTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="form-control"
              >
                <option value="all">All Status</option>
                {statusTypes.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filters-actions">
            <button onClick={clearAllFilters} className="btn btn-secondary">
              Clear All
            </button>
            <button onClick={() => setShowFilters(false)} className="btn btn-primary">
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Calendar Instructions */}
      <div className="calendar-info">
        <p>
          💡 Click on dates to select them for your PTO request. Selected dates will be highlighted in blue.
          {hasActiveFilters() && <span> • Filters are active - some events may be hidden.</span>}
        </p>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day Names */}
        <div className="calendar-days-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-label">{day}</div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="calendar-days-grid">
          {days.map((day, index) => {
            if (!day) return <div key={index} className="calendar-day calendar-day-empty"></div>;
            const isSelected = isDateSelected(day);
            const hasEventToday = hasEvent(day);
            const dayEvents = getEventsForDate(day);
            const isToday = day.toDateString() === new Date().toDateString();
            const isPastDate = day < new Date(new Date().setHours(0, 0, 0, 0));
            
            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={
                  "calendar-day" +
                  (isPastDate ? " calendar-day-past" : " calendar-day-active") +
                  (isSelected ? " calendar-day-selected" : "") +
                  (isToday ? " calendar-day-today" : "")
                }
              >
                <div className="calendar-day-inner">
                  <span className={
                    "calendar-day-number" +
                    (isToday ? " calendar-day-number-today" : "") +
                    (isPastDate ? " calendar-day-number-past" : "")
                  }>
                    {day.getDate()}
                  </span>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, 2).map((event, idx) => (
                      <div
                        key={`${event.id}-${idx}`}
                        className={
                          "calendar-event" +
                          (event.status === 'approved' ? " calendar-event-approved" : "") +
                          (event.status === 'pending' ? " calendar-event-pending" : "") +
                          (event.status === 'declined' ? " calendar-event-declined" : "")
                        }
                        title={`${event.requester_name}: ${event.reason}`}
                      >
                        <span>{getLeaveTypeEmoji(event.leave_type)}</span>
                        <span className="calendar-event-name">{event.requester_name}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="calendar-event-more">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-event-approved"></span>
          <span>Approved</span>
        </div>
        <div className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-event-pending"></span>
          <span>Pending</span>
        </div>
        <div className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-event-declined"></span>
          <span>Declined</span>
        </div>
        <div className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-day-selected"></span>
          <span>Selected</span>
        </div>
      </div>

      {/* Submit PTO Modal */}
      {showSubmitModal && (
        <PTOSubmissionModal
          selectedDates={selectedDates}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={handlePTOSubmit}
          currentUser={currentUser}
          currentUserData={currentUserData}
          userManager={getUserManager()}
          allUsers={allUsers}
          allTeams={allTeams}
          allRequests={events}
          isAdmin={isAdmin}
        />
      )}

      {/* EditPTOModal */}
      {editingRequest && (
        <EditPTOModal
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSave={() => { setEditingRequest(null); }}
          currentUser={currentUser}
        />
      )}

      {/* Info Message Modal/Alert */}
      {infoMessage && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, margin: 'auto', padding: 24, textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <span role="img" aria-label="info" style={{ fontSize: 32 }}>ℹ️</span>
            </div>
            <div style={{ marginBottom: 16 }}>{infoMessage}</div>
            <button className="btn btn-primary" onClick={() => setInfoMessage('')}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;