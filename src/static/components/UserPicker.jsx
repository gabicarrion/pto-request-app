import React, { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@forge/bridge';
import { Search, User, X } from 'lucide-react';

const UserPicker = ({ 
  selectedUser, 
  onSelect, 
  placeholder = "Search for a user",
  disabled = false,
  required = false,
  error = null 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search function
  const searchUsers = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setUsers([]);
        return;
      }

      setLoading(true);
      setSearchError(null);
      
      try {
        console.log('🔍 Searching users:', query);
        const response = await invoke('getJiraUsers', { query });
        
        if (response.success) {
          setUsers(response.data || []);
        } else {
          throw new Error(response.message || 'Failed to search users');
        }
      } catch (error) {
        console.error('❌ Error searching users:', error);
        setSearchError(error.message);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchUsers(query);
  };

  // Handle user selection
  const handleUserSelect = (user) => {
    onSelect(user);
    setIsOpen(false);
    setSearchQuery('');
    setUsers([]);
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
        setUsers([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
        setUsers([]);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Input/Display */}
      <div
        onClick={handleOpen}
        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed border-gray-200' 
            : isOpen
              ? 'border-blue-500 ring-2 ring-blue-200'
              : error
                ? 'border-red-300 hover:border-red-400'
                : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {selectedUser ? (
          <div className="flex items-center space-x-3 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {selectedUser.avatarUrl ? (
                <img 
                  src={selectedUser.avatarUrl} 
                  alt={selectedUser.displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                selectedUser.displayName?.charAt(0) || <User size={16} />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{selectedUser.displayName}</div>
              <div className="text-sm text-gray-600">{selectedUser.emailAddress}</div>
            </div>
            {!disabled && (
              <button
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-gray-500">
            <Search size={16} />
            <span>{placeholder}</span>
            {required && <span className="text-red-500">*</span>}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-1 text-sm text-red-600">{error}</div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Type to search users..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              </div>
            ) : searchError ? (
              <div className="p-4 text-center text-red-600">
                <div className="text-sm">Error: {searchError}</div>
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="p-4 text-center text-gray-500">
                <div className="text-sm">Type at least 2 characters to search</div>
              </div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <div className="text-sm">No users found</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map(user => (
                  <div
                    key={user.accountId}
                    onClick={() => handleUserSelect(user)}
                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {user.avatarUrl ? (
                          <img 
                            src={user.avatarUrl} 
                            alt={user.displayName}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          user.displayName?.charAt(0) || <User size={16} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.displayName}</div>
                        <div className="text-sm text-gray-600">{user.emailAddress}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

export default UserPicker;