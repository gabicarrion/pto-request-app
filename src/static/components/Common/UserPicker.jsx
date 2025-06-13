import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User } from 'lucide-react';
import { invoke } from '@forge/bridge';
import './UserPicker.css';

/**
 * UserPicker component for selecting users
 * 
 * @param {Object} props
 * @param {Object} props.selectedUser - Currently selected user
 * @param {Function} props.onSelect - Handler for user selection
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Whether the component is disabled
 * @param {string} props.error - Error message
 * @param {boolean} props.useBackendSearch - Whether to use backend search
 * @param {Array} props.allUsers - All available users (for local filtering)
 */
function UserPicker({ 
  selectedUser, 
  onSelect, 
  placeholder = 'Search users...', 
  disabled = false,
  error,
  useBackendSearch = false,
  allUsers = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Filter users when search query changes
  useEffect(() => {
    if (!isOpen || !searchQuery) {
      setFilteredUsers([]);
      return;
    }
    
    if (useBackendSearch) {
      // Use backend search if enabled
      searchUsersBackend();
    } else {
      // Use local filtering
      const query = searchQuery.toLowerCase();
      const filtered = allUsers.filter(user => {
        const displayName = (user.display_name || user.displayName || '').toLowerCase();
        const firstName = (user.first_name || '').toLowerCase();
        const lastName = (user.last_name || '').toLowerCase();
        const email = (user.email_address || user.emailAddress || '').toLowerCase();
        
        return displayName.includes(query) || 
               firstName.includes(query) || 
               lastName.includes(query) || 
               email.includes(query) ||
               `${firstName} ${lastName}`.includes(query);
      });
      
      setFilteredUsers(filtered);
    }
  }, [searchQuery, isOpen, useBackendSearch, allUsers]);
  
  // Search users using backend
  const searchUsersBackend = async () => {
    if (searchQuery.length < 2) return;
    
    setLoading(true);
    try {
      const response = await invoke('searchDatabaseUsers', {
        query: searchQuery,
        filterBy: 'all',
        startAt: 0,
        maxResults: 10
      });
      
      if (response.success && response.data) {
        setFilteredUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle user selection
  const handleSelectUser = (user) => {
    onSelect(user);
    setIsOpen(false);
    setSearchQuery('');
  };
  
  // Handle clear selection
  const handleClearSelection = () => {
    onSelect(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  // Format user display name
  const formatUserName = (user) => {
    if (!user) return '';
    
    return user.display_name || 
           user.displayName || 
           `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
           user.name || 
           'Unknown User';
  };
  
  return (
    <div className={`user-picker ${disabled ? 'disabled' : ''} ${error ? 'has-error' : ''}`} ref={containerRef}>
      {selectedUser ? (
        <div className="selected-user">
          <div className="selected-user-avatar">
            {selectedUser.avatar_url ? (
              <img src={selectedUser.avatar_url} alt="User Avatar" />
            ) : (
              <div className="avatar-placeholder">
                {formatUserName(selectedUser).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="selected-user-info">
            <div className="selected-user-name">{formatUserName(selectedUser)}</div>
            {(selectedUser.email_address || selectedUser.emailAddress) && (
              <div className="selected-user-email">
                {selectedUser.email_address || selectedUser.emailAddress}
              </div>
            )}
          </div>
          {!disabled && (
            <button 
              type="button" 
              className="clear-selection" 
              onClick={handleClearSelection}
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="search-input-container">
          <Search size={16} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            disabled={disabled}
            className="search-input"
          />
        </div>
      )}
      
      {isOpen && !selectedUser && (
        <div className="dropdown-menu">
          {loading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Searching...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="no-results">
              {searchQuery.length > 0 ? 'No users found' : 'Type to search users'}
            </div>
          ) : (
            <ul className="user-list">
              {filteredUsers.map(user => (
                <li 
                  key={user.id || user.jira_account_id || user.accountId}
                  className="user-item"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="user-item-avatar">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="User Avatar" />
                    ) : (
                      <div className="avatar-placeholder">
                        {formatUserName(user).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-item-info">
                    <div className="user-item-name">{formatUserName(user)}</div>
                    {(user.email_address || user.emailAddress) && (
                      <div className="user-item-email">
                        {user.email_address || user.emailAddress}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default UserPicker;