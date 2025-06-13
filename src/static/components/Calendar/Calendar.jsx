import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Plus, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import RequestModal from '../Modal/RequestModal';
import './Calendar.css';

// Setup localizer for react-big-calendar
const localizer = momentLocalizer(moment);

/**
 * Calendar component for viewing and managing PTO requests
 * 
 * @param {Object} props
 * @param {Object} props.currentUser - Current user information
 */
function Calendar({ currentUser }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());
  
  // Load calendar data on component mount
  useEffect(() => {
    if (currentUser) {
      loadCalendarData();
      loadTeamsAndUsers();
    }
  }, [currentUser]);
  
  // Load PTO requests and convert to calendar events
  const loadCalendarData = async () => {
    setLoading(true);
    
    try {
      // Load approved PTO requests
      const response = await invoke('getPtoRequests', { status: 'approved' });
      
      if (response.success) {
        // Convert PTO requests to calendar events
        const calendarEvents = (response.data || []).map(request => {
          const startDate = new Date(request.start_date);
          const endDate = new Date(request.end_date);
          
          // Add one day to end date for proper display in calendar
          endDate.setDate(endDate.getDate() + 1);
          
          // Determine event color based on leave type
          let backgroundColor;
          switch (request.leave_type) {
            case 'vacation':
              backgroundColor = '#3182ce'; // Blue
              break;
            case 'sick':
              backgroundColor = '#e53e3e'; // Red
              break;
            case 'personal':
              backgroundColor = '#805ad5'; // Purple
              break;
            case 'holiday':
              backgroundColor = '#38a169'; // Green
              break;
            default:
              backgroundColor = '#718096'; // Gray
          }
          
          return {
            id: request.id,
            title: `${request.requester_name} - ${request.leave_type}`,
            start: startDate,
            end: endDate,
            allDay: true,
            backgroundColor,
            borderColor: backgroundColor,
            textColor: '#ffffff',
            request: request // Store the original request data for reference
          };
        });
        
        setEvents(calendarEvents);
      }
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Load teams and users for the request modal
  const loadTeamsAndUsers = async () => {
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
      console.error('Failed to load teams and users:', error);
    }
  };
  
  // Handle event click to view/edit
  const handleEventClick = (event) => {
    setSelectedEvent(event.request);
    setShowModal(true);
  };
  
  // Handle modal close
  const handleCloseModal = () => {
    setSelectedEvent(null);
    setShowModal(false);
  };
  
  // Handle creating or updating a request
  const handleSubmitRequest = async (requestData) => {
    try {
      if (requestData.id) {
        // Update existing request
        await invoke('updatePtoRequest', requestData);
      } else {
        // Create new request
        await invoke('createPtoRequest', requestData);
      }
      
      // Refresh calendar data
      await loadCalendarData();
      
      return true;
    } catch (error) {
      console.error('Failed to submit request:', error);
      return false;
    }
  };
  
  // Custom event component for the calendar
  const EventComponent = ({ event }) => {
    return (
      <div 
        className="calendar-event" 
        style={{ 
          backgroundColor: event.backgroundColor,
          borderColor: event.borderColor,
          color: event.textColor
        }}
      >
        {event.title}
      </div>
    );
  };
  
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-title">
          <CalendarIcon size={20} />
          <h2>PTO Calendar</h2>
        </div>
        
        <div className="calendar-actions">
          <button 
            className="refresh-button" 
            onClick={loadCalendarData} 
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          
          <button 
            className="create-request-button" 
            onClick={() => {
              setSelectedEvent(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            New Request
          </button>
        </div>
      </div>
      
      <div className="calendar-view-container">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 200px)' }}
          onSelectEvent={handleEventClick}
          views={['month', 'week', 'day']}
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          components={{
            event: EventComponent
          }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.backgroundColor,
              borderColor: event.borderColor,
              color: event.textColor
            }
          })}
        />
      </div>
      
      {/* Request Modal */}
      {showModal && (
        <RequestModal
          isOpen={showModal}
          onClose={handleCloseModal}
          currentUser={currentUser}
          teams={teams || []} // Ensure we pass an empty array if teams is undefined
          users={users || []} // Ensure we pass an empty array if users is undefined
          onSubmit={handleSubmitRequest}
          editRequest={selectedEvent}
        />
      )}
    </div>
  );
}

export default Calendar;