import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import PTOSubmissionModal from '../components/PTOSubmissionModal';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';

const CalendarPage = ({ events, onDateSelect, selectedDates, onSubmitPTO }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSubmitModal, setShowSubmitModal] = useState(false);

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
  const hasEvent = (date) => {
    const dateStr = formatDate(date);
    return events.some(event => dateStr >= event.start_date && dateStr <= event.end_date);
  };
  const getEventsForDate = (date) => {
    const dateStr = formatDate(date);
    return events.filter(event => dateStr >= event.start_date && dateStr <= event.end_date);
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

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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

      {/* Calendar Instructions */}
      <div className="calendar-info">
        <p>
          💡 Click on dates to select them for your PTO request. Selected dates will be highlighted in blue.
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
          const hasEventToday = hasEvent(day);
          const dayEvents = getEventsForDate(day);
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
