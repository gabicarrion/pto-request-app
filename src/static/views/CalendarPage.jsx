import React, { useState, useEffect } from 'react';
import { Plus, Filter, Users, User, X, Calendar as CalendarIcon } from 'lucide-react';
import { invoke } from '@forge/bridge';
import PTOSubmissionModal from '../components/PTOSubmissionModal';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';

const CalendarPage = ({ 
  events, 
  onDateSelect, 
  selectedDates, 
  onSubmitPTO, 
  currentUser,
  preselectedTeamId = null, // For admin deep-linking
  preselectedUserId = null  // For admin deep-linking
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [selectedTeam, setSelectedTeam] = useState(preselectedTeamId || '');
  const [selectedUser, setSelectedUser] = useState(preselectedUserId || '');
  const [selectedStatuses, setSelectedStatuses] = useState(['approved', 'pending']);
  
  // Data for filters
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFilterData();
  }, []);

  // Handle preselected filters from admin
  useEffect(() => {
    if (preselectedTeamId) {
      setSelectedTeam(preselectedTeamId);
      setShowFilters(true);
    }
    if (preselectedUserId) {
      setSelectedUser(preselectedUserId);
      setShowFilters(true);
    }
  }, [preselectedTeamId, preselectedUserId]);

  const loadFilterData = async () => {
    setLoading(true);
    try {
      // Load teams
      const teamsResponse = await invoke('getTeams');
      if (teamsResponse.success) {
        setTeams(teamsResponse.data || []);
      }

      // Load users
      const usersResponse = await invoke('getUsers');
      if (usersResponse.success) {
        setUsers(usersResponse.data || []);
      }
    } catch (error) {
      console.error('Error loading filter data:', error);
    } finally {
      setLoading(false);
    }
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

  // Enhanced filtering logic
  const getFilteredEventsForDate = (date) => {
    const dateStr = formatDate(date);
    let filteredEvents = events.filter(event => 
      dateStr >= event.start_date && dateStr <= event.end_date
    );

    // Filter by status
    if (selectedStatuses.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        selectedStatuses.includes(event.status)
      );
    }

    // Filter by team
    if (selectedTeam) {
      const teamUsers = users.filter(user => user.team_id === selectedTeam);
      const teamUserIds = teamUsers.map(user => user.jira_account_id || user.id);
      filteredEvents = filteredEvents.filter(event => 
        teamUserIds.includes(event.requester_id)
      );
    }

    // Filter by specific user
    if (selectedUser) {
      filteredEvents = filteredEvents.filter(event => 
        event.requester_id === selectedUser
      );
    }

    return filteredEvents;
  };

  const hasFilteredEvent = (date) => {
    return getFilteredEventsForDate(date).length > 0;
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const handlePTOSubmit = (ptoData) => {
    onSubmitPTO(ptoData);
    setShowSubmitModal(false);
  };

  const clearFilters = () => {
    setSelectedTeam('');
    setSelectedUser('');
    setSelectedStatuses(['approved', 'pending']);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedTeam) count++;
    if (selectedUser) count++;
    if (selectedStatuses.length < 3) count++; // Less than all statuses
    return count;
  };

  const getSelectedTeamName = () => {
    const team = teams.find(t => t.id === selectedTeam);
    return team ? team.name : '';
  };

  const getSelectedUserName = () => {
    const user = users.find(u => (u.jira_account_id || u.id) === selectedUser);
    return user ? (user.display_name || user.displayName || user.name) : '';
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="card calendar-card">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-header-controls">
          <button
            onClick={() => navigateMonth(-1)}
            className="calendar-nav-btn"
          >←</button>
          <h2 className="calendar-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            className="calendar-nav-btn"
          >→</button>
        </div>

        {/* Action Buttons */}
        <div className="calendar-actions">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} calendar-filter-btn`}
          >
            <Filter size={16} />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="filter-badge">{activeFiltersCount}</span>
            )}
          </button>

          {/* Submit PTO Button */}
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

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="calendar-active-filters">
          <div className="active-filters-content">
            <span className="active-filters-label">Active filters:</span>
            <div className="active-filters-list">
              {selectedTeam && (
                <span className="filter-tag">
                  <Users size={12} />
                  Team: {getSelectedTeamName()}
                  <button 
                    onClick={() => setSelectedTeam('')}
                    className="filter-tag-remove"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedUser && (
                <span className="filter-tag">
                  <User size={12} />
                  User: {getSelectedUserName()}
                  <button 
                    onClick={() => setSelectedUser('')}
                    className="filter-tag-remove"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedStatuses.length < 3 && (
                <span className="filter-tag">
                  <CalendarIcon size={12} />
                  Status: {selectedStatuses.join(', ')}
                  <button 
                    onClick={() => setSelectedStatuses(['approved', 'pending', 'declined'])}
                    className="filter-tag-remove"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="calendar-filters-panel">
          <div className="filters-content">
            <h4>Filter Calendar Events</h4>
            
            <div className="filters-grid">
              {/* Team Filter */}
              <div className="filter-group">
                <label className="filter-label">
                  <Users size={16} />
                  Filter by Team
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => {
                    setSelectedTeam(e.target.value);
                    // Clear user filter if team changes
                    if (e.target.value) setSelectedUser('');
                  }}
                  className="filter-select"
                  disabled={loading}
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.members?.length || 0} members)
                    </option>
                  ))}
                </select>
              </div>

              {/* User Filter */}
              <div className="filter-group">
                <label className="filter-label">
                  <User size={16} />
                  Filter by User
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    // Clear team filter if user is selected
                    if (e.target.value) setSelectedTeam('');
                  }}
                  className="filter-select"
                  disabled={loading}
                >
                  <option value="">All Users</option>
                  <option value={currentUser?.accountId}>
                    👤 {currentUser?.displayName} (Me)
                  </option>
                  <optgroup label="Team Members">
                    {users
                      .filter(user => 
                        (user.jira_account_id || user.id) !== currentUser?.accountId
                      )
                      .sort((a, b) => 
                        (a.display_name || a.displayName || a.name || '').localeCompare(
                          b.display_name || b.displayName || b.name || ''
                        )
                      )
                      .map(user => (
                        <option 
                          key={user.id} 
                          value={user.jira_account_id || user.id}
                        >
                          {user.display_name || user.displayName || user.name}
                          {user.team_id && teams.find(t => t.id === user.team_id) && 
                            ` (${teams.find(t => t.id === user.team_id)?.name})`
                          }
                        </option>
                      ))
                    }
                  </optgroup>
                </select>
              </div>

              {/* Status Filter */}
              <div className="filter-group">
                <label className="filter-label">
                  <CalendarIcon size={16} />
                  Request Status
                </label>
                <div className="status-checkboxes">
                  {['approved', 'pending', 'declined'].map(status => (
                    <label key={status} className="status-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStatuses(prev => [...prev, status]);
                          } else {
                            setSelectedStatuses(prev => prev.filter(s => s !== status));
                          }
                        }}
                      />
                      <span className={`status-label status-${status}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="filters-actions">
              <button onClick={clearFilters} className="btn btn-secondary">
                Clear Filters
              </button>
              <button 
                onClick={() => setShowFilters(false)} 
                className="btn btn-primary"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Instructions */}
      <div className="calendar-info">
        <p>
          💡 Click on dates to select them for your PTO request. 
          {activeFiltersCount > 0 && (
            <span> Currently showing filtered events ({activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active).</span>
          )}
        </p>
      </div>

      {/* Calendar Grid - Day Names */}
      <div className="calendar-days-row">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-day-label">{day}</div>
        ))}
      </div>

      {/* Calendar Grid - Dates */}
      <div className="calendar-days-row">
        {days.map((day, index) => {
          if (!day) return <div key={index} className="calendar-day calendar-day-empty"></div>;
          
          const isSelected = isDateSelected(day);
          const hasEventToday = hasFilteredEvent(day);
          const dayEvents = getFilteredEventsForDate(day);
          const isToday = day.toDateString() === new Date().toDateString();
          const isPastDate = day < new Date(new Date().setHours(0, 0, 0, 0));
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => !isPastDate && onDateSelect(day)}
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
                      title={`${event.requester_name}: ${event.reason} (${event.status})`}
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
        />
      )}
    </div>
  );
};

export default CalendarPage;