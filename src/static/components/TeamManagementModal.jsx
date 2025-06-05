import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import UserPicker from './UserPicker';

function TeamManagementModal({ 
  isOpen, 
  onClose, 
  teams, 
  users,
  onSaveTeam, 
  onDeleteTeam,
  onSaveUser,
  onDeleteUser,
  showNotification,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('teams');
  const [activeSubTab, setActiveSubTab] = useState('list');
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Team form data
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    description: '',
    teamLead: null, // Changed to store user object
    department: '',
    color: '#667eea'
  });

  // User form data
  const [userFormData, setUserFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    jiraAccountId: '',
    employmentType: 'full-time',
    hireDate: '',
    teamId: '',
    capacity: 40
  });

  const [availabilityData, setAvailabilityData] = useState([
    { dayOfWeek: 1, dayName: 'Monday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 2, dayName: 'Tuesday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 3, dayName: 'Wednesday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 4, dayName: 'Thursday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 5, dayName: 'Friday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 6, dayName: 'Saturday', isWorkingDay: false, startTime: '', endTime: '', hoursPerDay: 0 },
    { dayOfWeek: 7, dayName: 'Sunday', isWorkingDay: false, startTime: '', endTime: '', hoursPerDay: 0 }
  ]);

  const [errors, setErrors] = useState({});

  // Department options - updated list
  const departmentOptions = [
    'Product',
    'Devops', 
    'RebelCare',
    'Strategy',
    'Service Delivery',
    'Client Services'
  ];

  // Reset forms
  const resetTeamForm = () => {
    setTeamFormData({
      name: '',
      description: '',
      teamLead: null, // Reset to null
      department: '',
      color: '#667eea'
    });
    setErrors({});
    setEditingTeam(null);
  };

  const resetUserForm = () => {
    setUserFormData({
      firstName: '',
      lastName: '',
      displayName: '',
      jiraAccountId: '',
      employmentType: 'full-time',
      hireDate: '',
      teamId: '',
      capacity: 40
    });
    setAvailabilityData([
      { dayOfWeek: 1, dayName: 'Monday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
      { dayOfWeek: 2, dayName: 'Tuesday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
      { dayOfWeek: 3, dayName: 'Wednesday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
      { dayOfWeek: 4, dayName: 'Thursday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
      { dayOfWeek: 5, dayName: 'Friday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
      { dayOfWeek: 6, dayName: 'Saturday', isWorkingDay: false, startTime: '', endTime: '', hoursPerDay: 0 },
      { dayOfWeek: 7, dayName: 'Sunday', isWorkingDay: false, startTime: '', endTime: '', hoursPerDay: 0 }
    ]);
    setErrors({});
    setEditingUser(null);
  };

  // Auto-generate display name when first/last name changes
  useEffect(() => {
    if (userFormData.firstName || userFormData.lastName) {
      setUserFormData(prev => ({
        ...prev,
        displayName: `${userFormData.firstName} ${userFormData.lastName}`.trim()
      }));
    }
  }, [userFormData.firstName, userFormData.lastName]);

  // Calculate weekly capacity from availability
  useEffect(() => {
    const weeklyHours = availabilityData.reduce((total, day) => 
      total + (day.isWorkingDay ? day.hoursPerDay : 0), 0
    );
    setUserFormData(prev => ({ ...prev, capacity: weeklyHours }));
  }, [availabilityData]);

  // Team handlers
  const handleEditTeam = (team) => {
    setEditingTeam(team);
    
    // Handle team lead - convert string to user object if needed
    let teamLead = null;
    if (team.team_lead) {
      // Try to find the user object for the team lead
      if (typeof team.team_lead === 'string') {
        // If it's a string, try to find the user by display name
        teamLead = users.find(user => 
          user.display_name === team.team_lead || 
          user.displayName === team.team_lead ||
          user.name === team.team_lead
        ) || null;
      } else if (typeof team.team_lead === 'object') {
        // If it's already an object, use it
        teamLead = team.team_lead;
      }
    }

    setTeamFormData({
      name: team.name || '',
      description: team.description || '',
      teamLead: teamLead,
      department: team.department || '',
      color: team.color || '#667eea'
    });
    setActiveSubTab('form');
  };

  const handleTeamInputChange = (field, value) => {
    setTeamFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleTeamLeadChange = (user) => {
    setTeamFormData(prev => ({ ...prev, teamLead: user }));
    if (errors.teamLead) {
      setErrors(prev => ({ ...prev, teamLead: null }));
    }
  };

  const validateTeamForm = () => {
    const newErrors = {};
    if (!teamFormData.name.trim()) {
      newErrors.name = 'Team name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    if (!validateTeamForm()) return;
    
    setLoading(true);
    try {
      const teamData = {
        id: editingTeam?.id,
        name: teamFormData.name,
        description: teamFormData.description,
        team_lead: teamFormData.teamLead?.displayName || teamFormData.teamLead?.display_name || '',
        teamLeadUser: teamFormData.teamLead, // Store the full user object
        department: teamFormData.department,
        color: teamFormData.color,
        manager: editingTeam?.manager || teamFormData.teamLead || null,
        members: editingTeam?.members || []
      };
      
      await onSaveTeam(teamData);
      showNotification(editingTeam ? 'Team updated successfully' : 'Team created successfully');
      resetTeamForm();
      setActiveSubTab('list');
      if (onRefresh) onRefresh();
    } catch (error) {
      showNotification('Failed to save team', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete the team "${teamName}"? This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await onDeleteTeam(teamId);
      showNotification('Team deleted successfully');
      if (onRefresh) onRefresh();
    } catch (error) {
      showNotification('Failed to delete team', 'error');
    } finally {
      setLoading(false);
    }
  };

  // User handlers
  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserFormData({
      firstName: user.first_name || user.firstName || '',
      lastName: user.last_name || user.lastName || '',
      displayName: user.display_name || user.displayName || '',
      jiraAccountId: user.jira_account_id || user.accountId || '',
      employmentType: user.employment_type || user.employmentType || 'full-time',
      hireDate: user.hire_date || user.hireDate || '',
      teamId: user.team_id || user.teamId || '',
      capacity: user.capacity || 40
    });
    
    // Load user's availability if available
    if (user.availability && Array.isArray(user.availability)) {
      setAvailabilityData(user.availability);
    }
    
    setActiveTab('users');
    setActiveSubTab('form');
  };

  const handleUserInputChange = (field, value) => {
    setUserFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleAvailabilityChange = (dayIndex, field, value) => {
    setAvailabilityData(prev => {
      const updated = [...prev];
      updated[dayIndex] = { ...updated[dayIndex], [field]: value };
      
      // Auto-calculate hours if start/end time changes
      if (field === 'startTime' || field === 'endTime') {
        const day = updated[dayIndex];
        if (day.startTime && day.endTime && day.isWorkingDay) {
          const start = new Date(`2000-01-01T${day.startTime}`);
          const end = new Date(`2000-01-01T${day.endTime}`);
          const hours = (end - start) / (1000 * 60 * 60);
          updated[dayIndex].hoursPerDay = Math.max(0, hours);
        }
      }
      
      // Clear hours if not working day
      if (field === 'isWorkingDay' && !value) {
        updated[dayIndex].startTime = '';
        updated[dayIndex].endTime = '';
        updated[dayIndex].hoursPerDay = 0;
      }
      
      return updated;
    });
  };

  const validateUserForm = () => {
    const newErrors = {};
    if (!userFormData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!userFormData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!validateUserForm()) return;
    
    setLoading(true);
    try {
      const userData = {
        id: editingUser?.id,
        first_name: userFormData.firstName,
        last_name: userFormData.lastName,
        display_name: userFormData.displayName,
        jira_account_id: userFormData.jiraAccountId,
        employment_type: userFormData.employmentType,
        hire_date: userFormData.hireDate,
        team_id: userFormData.teamId,
        capacity: userFormData.capacity,
        availability: availabilityData
      };
      
      await onSaveUser(userData);
      showNotification(editingUser ? 'User updated successfully' : 'User created successfully');
      resetUserForm();
      setActiveSubTab('list');
      if (onRefresh) onRefresh();
    } catch (error) {
      showNotification('Failed to save user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete the user "${userName}"? This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await onDeleteUser(userId);
      showNotification('User deleted successfully');
      if (onRefresh) onRefresh();
    } catch (error) {
      showNotification('Failed to delete user', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Get team members
  const getTeamMembers = (teamId) => {
    return users.filter(user => user.team_id === teamId || user.teamId === teamId);
  };

  // Get users without a team
  const getUsersWithoutTeam = () => {
    return users.filter(user => !user.team_id && !user.teamId);
  };

  if (!isOpen) return null;

  const colorOptions = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', 
    '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f'
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content team-management-modal">
        <div className="modal-header">
          <h3>Team & User Management</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Main Tab Navigation */}
          <div className="main-tab-navigation">
            <button 
              className={`main-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('teams');
                setActiveSubTab('list');
                resetTeamForm();
                resetUserForm();
              }}
            >
              👥 Teams ({teams.length})
            </button>
            <button 
              className={`main-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('users');
                setActiveSubTab('list');
                resetTeamForm();
                resetUserForm();
              }}
            >
              👤 Users ({users.length})
            </button>
          </div>

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <>
              <div className="sub-tab-navigation">
                <button 
                  className={`tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('list')}
                >
                  Teams List
                </button>
                <button 
                  className={`tab-btn ${activeSubTab === 'form' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubTab('form');
                    resetTeamForm();
                  }}
                >
                  {editingTeam ? 'Edit Team' : 'Add New Team'}
                </button>
              </div>

              {activeSubTab === 'list' && (
                <div className="teams-section">
                  {teams.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <h4>No Teams Created</h4>
                      <p>Create your first team to organize your resources</p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => {
                          resetTeamForm();
                          setActiveSubTab('form');
                        }}
                      >
                        Create First Team
                      </button>
                    </div>
                  ) : (
                    <div className="teams-grid">
                      {teams.map(team => {
                        const teamMembers = getTeamMembers(team.id);
                        return (
                          <div key={team.id} className="team-card" style={{ borderLeftColor: team.color }}>
                            <div className="team-header">
                              <h4>{team.name}</h4>
                              <div className="team-actions">
                                <button 
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => handleEditTeam(team)}
                                  disabled={loading}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteTeam(team.id, team.name)}
                                  disabled={loading}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            
                            {team.description && (
                              <p className="team-description">{team.description}</p>
                            )}
                            
                            <div className="team-meta">
                              {team.department && (
                                <span className="team-department">📁 {team.department}</span>
                              )}
                              {(team.team_lead || team.manager?.displayName) && (
                                <span className="team-lead">👤 {team.team_lead || team.manager?.displayName}</span>
                              )}
                              <span className="member-count">
                                {teamMembers.length} members
                              </span>
                            </div>

                            {/* Team Members Preview */}
                            {teamMembers.length > 0 && (
                              <div className="team-members-preview">
                                <h5>Members:</h5>
                                <div className="members-list">
                                  {teamMembers.slice(0, 3).map(member => (
                                    <div key={member.id} className="member-preview">
                                      <div className="member-avatar-small">
                                        {member.avatar_url || member.avatarUrl ? (
                                          <img src={member.avatar_url || member.avatarUrl} alt={member.display_name || member.displayName} />
                                        ) : (
                                          <div className="avatar-placeholder-small">
                                            {(member.display_name || member.displayName || member.name)?.charAt(0) || '?'}
                                          </div>
                                        )}
                                      </div>
                                      <span className="member-name-small">
                                        {member.display_name || member.displayName || member.name}
                                      </span>
                                    </div>
                                  ))}
                                  {teamMembers.length > 3 && (
                                    <div className="more-members">
                                      +{teamMembers.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === 'form' && (
                <form onSubmit={handleTeamSubmit} className="team-form">
                  <div className="form-group">
                    <label htmlFor="team-name">Team Name *</label>
                    <input
                      type="text"
                      id="team-name"
                      className={`form-control ${errors.name ? 'error' : ''}`}
                      value={teamFormData.name}
                      onChange={(e) => handleTeamInputChange('name', e.target.value)}
                      placeholder="Enter team name"
                      disabled={loading}
                    />
                    {errors.name && <span className="error-text">{errors.name}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="team-description">Description</label>
                    <textarea
                      id="team-description"
                      className="form-control"
                      value={teamFormData.description}
                      onChange={(e) => handleTeamInputChange('description', e.target.value)}
                      placeholder="Brief description of the team's purpose"
                      rows="3"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="team-lead">Team Lead</label>
                      <UserPicker
                        selectedUser={teamFormData.teamLead}
                        onSelect={handleTeamLeadChange}
                        placeholder="Search and select team lead"
                        disabled={loading}
                        error={errors.teamLead}
                      />
                      {errors.teamLead && <span className="error-text">{errors.teamLead}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="department">Department</label>
                      <select
                        id="department"
                        className="form-control"
                        value={teamFormData.department}
                        onChange={(e) => handleTeamInputChange('department', e.target.value)}
                        disabled={loading}
                      >
                        <option value="">Select Department</option>
                        {departmentOptions.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Team Color</label>
                    <div className="color-options">
                      {colorOptions.map(color => (
                        <div
                          key={color}
                          className={`color-option ${teamFormData.color === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => !loading && handleTeamInputChange('color', color)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : (editingTeam ? 'Update Team' : 'Create Team')}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        resetTeamForm();
                        setActiveSubTab('list');
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <>
              <div className="sub-tab-navigation">
                <button 
                  className={`tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('list')}
                >
                  Users List
                </button>
                <button 
                  className={`tab-btn ${activeSubTab === 'form' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubTab('form');
                    resetUserForm();
                  }}
                >
                  {editingUser ? 'Edit User' : 'Add New User'}
                </button>
              </div>

              {activeSubTab === 'list' && (
                <div className="users-section">
                  {users.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">👤</div>
                      <h4>No Users Created</h4>
                      <p>Add your first team member to get started</p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => {
                          resetUserForm();
                          setActiveSubTab('form');
                        }}
                      >
                        Add First User
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Users by Team */}
                      {teams.map(team => {
                        const teamMembers = getTeamMembers(team.id);
                        if (teamMembers.length === 0) return null;
                        
                        return (
                          <div key={team.id} className="team-users-section">
                            <h4 style={{ color: team.color }}>
                              {team.name} ({teamMembers.length} members)
                            </h4>
                            <div className="users-grid">
                              {teamMembers.map(user => (
                                <div key={user.id} className="user-card">
                                  <div className="user-avatar">
                                    {user.avatar_url || user.avatarUrl ? (
                                      <img src={user.avatar_url || user.avatarUrl} alt={user.display_name || user.displayName} />
                                    ) : (
                                      <div className="avatar-placeholder">
                                        {(user.display_name || user.displayName || user.name)?.charAt(0) || '?'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="user-info">
                                    <h5>{user.display_name || user.displayName || user.name}</h5>
                                    <p className="user-role">{(user.employment_type || user.employmentType)?.replace('-', ' ')}</p>
                                    <div className="user-capacity">
                                      {user.capacity || 40}h/week capacity
                                    </div>
                                  </div>
                                  <div className="user-actions">
                                    <button 
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => handleEditUser(user)}
                                      disabled={loading}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleDeleteUser(user.id, user.display_name || user.displayName || user.name)}
                                      disabled={loading}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Users without Team */}
                      {getUsersWithoutTeam().length > 0 && (
                        <div className="team-users-section">
                          <h4 style={{ color: '#6c757d' }}>
                            Unassigned Users ({getUsersWithoutTeam().length})
                          </h4>
                          <div className="users-grid">
                            {getUsersWithoutTeam().map(user => (
                              <div key={user.id} className="user-card">
                                <div className="user-avatar">
                                  {user.avatar_url || user.avatarUrl ? (
                                    <img src={user.avatar_url || user.avatarUrl} alt={user.display_name || user.displayName} />
                                  ) : (
                                    <div className="avatar-placeholder">
                                      {(user.display_name || user.displayName || user.name)?.charAt(0) || '?'}
                                    </div>
                                  )}
                                </div>
                                <div className="user-info">
                                  <h5>{user.display_name || user.displayName || user.name}</h5>
                                  <p className="user-role">{(user.employment_type || user.employmentType)?.replace('-', ' ')}</p>
                                  <div className="user-capacity">
                                    {user.capacity || 40}h/week capacity
                                  </div>
                                </div>
                                <div className="user-actions">
                                  <button 
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleEditUser(user)}
                                    disabled={loading}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteUser(user.id, user.display_name || user.displayName || user.name)}
                                    disabled={loading}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeSubTab === 'form' && (
                <form onSubmit={handleUserSubmit} className="user-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="firstName">First Name *</label>
                      <input
                        type="text"
                        id="firstName"
                        className={`form-control ${errors.firstName ? 'error' : ''}`}
                        value={userFormData.firstName}
                        onChange={(e) => handleUserInputChange('firstName', e.target.value)}
                        placeholder="Enter first name"
                        disabled={loading}
                      />
                      {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="lastName">Last Name *</label>
                      <input
                        type="text"
                        id="lastName"
                        className={`form-control ${errors.lastName ? 'error' : ''}`}
                        value={userFormData.lastName}
                        onChange={(e) => handleUserInputChange('lastName', e.target.value)}
                        placeholder="Enter last name"
                        disabled={loading}
                      />
                      {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="displayName">Display Name</label>
                    <input
                      type="text"
                      id="displayName"
                      className="form-control"
                      value={userFormData.displayName}
                      onChange={(e) => handleUserInputChange('displayName', e.target.value)}
                      placeholder="Display name (auto-generated from first/last name)"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="employmentType">Employment Type</label>
                      <select
                        id="employmentType"
                        className="form-control"
                        value={userFormData.employmentType}
                        onChange={(e) => handleUserInputChange('employmentType', e.target.value)}
                        disabled={loading}
                      >
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                        <option value="contractor">Contractor</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="hireDate">Hire Date</label>
                      <input
                        type="date"
                        id="hireDate"
                        className="form-control"
                        value={userFormData.hireDate}
                        onChange={(e) => handleUserInputChange('hireDate', e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="teamId">Team</label>
                    <select
                      id="teamId"
                      className="form-control"
                      value={userFormData.teamId || ''}
                      onChange={(e) => handleUserInputChange('teamId', e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select a team (optional)</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="jiraAccountId">Jira Account ID</label>
                    <input
                      type="text"
                      id="jiraAccountId"
                      className="form-control"
                      value={userFormData.jiraAccountId}
                      onChange={(e) => handleUserInputChange('jiraAccountId', e.target.value)}
                      placeholder="Optional: Link to Jira account"
                      disabled={loading}
                    />
                  </div>

                  {/* Availability Section */}
                  <div className="availability-section">
                    <h4>Working Schedule</h4>
                    <p className="help-text">Set the default working hours for this team member.</p>
                    
                    <div className="availability-grid">
                      {availabilityData.map((day, index) => (
                        <div key={day.dayOfWeek} className="availability-day">
                          <div className="day-header">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={day.isWorkingDay}
                                onChange={(e) => handleAvailabilityChange(index, 'isWorkingDay', e.target.checked)}
                                disabled={loading}
                              />
                              <span className="day-name">{day.dayName}</span>
                            </label>
                          </div>
                          
                          {day.isWorkingDay && (
                            <div className="day-details">
                              <div className="time-inputs">
                                <input
                                  type="time"
                                  value={day.startTime}
                                  onChange={(e) => handleAvailabilityChange(index, 'startTime', e.target.value)}
                                  className="form-control input-small"
                                  disabled={loading}
                                />
                                <span>to</span>
                                <input
                                  type="time"
                                  value={day.endTime}
                                  onChange={(e) => handleAvailabilityChange(index, 'endTime', e.target.value)}
                                  className="form-control input-small"
                                  disabled={loading}
                                />
                              </div>
                              <div className="hours-display">
                                {day.hoursPerDay.toFixed(1)} hours
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="availability-summary">
                      <strong>Total weekly capacity: </strong>
                      {availabilityData.reduce((total, day) => total + (day.isWorkingDay ? day.hoursPerDay : 0), 0).toFixed(1)} hours
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        resetUserForm();
                        setActiveSubTab('list');
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeamManagementModal;