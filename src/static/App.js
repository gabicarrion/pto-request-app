import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CheckCircle, User, Shield } from 'lucide-react';
import { invoke } from '@forge/bridge';

// Components
import Notification from './components/Notifications';
import AdminManagement from './views/AdminManagement';
import TeamPage from './views/TeamPage';

// Pages & Hooks
import CalendarPage from './views/CalendarPage';
import RequestsPage from './views/RequestsPage';
import ApprovalsPage from './views/ApprovalsPage';

import useCurrentUser from './hooks/useCurrentUser';
import usePTORequests from './hooks/usePTORequests';
import './styles/styles.css';

const PTOManagementApp = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDates, setSelectedDates] = useState([]);
  const [notification, setNotification] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [userTeams, setUserTeams] = useState([]);
  
  // Calendar filter state for admin deep-linking
  const [calendarFilters, setCalendarFilters] = useState({
    teamId: null,
    userId: null
  });

  // Custom hooks
  const { currentUser, loading: userLoading, error: userError, isAdmin } = useCurrentUser();
  const { 
    requests: ptoRequests, 
    loading: requestsLoading, 
    error: requestsError,
    submitRequest,
    updateRequestStatus,
    cancelRequest,
    fetchRequests,
    getUserRequests,
    getPendingRequests
  } = usePTORequests(currentUser);

  // Load user teams
  useEffect(() => {
    const loadUserTeams = async () => {
      if (!currentUser) return;
      
      try {
        const response = await invoke('getUserTeams', { userId: currentUser.accountId });
        if (response.success) {
          setUserTeams(response.data || []);
        }
      } catch (error) {
        console.error('Error loading user teams:', error);
      }
    };

    loadUserTeams();
  }, [currentUser]);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      setAppLoading(true);
      try {
        console.log('🔧 Initializing PTO App...');
        
        const dbResult = await invoke('initializePTODatabaseWithTeamManagement');
        if (!dbResult.success) {
          console.warn('Enhanced setup failed, trying regular init:', dbResult.message);
          const fallbackResult = await invoke('initializePTODatabase');
          if (!fallbackResult.success) {
            throw new Error(fallbackResult.message);
          }
        }
        
        console.log('✅ PTO App initialization complete');
        
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        showNotification('Failed to initialize app: ' + error.message, 'error');
      } finally {
        setAppLoading(false);
      }
    };

    initializeApp();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDateSelect = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDates(prev => 
      prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr].sort()
    );
  };

  const handlePTOSubmit = async (ptoData) => {
    try {
      // Validate manager selection
      if (!ptoData.manager) {
        showNotification('Please select a manager to approve your request', 'error');
        return;
      }

      // Prepare request data with proper manager selection
      const requestData = {
        reporter: currentUser,
        manager: ptoData.manager, // This comes from UserPicker component
        startDate: selectedDates[0],
        endDate: selectedDates[selectedDates.length - 1],
        leaveType: ptoData.leaveType,
        reason: ptoData.reason,
        dailySchedules: ptoData.dailySchedules
      };
      
      console.log('📝 Submitting PTO request with manager:', ptoData.manager.displayName);
      
      const result = await submitRequest(requestData);
      
      if (result.success) {
        setSelectedDates([]);
        showNotification(`PTO request submitted successfully! ${ptoData.manager.displayName} will receive the approval request.`);
      } else {
        showNotification(result.message || 'Failed to submit PTO request', 'error');
      }
      
    } catch (error) {
      console.error('Error submitting PTO request:', error);
      showNotification('Failed to submit PTO request', 'error');
    }
  };

  const handleApproval = async (requestId, status, comment) => {
    try {
      console.log(`🔄 Processing ${status} for request ${requestId}`);
      
      const result = await updateRequestStatus(requestId, status, comment);
      
      if (result.success) {
        showNotification(`Request ${status} successfully!`);
        // Refresh requests to update the UI
        await fetchRequests();
      } else {
        showNotification(result.message || `Failed to ${status} request`, 'error');
      }
      
    } catch (error) {
      console.error('Error updating PTO request:', error);
      showNotification(`Failed to ${status} request`, 'error');
    }
  };

  const handleEditRequest = (request) => {
    showNotification('Edit functionality will be implemented soon!');
  };

  const handleCancelRequest = async (request) => {
    if (!window.confirm('Are you sure you want to cancel this PTO request?')) {
      return;
    }

    try {
      const result = await cancelRequest(request.id);
      
      if (result.success) {
        showNotification('PTO request cancelled successfully!');
      } else {
        showNotification(result.message || 'Failed to cancel PTO request', 'error');
      }
      
    } catch (error) {
      console.error('Error cancelling PTO request:', error);
      showNotification('Failed to cancel PTO request', 'error');
    }
  };

  // Handle navigation from admin with filters
  const handleNavigateToCalendar = (tab, filters = {}) => {
    console.log('📅 Navigating to calendar with filters:', filters);
    
    setCalendarFilters({
      teamId: filters.teamId || null,
      userId: filters.userId || null
    });
    
    setActiveTab(tab);
    
    if (filters.teamId || filters.userId) {
      const filterText = filters.teamId ? 'team filter' : 'user filter';
      showNotification(`Calendar opened with ${filterText} applied`, 'success');
    }
  };

  // Clear calendar filters when tab changes
  const handleTabChange = (newTab) => {
    if (newTab !== 'calendar') {
      setCalendarFilters({ teamId: null, userId: null });
    }
    setActiveTab(newTab);
  };

  // Navigation tabs configuration
  const tabs = [
    { 
      id: 'calendar', 
      label: 'Calendar', 
      icon: Calendar,
      description: 'View and create PTO requests'
    },
    { 
      id: 'requests', 
      label: 'My Requests', 
      icon: Clock,
      description: 'View your PTO request history'
    },
    { 
      id: 'approvals', 
      label: 'Approvals', 
      icon: CheckCircle,
      description: 'Approve team PTO requests'
    },
    { 
      id: 'team', 
      label: 'Team', 
      icon: Users,
      description: 'Team dashboard and analytics'
    },
    ...(isAdmin ? [{ 
      id: 'admin', 
      label: 'Admin', 
      icon: Shield,
      description: 'Administrative functions'
    }] : [])
  ];

  // Get filtered data based on user
  const userRequests = getUserRequests(currentUser?.accountId);
  
  // Get pending requests for current user as manager (requests where they are the manager)
  const pendingRequestsForApproval = ptoRequests.filter(req => 
    req.status === 'pending' && 
    req.manager_email === currentUser?.emailAddress &&
    req.requester_id !== currentUser?.accountId
  );

  // Show loading state during initialization
  if (appLoading || userLoading) {
    return (
      <div className="pto-app-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2 className="loading-title">Initializing PTO Management</h2>
          <p className="loading-text">Setting up database and admin users...</p>
        </div>
      </div>
    );
  }

  // Show error state if user loading failed
  if (userError) {
    return (
      <div className="pto-app-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Authentication Error</h2>
          <p className="error-text">Failed to load user information: {userError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary error-retry-btn"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Don't render if no current user
  if (!currentUser) {
    return (
      <div className="pto-app-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading user information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pto-app">
      {/* Header */}
      <header className="pto-app-header">
        <div className="header-container">
          <div className="header-content">
            <div className="header-brand">
              <div className="brand-icon">
                <Calendar size={20} />
              </div>
              <div className="brand-text">
                <h1 className="brand-title">PTO Management</h1>
              </div>
            </div>
            
            <div className="header-user-section">
              {/* Quick Stats */}
              <div className="header-stats">
                <div className="stat-item">
                  <div className="stat-dot stat-pending"></div>
                  <span className="stat-text">{pendingRequestsForApproval.length} pending</span>
                </div>
                <div className="stat-item">
                  <div className="stat-dot stat-approved"></div>
                  <span className="stat-text">{userRequests.filter(r => r.status === 'approved').length} approved</span>
                </div>
                {userTeams.length > 0 && (
                  <div className="stat-item">
                    <div className="stat-dot stat-team"></div>
                    <span className="stat-text">{userTeams.length} teams</span>
                  </div>
                )}
              </div>
              
              {/* User Profile */}
              <div className="header-user-profile">
                <div className="user-avatar">
                  {currentUser.displayName?.charAt(0) || <User size={16} />}
                  {isAdmin && (
                    <div className="admin-badge">
                      <Shield size={8} />
                    </div>
                  )}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    <span>{currentUser.displayName}</span>
                    {isAdmin && <Shield size={12} className="admin-icon" />}
                  </div>
                  <div className="user-email">{currentUser.emailAddress}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="pto-app-nav">
        <div className="nav-container">
          <div className="nav-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`nav-tab ${isActive ? 'nav-tab-active' : ''} ${tab.id === 'admin' ? 'nav-tab-admin' : ''}`}
                  title={tab.description}
                >
                  <Icon size={16} />
                  <span className="nav-tab-label">{tab.label}</span>
                  {tab.id === 'approvals' && pendingRequestsForApproval.length > 0 && (
                    <span className="nav-tab-badge">{pendingRequestsForApproval.length}</span>
                  )}
                  {tab.id === 'admin' && (
                    <span className="nav-tab-admin-badge">Admin</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pto-app-main">
        <div className="main-container">
          {activeTab === 'calendar' && (
            <CalendarPage
              events={ptoRequests}
              onDateSelect={handleDateSelect}
              selectedDates={selectedDates}
              onSubmitPTO={handlePTOSubmit}
              currentUser={currentUser}
              preselectedTeamId={calendarFilters.teamId}
              preselectedUserId={calendarFilters.userId}
            />
          )}
          
          {activeTab === 'requests' && (
            <RequestsPage
              requests={userRequests}
              currentUser={currentUser}
              onEditRequest={handleEditRequest}
              onCancelRequest={handleCancelRequest}
            />
          )}
          
          {activeTab === 'approvals' && (
            <ApprovalsPage
              pendingRequests={pendingRequestsForApproval}
              onApproval={handleApproval}
            />
          )}
          
          {activeTab === 'team' && (
            <TeamPage
              teamData={{ teams: userTeams }}
              requests={ptoRequests}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminManagement
              currentUser={currentUser}
              showNotification={showNotification}
              onNavigateToCalendar={handleNavigateToCalendar}
            />
          )}
        </div>
      </main>

      {/* Loading Overlay */}
      {(requestsLoading || appLoading) && (
        <div className="pto-loading-overlay">
          <div className="loading-modal">
            <div className="loading-spinner"></div>
            <span className="loading-modal-text">Processing...</span>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default PTOManagementApp;