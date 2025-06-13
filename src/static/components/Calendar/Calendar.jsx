// src/static/components/Calendar/Calendar.jsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './Calendar.css';
import CalendarToolbar from './CalendarToolbar';
import CalendarEvent from './CalendarEvent';
import RequestModal from '../Modal/RequestModal';

const Calendar = ({ currentUser }) => {
  // State for calendar
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Load current user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const adminStatus = await invoke('isCurrentUserAdmin');
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Load events when month changes
  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      
      try {
        // Get first and last day of the month for the current view
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Adjust to include days from previous/next month shown in the view
        const firstDayOfView = new Date(firstDay);
        firstDayOfView.setDate(firstDayOfView.getDate() - firstDayOfView.getDay());
        
        const lastDayOfView = new Date(lastDay);
        const daysToAdd = 6 - lastDayOfView.getDay();
        lastDayOfView.setDate(lastDayOfView.getDate() + daysToAdd);
        
        // Fetch PTO schedules from our service
        const schedules = await invoke('getDailySchedules', { 
          startDate: firstDayOfView.toISOString(),
          endDate: lastDayOfView.toISOString()
        });
        
        setEvents(schedules);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  }, [date]);
  
  // Generate calendar days for the month
  const generateCalendarDays = () => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();
    
    // Get last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get days from previous month to fill in first week
    const prevMonthDays = [];
    if (startingDayOfWeek > 0) {
      const daysFromPrevMonth = startingDayOfWeek;
      const prevMonth = new Date(year, month, 0);
      const prevMonthLastDay = prevMonth.getDate();
      
      for (let i = prevMonthLastDay - daysFromPrevMonth + 1; i <= prevMonthLastDay; i++) {
        prevMonthDays.push({
          date: new Date(year, month - 1, i),
          dayOfMonth: i,
          isCurrentMonth: false
        });
      }
    }
    
    // Current month days
    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      currentMonthDays.push({
        date: new Date(year, month, i),
        dayOfMonth: i,
        isCurrentMonth: true,
        isToday: isToday(new Date(year, month, i))
      });
    }
    
    // Next month days to fill remaining cells
    const nextMonthDays = [];
    const totalDaysDisplayed = 42; // 6 rows of 7 days
    const remainingDays = totalDaysDisplayed - prevMonthDays.length - currentMonthDays.length;
    
    for (let i = 1; i <= remainingDays; i++) {
      nextMonthDays.push({
        date: new Date(year, month + 1, i),
        dayOfMonth: i,
        isCurrentMonth: false
      });
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  };
  
  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  // Format date as string
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  // Find events for a specific day
  const getEventsForDay = (day) => {
    const dayStr = formatDate(day);
    return events.filter(event => formatDate(new Date(event.date)) === dayStr);
  };
  
  // Handle date click to select/deselect for PTO request
  const handleDateClick = (day) => {
    // Don't allow selecting days in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (day.date < today) {
      return;
    }
    
    const dateStr = formatDate(day.date);
    
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
  };
  
  // Open request modal
  const handleRequestPTO = () => {
    if (selectedDates.length === 0) {
      // Show error or alert that no dates are selected
      return;
    }
    
    setIsModalOpen(true);
  };
  
  // Close modal and reset selected dates
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // After successful submission, close modal and refresh data
  const handleRequestSubmitted = () => {
    setIsModalOpen(false);
    setSelectedDates([]);
    
    // Refresh events data
    const fetchEvents = async () => {
      setIsLoading(true);
      
      try {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const firstDayOfView = new Date(firstDay);
        firstDayOfView.setDate(firstDayOfView.getDate() - firstDayOfView.getDay());
        
        const lastDayOfView = new Date(lastDay);
        const daysToAdd = 6 - lastDayOfView.getDay();
        lastDayOfView.setDate(lastDayOfView.getDate() + daysToAdd);
        
        const schedules = await invoke('getDailySchedules', { 
          startDate: firstDayOfView.toISOString(),
          endDate: lastDayOfView.toISOString()
        });
        
        setEvents(schedules);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  };
  
  // Generate the calendar UI
  const calendarDays = generateCalendarDays();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return (
    <div className="calendar-container">
      <CalendarToolbar 
        date={date}
        onPrevMonth={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))}
        onNextMonth={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))}
        onToday={() => setDate(new Date())}
        selectedDates={selectedDates}
        onRequestPTO={handleRequestPTO}
      />
      
      <div className="calendar-grid">
        {/* Day headers */}
        {dayNames.map(day => (
          <div key={day} className="calendar-header">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day.date);
          const isSelected = selectedDates.includes(formatDate(day.date));
          
          // Determine class names for the day cell
          let className = "calendar-day";
          if (!day.isCurrentMonth) className += " calendar-day-outside";
          if (day.isToday) className += " calendar-day-today";
          if (isSelected) className += " calendar-day-selected";
          
          return (
            <div 
              key={index} 
              className={className}
              onClick={() => handleDateClick(day)}
            >
              <div className="calendar-day-header">
                <span className="calendar-day-number">{day.dayOfMonth}</span>
                {isSelected && <span className="calendar-day-selected-indicator">✓</span>}
              </div>
              
              <div className="calendar-day-content">
                {isLoading ? (
                  <div className="calendar-day-loading">Loading...</div>
                ) : (
                  dayEvents.map(event => (
                    <CalendarEvent 
                      key={event.daily_schedule_id} 
                      event={event} 
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {isModalOpen && (
        <RequestModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          selectedDates={selectedDates}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onRequestSubmitted={handleRequestSubmitted}
        />
      )}
    </div>
  );
};

export default Calendar;