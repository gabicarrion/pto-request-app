import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { Settings, Users, Building, Award, UserPlus, Download, RefreshCw, Shield } from 'lucide-react';
import TeamManagementModal from '../components/Modal/TeamManagementModal';
import Notifications from '../components/Common/Notifications';

/**
 * AdminTab component for managing teams and users
 * 
 * @param {Object} props
 * @param {Object} props.currentUser - Current user information
 */
const AdminTab = ({ currentUser }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeams: 0,
    usersWithoutTeam: 0,
    pendingRequests: 0
  });
  
  // Load admin data on component mount
  useEffect(() => {
    loadAdminData();
  }, []);
  
  // Load teams, users, and stats
  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load teams
      const teamsResponse = await invoke('getTeams');
      if (teamsResponse.success) {
        setTeams(teamsResponse.data || []);
      }
      
      // Load users
      const usersResponse = await invoke('getUsers');
      if (usersResponse.success) {
        setUsers(usersResponse.data || []);
      }
      
      // Calculate stats
      calculateStats(
        teamsResponse.success ? teamsResponse.data : [], 
        usersResponse.success ? usersResponse.data : []
      );
      
      // Get pending requests count
      const pendingRequestsResponse = await invoke('getPendingRequests', {});
      if (pendingRequestsResponse.success) {
        setStats(prev => ({
          ...prev,
          pendingRequests: pendingRequestsResponse.data?.length || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      showNotification('Failed to load admin data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate stats from teams and users
  const calculateStats = (teamsData, usersData) => {
    const usersWithoutTeam = usersData.filter(user => {
      if (!user.team_memberships || user.team_memberships.length === 0) {
        return !user.team_id; // Also check legacy team_id
      }
      return false;
    }).length;
    
    setStats(prev => ({
      ...prev,
      totalUsers: usersData.length,
      totalTeams: teamsData.length,
      usersWithoutTeam
    }));
  };
  
  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };
  
  // Handle team save
  const handleSaveTeam = async (teamData) => {
    try {
      if (teamData.id) {
        // Update existing team
        await invoke('updateTeam', teamData);
      } else {
        // Create new team
        await invoke('createTeam', teamData);
      }
      
      // Refresh data
      await loadAdminData();
      showNotification(teamData.id ? 'Team updated successfully' : 'Team created successfully');
      return true;
    } catch (error) {
      console.error('Failed to save team:', error);
      showNotification('Failed to save team: ' + error.message, 'error');
      return false;
    }
  };
  
  // Handle team delete
  const handleDeleteTeam = async (teamId) => {
    try {
      await invoke('deleteTeam', { teamId });
      
      // Refresh data
      await loadAdminData();
      showNotification('Team deleted successfully');
      return true;
    } catch (error) {
      console.error('Failed to delete team:', error);
      showNotification('Failed to delete team: ' + error.message, 'error');
      return false;
    }
  };
  
  // Handle user save
  const handleSaveUser = async (userData) => {
    try {
      if (userData.id) {
        // Update existing user
        await invoke('updateUser', userData);
      } else {
        // Create new user
        await invoke('createUser', userData);
      }
      
      // Refresh data
      await loadAdminData();
      showNotification(userData.id ? 'User updated successfully' : 'User created successfully');
      return true;
    } catch (error) {
      console.error('Failed to save user:', error);
      showNotification('Failed to save user: ' + error.message, 'error');
      return false;
    }
  };
  
  // Handle user delete
  const handleDeleteUser = async (userId) => {
    try {
      await invoke('deleteUser', { userId });
      
      // Refresh data
      await loadAdminData();
      showNotification('User deleted successfully');
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      showNotification('Failed to delete user: ' + error.message, 'error');
      return false;
    }
  };
  
  // Get team members
  const getTeamMembers = (teamId) => {
    return users.filter(user => {
      if (user.team_memberships && Array.isArray(user.team_memberships)) {
        return user.team_memberships.some(m => m.team_id === teamId);
      }
      return user.team_id === teamId;
    });
  };
  
  return (
    <div className="admin-page">
      {/* Admin Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Settings size={20} />
          <h2>Admin</h2>
        </div>
        
        <nav className="admin-nav">
          <button 
            className={`admin-nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            <Award size={18} />
            Dashboard
          </button>
          <button 
            className={`admin-nav-item ${activeSection === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveSection('teams')}
          >
            <Building size={18} />
            Teams
          </button>
          <button 
            className={`admin-nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <Users size={18} />
            Users
          </button>
        </nav>
      </div>
      
      {/* Admin Content */}
      <div className="admin-content">
        {/* Dashboard Section */}
        {activeSection === 'dashboard' && (
          <div className="admin-section">
            <div className="section-header">
              <h2>Admin Dashboard</h2>
              <button className="refresh-button" onClick={loadAdminData} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                Refresh
              </button>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon users-icon">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalUsers}</div>
                  <div className="stat-label">Total Users</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon teams-icon">
                  <Building size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalTeams}</div>
                  <div className="stat-label">Teams</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon unassigned-icon">
                  <UserPlus size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.usersWithoutTeam}</div>
                  <div className="stat-label">Unassigned Users</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon pending-icon">
                  <Award size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.pendingRequests}</div>
                  <div className="stat-label">Pending Requests</div>
                </div>
              </div>
            </div>
            
            <div className="admin-actions">
              <button className="admin-action-btn" onClick={() => setShowTeamModal(true)}>
                <Building size={16} />
                Manage Teams & Users
              </button>
              
              <button className="admin-action-btn secondary">
                <Download size={16} />
                Export Data
              </button>
            </div>
            
            {/* Recent Activity */}
            <div className="recent-activity">
              <h3>Recent Activity</h3>
              <div className="activity-empty">
                <p>No recent activity to display.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Teams Section */}
        {activeSection === 'teams' && (
          <div className="admin-section">
            <div className="section-header">
              <h2>Team Management</h2>
              <div className="section-actions">
                <button className="refresh-button" onClick={loadAdminData} disabled={loading}>
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                  Refresh
                </button>
                <button className="action-button primary" onClick={() => setShowTeamModal(true)}>
                  <Building size={16} />
                  Manage Teams
                </button>
              </div>
            </div>
            
            {teams.length === 0 ? (
              <div className="empty-state">
                <Building size={48} />
                <h3>No Teams Created</h3>
                <p>Start by creating your first team to organize your workforce</p>
                <button className="action-button primary" onClick={() => setShowTeamModal(true)}>
                  Create First Team
                </button>
              </div>
            ) : (
              <div className="table-container">
                <table className="admin-table">
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
                      const teamManager = users.find(user => 
                        user.id === team.manager || 
                        user.jira_account_id === team.manager
                      );
                      
                      const teamMembers = getTeamMembers(team.id);
                      
                      return (
                        <tr key={team.id}>
                          <td>
                            <div className="team-name">
                              <div 
                                className="team-color" 
                                style={{ backgroundColor: team.color || '#667eea' }}
                              ></div>
                              {team.name}
                            </div>
                          </td>
                          <td>{team.department || '-'}</td>
                          <td>
                            {teamManager ? (
                              teamManager.display_name || 
                              teamManager.displayName || 
                              `${teamManager.first_name} ${teamManager.last_name}`
                            ) : '-'}
                          </td>
                          <td>{teamMembers.length}</td>
                          <td>
                            <button 
                              className="table-action-btn"
                              onClick={() => setShowTeamModal(true)}
                            >
                              Manage
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
        
        {/* Users Section */}
        {activeSection === 'users' && (
          <div className="admin-section">
            <div className="section-header">
              <h2>User Management</h2>
              <div className="section-actions">
                <button className="refresh-button" onClick={loadAdminData} disabled={loading}>
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                  Refresh
                </button>
                <button className="action-button primary" onClick={() => setShowTeamModal(true)}>
                  <UserPlus size={16} />
                  Manage Users
                </button>
              </div>
            </div>
            
            {users.length === 0 ? (
              <div className="empty-state">
                <Users size={48} />
                <h3>No Users Added</h3>
                <p>Start by adding users to your organization</p>
                <button className="action-button primary" onClick={() => setShowTeamModal(true)}>
                  Add First User
                </button>
              </div>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Teams</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const userTeams = [];
                      
                      // Get user's teams
                      if (user.team_memberships && Array.isArray(user.team_memberships)) {
                        user.team_memberships.forEach(membership => {
                          const team = teams.find(t => t.id === membership.team_id);
                          if (team) {
                            userTeams.push({
                              name: team.name,
                              role: membership.role
                            });
                          }
                        });
                      } else if (user.team_id) {
                        const team = teams.find(t => t.id === user.team_id);
                        if (team) {
                          userTeams.push({
                            name: team.name,
                            role: 'Member'
                          });
                        }
                      }
                      
                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="user-name-cell">
                              <div className="user-avatar-small">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="User Avatar" />
                                ) : (
                                  <div className="avatar-placeholder-small">
                                    {(user.display_name || user.displayName || '').charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div>
                                {user.display_name || user.displayName || `${user.first_name} ${user.last_name}`}
                              </div>
                            </div>
                          </td>
                          <td>{user.email_address || user.emailAddress || '-'}</td>
                          <td>
                            {userTeams.length > 0 ? (
                              <div className="user-teams">
                                {userTeams.map((teamInfo, idx) => (
                                  <span key={idx} className="user-team-badge">
                                    {teamInfo.name} ({teamInfo.role})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="no-team">No Team</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${user.status || 'active'}`}>
                              {user.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="table-action-btn"
                              onClick={() => setShowTeamModal(true)}
                            >
                              Edit
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
      </div>
      
      {/* Team Management Modal */}
      {showTeamModal && (
        <TeamManagementModal
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          teams={teams}
          users={users}
          onSaveTeam={handleSaveTeam}
          onDeleteTeam={handleDeleteTeam}
          onSaveUser={handleSaveUser}
          onDeleteUser={handleDeleteUser}
          showNotification={showNotification}
          onRefresh={loadAdminData}
          currentUser={currentUser}
        />
      )}
      
      {/* Notification */}
      {notification && (
        <Notifications 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  );
};

export default AdminTab;