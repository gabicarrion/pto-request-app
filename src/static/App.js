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
  
  // Load user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      
      try {
        // Get current user
        const user = await invoke('getCurrentUser');
        setCurrentUser(user);
        
        // Check user roles
        const isAdmin = await invoke('isCurrentUserAdmin');
        const isManager = await invoke('isCurrentUserManager');
        const isExecutiveManager = await invoke('isCurrentUserExecutiveManager');
        
        setUserRoles({
          isAdmin,
          isManager,
          isExecutiveManager
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
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
              <span className="user-name">{currentUser.display_name}</span>
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
          <AdminTab currentUser={currentUser} />
        )}
      </main>
      
      <footer className="app-footer">
        <p>HR PTO Management Tool &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default App;