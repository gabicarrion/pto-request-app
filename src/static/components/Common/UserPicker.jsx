// src/static/components/Common/UserPicker.jsx
import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@forge/bridge';

const UserPicker = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Search for users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setUsers([]);
        return;
      }
      
      setIsLoading(true);
      
      try {
        const results = await invoke('searchUsers', { query });
        setUsers(results);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Debounce search
    const handler = setTimeout(searchUsers, 300);
    
    return () => clearTimeout(handler);
  }, [query]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target) && 
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle input change
  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };
  
  // Handle user selection
  const handleUserSelect = (user) => {
    onChange(user);
    setQuery('');
    setIsOpen(false);
  };
  
  // Focus input when clicking on the container
  const handleContainerClick = () => {
    inputRef.current.focus();
    setIsOpen(true);
  };
  
  return (
    <div className="user-picker" onClick={handleContainerClick}>
      <input
        ref={inputRef}
        type="text"
        className="user-picker-search"
        placeholder="Search for a user..."
        value={value ? value.display_name : query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
      />
      
      {isOpen && (
        <div ref={dropdownRef} className="user-picker-dropdown">
          {isLoading && <div className="user-picker-loading">Loading...</div>}
          
          {!isLoading && users.length === 0 && query.length >= 2 && (
            <div className="user-picker-no-results">No users found</div>
          )}
          
          {!isLoading && users.length > 0 && (
            users.map(user => (
              <div
                key={user.user_id}
                className="user-picker-item"
                onClick={() => handleUserSelect(user)}
              >
                <div className="user-picker-item-name">{user.display_name}</div>
                <div className="user-picker-item-email">{user.email_address}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default UserPicker;