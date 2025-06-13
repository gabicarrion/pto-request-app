import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Users, CheckCircle, User, Shield, UserCheck } from 'lucide-react';
import { invoke } from '@forge/bridge';

// Components
import Notification from './components/Common/Notifications';
import AdminManagement from './components/Admin/AdminManagement';
import ManagerView from './components/Manager/ManagerView';
import UserPicker from './components/Common/UserPicker';

// Pages & Hooks
import CalendarPage from './components/Calendar/CalendarPage';
import RequestsPage from './components/MyRequests/RequestsPage';

import useCurrentUser from './hooks/useCurrentUser';
import usePTORequests from './hooks/usePTORequests';
import './styles/styles.css';

const PTOManagementApp = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDates, setSelectedDates] = useState([]);
  const [notification, setNotification] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [userTeams, setUserTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [isViewingAsNonAdmin, setIsViewingAsNonAdmin] = useState(false);
  const [viewAsUser, setViewAsUser] = useState(null);
  const [viewAsIsAdmin, setViewAsIsAdmin] = useState(false);

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

  // Check if user is a manager
  const [isManager, setIsManager] = useState(false);

  // Load additional data
  useEffect(() => {
    const loadAllData = async () => {
      if (!currentUser) return;
      
      try {
        // Load user teams
        const response = await invoke('getUserTeams', { 
          userId: isViewingAsNonAdmin ? viewAsUser.jira_account_id : currentUser.accountId 
        });
        if (response.success) {
          setUserTeams(response.data || []);
        }

        // Load all users and teams for admin/manager functionality
        const [usersResponse, teamsResponse] = await Promise.all([
          invoke('getAllUsers'),
          invoke('getTeams')
        ]);

        if (usersResponse.success) {
          setAllUsers(usersResponse.data || []);
        }

        if (teamsResponse.success) {
          const teams = teamsResponse.data || [];
          setAllTeams(teams);
          
          // Check if current user is a manager of any team
          const userId = isViewingAsNonAdmin ? (viewAsUser.jira_account_id || viewAsUser.id) : (currentUser.jira_account_id || currentUser.id);
          const managedTeams = teams.filter(team =>
            team.manager?.jira_account_id === userId ||
            team.manager?.id === userId
          );
          setIsManager(managedTeams.length > 0 || (isAdmin && !isViewingAsNonAdmin));
        }
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
    };

    loadAllData();
  }, [currentUser, isAdmin, isViewingAsNonAdmin, viewAsUser]);

  // Initialize app with admin setup
  useEffect(() => {
    const initializeApp = async () => {
      setAppLoading(true);
      
      // Add multiple retry attempts with exponential backoff
      let retries = 5;
      let delay = 1000; // Start with 1 second
      
      while (retries > 0) {
        try {
          console.log(`🔧 Initializing PTO App (attempt ${6 - retries}/5)...`);
          
          // Check if Forge bridge is available before proceeding
          if (typeof invoke === 'undefined') {
            throw new Error('Forge bridge not available');
          }
          
          const dbResult = await invoke('initializePTODatabaseWithTeamManagement');
          if (!dbResult.success) {
            console.warn('Admin setup failed, trying regular init:', dbResult.message);
            const fallbackResult = await invoke('initializePTODatabase');
            if (!fallbackResult.success) {
              throw new Error(fallbackResult.message);
            }
          } else {
            console.log('✅ PTO App and Admin initialized:', dbResult.data);
          }
          
          console.log('✅ PTO App initialization complete');
          break; // Success, exit retry loop
          
        } catch (error) {
          retries--;
          if ((error.message.includes('window is not defined') || 
              error.message.includes('Forge bridge not available')) && retries > 0) {
            console.warn(`⚠️ Forge not ready, retrying in ${delay/1000} second(s)... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 5000); // Exponential backoff, max 5 seconds
          } else {
            console.error('❌ App initialization failed:', error);
            if (typeof showNotification === 'function') {
              showNotification('Failed to initialize app: ' + error.message, 'error');
            }
            break;
          }
        }
      }
      
      setAppLoading(false);
    };

    // Wait for DOM and Forge to be ready
    const timer = setTimeout(initializeApp, 2000); // Increased delay to 2 seconds
    return () => clearTimeout(timer);
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
      // Find current user data in the system
      const currentUserData = allUsers.find(user => 
        user.jira_account_id === currentUser?.accountId ||
        user.email_address === currentUser?.emailAddress
      );

      // Get user's manager if they exist in the system
      let userManager = null;
      if (currentUserData?.team_id) {
        const userTeam = allTeams.find(team => team.id === currentUserData.team_id);
        if (userTeam?.manager) {
          userManager = userTeam.manager;
        }
      }

      // Prepare request data in the format expected by backend
      const requestData = {
        reporter: ptoData.targetUser || currentUser,
        manager: ptoData.manager || userManager || {
          accountId: "manager-default",
          displayName: "Manager",
          emailAddress: "manager@company.com"
        },
        startDate: ptoData.startDate || selectedDates[0],
        endDate: ptoData.endDate || selectedDates[selectedDates.length - 1],
        leaveType: ptoData.leaveType || ptoData.dailySchedules?.[0]?.leaveType || 'vacation',
        reason: ptoData.reason || '',
        dailySchedules: ptoData.dailySchedules || selectedDates.map(date => ({
          date,
          type: 'FULL_DAY',
          leaveType: 'vacation'
        }))
      };
      
      const result = await submitRequest(requestData);
      
      if (result.success) {
        setSelectedDates([]);
        showNotification('PTO request submitted successfully!');
        return { success: true };
      } else {
        showNotification(result.message || 'Failed to submit PTO request', 'error');
        return { success: false };
      }
      
    } catch (error) {
      console.error('Error submitting PTO request:', error);
      showNotification('Failed to submit PTO request', 'error');
      return { success: false };
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

  const handleEditRequest = async (request) => {
    try {
      const response = await invoke('editPTORequest', {
        requestId: request.id,
        editedBy: currentUser.accountId,
        updatedData: {
          startDate: request.startDate,
          endDate: request.endDate,
          leaveType: request.leaveType,
          reason: request.reason,
          dailySchedules: request.dailySchedules
        }
      });

      if (response.success) {
        showNotification('PTO request updated successfully and resubmitted for approval');
        // Refresh the requests list
        if (isViewingAsNonAdmin) {
          loadUserRequests(viewAsUser);
        } else {
          loadAllRequests();
        }
      } else {
        showNotification(response.message || 'Failed to update PTO request', 'error');
      }
    } catch (error) {
      console.error('Error updating PTO request:', error);
      showNotification('Failed to update PTO request', 'error');
    }
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

  const handleViewAsNonAdmin = async (user) => {
    if (!user) {
      setIsViewingAsNonAdmin(false);
      setViewAsUser(null);
      setViewAsIsAdmin(false);
      return;
    }

    try {
      // Get user's teams
      const response = await invoke('getUserTeams', { userId: user.jira_account_id || user.id });
      if (response.success) {
        setViewAsUser(user);
        setUserTeams(response.data || []);
        setIsViewingAsNonAdmin(true);
        // Check admin status for the impersonated user
        const adminResp = await invoke('checkUserAdminStatus', { accountId: user.jira_account_id || user.accountId || user.id });
        setViewAsIsAdmin(adminResp.success ? adminResp.data.isAdmin : false);
      }
    } catch (error) {
      console.error('Error setting view as user:', error);
      setViewAsIsAdmin(false);
    }
  };

  const handleExitViewAs = () => {
    setIsViewingAsNonAdmin(false);
    setViewAsUser(null);
    setViewAsIsAdmin(false);
    // Reload original user data
    loadAllData();
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
    // Show Manager view for managers and admins
    ...(isManager ? [{ 
      id: 'manager', 
      label: 'Manager', 
      icon: UserCheck,
      description: 'Manage team PTO requests'
    }] : []),
    // Admin tab - only show for admin users
    ...(((isViewingAsNonAdmin ? viewAsIsAdmin : isAdmin)) ? [{ 
      id: 'admin', 
      label: 'Admin', 
      icon: Shield,
      description: 'Administrative functions'
    }] : [])
  ];

  // Filter data based on user
  const effectiveAccountId = isViewingAsNonAdmin ? viewAsUser?.accountId : currentUser?.accountId;
  const userRequests = getUserRequests(effectiveAccountId);
  const pendingRequests = getPendingRequests().filter(req => 
    req.requester_id !== effectiveAccountId
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
    <div className="pto-management-app">
      {currentUser && (
        <div className="app-header">
        </div>
      )}
      <div className="min-h-screen bg-gray-50">
        {/* Clean Top Navigation Bar */}
        <div className="app-topbar">
          <div className="app-logo">
            <div className="app-logo-icon">
              <Calendar size={20} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '1.125rem', color: '#1f2937' }}>PTO Request</span>
          </div>
          
          <div className="nav-tabs condensed">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={async () => {
                  // Clear validation data when switching tabs
                  try {
                    await invoke('clearImportValidationData');
                  } catch (error) {
                    console.warn('⚠️ Could not clear validation data:', error);
                  }
                  setActiveTab(tab.id);
                }}
                  className={`nav-tab${isActive ? ' active' : ''}${tab.id === 'admin' ? ' admin' : ''}${tab.id === 'manager' && !isAdmin ? ' manager' : ''}`}
                  title={tab.description}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {tab.id === 'manager' && pendingRequests.length > 0 && (
                    <span className="nav-tab-badge">{pendingRequests.length}</span>
                  )}
                  {tab.id === 'admin' && (
                    <span className="nav-tab-label admin">Admin</span>
                  )}
                  {tab.id === 'manager' && !isAdmin && (
                    <span className="nav-tab-label manager">Manager</span>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="app-user-profile">
            <div className="user-avatar-header">
              {currentUser.displayName?.charAt(0) || <User size={16} />}
              {isAdmin && <span className="user-badge admin"><Shield size={8} /></span>}
              {isManager && !isAdmin && <span className="user-badge manager"><UserCheck size={8} /></span>}
            </div>
            <div className="user-info-header">
              <div className="user-name-header">
                <span>{currentUser.displayName}</span>
                {isAdmin && <Shield size={12} style={{ color: '#8b5cf6' }} />}
                {isManager && !isAdmin && <UserCheck size={12} style={{ color: '#f97316' }} />}
              </div>
              <div className="user-email-header">{currentUser.emailAddress}</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
          {activeTab === 'calendar' && (
            <CalendarPage
              events={ptoRequests}
              onDateSelect={handleDateSelect}
              selectedDates={selectedDates}
              onSubmitPTO={handlePTOSubmit}
              currentUser={isViewingAsNonAdmin ? viewAsUser : currentUser}
              allUsers={allUsers}
              allTeams={allTeams}
              isAdmin={isViewingAsNonAdmin ? viewAsIsAdmin : isAdmin}
            />
          )}
          
          {activeTab === 'requests' && (
            <RequestsPage
              requests={userRequests}
              currentUser={isViewingAsNonAdmin ? viewAsUser : currentUser}
              onEditRequest={handleEditRequest}
              onCancelRequest={handleCancelRequest}
            />
          )}
          
          {activeTab === 'manager' && isManager && (
            <ManagerView
              currentUser={currentUser}
              isAdmin={isAdmin}
              showNotification={showNotification}
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
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 320, padding: 24, textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
              <span>Processing...</span>
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
    </div>
  );
};

export default PTOManagementApp;