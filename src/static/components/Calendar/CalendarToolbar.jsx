// src/static/components/Calendar/CalendarToolbar.jsx
import React, { useState } from 'react';
import './Calendar.css';

const CalendarToolbar = ({ 
  date, 
  onPrevMonth, 
  onNextMonth, 
  onToday, 
  selectedDates,
  onRequestPTO
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    leaveTypes: {
      vacation: true,
      sick: true,
      personal: true,
      holiday: true,
      other: true
    },
    teams: []
  });
  
  // Format date to display month and year
  const formatMonthYear = (date) => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  };
  
  // Toggle filter visibility
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  
  // Update leave type filters
  const handleLeaveTypeFilterChange = (type) => {
    setFilters({
      ...filters,
      leaveTypes: {
        ...filters.leaveTypes,
        [type]: !filters.leaveTypes[type]
      }
    });
  };
  
  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar-left">
        <button 
          className="btn-secondary" 
          onClick={onToday}
          title="Go to today"
        >
          Today
        </button>
        
        <button 
          className="btn-secondary" 
          onClick={onPrevMonth}
          title="Previous month"
        >
          &lt;
        </button>
        
        <button 
          className="btn-secondary" 
          onClick={onNextMonth}
          title="Next month"
        >
          &gt;
        </button>
        
        <div className="calendar-toolbar-center">
          {formatMonthYear(date)}
        </div>
      </div>
      
      <div className="calendar-toolbar-right">
        <button 
          className="btn-secondary" 
          onClick={toggleFilters}
          title="Show/hide filters"
        >
          Filters
        </button>
        
        <button 
          className="btn-primary" 
          onClick={onRequestPTO}
          disabled={selectedDates.length === 0}
          title={selectedDates.length === 0 ? "Select dates first" : "Request PTO for selected dates"}
        >
          Request Time Off {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}
        </button>
      </div>
      
      {/* Filter panel */}
      {showFilters && (
        <div className="calendar-filter-panel">
          <div className="calendar-filter-section">
            <h4>Leave Types</h4>
            <div className="calendar-filter-options">
              <label>
                <input 
                  type="checkbox" 
                  checked={filters.leaveTypes.vacation} 
                  onChange={() => handleLeaveTypeFilterChange('vacation')} 
                />
                Vacation
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={filters.leaveTypes.sick} 
                  onChange={() => handleLeaveTypeFilterChange('sick')} 
                />
                Sick
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={filters.leaveTypes.personal} 
                  onChange={() => handleLeaveTypeFilterChange('personal')} 
                />
                Personal
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={filters.leaveTypes.holiday} 
                  onChange={() => handleLeaveTypeFilterChange('holiday')} 
                />
                Holiday
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  checked={filters.leaveTypes.other} 
                  onChange={() => handleLeaveTypeFilterChange('other')} 
                />
                Other
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarToolbar;