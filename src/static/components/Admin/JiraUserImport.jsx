import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { Users, Search, RefreshCw, UserPlus, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import './JiraUserImport.css';

/**
 * Component for importing users from Jira
 * 
 * @param {Object} props
 * @param {Array} props.existingUsers - Already imported users
 * @param {Array} props.teams - Available teams
 * @param {Function} props.onUserImport - Callback when users are imported
 * @param {Function} props.showNotification - Function to show notifications
 */
function JiraUserImport({ existingUsers = [], teams = [], onUserImport, showNotification }) {
  const [jiraUsers, setJiraUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [pagination, setPagination] = useState({
    startAt: 0,
    maxResults: 50,
    total: 0,
    isLast: true
  });
  
  // Default team for bulk import
  const [defaultTeam, setDefaultTeam] = useState('');
  const [defaultRole, setDefaultRole] = useState('Member');
  
  // Load Jira users on component mount
  useEffect(() => {
    loadJiraUsers(0);
  }, []);
  
  // Filter users when search query or jiraUsers change
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(jiraUsers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        jiraUsers.filter(user => 
          (user.displayName || '').toLowerCase().includes(query) ||
          (user.emailAddress || '').toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, jiraUsers]);
  
  // Load users from Jira
  const loadJiraUsers = async (startAt = 0) => {
    setLoading(true);
    
    try {
      // Clear existing users if starting from beginning
      if (startAt === 0) {
        setJiraUsers([]);
      }
      
      const response = await invoke('getInternalJiraUsers', {
        startAt,
        maxResults: 50
      });
      
      if (response.success && response.data) {
        const { users: newUsers, total, isLast } = response.data;
        
        // Merge with existing users (if paginating)
        setJiraUsers(prev => {
          const combined = [...prev, ...(newUsers || [])];
          // Remove duplicates by accountId
          const uniqueUsers = Array.from(
            new Map(combined.map(user => [user.accountId, user])).values()
          );
          return uniqueUsers;
        });
        
        setPagination({
          startAt,
          maxResults: 50,
          total: total || 0,
          isLast: isLast !== false
        });
      } else {
        throw new Error(response.message || 'Failed to load Jira users');
      }
    } catch (error) {
      showNotification('Failed to load Jira users: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load next page of users
  const loadNextPage = () => {
    if (!pagination.isLast) {
      loadJiraUsers(pagination.startAt + pagination.maxResults);
    }
  };
  
  // Load previous page of users
  const loadPreviousPage = () => {
    if (pagination.startAt > 0) {
      const newStartAt = Math.max(0, pagination.startAt - pagination.maxResults);
      loadJiraUsers(newStartAt);
    }
  };
  
  // Get users not already in the system
  const getNewUsers = () => {
    // Create a set of existing user identifiers
    const existingIds = new Set();
    const existingEmails = new Set();
    
    existingUsers.forEach(user => {
      if (user.jira_account_id) existingIds.add(user.jira_account_id);
      if (user.accountId) existingIds.add(user.accountId);
      if (user.email_address) existingEmails.add(user.email_address.toLowerCase());
      if (user.emailAddress) existingEmails.add(user.emailAddress.toLowerCase());
    });
    
    // Filter out inactive users and users that already exist
    return filteredUsers.filter(jiraUser => {
      // Skip inactive users
      if (jiraUser.active === false) return false;
      
      const jiraAccountId = jiraUser.accountId;
      const jiraEmail = jiraUser.emailAddress?.toLowerCase();
      
      // Only show users that are not in the system by either account ID or email
      return !existingIds.has(jiraAccountId) && 
             (jiraEmail ? !existingEmails.has(jiraEmail) : true);
    });
  };
  
  // Handle user selection
  const handleUserSelection = (user, selected) => {
    if (selected) {
      setSelectedUsers(prev => [...prev, user]);
    } else {
      setSelectedUsers(prev => prev.filter(u => u.accountId !== user.accountId));
    }
  };
  
  // Select all visible users
  const handleSelectAll = () => {
    const newUsers = getNewUsers();
    setSelectedUsers(newUsers);
  };
  
  // Clear all selected users
  const handleClearSelection = () => {
    setSelectedUsers([]);
  };
  
  // Import selected users
  const handleImportUsers = async () => {
    if (selectedUsers.length === 0) {
      showNotification('Please select users to import', 'warning');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await invoke('bulkImportUsersFromJira', {
        selectedUserIds: selectedUsers.map(user => user.accountId),
        defaultTeamId: defaultTeam || null,
        defaultDepartment: ''
      });
      
      if (response.success) {
        const { importedCount, skippedCount } = response.data;
        showNotification(
          `Successfully imported ${importedCount} users. ${skippedCount > 0 ? `${skippedCount} users were already in the system.` : ''}`,
          'success'
        );
        
        // Clear selection
        setSelectedUsers([]);
        
        // Refresh user list
        loadJiraUsers(0);
        
        // Notify parent component
        if (onUserImport) {
          onUserImport();
        }
      } else {
        throw new Error(response.message || 'Failed to import users');
      }
    } catch (error) {
      showNotification('Failed to import users: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Get new users (not already in system)
  const newUsers = getNewUsers();
  
  return (
    <div className="jira-user-import">
      <div className="jira-import-header">
        <div className="jira-import-title">
          <h3>
            <Users size={18} />
            Import Users from Jira
          </h3>
          <p>Select Jira users to import into the system. Only active users not already in the system are shown.</p>
        </div>
        
        <div className="jira-import-actions">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <XCircle size={16} />
              </button>
            )}
          </div>
          
          <button
            className="action-button secondary"
            onClick={() => loadJiraUsers(0)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Import Options */}
      {selectedUsers.length > 0 && (
        <div className="import-options">
          <div className="selected-count">
            <CheckCircle size={16} />
            {selectedUsers.length} users selected
          </div>
          
          <div className="import-settings">
            <div className="setting-group">
              <label>Default Team (Optional)</label>
              <select
                value={defaultTeam}
                onChange={(e) => setDefaultTeam(e.target.value)}
              >
                <option value="">No Team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            
            <div className="setting-group">
              <label>Default Role</label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value)}
              >
                <option value="Member">Member</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
          </div>
          
          <div className="import-buttons">
            <button
              className="action-button secondary"
              onClick={handleClearSelection}
              disabled={loading}
            >
              Clear Selection
            </button>
            
            <button
              className="action-button primary"
              onClick={handleImportUsers}
              disabled={loading}
            >
              <UserPlus size={16} />
              Import {selectedUsers.length} Users
            </button>
          </div>
        </div>
      )}
      
      {/* User Selection */}
      <div className="user-selection-header">
        <div className="available-count">
          {newUsers.length} users available to import
        </div>
        
        <div className="selection-actions">
          {newUsers.length > 0 && (
            <button
              className="select-all-btn"
              onClick={handleSelectAll}
              disabled={loading}
            >
              Select All
            </button>
          )}
        </div>
      </div>
      
      {/* User Grid */}
      {loading && jiraUsers.length === 0 ? (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" />
          <p>Loading users from Jira...</p>
        </div>
      ) : newUsers.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={48} />
          <h3>No Users to Import</h3>
          <p>
            {searchQuery ? 
              'No matching users found. Try a different search term.' : 
              'All Jira users have already been imported.'}
          </p>
        </div>
      ) : (
        <div className="jira-users-grid">
          {newUsers.map(user => {
            const isSelected = selectedUsers.some(u => u.accountId === user.accountId);
            return (
              <div key={user.accountId} className={`jira-user-card ${isSelected ? 'selected' : ''}`}>
                <div className="user-selection">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleUserSelection(user, e.target.checked)}
                    id={`user-${user.accountId}`}
                  />
                  <label htmlFor={`user-${user.accountId}`} className="checkbox-label">
                    <span className="custom-checkbox">
                      <CheckCircle size={14} className="check-icon" />
                    </span>
                  </label>
                </div>
                
                <div className="user-avatar">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} />
                  ) : (
                    <div className="avatar-placeholder">
                      {user.displayName?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                
                <div className="user-info">
                  <div className="user-name">{user.displayName}</div>
                  <div className="user-email">{user.emailAddress}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Pagination */}
      {jiraUsers.length > 0 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={loadPreviousPage}
            disabled={pagination.startAt === 0 || loading}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          
          <div className="pagination-info">
            Showing {pagination.startAt + 1} - {Math.min(pagination.startAt + filteredUsers.length, pagination.total)} of {pagination.total}
          </div>
          
          <button
            className="pagination-btn"
            onClick={loadNextPage}
            disabled={pagination.isLast || loading}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default JiraUserImport;