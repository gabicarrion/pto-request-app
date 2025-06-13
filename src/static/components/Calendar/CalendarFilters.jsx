import React from 'react';
import './CalendarFilters.css';
import { Filter, Users, Calendar, CheckCircle } from 'lucide-react';

/**
 * CalendarFilters component provides filtering options for the PTO calendar view
 * Allows filtering by user, team, and leave type
 * 
 * @param {Object} props
 * @param {Array} props.users - Array of all users
 * @param {Array} props.teams - Array of all teams
 * @param {Array} props.leaveTypes - Array of available leave types
 * @param {Object} props.filters - Current filter values
 * @param {Function} props.onFilterChange - Handler for filter changes
 */
function CalendarFilters({ 
  users = [], 
  teams = [], 
  leaveTypes = [
    { value: 'vacation', label: 'Vacation' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'personal', label: 'Personal Leave' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'other', label: 'Other' }
  ], 
  filters = {}, 
  onFilterChange 
}) {
  
  // Handler for filter change events
  const handleFilterChange = (filterType, value) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        [filterType]: value
      });
    }
  };

  return (
    <div className="calendar-filters">
      <div className="calendar-filters-header">
        <Filter size={16} />
        <h3>Filters</h3>
      </div>
      
      {/* User filter */}
      <div className="filter-section">
        <div className="filter-section-header">
          <Users size={14} />
          <h4>User</h4>
        </div>
        <select 
          value={filters.userId || ''}
          onChange={(e) => handleFilterChange('userId', e.target.value)}
          className="filter-select"
        >
          <option value="">All Users</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.display_name || user.displayName || `${user.first_name} ${user.last_name}`}
            </option>
          ))}
        </select>
      </div>
      
      {/* Team filter */}
      <div className="filter-section">
        <div className="filter-section-header">
          <Users size={14} />
          <h4>Team</h4>
        </div>
        <select 
          value={filters.teamId || ''}
          onChange={(e) => handleFilterChange('teamId', e.target.value)}
          className="filter-select"
        >
          <option value="">All Teams</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Leave Type filter */}
      <div className="filter-section">
        <div className="filter-section-header">
          <Calendar size={14} />
          <h4>Leave Type</h4>
        </div>
        <select 
          value={filters.leaveType || ''}
          onChange={(e) => handleFilterChange('leaveType', e.target.value)}
          className="filter-select"
        >
          <option value="">All Leave Types</option>
          {leaveTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* Status filter - additional filter for request status */}
      <div className="filter-section">
        <div className="filter-section-header">
          <CheckCircle size={14} />
          <h4>Status</h4>
        </div>
        <select 
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      
      {/* Clear filters button */}
      <button 
        className="clear-filters-btn"
        onClick={() => onFilterChange({})}
      >
        Clear Filters
      </button>
    </div>
  );
}

export default CalendarFilters;