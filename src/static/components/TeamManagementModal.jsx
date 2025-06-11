import React from 'react';
import { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import UserPicker from './UserPicker';
import { User, UserPlus, Download, RefreshCw, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';

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

  // Jira users import state
  const [jiraUsers, setJiraUsers] = useState([]);
  const [jiraUsersLoading, setJiraUsersLoading] = useState(false);
  const [jiraUsersPagination, setJiraUsersPagination] = useState({
    startAt: 0,
    maxResults: 50,
    total: 0,
    isLast: true
  });
  const [selectedJiraUsers, setSelectedJiraUsers] = useState([]);
  const [importingUsers, setImportingUsers] = useState(false);

  // Team form data
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    description: '',
    manager: null,
    department: '',
    color: '#667eea'
  });

  // User form data
  const [userFormData, setUserFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    emailAddress: '',
    jiraAccountId: '',
    employmentType: 'full-time',
    hireDate: '',
    teamMemberships: [],
    capacity: 40,
    manager: '',
    executiveManager: ''
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

  // Department options
  const departmentOptions = [
    'Product',
    'Devops', 
    'RebelCare',
    'Strategy',
    'Service Delivery',
    'Client Services',
    'Sales',
    'Marketing',
    'Operations',
    'Finance',
    'HR'
    
  ];

  // Add state for bulk role
  const [bulkRole, setBulkRole] = useState('Member');

  // Load Jira users when import tab is activated
  useEffect(() => {
    if (activeTab === 'users' && activeSubTab === 'import') {
      loadJiraUsers(0);
    }
  }, [activeTab, activeSubTab]);

  // Load Jira users with pagination
  const loadJiraUsers = async (startAt = 0) => {
    if (startAt === 0) {
      setJiraUsersLoading(true);
      setJiraUsers([]); // Clear existing users when starting fresh
    }
    
    try {
      const response = await invoke('getInternalJiraUsers', {
        startAt,
        maxResults: 50
      });
      
      if (response.success && response.data) {
        const { users: newUsers, total, isLast } = response.data;
        
        setJiraUsers(prev => [...prev, ...(newUsers || [])]);
        setJiraUsersPagination({
          startAt,
          maxResults: 50,
          total: total || 0,
          isLast: isLast !== false
        });

        // If there are more pages and this is the first load, automatically load them
        if (!isLast) {
          const nextStartAt = startAt + 50;
          await loadJiraUsers(nextStartAt);
        }
      } else {
        throw new Error(response.message || 'Failed to load Jira users');
      }
    } catch (error) {
      if (startAt === 0) { // Only show error for first page
        showNotification('Failed to load Jira users: ' + error.message, 'error');
        setJiraUsers([]);
      }
    } finally {
      if (startAt === 0 || jiraUsersLoading) {
        setJiraUsersLoading(false);
      }
    }
  };

  // Get users not in system
  const getUsersNotInSystem = () => {
    // Create a set of existing user identifiers
    const systemIdentifiers = new Set();
    
    users.forEach(user => {
      if (user.jira_account_id) systemIdentifiers.add(user.jira_account_id);
      if (user.accountId) systemIdentifiers.add(user.accountId);
      if (user.email_address) systemIdentifiers.add(user.email_address.toLowerCase());
      if (user.emailAddress) systemIdentifiers.add(user.emailAddress.toLowerCase());
    });
    
    // Filter out users that exist in the system
    return jiraUsers.filter(jiraUser => {
      // Skip inactive users
      if (jiraUser.active === false) return false;
      
      const jiraAccountId = jiraUser.accountId;
      const jiraEmail = jiraUser.emailAddress?.toLowerCase();
      
      // Only show users that are not in the system by either account ID or email
      return !systemIdentifiers.has(jiraAccountId) && 
             (jiraEmail ? !systemIdentifiers.has(jiraEmail) : true);
    });
  };

  // Handle Jira user selection
  const handleJiraUserSelection = (jiraUser, selected) => {
    setSelectedJiraUsers(prev => {
      if (selected) {
        return [...prev, jiraUser];
      } else {
        return prev.filter(user => user.accountId !== jiraUser.accountId);
      }
    });
  };

  // Handle bulk import of selected Jira users
  const handleBulkImportUsers = async () => {
    if (selectedJiraUsers.length === 0) {
      showNotification('Please select users to import', 'error');
      return;
    }

    setImportingUsers(true);
    try {
      const existingIds = users.map(user => 
        user.jira_account_id || user.email_address
      ).filter(Boolean);

      const usersToImport = selectedJiraUsers.filter(jiraUser => 
        !existingIds.includes(jiraUser.accountId) && 
        !existingIds.includes(jiraUser.emailAddress)
      );

      const response = await invoke('bulkImportUsersFromJira', {
        selectedUserIds: usersToImport.map(user => user.accountId),
        defaultTeamId: null,
        defaultDepartment: ''
      });

      if (response.success) {
        const { importedCount, skippedCount } = response.data;
        showNotification(
          `Successfully imported ${importedCount} users. ${skippedCount > 0 ? `${skippedCount} users were already in the system.` : ''}`,
          'success'
        );
        setSelectedJiraUsers([]);
        if (onRefresh) onRefresh();
        // Refresh Jira users list to update availability
        loadJiraUsers(0);
      } else {
        throw new Error(response.message || 'Failed to import users');
      }
    } catch (error) {
      showNotification('Failed to import users: ' + error.message, 'error');
    } finally {
      setImportingUsers(false);
    }
  };

  // Handle creating user from Jira
  const handleCreateUserFromJira = (jiraUser) => {
    setUserFormData({
      firstName: jiraUser.displayName?.split(' ')[0] || '',
      lastName: jiraUser.displayName?.split(' ').slice(1).join(' ') || '',
      displayName: jiraUser.displayName || '',
      emailAddress: jiraUser.emailAddress || '',
      jiraAccountId: jiraUser.accountId || '',
      employmentType: 'full-time',
      hireDate: '',
      teamMemberships: [],
      capacity: 40,
      manager: '',
      executiveManager: ''
    });
    setEditingUser(null);
    setActiveSubTab('form');
  };

  // Reset forms
  const resetTeamForm = () => {
    setTeamFormData({
      name: '',
      description: '',
      manager: null,
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
      emailAddress: '',
      jiraAccountId: '',
      employmentType: 'full-time',
      hireDate: '',
      teamMemberships: [],
      capacity: 40,
      manager: '',
      executiveManager: ''
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
    let manager = null;
    if (team.manager) {
      manager = users.find(
        u =>
          u.jira_account_id === team.manager ||
          u.accountId === team.manager ||
          u.id === team.manager
      ) || null;
    }
    setTeamFormData({
      name: team.name || '',
      description: team.description || '',
      manager: manager,
      department: team.department || '',
      color: team.color || '#667eea'
    });
    setActiveSubTab('form');
  };

  const handleManagerChange = async (manager) => {
    setTeamFormData(prev => ({
      ...prev,
      manager
    }));
  };

  const handleTeamInputChange = (field, value) => {
    setTeamFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
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
        manager: teamFormData.manager
          ? (teamFormData.manager.jira_account_id || teamFormData.manager.accountId || teamFormData.manager.id || null)
          : null,
        department: teamFormData.department,
        color: teamFormData.color,
        members: editingTeam?.members || []
      };
      
      console.log('Submitting team:', teamData);
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
      emailAddress: user.email_address || user.emailAddress || '',
      jiraAccountId: user.jira_account_id || user.accountId || '',
      employmentType: user.employment_type || user.employmentType || 'full-time',
      hireDate: user.hire_date || user.hireDate || '',
      teamMemberships: user.team_memberships || [],
      capacity: user.capacity || 40,
      isAdmin: user.isAdmin === true,
      manager: user.manager || '',
      executiveManager: user.executive_manager || ''
    });
    
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
      
      if (field === 'startTime' || field === 'endTime') {
        const day = updated[dayIndex];
        if (day.startTime && day.endTime && day.isWorkingDay) {
          const start = new Date(`2000-01-01T${day.startTime}`);
          const end = new Date(`2000-01-01T${day.endTime}`);
          const hours = (end - start) / (1000 * 60 * 60);
          updated[dayIndex].hoursPerDay = Math.max(0, hours);
        }
      }
      
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
      const prevIsAdmin = editingUser?.isAdmin === true;
      const newIsAdmin = userFormData.isAdmin === true;
      const userData = {
        id: editingUser?.id,
        first_name: userFormData.firstName,
        last_name: userFormData.lastName,
        display_name: userFormData.displayName,
        email_address: userFormData.emailAddress,
        jira_account_id: userFormData.jiraAccountId,
        employment_type: userFormData.employmentType,
        hire_date: userFormData.hireDate,
        team_memberships: userFormData.teamMemberships,
        capacity: userFormData.capacity,
        availability: availabilityData,
        isAdmin: newIsAdmin,
        manager: userFormData.manager,
        executive_manager: userFormData.executiveManager
      };
      
      console.log('Submitting user:', userData);
      await onSaveUser(userData);
      // Sync admin status with backend admin list
      if (newIsAdmin && !prevIsAdmin) {
        await invoke('addAdminUser', {
          accountId: userData.jira_account_id || userData.id || userData.accountId,
          addedBy: currentUser?.accountId
        });
      } else if (!newIsAdmin && prevIsAdmin) {
        await invoke('removeAdminUser', {
          accountId: userData.jira_account_id || userData.id || userData.accountId,
          removedBy: currentUser?.accountId
        });
      }
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
    return users.filter(user => (user.team_memberships || []).some(m => m.team_id === teamId));
  };

  // Get users without a team
  const getUsersWithoutTeam = () => {
    return users.filter(user => !user.team_memberships || user.team_memberships.length === 0);
  };

  // Add state for selected users and bulk team assignment
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkTeamModal, setShowBulkTeamModal] = useState(false);
  const [bulkTeamId, setBulkTeamId] = useState('');

  // Add function to check if team has manager
  const teamHasManager = (teamId) => {
    return users.some(user => 
      (user.team_memberships || []).some(m => 
        m.team_id === teamId && m.role === 'Manager'
      )
    );
  };

  // Add export function
  const handleExport = () => {
    const exportData = {
      teams: teams.map(team => ({
        name: team.name,
        description: team.description,
        department: team.department,
        color: team.color
      })),
      users: users.map(user => ({
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        emailAddress: user.email_address,
        employmentType: user.employment_type,
        hireDate: user.hire_date,
        teamMemberships: user.team_memberships || []
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-user-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to CSV with Jira accountId as user id
  const columns = [
    'type', 'id', 'name', 'jira_account_id', 'first_name', 'last_name', 'display_name',
    'email', 'employment_type', 'hire_date', 'team_memberships', 'capacity',
    'department', 'description', 'color', 'manager', 'executive_manager', 'isAdmin'
  ];

  const handleExportCSV = () => {
    const teamRows = teams.map(team => ({
      type: 'team',
      id: team.id,
      name: team.name,
      jira_account_id: '',
      first_name: '',
      last_name: '',
      display_name: '',
      email: '',
      employment_type: '',
      hire_date: '',
      team_memberships: '',
      capacity: '',
      department: team.department || '',
      description: team.description || '',
      color: team.color || '',
      manager: team.manager || '',
      executive_manager: '',
      isAdmin: ''
    }));

    const userRows = users.map(user => ({
      type: 'user',
      id: user.id,
      name: user.name || user.display_name || '',
      jira_account_id: user.jira_account_id || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      display_name: user.display_name || '',
      email: user.email_address || '',
      employment_type: user.employment_type || '',
      hire_date: user.hire_date || '',
      team_memberships: (user.team_memberships || [])
        .map(tm => `${teams.find(t => t.id === tm.team_id)?.name || tm.team_id}:${tm.role}`)
        .join(','),
      capacity: user.capacity || '',
      department: user.department || '',
      description: '',
      color: '',
      manager: user.manager || '',
      executive_manager: user.executive_manager || '',
      isAdmin: user.isAdmin === true ? 'TRUE' : 'FALSE'
    }));

    const allRows = [...teamRows, ...userRows];
    const csv = Papa.unparse(allRows, { columns });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teams-and-users-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Add a helper to generate unique IDs
  const generateId = () => {
    return (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : 'team-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  };

  // Import from CSV with Jira accountId as user id
  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setLoading(true);
        try {
          const teamsToImport = [];
          const usersToImport = [];
          for (const row of results.data) {
            if (row.type === 'team') {
              teamsToImport.push({
                id: row.id || generateId(),
                name: row.name,
                department: row.department,
                description: row.description,
                color: row.color,
                manager: row.manager
              });
            } else if (row.type === 'user') {
              let team_memberships = [];
              if (row.team_memberships) {
                team_memberships = row.team_memberships.split(',').map(pair => {
                  const [teamName, role] = pair.split(':');
                  const team = teams.find(t => t.name === teamName.trim());
                  return {
                    team_id: team ? team.id : teamName.trim(),
                    role: (role || 'Member').trim()
                  };
                });
              }
              usersToImport.push({
                id: row.id,
                name: row.name,
                jira_account_id: row.jira_account_id,
                displayName: row.display_name,
                first_name: row.first_name,
                last_name: row.last_name,
                emailAddress: row.email,
                department: row.department,
                hireDate: row.hire_date,
                employmentType: row.employment_type,
                team_memberships,
                capacity: row.capacity,
                isAdmin: row.isAdmin === 'TRUE' || row.isAdmin === 'true',
                manager: row.manager || '',
                executive_manager: row.executive_manager || ''
              });
            }
          }

          // Fetch all existing teams before import
          const existingTeamsResponse = await invoke('getTeams');
          const existingTeams = existingTeamsResponse.success ? existingTeamsResponse.data : [];

          // Import teams first (update if id exists)
          for (const teamData of teamsToImport) {
            const existingTeam = existingTeams.find(t => t.id === teamData.id);
            if (existingTeam) {
              await invoke('updateTeam', teamData);
            } else {
              await invoke('createTeam', teamData);
            }
          }

          // Then import users (update if id exists)
          for (const userData of usersToImport) {
            await onSaveUser(userData); // onSaveUser should handle update vs create by id (jira_account_id)
          }

          showNotification('CSV import completed successfully');
          if (onRefresh) onRefresh();
        } catch (error) {
          showNotification('Failed to import CSV: ' + error.message, 'error');
        } finally {
          setLoading(false);
          event.target.value = '';
        }
      }
    });
  };

  // Add bulk delete handler
  const handleBulkDeleteUsers = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedUserIds.length} users? This action cannot be undone.`)) {
      return;
    }
    setLoading(true);
    try {
      for (const userId of selectedUserIds) {
        await onDeleteUser(userId);
      }
      showNotification(`${selectedUserIds.length} users deleted successfully`);
      setSelectedUserIds([]);
      if (onRefresh) onRefresh();
    } catch (error) {
      showNotification('Failed to delete users: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const colorOptions = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', 
    '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f'
  ];

  const usersNotInSystem = getUsersNotInSystem();

  const normalizeManager = (manager) => {
    if (!manager) return null;
    return {
      ...manager,
      accountId: manager.accountId || manager.jira_account_id || manager.id,
      displayName: manager.displayName || manager.display_name || manager.name,
      emailAddress: manager.emailAddress || manager.email_address,
      avatarUrl: manager.avatarUrl || manager.avatar_url,
    };
  };

  const getManagerName = (managerId) => {
    if (!managerId) return '-';
    const user = users.find(
      u =>
        u.jira_account_id === managerId ||
        u.accountId === managerId ||
        u.id === managerId
    );
    return user ? (user.display_name || user.displayName || user.name) : managerId;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content team-management-modal">
        <div className="modal-header">
          <h3>Team & User Management</h3>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={handleExportCSV} disabled={loading}>
              <Download size={16} /> Export CSV
            </button>
            <label className="btn btn-secondary" style={{ marginLeft: 8 }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                style={{ display: 'none' }}
                disabled={loading}
              />
              <UserPlus size={16} /> Import CSV
            </label>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="modal-body">
          {/* Main Tab Navigation */}
          <div className="team-management-main-tabs">
            <button 
              className={`team-management-main-tab ${activeTab === 'teams' ? 'team-management-main-tab-active' : ''}`}
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
              className={`team-management-main-tab ${activeTab === 'users' ? 'team-management-main-tab-active' : ''}`}
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
              <div className="team-management-sub-tabs">
                <button 
                  className={`team-management-sub-tab ${activeSubTab === 'list' ? 'team-management-sub-tab-active' : ''}`}
                  onClick={() => setActiveSubTab('list')}
                >
                  Teams List
                </button>
                <button 
                  className={`team-management-sub-tab ${activeSubTab === 'form' ? 'team-management-sub-tab-active' : ''}`}
                  onClick={() => {
                    setActiveSubTab('form');
                    resetTeamForm();
                  }}
                >
                  {editingTeam ? 'Edit Team' : 'Add New Team'}
                </button>
              </div>

              {activeSubTab === 'list' && (
                <div className="team-management-teams-section">
                  {teams.length === 0 ? (
                    <div className="team-management-empty-state">
                      <div className="team-management-empty-icon">👥</div>
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
                    <div className="requests-table-wrapper">
                      <table className="requests-table">
                        <thead>
                          <tr>
                            <th>Team Name</th>
                            <th>Department</th>
                            <th>Manager</th>
                            <th>Members</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teams.map(team => {
                            const teamMembers = getTeamMembers(team.id);
                            return (
                              <tr key={team.id}>
                                <td>{team.name}</td>
                                <td>{team.department || '-'}</td>
                                <td>{getManagerName(team.manager)}</td>
                                <td>{teamMembers.length}</td>
                                <td>
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
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === 'form' && (
                <form onSubmit={handleTeamSubmit} className="team-management-team-form">
                  <div className="form-group">
                    <label htmlFor="team-name">Team Name *</label>
                    <input
                      type="text"
                      id="team-name"
                      className={`form-control ${errors.name ? 'form-control-error' : ''}`}
                      value={teamFormData.name}
                      onChange={(e) => handleTeamInputChange('name', e.target.value)}
                      placeholder="Enter team name"
                      disabled={loading}
                    />
                    {errors.name && <span className="form-error-text">{errors.name}</span>}
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
                      <label htmlFor="team-manager">Manager</label>
                      <UserPicker
                        selectedUser={teamFormData.manager ? users.find(u => u.id === teamFormData.manager) || null : null}
                        onSelect={user => handleManagerChange(user ? user.id : '')}
                        placeholder="Search and select manager"
                        disabled={loading}
                        error={errors.manager}
                        useBackendSearch={false}
                        allUsers={users}
                      />
                      {errors.manager && <span className="form-error-text">{errors.manager}</span>}
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
                    <div className="team-management-color-options">
                      {colorOptions.map(color => (
                        <div
                          key={color}
                          className={`team-management-color-option ${teamFormData.color === color ? 'team-management-color-option-selected' : ''}`}
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
              <div className="team-management-sub-tabs">
                <button 
                  className={`team-management-sub-tab ${activeSubTab === 'list' ? 'team-management-sub-tab-active' : ''}`}
                  onClick={() => setActiveSubTab('list')}
                >
                  Users List
                </button>
                <button 
                  className={`team-management-sub-tab ${activeSubTab === 'form' ? 'team-management-sub-tab-active' : ''}`}
                  onClick={() => {
                    setActiveSubTab('form');
                    resetUserForm();
                  }}
                >
                  {editingUser ? 'Edit User' : 'Add New User'}
                </button>
                <button 
                  className={`team-management-sub-tab ${activeSubTab === 'import' ? 'team-management-sub-tab-active' : ''}`}
                  onClick={() => setActiveSubTab('import')}
                >
                  Import from Jira ({usersNotInSystem.length})
                </button>
              </div>

              {activeSubTab === 'list' && (
                <div className="team-management-users-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4>Users</h4>
                    <button
                      className="btn btn-primary"
                      disabled={selectedUserIds.length === users.length && users.length > 0}
                      onClick={() => setShowBulkTeamModal(true)}
                    >
                      Bulk Add to Team
                    </button>
                  </div>
                  {selectedUserIds.length > 0 && (
                    <button
                      className="btn btn-danger"
                      onClick={handleBulkDeleteUsers}
                      disabled={loading}
                      style={{ marginBottom: 16 }}
                    >
                      Delete Selected Users ({selectedUserIds.length})
                    </button>
                  )}
                  <div className="requests-table-wrapper">
                    <table className="requests-table">
                      <thead>
                        <tr>
                          <th><input type="checkbox" checked={selectedUserIds.length === users.length && users.length > 0} onChange={e => setSelectedUserIds(e.target.checked ? users.map(u => u.id) : [])} /></th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Teams</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => (
                          <tr key={user.id}>
                            <td><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={e => setSelectedUserIds(e.target.checked ? [...selectedUserIds, user.id] : selectedUserIds.filter(id => id !== user.id))} /></td>
                            <td>{user.display_name || user.displayName || user.name}</td>
                            <td>{user.email_address || user.emailAddress || '-'}</td>
                            <td>{(user.team_memberships || []).map(tm => {
                              const t = teams.find(team => team.id === tm.team_id);
                              return t ? `${t.name} (${tm.role})` : tm.team_id;
                            }).join(', ')}</td>
                            <td>
                              <button className="btn btn-sm btn-secondary" onClick={() => handleEditUser(user)} disabled={loading}>Edit</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(user.id, user.display_name || user.displayName || user.name)} disabled={loading}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Bulk Add to Team Modal */}
                  {showBulkTeamModal && (
                    <div className="modal-overlay">
                      <div className="modal-content" style={{ maxWidth: 400, margin: 'auto', padding: 24 }}>
                        <h4>Add Selected Users to Team</h4>
                        <div className="form-group">
                          <label>Team</label>
                          <select 
                            className="form-control" 
                            value={bulkTeamId} 
                            onChange={e => {
                              setBulkTeamId(e.target.value);
                              if (teamHasManager(e.target.value)) {
                                setBulkRole('Member');
                              }
                            }}
                          >
                            <option value="">Select a team</option>
                            {teams.map(team => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Role</label>
                          <select 
                            className="form-control" 
                            value={bulkRole} 
                            onChange={e => setBulkRole(e.target.value)}
                            disabled={bulkTeamId && teamHasManager(bulkTeamId)}
                          >
                            <option value="Member">Member</option>
                            <option value="Manager" disabled={bulkTeamId && teamHasManager(bulkTeamId)}>
                              Manager {bulkTeamId && teamHasManager(bulkTeamId) ? '(Team already has a manager)' : ''}
                            </option>
                          </select>
                        </div>
                        <div className="form-actions" style={{ marginTop: 24 }}>
                          <button className="btn btn-secondary" onClick={() => setShowBulkTeamModal(false)}>Cancel</button>
                          <button
                            className="btn btn-primary"
                            disabled={!bulkTeamId}
                            onClick={async () => {
                              setLoading(true);
                              for (const userId of selectedUserIds) {
                                const user = users.find(u => u.id === userId);
                                if (user && !(user.team_memberships || []).some(tm => tm.team_id === bulkTeamId)) {
                                  await onSaveUser({ 
                                    ...user, 
                                    team_memberships: [...(user.team_memberships || []), { 
                                      team_id: bulkTeamId, 
                                      role: bulkRole 
                                    }] 
                                  });
                                }
                              }
                              setLoading(false);
                              setShowBulkTeamModal(false);
                              setSelectedUserIds([]);
                              setBulkTeamId('');
                              setBulkRole('Member');
                              if (onRefresh) onRefresh();
                            }}
                          >
                            Add to Team
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === 'form' && (
                <form onSubmit={handleUserSubmit} className="team-management-user-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="firstName">First Name *</label>
                      <input
                        type="text"
                        id="firstName"
                        className={`form-control ${errors.firstName ? 'form-control-error' : ''}`}
                        value={userFormData.firstName}
                        onChange={(e) => handleUserInputChange('firstName', e.target.value)}
                        placeholder="Enter first name"
                        disabled={loading}
                      />
                      {errors.firstName && <span className="form-error-text">{errors.firstName}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="lastName">Last Name *</label>
                      <input
                        type="text"
                        id="lastName"
                        className={`form-control ${errors.lastName ? 'form-control-error' : ''}`}
                        value={userFormData.lastName}
                        onChange={(e) => handleUserInputChange('lastName', e.target.value)}
                        placeholder="Enter last name"
                        disabled={loading}
                      />
                      {errors.lastName && <span className="form-error-text">{errors.lastName}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="emailAddress">Email Address</label>
                    <input
                      type="email"
                      id="emailAddress"
                      className={`form-control ${errors.emailAddress ? 'form-control-error' : ''}`}
                      value={userFormData.emailAddress}
                      onChange={(e) => handleUserInputChange('emailAddress', e.target.value)}
                      placeholder="Enter email address"
                      disabled={loading}
                    />
                    {errors.emailAddress && <span className="form-error-text">{errors.emailAddress}</span>}
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
                    <label>Teams & Roles</label>
                    {teams.map(team => {
                      const membership = userFormData.teamMemberships.find(tm => tm.team_id === team.id);
                      const hasManager = users.some(u => (u.team_memberships || []).some(tm => tm.team_id === team.id && tm.role === 'Manager'));
                      return (
                        <div key={team.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <input
                            type="checkbox"
                            checked={!!membership}
                            onChange={e => {
                              if (e.target.checked) {
                                setUserFormData(prev => ({
                                  ...prev,
                                  teamMemberships: [...prev.teamMemberships, { team_id: team.id, role: hasManager ? 'Member' : 'Manager' }]
                                }));
                              } else {
                                setUserFormData(prev => ({
                                  ...prev,
                                  teamMemberships: prev.teamMemberships.filter(tm => tm.team_id !== team.id)
                                }));
                              }
                            }}
                            disabled={loading}
                          />
                          <span style={{ marginLeft: 8, marginRight: 8 }}>{team.name}</span>
                          {membership && (
                            <select
                              value={membership.role}
                              onChange={e => {
                                if (e.target.value === 'Manager' && hasManager) {
                                  showNotification('This team already has a manager', 'error');
                                  return;
                                }
                                setUserFormData(prev => ({
                                  ...prev,
                                  teamMemberships: prev.teamMemberships.map(tm =>
                                    tm.team_id === team.id ? { ...tm, role: e.target.value } : tm
                                  )
                                }));
                              }}
                              style={{ marginLeft: 8 }}
                              disabled={loading || (hasManager && membership.role !== 'Manager')}
                            >
                              <option value="Member">Member</option>
                              <option value="Manager" disabled={hasManager}>
                                Manager {hasManager ? '(Team already has a manager)' : ''}
                              </option>
                            </select>
                          )}
                        </div>
                      );
                    })}
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

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={userFormData.isAdmin === true}
                        onChange={e => setUserFormData(prev => ({ ...prev, isAdmin: e.target.checked }))}
                        disabled={loading}
                      />
                      {' '}Admin User
                    </label>
                  </div>

                  <div className="form-group">
                    <label htmlFor="manager">Manager</label>
                    <UserPicker
                      selectedUser={userFormData.manager ? users.find(u => u.id === userFormData.manager) || null : null}
                      onSelect={user => setUserFormData(prev => ({ ...prev, manager: user ? user.id : '' }))}
                      placeholder="Select manager"
                      users={users}
                      allUsers={users}
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="executiveManager">Executive Manager</label>
                    <UserPicker
                      selectedUser={userFormData.executiveManager ? users.find(u => u.id === userFormData.executiveManager) || null : null}
                      onSelect={user => setUserFormData(prev => ({ ...prev, executiveManager: user ? user.id : '' }))}
                      placeholder="Select executive manager"
                      users={users}
                      allUsers={users}
                      disabled={loading}
                    />
                  </div>

                  {/* Availability Section */}
                  <div className="team-management-availability-section">
                    <h4>Working Schedule</h4>
                    <p className="team-management-help-text">Set the default working hours for this team member.</p>
                    
                    <div className="team-management-availability-grid">
                      {availabilityData.map((day, index) => (
                        <div key={day.dayOfWeek} className="team-management-availability-day">
                          <div className="team-management-day-header">
                            <label className="team-management-checkbox-label">
                              <input
                                type="checkbox"
                                checked={day.isWorkingDay}
                                onChange={(e) => handleAvailabilityChange(index, 'isWorkingDay', e.target.checked)}
                                disabled={loading}
                              />
                              <span className="team-management-day-name">{day.dayName}</span>
                            </label>
                          </div>
                          
                          {day.isWorkingDay && (
                            <div className="team-management-day-details">
                              <div className="team-management-time-inputs">
                                <input
                                  type="time"
                                  value={day.startTime}
                                  onChange={(e) => handleAvailabilityChange(index, 'startTime', e.target.value)}
                                  className="form-control team-management-input-small"
                                  disabled={loading}
                                />
                                <span>to</span>
                                <input
                                  type="time"
                                  value={day.endTime}
                                  onChange={(e) => handleAvailabilityChange(index, 'endTime', e.target.value)}
                                  className="form-control team-management-input-small"
                                  disabled={loading}
                                />
                              </div>
                              <div className="team-management-hours-display">
                                {day.hoursPerDay.toFixed(1)} hours
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="team-management-availability-summary">
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

              {/* Import from Jira Tab */}
              {activeSubTab === 'import' && (
                <div className="team-management-import-section">
                  <div className="team-management-import-header">
                    <div className="team-management-import-title">
                      <h4>Import Users from Jira</h4>
                      <p>Select Jira users to import into the PTO system. Users already in the system will not be shown.</p>
                    </div>
                    <div className="team-management-import-actions">
                      <button
                        onClick={() => loadJiraUsers(0)}
                        disabled={jiraUsersLoading}
                        className="btn btn-secondary"
                      >
                        <RefreshCw size={16} className={jiraUsersLoading ? 'team-management-spin' : ''} />
                        Refresh
                      </button>
                      {selectedJiraUsers.length > 0 && (
                        <button
                          onClick={handleBulkImportUsers}
                          disabled={importingUsers}
                          className="btn btn-primary"
                        >
                          <UserPlus size={16} />
                          Import {selectedJiraUsers.length} Selected
                          {importingUsers && ' (Importing...)'}
                        </button>
                      )}
                    </div>
                  </div>

                  {jiraUsersLoading && jiraUsers.length === 0 ? (
                    <div className="team-management-loading-state">
                      <div className="team-management-loading-spinner"></div>
                      <p>Loading Jira users...</p>
                    </div>
                  ) : usersNotInSystem.length === 0 ? (
                    <div className="team-management-empty-state">
                      <div className="team-management-empty-icon">✅</div>
                      <h4>All Jira Users Imported</h4>
                      <p>All available Jira users from your organization are already in the system.</p>
                    </div>
                  ) : (
                    <>
                      <div className="team-management-import-stats">
                        <div className="team-management-import-stat">
                          <span className="team-management-import-stat-label">Total Jira Users:</span>
                          <span className="team-management-import-stat-value">{jiraUsersPagination.total}</span>
                        </div>
                        <div className="team-management-import-stat">
                          <span className="team-management-import-stat-label">Available to Import:</span>
                          <span className="team-management-import-stat-value">{usersNotInSystem.length}</span>
                        </div>
                        <div className="team-management-import-stat">
                          <span className="team-management-import-stat-label">Selected:</span>
                          <span className="team-management-import-stat-value">{selectedJiraUsers.length}</span>
                        </div>
                      </div>

                      <div className="team-management-jira-users-grid">
                        {usersNotInSystem.map(jiraUser => {
                          const isSelected = selectedJiraUsers.some(user => user.accountId === jiraUser.accountId);
                          return (
                            <div key={jiraUser.accountId} className="team-management-jira-user-card">
                              <div className="team-management-jira-user-header">
                                <label className="team-management-jira-user-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => handleJiraUserSelection(jiraUser, e.target.checked)}
                                    disabled={importingUsers}
                                  />
                                  <span className="team-management-checkbox-custom"></span>
                                </label>
                                <div className="team-management-jira-user-avatar">
                                  {jiraUser.avatarUrl ? (
                                    <img src={jiraUser.avatarUrl} alt={jiraUser.displayName} />
                                  ) : (
                                    <div className="team-management-avatar-placeholder">
                                      {jiraUser.displayName?.charAt(0) || '?'}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="team-management-jira-user-info">
                                <h5 className="team-management-jira-user-name">{jiraUser.displayName}</h5>
                                <div className="team-management-jira-user-email">{jiraUser.emailAddress}</div>
                                <div className="team-management-jira-user-active">
                                  {jiraUser.active ? '✅ Active' : '❌ Inactive'}
                                </div>
                              </div>
                              <div className="team-management-jira-user-actions">
                                <button
                                  onClick={() => handleCreateUserFromJira(jiraUser)}
                                  className="btn btn-sm btn-secondary"
                                  disabled={importingUsers}
                                >
                                  <User size={14} />
                                  Create User
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {!jiraUsersPagination.isLast && (
                        <div className="team-management-pagination">
                          <button
                            onClick={() => loadJiraUsers(jiraUsersPagination.startAt + jiraUsersPagination.maxResults)}
                            disabled={jiraUsersLoading}
                            className="btn btn-secondary"
                          >
                            <ChevronRight size={16} />
                            Load More Users
                            {jiraUsersLoading && ' (Loading...)'}
                          </button>
                          <div className="team-management-pagination-info">
                            Showing {jiraUsers.length} of {jiraUsersPagination.total} Jira users
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamManagementModal;