// src/static/App.jsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';

// Import tabs
import Calendar from './components/Calendar/Calendar';
import MyRequestsTab from './tabs/MyRequestsTab';
import ManagerTab from './tabs/ManagerTab';
import AdminTab from './tabs/AdminTab';

// Import styles
import './styles/app.css';

const App = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState({
    isAdmin: false,
    isManager: false,
    isExecutiveManager: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  // Load user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      
      try {
        // Get current user
        const userResponse = await invoke('getCurrentUser');
        if (!userResponse || !userResponse.success) {
          throw new Error('Failed to fetch current user');
        }
        
        const user = userResponse.data || userResponse;
        setCurrentUser(user);
        
        console.log('Current user data:', user);
        
        // Check user roles
        let isAdmin = false;
        let isManager = false;
        let isExecutiveManager = false;
        
        try {
          const adminResponse = await invoke('isCurrentUserAdmin');
          isAdmin = adminResponse === true || (adminResponse && adminResponse.success === true);
        } catch (error) {
          console.warn('Error checking admin status:', error);
        }
        
        try {
          const managerResponse = await invoke('isCurrentUserManager');
          isManager = managerResponse === true || (managerResponse && managerResponse.success === true);
        } catch (error) {
          console.warn('Error checking manager status:', error);
        }
        
        try {
          const execResponse = await invoke('isCurrentUserExecutiveManager');
          isExecutiveManager = execResponse === true || (execResponse && execResponse.success === true);
        } catch (error) {
          console.warn('Error checking executive manager status:', error);
        }
        
        // Override admin status for specific users or testing
        if (user && 
            (user.jira_account_id === '60d47a8edeecef006a0c1beb' || 
             user.accountId === '60d47a8edeecef006a0c1beb' ||
             user.email_address === 'admin@example.com' ||
             user.emailAddress === 'admin@example.com')) {
          console.log('Admin override applied');
          isAdmin = true;
        }
        
        console.log('User roles:', { isAdmin, isManager, isExecutiveManager });
        
        setUserRoles({
          isAdmin,
          isManager,
          isExecutiveManager
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        showNotification('Error loading user data: ' + error.message, 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading HR Tool...</p>
      </div>
    );
  }
  
  return (
    <div className="pto-app">
      <header className="app-header">
        <h1>PTO Management Tool</h1>
        
        <div className="user-info">
          {currentUser && (
            <div className="current-user">
              <span className="user-name">
                {currentUser.display_name || currentUser.displayName || 
                 `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 
                 currentUser.name || 'User'}
              </span>
              <span className="user-roles">
                {userRoles.isAdmin && <span className="role admin">Admin</span>}
                {userRoles.isManager && <span className="role manager">Manager</span>}
                {userRoles.isExecutiveManager && <span className="role exec">Executive</span>}
              </span>
            </div>
          )}
        </div>
      </header>
      
      <nav className="app-tabs">
        <button 
          className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => handleTabChange('calendar')}
        >
          Calendar
        </button>
        
        <button 
          className={`tab-button ${activeTab === 'my-requests' ? 'active' : ''}`}
          onClick={() => handleTabChange('my-requests')}
        >
          My Requests
        </button>
        
        {/* Show Manager tab only for managers or executive managers */}
        {(userRoles.isManager || userRoles.isExecutiveManager) && (
          <button 
            className={`tab-button ${activeTab === 'manager' ? 'active' : ''}`}
            onClick={() => handleTabChange('manager')}
          >
            Manager Dashboard
          </button>
        )}
        
        {/* Show Admin tab only for admins */}
        {userRoles.isAdmin && (
          <button 
            className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => handleTabChange('admin')}
          >
            Admin
          </button>
        )}
      </nav>
      
      <main className="app-content">
        {activeTab === 'calendar' && (
          <Calendar currentUser={currentUser} />
        )}
        
        {activeTab === 'my-requests' && (
          <MyRequestsTab currentUser={currentUser} />
        )}
        
        {activeTab === 'manager' && (userRoles.isManager || userRoles.isExecutiveManager) && (
          <ManagerTab currentUser={currentUser} />
        )}
        
        {activeTab === 'admin' && userRoles.isAdmin && (
          <AdminTab 
            currentUser={currentUser} 
            isAdmin={userRoles.isAdmin}
            showNotification={showNotification}
          />
        )}
      </main>
      
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-message">{notification.message}</div>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}
      
      <footer className="app-footer">
        <p>HR PTO Management Tool &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default App;