import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Calendar, Building2, UserCheck, X, Eye, CalendarCheck
} from 'lucide-react';
import { invoke } from '@forge/bridge';
import UserPicker from '../components/UserPicker';
import PTOSubmissionModal from '../components/PTOSubmissionModal';
import TeamManagementModal from '../components/TeamManagementModal';

const AdminManagement = ({ 
  currentUser, 
  showNotification, 
  onNavigateToCalendar // New prop for navigation
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showTeamManagementModal, setShowTeamManagementModal] = useState(false);
  const [showAddPTOModal, setShowAddPTOModal] = useState(false);
  const [selectedPTOUser, setSelectedPTOUser] = useState(null);

  useEffect(() => { loadAllAdminData(); }, []);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAdminUsers(),
        loadAllTeams(),
        loadAllUsers(),
        loadAllRequests()
      ]);
    } catch {
      showNotification('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      const response = await invoke('getAdminUsers');
      if (response.success) setAdminUsers(response.data || []);
    } catch {}
  };

  const loadAllTeams = async () => {
    try {
      const response = await invoke('getTeams');
      if (response.success) setAllTeams(response.data || []);
    } catch {}
  };

  const loadAllUsers = async () => {
    try {
      const response = await invoke('getUsers');
      if (response.success) setAllUsers(response.data || []);
    } catch {}
  };

  const loadAllRequests = async () => {
    try {
      const response = await invoke('getPTORequests');
      if (response.success) setAllRequests(response.data || []);
    } catch {}
  };

  const handleAddAdmin = async (user) => {
    if (!user) return;
    try {
      const response = await invoke('addAdminUser', {
        accountId: user.accountId,
        addedBy: currentUser.accountId
      });
      if (response.success) {
        showNotification(`${user.displayName} added as admin`);
        setShowAddAdmin(false);
        loadAdminUsers();
      } else {
        showNotification(response.message || 'Failed to add admin', 'error');
      }
    } catch {
      showNotification('Failed to add admin user', 'error');
    }
  };

  const handleRemoveAdmin = async (adminAccountId) => {
    if (adminAccountId === currentUser.accountId) {
      showNotification('You cannot remove yourself as admin', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to remove admin privileges?')) return;
    try {
      const response = await invoke('removeAdminUser', {
        accountId: adminAccountId,
        removedBy: currentUser.accountId
      });
      if (response.success) {
        showNotification('Admin privileges removed');
        loadAdminUsers();
      } else {
        showNotification(response.message || 'Failed to remove admin', 'error');
      }
    } catch {
      showNotification('Failed to remove admin user', 'error');
    }
  };

  const handleSubmitPTOForUser = async (ptoData) => {
    if (!ptoData?.targetUser) {
      showNotification('Please select a user for PTO', 'error');
      return;
    }
    try {
      const response = await invoke('submitPTOForUser', {
        ...ptoData,
        submittedBy: currentUser.accountId
      });
      if (response.success) {
        showNotification(`PTO request created for ${ptoData.targetUser.displayName}`);
        setShowAddPTOModal(false);
        setSelectedPTOUser(null);
        loadAllRequests();
      } else {
        showNotification(response.message || 'Failed to create PTO request', 'error');
      }
    } catch {
      showNotification('Failed to create PTO request', 'error');
    }
  };

  // Navigate to calendar with team filter
  const handleViewTeamCalendar = (teamId) => {
    if (onNavigateToCalendar) {
      onNavigateToCalendar('calendar', { teamId });
    }
  };

  // Navigate to calendar with user filter
  const handleViewUserCalendar = (userId) => {
    if (onNavigateToCalendar) {
      onNavigateToCalendar('calendar', { userId });
    }
  };

  // Get team statistics
  const getTeamStats = (teamId) => {
    const teamMembers = allUsers.filter(user => user.team_id === teamId);
    const teamMemberIds = teamMembers.map(user => user.jira_account_id || user.id);
    const teamRequests = allRequests.filter(req => teamMemberIds.includes(req.requester_id));
    
    return {
      memberCount: teamMembers.length,
      totalRequests: teamRequests.length,
      pendingRequests: teamRequests.filter(req => req.status === 'pending').length,
      approvedRequests: teamRequests.filter(req => req.status === 'approved').length,
      totalDaysOff: teamRequests
        .filter(req => req.status === 'approved')
        .reduce((sum, req) => sum + (req.total_days || 0), 0)
    };
  };

  // Get current PTO status for user
  const getUserCurrentPTO = (userId) => {
    const today = new Date();
    const userRequests = allRequests.filter(req => 
      (req.requester_id === userId) && 
      req.status === 'approved' &&
      new Date(req.start_date) <= today &&
      new Date(req.end_date) >= today
    );
    return userRequests.length > 0 ? userRequests[0] : null;
  };

  const stats = {
    totalAdmins: adminUsers.length,
    totalTeams: allTeams.length,
    totalUsers: allUsers.length,
    totalRequests: allRequests.length,
    pendingRequests: allRequests.filter(r => r.status === 'pending').length,
    approvedRequests: allRequests.filter(r => r.status === 'approved').length
  };

  return (
    <div className="dashboard">
      {/* Tabs */}
      <div className="main-tabs">
        <button 
          className={`tab-btn${activeTab === 'overview' ? ' active' : ''}`} 
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-btn${activeTab === 'teams' ? ' active' : ''}`} 
          onClick={() => setActiveTab('teams')}
        >
          👥 Teams
        </button>
        <button 
          className={`tab-btn${activeTab === 'users' ? ' active' : ''}`} 
          onClick={() => setActiveTab('users')}
        >
          👤 Users
        </button>
        <button 
          className={`tab-btn${activeTab === 'analytics' ? ' active' : ''}`} 
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="dashboard-section">
          <div className="dashboard-cards">
            <SummaryCard title="Admin Users" value={stats.totalAdmins} color="purple" icon={<Shield size={24} />} />
            <SummaryCard title="Teams" value={stats.totalTeams} color="blue" icon={<Users size={24} />} />
            <SummaryCard title="Total Users" value={stats.totalUsers} color="emerald" icon={<UserCheck size={24} />} />
            <SummaryCard title="PTO Requests" value={stats.totalRequests} color="orange" icon={<Calendar size={24} />} />
            <SummaryCard title="Pending" value={stats.pendingRequests} color="yellow" icon={<Calendar size={24} />} />
            <SummaryCard title="Approved" value={stats.approvedRequests} color="green" icon={<Calendar size={24} />} />
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">Quick Actions</div>
            <div className="quick-actions">
              <button onClick={() => setShowTeamManagementModal(true)} className="action-btn">
                <div className="action-icon bg-blue">{<Building2 size={20} />}</div>
                <div>
                  <div className="action-title">Manage Teams & Users</div>
                  <div className="action-desc">Advanced team and user management</div>
                </div>
              </button>
              <button onClick={() => setShowAddAdmin(true)} className="action-btn">
                <div className="action-icon bg-purple">{<Shield size={20} />}</div>
                <div>
                  <div className="action-title">Add Admin</div>
                  <div className="action-desc">Grant admin privileges</div>
                </div>
              </button>
              <button onClick={() => setShowAddPTOModal(true)} className="action-btn">
                <div className="action-icon bg-green">{<Calendar size={20} />}</div>
                <div>
                  <div className="action-title">Create PTO</div>
                  <div className="action-desc">Create PTO for users</div>
                </div>
              </button>
              <button onClick={() => handleViewTeamCalendar()} className="action-btn">
                <div className="action-icon bg-indigo">{<CalendarCheck size={20} />}</div>
                <div>
                  <div className="action-title">View Calendar</div>
                  <div className="action-desc">View all PTO requests on calendar</div>
                </div>
              </button>
            </div>
          </div>

          {/* Recent PTO Activity */}
          <div className="card">
            <div className="card-header">Recent PTO Requests</div>
            <div className="card-body">
              {allRequests.slice(0, 8).map(request => (
                <div key={request.id} className="request-row">
                  <div className="request-avatar">
                    {request.requester_name?.charAt(0) || '?'}
                  </div>
                  <div className="request-info">
                    <span className="request-user">{request.requester_name}</span>
                    <span className="request-type">requested {request.leave_type}</span>
                    <div className="request-date">{new Date(request.start_date).toLocaleDateString()}</div>
                  </div>
                  <div className="request-actions">
                    <span className={`status-badge status-${request.status}`}>{request.status}</span>
                    <button 
                      onClick={() => handleViewUserCalendar(request.requester_id)}
                      className="btn-icon"
                      title="View user's calendar"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="dashboard-section">
          <div className="card">
            <div className="card-header">
              <span>Team Management</span>
              <button 
                onClick={() => setShowTeamManagementModal(true)}
                className="btn btn-primary"
              >
                Manage Teams
              </button>
            </div>
            <div className="teams-grid">
              {allTeams.map(team => {
                const teamStats = getTeamStats(team.id);
                return (
                  <div key={team.id} className="team-admin-card">
                    <div className="team-card-header">
                      <div className="team-info">
                        <h4 style={{ color: team.color || '#6366f1' }}>{team.name}</h4>
                        {team.description && <p className="team-description">{team.description}</p>}
                      </div>
                      <div className="team-actions">
                        <button 
                          onClick={() => handleViewTeamCalendar(team.id)}
                          className="btn btn-sm btn-secondary"
                          title="View team calendar"
                        >
                          <CalendarCheck size={16} />
                          Calendar
                        </button>
                      </div>
                    </div>
                    
                    <div className="team-stats-grid">
                      <div className="stat-item">
                        <span className="stat-value">{teamStats.memberCount}</span>
                        <span className="stat-label">Members</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{teamStats.totalRequests}</span>
                        <span className="stat-label">Requests</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{teamStats.pendingRequests}</span>
                        <span className="stat-label">Pending</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{teamStats.totalDaysOff}</span>
                        <span className="stat-label">Days Off</span>
                      </div>
                    </div>

                    {/* Team Members Preview */}
                    <div className="team-members-preview">
                      <h5>Recent Activity:</h5>
                      {allRequests
                        .filter(req => {
                          const teamMemberIds = allUsers
                            .filter(user => user.team_id === team.id)
                            .map(user => user.jira_account_id || user.id);
                          return teamMemberIds.includes(req.requester_id);
                        })
                        .slice(0, 3)
                        .map(request => (
                          <div key={request.id} className="activity-item">
                            <span className="activity-user">{request.requester_name}</span>
                            <span className="activity-action">
                              {request.leave_type} • {new Date(request.start_date).toLocaleDateString()}
                            </span>
                            <span className={`activity-status status-${request.status}`}>
                              {request.status}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="dashboard-section">
          <div className="card">
            <div className="card-header">
              <span>User Management</span>
              <button 
                onClick={() => setShowTeamManagementModal(true)}
                className="btn btn-primary"
              >
                Manage Users
              </button>
            </div>
            <div className="users-grid">
              {allUsers.map(user => {
                const currentPTO = getUserCurrentPTO(user.jira_account_id || user.id);
                const userTeam = allTeams.find(t => t.id === user.team_id);
                const userRequests = allRequests.filter(req => 
                  req.requester_id === (user.jira_account_id || user.id)
                );
                
                return (
                  <div key={user.id} className="user-admin-card">
                    <div className="user-card-header">
                      <div className="user-avatar-large">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.display_name} />
                        ) : (
                          <div className="avatar-placeholder-large">
                            {(user.display_name || user.displayName || user.name)?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <h4>{user.display_name || user.displayName || user.name}</h4>
                        <p className="user-email">{user.email_address || user.emailAddress}</p>
                        {userTeam && (
                          <span className="user-team" style={{ color: userTeam.color }}>
                            {userTeam.name}
                          </span>
                        )}
                      </div>
                      <div className="user-actions">
                        <button 
                          onClick={() => handleViewUserCalendar(user.jira_account_id || user.id)}
                          className="btn btn-sm btn-secondary"
                          title="View user's calendar"
                        >
                          <CalendarCheck size={16} />
                          Calendar
                        </button>
                      </div>
                    </div>

                    {currentPTO && (
                      <div className="current-pto-banner">
                        🏖️ Currently on {currentPTO.leave_type} leave until {new Date(currentPTO.end_date).toLocaleDateString()}
                      </div>
                    )}

                    <div className="user-stats-grid">
                      <div className="stat-item">
                        <span className="stat-value">{userRequests.length}</span>
                        <span className="stat-label">Total Requests</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">
                          {userRequests.filter(r => r.status === 'pending').length}
                        </span>
                        <span className="stat-label">Pending</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">
                          {userRequests
                            .filter(r => r.status === 'approved')
                            .reduce((sum, r) => sum + (r.total_days || 0), 0)
                          }
                        </span>
                        <span className="stat-label">Days Used</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="dashboard-section">
          <div className="analytics-grid">
            <div className="card">
              <div className="card-header">PTO Requests by Status</div>
              <div className="card-body">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <span className="status-badge status-approved">Approved</span>
                      </td>
                      <td>{stats.approvedRequests}</td>
                      <td>
                        {stats.totalRequests > 0 
                          ? Math.round((stats.approvedRequests / stats.totalRequests) * 100)
                          : 0
                        }%
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="status-badge status-pending">Pending</span>
                      </td>
                      <td>{stats.pendingRequests}</td>
                      <td>
                        {stats.totalRequests > 0 
                          ? Math.round((stats.pendingRequests / stats.totalRequests) * 100)
                          : 0
                        }%
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="status-badge status-declined">Declined</span>
                      </td>
                      <td>{allRequests.filter(r => r.status === 'declined').length}</td>
                      <td>
                        {stats.totalRequests > 0 
                          ? Math.round((allRequests.filter(r => r.status === 'declined').length / stats.totalRequests) * 100)
                          : 0
                        }%
                      </td>
                    </tr>
                    <tr className="table-total">
                      <td><strong>Total</strong></td>
                      <td><strong>{stats.totalRequests}</strong></td>
                      <td><strong>100%</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">Leave Types Distribution</div>
              <div className="card-body">
                <div className="leave-types-stats">
                  {['vacation', 'sick', 'personal', 'holiday'].map(type => {
                    const count = allRequests.filter(r => r.leave_type === type).length;
                    const percentage = stats.totalRequests > 0 
                      ? Math.round((count / stats.totalRequests) * 100) 
                      : 0;
                    return (
                      <div key={type} className="leave-type-stat">
                        <div className="leave-type-header">
                          <span className="leave-type-name">
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </span>
                          <span className="leave-type-count">{count}</span>
                        </div>
                        <div className="leave-type-bar">
                          <div 
                            className="leave-type-progress" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="leave-type-percentage">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddAdmin && (
        <Modal title="Add Admin User" onClose={() => setShowAddAdmin(false)}>
          <UserPicker
            selectedUser={null}
            onSelect={handleAddAdmin}
            placeholder="Search and select user to grant admin privileges"
            required
          />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowAddAdmin(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showTeamManagementModal && (
        <TeamManagementModal
          isOpen={showTeamManagementModal}
          onClose={() => setShowTeamManagementModal(false)}
          teams={allTeams}
          users={allUsers}
          onSaveTeam={async teamData => {
            const duplicate = allTeams.some(
              t => t.name.trim().toLowerCase() === teamData.name.trim().toLowerCase() && t.id !== teamData.id
            );
            if (duplicate) {
              showNotification('A team with this name already exists.', 'error');
              return;
            }
            await invoke(teamData.id ? 'updateTeam' : 'createTeam', teamData);
            loadAllTeams();
          }}
          onDeleteTeam={async teamId => {
            await invoke('deleteTeam', { teamId, deletedBy: currentUser.accountId });
            loadAllTeams();
          }}
          onSaveUser={async userData => {
            const duplicate = allUsers.some(
              u =>
                (u.email?.toLowerCase() === userData.email?.toLowerCase() || u.accountId === userData.accountId)
                && u.id !== userData.id
            );
            if (duplicate) {
              showNotification('A user with this email or account already exists.', 'error');
              return;
            }
            await invoke(userData.id ? 'updateUser' : 'createUser', userData);
            loadAllUsers();
          }}
          onDeleteUser={async userId => {
            await invoke('deleteUser', { userId, deletedBy: currentUser.accountId });
            loadAllUsers();
          }}
          showNotification={showNotification}
          onRefresh={loadAllAdminData}
        />
      )}

      {showAddPTOModal && (
        <PTOSubmissionModal
          isAdminMode
          onClose={() => {
            setShowAddPTOModal(false);
            setSelectedPTOUser(null);
          }}
          onSubmit={handleSubmitPTOForUser}
          targetUser={selectedPTOUser}
          allUsers={allUsers}
          allTeams={allTeams}
          allRequests={allRequests}
        />
      )}
    </div>
  );
};

function SummaryCard({ title, value, color, icon }) {
  return (
    <div className={`summary-card summary-card-${color}`}>
      <div className="summary-card-icon">{icon}</div>
      <div className="summary-card-content">
        <div className="summary-card-title">{title}</div>
        <div className="summary-card-value">{value}</div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default AdminManagement;