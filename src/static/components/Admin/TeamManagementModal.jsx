import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { 
  Users, 
  UserPlus, 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Search,
  ChevronDown,
  Calendar,
  Clock,
  Mail,
  User
} from 'lucide-react';
import './team-user-modal-styles.css';

const TeamManagementModal = ({ isOpen, onClose, showNotification, onRefresh }) => {
  // Main state
  const [activeTab, setActiveTab] = useState('teams');
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Team form data matching database schema
  const [teamFormData, setTeamFormData] = useState({
    team_id: '',
    team_name: '',
    team_department: '',
    team_business_unit: '',
    team_manager_name: '',
    team_manager_id: '',
    team_manager_email: '',
    team_executive_manager_name: '',
    team_executive_manager_id: '',
    team_executive_manager_email: ''
  });

  // User form data matching database schema
  const [userFormData, setUserFormData] = useState({
    user_id: '',
    jira_account_id: '',
    display_name: '',
    email_address: '',
    team_memberships: [],
    employment_type: 'full_time',
    capacity: 40,
    standard_availability: {
      monday: { working: true, hours: 8 },
      tuesday: { working: true, hours: 8 },
      wednesday: { working: true, hours: 8 },
      thursday: { working: true, hours: 8 },
      friday: { working: true, hours: 8 },
      saturday: { working: false, hours: 0 },
      sunday: { working: false, hours: 0 }
    },
    isAdmin: false,
    isManager: [],
    isExecutive_Manager: [],
    pto_accountability_type: 'standard_year',
    pto_available_in_the_period: { vacation: 20, holiday: 10, personal: 1 },
    hiring_date: '',
    used_pto_days_in_period: { vacation: 0, holiday: 0, personal: 0 },
    remaining_pto_days_in_period: { vacation: 20, holiday: 10, personal: 1 }
  });

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsResponse, usersResponse] = await Promise.all([
        invoke('getAllTeams'),
        invoke('getAllUsers')
      ]);

      if (teamsResponse.success) {
        setTeams(teamsResponse.data || []);
      }
      if (usersResponse.success) {
        setUsers(usersResponse.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reset forms
  const resetTeamForm = () => {
    setTeamFormData({
      team_id: '',
      team_name: '',
      team_department: '',
      team_business_unit: '',
      team_manager_name: '',
      team_manager_id: '',
      team_manager_email: '',
      team_executive_manager_name: '',
      team_executive_manager_id: '',
      team_executive_manager_email: ''
    });
    setEditingTeam(null);
  };

  const resetUserForm = () => {
    setUserFormData({
      user_id: '',
      jira_account_id: '',
      display_name: '',
      email_address: '',
      team_memberships: [],
      employment_type: 'full_time',
      capacity: 40,
      standard_availability: {
        monday: { working: true, hours: 8 },
        tuesday: { working: true, hours: 8 },
        wednesday: { working: true, hours: 8 },
        thursday: { working: true, hours: 8 },
        friday: { working: true, hours: 8 },
        saturday: { working: false, hours: 0 },
        sunday: { working: false, hours: 0 }
      },
      isAdmin: false,
      isManager: [],
      isExecutive_Manager: [],
      pto_accountability_type: 'standard_year',
      pto_available_in_the_period: { vacation: 20, holiday: 10, personal: 1 },
      hiring_date: '',
      used_pto_days_in_period: { vacation: 0, holiday: 0, personal: 0 },
      remaining_pto_days_in_period: { vacation: 20, holiday: 10, personal: 1 }
    });
    setEditingUser(null);
  };

  // Team operations
  const handleCreateTeam = () => {
    resetTeamForm();
    setShowTeamModal(true);
  };

  const handleEditTeam = (team) => {
    setTeamFormData({
      team_id: team.team_id || team.id,
      team_name: team.team_name || team.name || '',
      team_department: team.team_department || team.department || '',
      team_business_unit: team.team_business_unit || team.business_unit || '',
      team_manager_name: team.team_manager_name || '',
      team_manager_id: team.team_manager_id || '',
      team_manager_email: team.team_manager_email || '',
      team_executive_manager_name: team.team_executive_manager_name || '',
      team_executive_manager_id: team.team_executive_manager_id || '',
      team_executive_manager_email: team.team_executive_manager_email || ''
    });
    setEditingTeam(team);
    setShowTeamModal(true);
  };

  const handleSaveTeam = async () => {
    setLoading(true);
    try {
      const teamData = {
        ...teamFormData,
        updated_at: new Date().toISOString()
      };

      if (editingTeam) {
        teamData.team_id = editingTeam.team_id || editingTeam.id;
      } else {
        teamData.created_at = new Date().toISOString();
      }

      const response = await invoke(editingTeam ? 'updateTeam' : 'createTeam', teamData);
      
      if (response.success) {
        showNotification(`Team ${editingTeam ? 'updated' : 'created'} successfully`, 'success');
        setShowTeamModal(false);
        resetTeamForm();
        loadData();
        onRefresh?.();
      } else {
        showNotification(response.message || 'Error saving team', 'error');
      }
    } catch (error) {
      console.error('Error saving team:', error);
      showNotification('Error saving team', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`Are you sure you want to delete team "${team.team_name || team.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await invoke('deleteTeam', { team_id: team.team_id || team.id });
      
      if (response.success) {
        showNotification('Team deleted successfully', 'success');
        loadData();
        onRefresh?.();
      } else {
        showNotification(response.message || 'Error deleting team', 'error');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      showNotification('Error deleting team', 'error');
    } finally {
      setLoading(false);
    }
  };

  // User operations
  const handleCreateUser = () => {
    resetUserForm();
    setShowUserModal(true);
  };

  const handleEditUser = (user) => {
    setUserFormData({
      user_id: user.user_id || user.id,
      jira_account_id: user.jira_account_id || '',
      display_name: user.display_name || '',
      email_address: user.email_address || '',
      team_memberships: user.team_memberships || [],
      employment_type: user.employment_type || 'full_time',
      capacity: user.capacity || 40,
      standard_availability: user.standard_availability || {
        monday: { working: true, hours: 8 },
        tuesday: { working: true, hours: 8 },
        wednesday: { working: true, hours: 8 },
        thursday: { working: true, hours: 8 },
        friday: { working: true, hours: 8 },
        saturday: { working: false, hours: 0 },
        sunday: { working: false, hours: 0 }
      },
      isAdmin: user.isAdmin || false,
      isManager: user.isManager || [],
      isExecutive_Manager: user.isExecutive_Manager || [],
      pto_accountability_type: user.pto_accountability_type || 'standard_year',
      pto_available_in_the_period: user.pto_available_in_the_period || { vacation: 20, holiday: 10, personal: 1 },
      hiring_date: user.hiring_date || '',
      used_pto_days_in_period: user.used_pto_days_in_period || { vacation: 0, holiday: 0, personal: 0 },
      remaining_pto_days_in_period: user.remaining_pto_days_in_period || { vacation: 20, holiday: 10, personal: 1 }
    });
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    setLoading(true);
    try {
      const userData = {
        ...userFormData,
        updated_at: new Date().toISOString()
      };

      if (editingUser) {
        userData.user_id = editingUser.user_id || editingUser.id;
      } else {
        userData.created_at = new Date().toISOString();
      }

      const response = await invoke(editingUser ? 'updateUser' : 'createUser', userData);
      
      if (response.success) {
        showNotification(`User ${editingUser ? 'updated' : 'created'} successfully`, 'success');
        setShowUserModal(false);
        resetUserForm();
        loadData();
        onRefresh?.();
      } else {
        showNotification(response.message || 'Error saving user', 'error');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showNotification('Error saving user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.display_name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await invoke('deleteUser', { user_id: user.user_id || user.id });
      
      if (response.success) {
        showNotification('User deleted successfully', 'success');
        loadData();
        onRefresh?.();
      } else {
        showNotification(response.message || 'Error deleting user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Error deleting user', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter functions
  const filteredTeams = teams.filter(team => 
    (team.team_name || team.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.team_department || team.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user => 
    (user.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email_address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '1200px', width: '90vw', height: '80vh' }}>
          {/* Header */}
          <div className="modal-header">
            <h2>Teams & Users Management</h2>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs-container">
            <div className="tabs-nav">
              <button 
                className={`tab ${activeTab === 'teams' ? 'active' : ''}`}
                onClick={() => setActiveTab('teams')}
              >
                <Building size={16} />
                Teams ({teams.length})
              </button>
              <button 
                className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={16} />
                Users ({users.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {/* Search and Actions Bar */}
              <div className="action-bar">
                <div className="search-container">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="action-buttons">
                  <button 
                    className="btn btn-primary"
                    onClick={activeTab === 'teams' ? handleCreateTeam : handleCreateUser}
                  >
                    <Plus size={16} />
                    Add {activeTab === 'teams' ? 'Team' : 'User'}
                  </button>
                </div>
              </div>

              {/* Teams Tab */}
              {activeTab === 'teams' && (
                <div className="data-table-container">
                  {loading ? (
                    <div className="loading-state">Loading teams...</div>
                  ) : filteredTeams.length === 0 ? (
                    <div className="empty-state">
                      <Building size={48} />
                      <h3>No teams found</h3>
                      <p>Create your first team to get started</p>
                    </div>
                  ) : (
                    <div className="data-table">
                      <div className="table-header">
                        <div>Team Name</div>
                        <div>Department</div>
                        <div>Business Unit</div>
                        <div>Manager</div>
                        <div>Actions</div>
                      </div>
                      {filteredTeams.map((team) => (
                        <div key={team.team_id || team.id} className="table-row">
                          <div className="cell-primary">
                            <Building size={16} />
                            {team.team_name || team.name}
                          </div>
                          <div>{team.team_department || team.department || '-'}</div>
                          <div>{team.team_business_unit || team.business_unit || '-'}</div>
                          <div>{team.team_manager_name || '-'}</div>
                          <div className="actions-cell">
                            <button 
                              className="btn-icon"
                              onClick={() => handleEditTeam(team)}
                              title="Edit team"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon btn-danger"
                              onClick={() => handleDeleteTeam(team)}
                              title="Delete team"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="data-table-container">
                  {loading ? (
                    <div className="loading-state">Loading users...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                      <User size={48} />
                      <h3>No users found</h3>
                      <p>Add your first user to get started</p>
                    </div>
                  ) : (
                    <div className="data-table">
                      <div className="table-header">
                        <div>Display Name</div>
                        <div>Email</div>
                        <div>Employment Type</div>
                        <div>Teams</div>
                        <div>Admin</div>
                        <div>Actions</div>
                      </div>
                      {filteredUsers.map((user) => (
                        <div key={user.user_id || user.id} className="table-row">
                          <div className="cell-primary">
                            <User size={16} />
                            {user.display_name}
                          </div>
                          <div>{user.email_address || '-'}</div>
                          <div>
                            <span className={`badge ${user.employment_type === 'full_time' ? 'badge-success' : 'badge-warning'}`}>
                              {user.employment_type === 'full_time' ? 'Full Time' : 'Part Time'}
                            </span>
                          </div>
                          <div>{(user.team_memberships || []).length} teams</div>
                          <div>
                            {user.isAdmin ? (
                              <span className="badge badge-info">Admin</span>
                            ) : (
                              '-'
                            )}
                          </div>
                          <div className="actions-cell">
                            <button 
                              className="btn-icon"
                              onClick={() => handleEditUser(user)}
                              title="Edit user"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon btn-danger"
                              onClick={() => handleDeleteUser(user)}
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Team Modal */}
      {showTeamModal && (
        <TeamFormModal
          isOpen={showTeamModal}
          onClose={() => {
            setShowTeamModal(false);
            resetTeamForm();
          }}
          teamData={teamFormData}
          setTeamData={setTeamFormData}
          onSave={handleSaveTeam}
          isEditing={!!editingTeam}
          loading={loading}
          users={users}
        />
      )}

      {/* User Modal */}
      {showUserModal && (
        <UserFormModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            resetUserForm();
          }}
          userData={userFormData}
          setUserData={setUserFormData}
          onSave={handleSaveUser}
          isEditing={!!editingUser}
          loading={loading}
          teams={teams}
        />
      )}
    </>
  );
};

// Team Form Modal Component
const TeamFormModal = ({ isOpen, onClose, teamData, setTeamData, onSave, isEditing, loading, users }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Team' : 'Create New Team'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Team Name *</label>
              <input
                type="text"
                value={teamData.team_name}
                onChange={(e) => setTeamData({ ...teamData, team_name: e.target.value })}
                placeholder="Enter team name"
                required
              />
            </div>

            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                value={teamData.team_department}
                onChange={(e) => setTeamData({ ...teamData, team_department: e.target.value })}
                placeholder="Enter department"
              />
            </div>

            <div className="form-group">
              <label>Business Unit</label>
              <input
                type="text"
                value={teamData.team_business_unit}
                onChange={(e) => setTeamData({ ...teamData, team_business_unit: e.target.value })}
                placeholder="Enter business unit"
              />
            </div>

            <div className="form-group">
              <label>Manager Name</label>
              <input
                type="text"
                value={teamData.team_manager_name}
                onChange={(e) => setTeamData({ ...teamData, team_manager_name: e.target.value })}
                placeholder="Enter manager name"
              />
            </div>

            <div className="form-group">
              <label>Manager ID (Jira Account ID)</label>
              <input
                type="text"
                value={teamData.team_manager_id}
                onChange={(e) => setTeamData({ ...teamData, team_manager_id: e.target.value })}
                placeholder="Enter manager Jira account ID"
              />
            </div>

            <div className="form-group">
              <label>Manager Email</label>
              <input
                type="email"
                value={teamData.team_manager_email}
                onChange={(e) => setTeamData({ ...teamData, team_manager_email: e.target.value })}
                placeholder="Enter manager email"
              />
            </div>

            <div className="form-group">
              <label>Executive Manager Name</label>
              <input
                type="text"
                value={teamData.team_executive_manager_name}
                onChange={(e) => setTeamData({ ...teamData, team_executive_manager_name: e.target.value })}
                placeholder="Enter executive manager name"
              />
            </div>

            <div className="form-group">
              <label>Executive Manager ID (Jira Account ID)</label>
              <input
                type="text"
                value={teamData.team_executive_manager_id}
                onChange={(e) => setTeamData({ ...teamData, team_executive_manager_id: e.target.value })}
                placeholder="Enter executive manager Jira account ID"
              />
            </div>

            <div className="form-group">
              <label>Executive Manager Email</label>
              <input
                type="email"
                value={teamData.team_executive_manager_email}
                onChange={(e) => setTeamData({ ...teamData, team_executive_manager_email: e.target.value })}
                placeholder="Enter executive manager email"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={onSave} 
            disabled={loading || !teamData.team_name.trim()}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Team' : 'Create Team')}
          </button>
        </div>
      </div>
    </div>
  );
};

// User Form Modal Component
const UserFormModal = ({ isOpen, onClose, userData, setUserData, onSave, isEditing, loading, teams }) => {
  if (!isOpen) return null;

  const handleTeamMembershipChange = (teamId, role) => {
    const existingIndex = userData.team_memberships.findIndex(tm => tm.team_id === teamId);
    const newMemberships = [...userData.team_memberships];
    
    if (existingIndex !== -1) {
      if (role) {
        newMemberships[existingIndex] = { team_id: teamId, role };
      } else {
        newMemberships.splice(existingIndex, 1);
      }
    } else if (role) {
      newMemberships.push({ team_id: teamId, role });
    }
    
    setUserData({ ...userData, team_memberships: newMemberships });
  };

  const handleAvailabilityChange = (day, field, value) => {
    setUserData({
      ...userData,
      standard_availability: {
        ...userData.standard_availability,
        [day]: {
          ...userData.standard_availability[day],
          [field]: value
        }
      }
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>{isEditing ? 'Edit User' : 'Create New User'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-sections">
            {/* Basic Information */}
            <div className="form-section">
              <h4>Basic Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Display Name *</label>
                  <input
                    type="text"
                    value={userData.display_name}
                    onChange={(e) => setUserData({ ...userData, display_name: e.target.value })}
                    placeholder="Enter display name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={userData.email_address}
                    onChange={(e) => setUserData({ ...userData, email_address: e.target.value })}
                    placeholder="Enter email address"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Jira Account ID</label>
                  <input
                    type="text"
                    value={userData.jira_account_id}
                    onChange={(e) => setUserData({ ...userData, jira_account_id: e.target.value })}
                    placeholder="Enter Jira account ID"
                  />
                </div>

                <div className="form-group">
                  <label>Hiring Date</label>
                  <input
                    type="date"
                    value={userData.hiring_date}
                    onChange={(e) => setUserData({ ...userData, hiring_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div className="form-section">
              <h4>Employment Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Employment Type</label>
                  <select
                    value={userData.employment_type}
                    onChange={(e) => {
                      const newCapacity = e.target.value === 'full_time' ? 40 : 20;
                      setUserData({ 
                        ...userData, 
                        employment_type: e.target.value,
                        capacity: newCapacity
                      });
                    }}
                  >
                    <option value="full_time">Full Time (40h/week)</option>
                    <option value="part_time">Part Time (20h/week)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Capacity (hours/week)</label>
                  <input
                    type="number"
                    value={userData.capacity}
                    onChange={(e) => setUserData({ ...userData, capacity: parseInt(e.target.value) || 0 })}
                    min="1"
                    max="60"
                  />
                </div>

                <div className="form-group">
                  <label>PTO Accountability Type</label>
                  <select
                    value={userData.pto_accountability_type}
                    onChange={(e) => setUserData({ ...userData, pto_accountability_type: e.target.value })}
                  >
                    <option value="standard_year">Standard Year</option>
                    <option value="work_year">Work Year</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className="form-section">
              <h4>Permissions</h4>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={userData.isAdmin}
                    onChange={(e) => setUserData({ ...userData, isAdmin: e.target.checked })}
                  />
                  <span>Is Admin</span>
                </label>
              </div>
            </div>

            {/* Team Memberships */}
            <div className="form-section">
              <h4>Team Memberships</h4>
              <div className="team-memberships">
                {teams.length === 0 ? (
                  <p>No teams available. Create teams first.</p>
                ) : (
                  teams.map((team) => {
                    const membership = userData.team_memberships.find(tm => tm.team_id === (team.team_id || team.id));
                    return (
                      <div key={team.team_id || team.id} className="team-membership-item">
                        <div className="team-info">
                          <Building size={16} />
                          <span>{team.team_name || team.name}</span>
                        </div>
                        <select
                          value={membership?.role || ''}
                          onChange={(e) => handleTeamMembershipChange(team.team_id || team.id, e.target.value)}
                        >
                          <option value="">No Role</option>
                          <option value="Member">Member</option>
                          <option value="Manager">Manager</option>
                          <option value="Executive Manager">Executive Manager</option>
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Standard Availability */}
            <div className="form-section">
              <h4>Standard Availability</h4>
              <div className="availability-grid">
                {Object.entries(userData.standard_availability).map(([day, settings]) => (
                  <div key={day} className="availability-day">
                    <div className="day-header">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.working}
                          onChange={(e) => handleAvailabilityChange(day, 'working', e.target.checked)}
                        />
                        <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                      </label>
                    </div>
                    {settings.working && (
                      <div className="hours-input">
                        <input
                          type="number"
                          value={settings.hours}
                          onChange={(e) => handleAvailabilityChange(day, 'hours', parseInt(e.target.value) || 0)}
                          min="0"
                          max="12"
                          step="0.5"
                        />
                        <span>hours</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* PTO Allowances */}
            <div className="form-section">
              <h4>PTO Allowances (Days per Period)</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Vacation Days</label>
                  <input
                    type="number"
                    value={userData.pto_available_in_the_period.vacation}
                    onChange={(e) => setUserData({
                      ...userData,
                      pto_available_in_the_period: {
                        ...userData.pto_available_in_the_period,
                        vacation: parseInt(e.target.value) || 0
                      },
                      remaining_pto_days_in_period: {
                        ...userData.remaining_pto_days_in_period,
                        vacation: parseInt(e.target.value) || 0
                      }
                    })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Holiday Days</label>
                  <input
                    type="number"
                    value={userData.pto_available_in_the_period.holiday}
                    onChange={(e) => setUserData({
                      ...userData,
                      pto_available_in_the_period: {
                        ...userData.pto_available_in_the_period,
                        holiday: parseInt(e.target.value) || 0
                      },
                      remaining_pto_days_in_period: {
                        ...userData.remaining_pto_days_in_period,
                        holiday: parseInt(e.target.value) || 0
                      }
                    })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Personal Days</label>
                  <input
                    type="number"
                    value={userData.pto_available_in_the_period.personal}
                    onChange={(e) => setUserData({
                      ...userData,
                      pto_available_in_the_period: {
                        ...userData.pto_available_in_the_period,
                        personal: parseInt(e.target.value) || 0
                      },
                      remaining_pto_days_in_period: {
                        ...userData.remaining_pto_days_in_period,
                        personal: parseInt(e.target.value) || 0
                      }
                    })}
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={onSave} 
            disabled={loading || !userData.display_name.trim() || !userData.email_address.trim()}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update User' : 'Create User')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamManagementModal;