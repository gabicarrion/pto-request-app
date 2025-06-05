import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Users, CheckCircle, User, Shield } from 'lucide-react';
import { invoke } from '@forge/bridge';

// Components
import Notification from './components/Notifications';
import AdminManagement from './views/AdminManagement';
import TeamPage from './views/TeamPage';
import TEamManagementModal from './components/TeamManagementModal';

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

  // Initialize app with admin setup
  useEffect(() => {
    const initializeApp = async () => {
      setAppLoading(true);
      try {
        console.log('🔧 Initializing PTO App with Admin Setup...');
        
        // Initialize database and set up default admin
        const dbResult = await invoke('initializePTODatabaseWithTeamManagement');
        if (!dbResult.success) {
          console.warn('Admin setup failed, trying regular init:', dbResult.message);
          // Fallback to regular initialization
          const fallbackResult = await invoke('initializePTODatabase');
          if (!fallbackResult.success) {
            throw new Error(fallbackResult.message);
          }
        } else {
          console.log('✅ PTO App and Admin initialized:', dbResult.data);
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
      // Prepare request data in the format expected by your backend
      const requestData = {
        reporter: currentUser,
        manager: ptoData.manager || {
          accountId: "manager-default", // You might want to implement manager selection
          displayName: "Manager",
          emailAddress: "manager@company.com"
        },
        startDate: selectedDates[0],
        endDate: selectedDates[selectedDates.length - 1],
        leaveType: ptoData.leaveType,
        reason: ptoData.reason,
        dailySchedules: ptoData.dailySchedules
      };
      
      const result = await submitRequest(requestData);
      
      if (result.success) {
        setSelectedDates([]);
        showNotification('PTO request submitted successfully!');
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
      const result = await updateRequestStatus(requestId, status, comment);
      
      if (result.success) {
        showNotification(`Request ${status} successfully!`);
      } else {
        showNotification(result.message || `Failed to ${status} request`, 'error');
      }
      
    } catch (error) {
      console.error('Error updating PTO request:', error);
      showNotification(`Failed to ${status} request`, 'error');
    }
  };

  const handleEditRequest = (request) => {
    // Implementation for editing requests
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

  // Navigation tabs configuration - now includes admin tab
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
    // Admin tab - only show for admin users
    ...(isAdmin ? [{ 
      id: 'admin', 
      label: 'Admin', 
      icon: Shield,
      description: 'Administrative functions'
    }] : [])
  ];

  // Filter data based on user
  const userRequests = getUserRequests(currentUser?.accountId);
  const pendingRequests = getPendingRequests().filter(req => 
    req.requester_id !== currentUser?.accountId
  );

  // Show loading state during initialization
  if (appLoading || userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing PTO Management</h2>
          <p className="text-gray-600">Setting up database and admin users...</p>
        </div>
      </div>
    );
  }

  // Show error state if user loading failed
  if (userError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">Failed to load user information: {userError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Calendar size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">PTO Management</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Quick Stats */}
              <div className="hidden md:flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>{pendingRequests.length} pending</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>{userRequests.filter(r => r.status === 'approved').length} approved</span>
                </div>
                {userTeams.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span>{userTeams.length} teams</span>
                  </div>
                )}
              </div>
              
              {/* User Profile */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold relative">
                  {currentUser.displayName?.charAt(0) || <User size={16} />}
                  {isAdmin && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <Shield size={8} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                    <span>{currentUser.displayName}</span>
                    {isAdmin && <Shield size={12} className="text-purple-600" />}
                  </div>
                  <div className="text-xs text-gray-500">{currentUser.emailAddress}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? tab.id === 'admin' 
                        ? 'border-purple-500 text-purple-600'
                        : 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  title={tab.description}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.id === 'approvals' && pendingRequests.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {pendingRequests.length}
                    </span>
                  )}
                  {tab.id === 'admin' && (
                    <span className="bg-purple-100 text-purple-600 text-xs rounded-full px-2 py-0.5">
                      Admin
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'calendar' && (
          <CalendarPage
            events={ptoRequests}
            onDateSelect={handleDateSelect}
            selectedDates={selectedDates}
            onSubmitPTO={handlePTOSubmit}
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
            pendingRequests={pendingRequests}
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
          />
        )}
      </main>

      {/* Loading Overlay */}
      {(requestsLoading || appLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-700">Processing...</span>
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