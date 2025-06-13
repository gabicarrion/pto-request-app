// src/static/components/Calendar/CalendarEvent.jsx
import React from 'react';
import './Calendar.css';

const CalendarEvent = ({ event }) => {
  // Get class name based on leave type
  const getEventClassName = () => {
    let className = `calendar-event calendar-event-${event.leave_type.toLowerCase()}`;
    
    // Add class for half-day events
    if (event.schedule_type !== 'FULL_DAY') {
      className += ' calendar-event-half-day';
    }
    
    return className;
  };
  
  // Get schedule type display
  const getScheduleTypeDisplay = () => {
    switch (event.schedule_type) {
      case 'HALF_DAY_MORNING':
        return 'Morning';
      case 'HALF_DAY_AFTERNOON':
        return 'Afternoon';
      default:
        return '';
    }
  };
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!event.requester_name) return '';
    
    const nameParts = event.requester_name.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    
    return nameParts[0][0].toUpperCase();
  };
  
  return (
    <div className={getEventClassName()} title={`${event.requester_name}: ${event.leave_type}`}>
      <div className="calendar-event-user">
        <div className="calendar-event-user-avatar">
          {getUserInitials()}
        </div>
        <span className="calendar-event-user-name">
          {event.requester_name.split(' ')[0]}
        </span>
      </div>
      
      {event.schedule_type !== 'FULL_DAY' && (
        <span className="calendar-event-schedule">
          {getScheduleTypeDisplay()}
        </span>
      )}
    </div>
  );
};

export default CalendarEvent;