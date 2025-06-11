import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, User, X } from 'lucide-react';
import { invoke } from '@forge/bridge';

// Simple debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const UserPicker = ({ 
  selectedUser, 
  onSelect, 
  placeholder = "Search for a user",
  disabled = false,
  required = false,
  error = null,
  allUsers = [], // Pass all users from database
  filterBy = 'all', // 'all', 'withTeam', 'withoutTeam'
  useBackendSearch = false // Whether to use backend search or local filtering
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search function for backend search
  const searchUsersBackend = useCallback(
    debounce(async (query) => {
      if (query.length < 1) {
        setFilteredUsers([]);
        return;
      }

      setLoading(true);
      setSearchError(null);
      
      try {
        const response = await invoke('searchDatabaseUsers', { 
          query, 
          filterBy,
          startAt: 0,
          maxResults: 50 
        });
        
        if (response.success && response.data) {
          setFilteredUsers(response.data.users || []);
        } else {
          throw new Error(response.message || 'Failed to search users');
        }
      } catch (error) {
        console.error('❌ Error searching users:', error);
        setSearchError(error.message);
        setFilteredUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [filterBy]
  );

  // Local filtering function
  const filterUsersLocal = useCallback((query = '') => {
    let users = [...allUsers];
    
    // Apply team filter
    if (filterBy === 'withTeam') {
      users = users.filter(user => (user.team_ids || []).length > 0);
    } else if (filterBy === 'withoutTeam') {
      users = users.filter(user => !(user.team_ids && user.team_ids.length > 0));
    }
    
    // Apply search query
    if (query.length >= 1) {
      const searchLower = query.toLowerCase();
      users = users.filter(user => {
        const displayName = (user.display_name || user.displayName || '').toLowerCase();
        const email = (user.email_address || user.emailAddress || '').toLowerCase();
        const firstName = (user.first_name || user.firstName || '').toLowerCase();
        const lastName = (user.last_name || user.lastName || '').toLowerCase();
        
        return displayName.includes(searchLower) || 
               email.includes(searchLower) ||
               firstName.includes(searchLower) ||
               lastName.includes(searchLower);
      });
    }
    
    // Sort by display name
    users.sort((a, b) => {
      const nameA = (a.display_name || a.displayName || '').toLowerCase();
      const nameB = (b.display_name || b.displayName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    setFilteredUsers(users.slice(0, 50)); // Limit to 50 results for performance
  }, [allUsers, filterBy]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (useBackendSearch) {
      searchUsersBackend(query);
    } else {
      filterUsersLocal(query);
    }
  };

  // Initialize filtered users when component mounts or allUsers changes
  useEffect(() => {
    if (!useBackendSearch) {
      filterUsersLocal(searchQuery);
    }
  }, [filterUsersLocal, searchQuery, useBackendSearch]);

  // Handle user selection
  const handleUserSelect = (user) => {
    onSelect(user);
    setIsOpen(false);
    setSearchQuery('');
    setFilteredUsers([]);
  };

  // Handle clearing selection
  const handleClear = (e) => {
    e.stopPropagation();
    onSelect(null);
  };

  // Handle opening dropdown
  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
        if (!useBackendSearch) {
          setFilteredUsers([]);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [useBackendSearch]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
        if (!useBackendSearch) {
          setFilteredUsers([]);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, useBackendSearch]);

  // Get team name for user
  const getUserTeamName = (user) => {
    // This would need to be passed as a prop or computed elsewhere
    return user.team_name || '';
  };

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query) {
        setFilteredUsers([]);
        return;
      }

      try {
        let response;
        if (useBackendSearch) {
          response = await invoke('searchDatabaseUsers', {
            query,
            filterBy,
            startAt: 0,
            maxResults: 50
          });
        } else {
          response = await invoke('getInternalJiraUsers', {
            startAt: 0,
            maxResults: 50
          });
        }

        if (response.success) {
          setFilteredUsers(response.data.users || []);
        } else {
          setFilteredUsers([]);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setFilteredUsers([]);
      }
    }, 300),
    [useBackendSearch, filterBy]
  );

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setFilteredUsers([]);
    }
  }, [searchQuery, debouncedSearch]);

  return (
    <div className="user-picker-container" ref={dropdownRef}>
      {/* Main Input/Display */}
      <div
        onClick={handleOpen}
        className={`user-picker-input ${disabled ? 'user-picker-input-disabled' : ''} ${
          isOpen ? 'user-picker-input-focused' : ''
        } ${error ? 'user-picker-input-error' : ''}`}
      >
        {selectedUser ? (
          <div className="user-picker-selected">
            <div className="user-picker-avatar">
              {selectedUser.avatarUrl || selectedUser.avatar_url ? (
                <img 
                  src={selectedUser.avatarUrl || selectedUser.avatar_url} 
                  alt={selectedUser.displayName || selectedUser.display_name}
                  className="user-picker-avatar-img"
                />
              ) : (
                <span className="user-picker-avatar-text">
                  {(selectedUser.displayName || selectedUser.display_name)?.charAt(0) || <User size={16} />}
                </span>
              )}
            </div>
            <div className="user-picker-user-info">
              <div className="user-picker-user-name">
                {selectedUser.displayName || selectedUser.display_name}
              </div>
              <div className="user-picker-user-email">
                {selectedUser.emailAddress || selectedUser.email_address}
              </div>
            </div>
            {!disabled && (
              <button
                onClick={handleClear}
                className="user-picker-clear-btn"
                type="button"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="user-picker-placeholder">
            <Search size={16} />
            <span>{placeholder}</span>
            {required && <span className="user-picker-required">*</span>}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="user-picker-error">{error}</div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="user-picker-dropdown">
          {/* Search Input */}
          <div className="user-picker-search-container">
            <div className="user-picker-search-input-wrapper">
              <Search size={16} className="user-picker-search-icon" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Type to search users..."
                className="user-picker-search-input"
              />
            </div>
          </div>

          {/* Results */}
          <div className="user-picker-results">
            {loading ? (
              <div className="user-picker-loading">
                <div className="user-picker-loading-spinner"></div>
                <div className="user-picker-loading-text">Searching...</div>
              </div>
            ) : searchError ? (
              <div className="user-picker-empty">
                <div className="user-picker-empty-text">Error: {searchError}</div>
              </div>
            ) : allUsers.length === 0 && !useBackendSearch ? (
              <div className="user-picker-empty">
                <div className="user-picker-empty-text">No users available</div>
              </div>
            ) : searchQuery.length >= 1 && filteredUsers.length === 0 ? (
              <div className="user-picker-empty">
                <div className="user-picker-empty-text">No users found</div>
              </div>
            ) : searchQuery.length < 1 ? (
              <div className="user-picker-empty">
                <div className="user-picker-empty-text">Type to search users...</div>
              </div>
            ) : (
              <div className="user-picker-user-list">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="user-picker-user-option"
                  >
                    <div className="user-picker-avatar">
                      {user.avatarUrl || user.avatar_url ? (
                        <img 
                          src={user.avatarUrl || user.avatar_url} 
                          alt={user.displayName || user.display_name}
                          className="user-picker-avatar-img"
                        />
                      ) : (
                        <span className="user-picker-avatar-text">
                          {(user.displayName || user.display_name)?.charAt(0) || <User size={16} />}
                        </span>
                      )}
                    </div>
                    <div className="user-picker-option-info">
                      <div className="user-picker-option-name">
                        {user.displayName || user.display_name}
                      </div>
                      <div className="user-picker-option-email">
                        {user.emailAddress || user.email_address}
                      </div>
                      {getUserTeamName(user) && (
                        <div className="user-picker-option-team">
                          Team: {getUserTeamName(user)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 50 && (
                  <div className="user-picker-more-results">
                    Showing first 50 results. Narrow your search for more specific results.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPicker;