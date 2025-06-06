import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Calendar, Building2, UserCheck, X, Download, 
  BarChart3, TrendingUp, Clock, CheckCircle, XCircle, Settings, Plus
} from 'lucide-react';
import { invoke } from '@forge/bridge';
import UserPicker from '../components/UserPicker';
import PTOSubmissionModal from '../components/PTOSubmissionModal';
import TeamManagementModal from '../components/TeamManagementModal';

const AdminManagement = ({ currentUser, showNotification }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [jiraUsers, setJiraUsers] = useState([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showTeamManagementModal, setShowTeamManagementModal] = useState(false);
  const [showAddPTOModal, setShowAddPTOModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Report configuration state
  const [reportConfig, setReportConfig] = useState({
    scope: 'company',
    teamId: '',
    userId: '',
    startDate: '',
    endDate: '',
    status: 'all'
  });

  useEffect(() => { 
    loadAllAdminData(); 
    loadJiraUsers();
  }, []);

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

  const loadJiraUsers = async () => {
    try {
      const response = await invoke('getInternalJiraUsersByGroup', {
        groupName: 'jira-users'
      });
      if (response.success) {
        setJiraUsers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load Jira users:', error);
    }
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
        requestData: {
          requester_id: ptoData.targetUser.accountId,
          requester_name: ptoData.targetUser.displayName,
          requester_email: ptoData.targetUser.emailAddress,
          manager_id: ptoData.manager?.accountId || 'admin',
          manager_name: ptoData.manager?.displayName || currentUser.displayName,
          manager_email: ptoData.manager?.emailAddress || currentUser.emailAddress,
          start_date: ptoData.startDate,
          end_date: ptoData.endDate,
          leave_type: ptoData.leaveType || 'vacation',
          reason: ptoData.reason || 'Admin created',
          status: 'approved',
          total_days: ptoData.totalDays,
          total_hours: ptoData.totalHours,
          daily_schedules: ptoData.dailySchedules
        },
        submittedBy: currentUser.accountId
      });
      if (response.success) {
        showNotification(`PTO request created for ${ptoData.targetUser.displayName}`);
        setShowAddPTOModal(false);
        loadAllRequests();
      } else {
        showNotification(response.message || 'Failed to create PTO request', 'error');
      }
    } catch {
      showNotification('Failed to create PTO request', 'error');
    }
  };

  const handleGenerateReport = async () => {
    try {
      let filteredRequests = [...allRequests];

      if (reportConfig.scope === 'team' && reportConfig.teamId) {
        const teamUsers = allUsers.filter(user => user.team_id === reportConfig.teamId);
        const teamUserIds = teamUsers.map(user => user.jira_account_id || user.id);
        filteredRequests = filteredRequests.filter(req => 
          teamUserIds.includes(req.requester_id)
        );
      } else if (reportConfig.scope === 'user' && reportConfig.userId) {
        filteredRequests = filteredRequests.filter(req => 
          req.requester_id === reportConfig.userId
        );
      }

      if (reportConfig.startDate && reportConfig.endDate) {
        filteredRequests = filteredRequests.filter(req => {
          const reqStart = new Date(req.start_date);
          const filterStart = new Date(reportConfig.startDate);
          const filterEnd = new Date(reportConfig.endDate);
          return reqStart >= filterStart && reqStart <= filterEnd;
        });
      }

      if (reportConfig.status !== 'all') {
        filteredRequests = filteredRequests.filter(req => req.status === reportConfig.status);
      }

      const reportData = filteredRequests.map(request => {
        const user = allUsers.find(u => 
          u.jira_account_id === request.requester_id || 
          u.email_address === request.requester_email
        );
        const team = user ? allTeams.find(t => t.id === user.team_id) : null;

        return {
          'Date': new Date().toLocaleDateString(),
          'Manager': request.manager_name || '',
          'Team': team?.name || 'Unassigned',
          'Department': team?.department || '',
          'User': request.requester_name,
          'Start Date': request.start_date,
          'End Date': request.end_date,
          'Total Days': request.total_days || 0,
          'Leave Type': request.leave_type,
          'Reason': request.reason || '',
          'Manager Comment': request.reviewer_comments || '',
          'Status': request.status,
          'Submitted Date': request.submitted_at
        };
      });

      const headers = Object.keys(reportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...reportData.map(row =>
          headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pto-admin-report-${reportConfig.scope}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification('Report downloaded successfully!');
      setShowReportModal(false);
    } catch (error) {
      showNotification('Failed to generate report', 'error');
    }
  };

  const getUsersNotInSystem = () => {
    const systemUserIds = allUsers.map(user => 
      user.jira_account_id || user.email_address
    ).filter(Boolean);
    
    return jiraUsers.filter(jiraUser => 
      !systemUserIds.includes(jiraUser.accountId) && 
      !systemUserIds.includes(jiraUser.emailAddress)
    );
  };

  const stats = {
    totalAdmins: adminUsers.length,
    totalTeams: allTeams.length,
    totalUsers: allUsers.length,
    totalRequests: allRequests.length,
    pendingRequests: allRequests.filter(r => r.status === 'pending').length,
    approvedRequests: allRequests.filter(r => r.status === 'approved').length,
    declinedRequests: allRequests.filter(r => r.status === 'declined').length,
    usersNotInSystem: getUsersNotInSystem().length
  };

  const analytics = {
    requestsByWeekday: allRequests.reduce((acc, req) => {
      const startDate = new Date(req.start_date);
      const dayName = startDate.toLocaleDateString('en-US', { weekday: 'long' });
      acc[dayName] = (acc[dayName] || 0) + 1;
      return acc;
    }, {}),
    
    requestsByLeaveType: allRequests.reduce((acc, req) => {
      acc[req.leave_type] = (acc[req.leave_type] || 0) + 1;
      return acc;
    }, {}),
    
    requestsByTeam: allRequests.reduce((acc, req) => {
      const user = allUsers.find(u => 
        u.jira_account_id === req.requester_id || 
        u.email_address === req.requester_email
      );
      const team = user ? allTeams.find(t => t.id === user.team_id) : null;
      const teamName = team?.name || 'Unassigned';
      acc[teamName] = (acc[teamName] || 0) + 1;
      return acc;
    }, {})
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Shield size={16} />
          Overview
        </button>
        <button 
          className={`admin-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Building2 size={16} />
          Teams
        </button>
        <button 
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} />
          Users
        </button>
        <button 
          className={`admin-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          Analytics
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="admin-section">
          {/* Stats Cards - More professional */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card admin-stat-purple">
              <div className="stat-icon">
                <Shield size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalAdmins}</div>
                <div className="stat-label">Admin Users</div>
              </div>
            </div>

            <div className="admin-stat-card admin-stat-blue">
              <div className="stat-icon">
                <Building2 size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalTeams}</div>
                <div className="stat-label">Teams</div>
              </div>
            </div>

            <div className="admin-stat-card admin-stat-emerald">
              <div className="stat-icon">
                <UserCheck size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalUsers}</div>
                <div className="stat-label">Users</div>
              </div>
            </div>

            {/* Combined PTO Requests Card */}
            <div className="admin-stat-card admin-stat-indigo">
              <div className="stat-icon">
                <Calendar size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalRequests}</div>
                <div className="stat-label">Total Requests</div>
                <div className="stat-breakdown">
                  <span className="breakdown-item green">{stats.approvedRequests} approved</span>
                  <span className="breakdown-item orange">{stats.pendingRequests} pending</span>
                  <span className="breakdown-item red">{stats.declinedRequests} declined</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card admin-actions-card">
            <div className="card-header">
              <h3>Actions</h3>
            </div>
            <div className="card-body">
              <div className="admin-actions-grid">
                <button 
                  onClick={() => setShowAddPTOModal(true)} 
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-green">
                    <Calendar size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Create PTO</div>
                    <div className="action-desc">Create PTO requests for users</div>
                  </div>
                </button>

                <button 
                  onClick={() => setShowReportModal(true)} 
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-blue">
                    <Download size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Generate Reports</div>
                    <div className="action-desc">Export detailed PTO reports</div>
                  </div>
                </button>

                <button 
                  onClick={() => setShowTeamManagementModal(true)} 
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-indigo">
                    <Settings size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Manage Teams & Users</div>
                    <div className="action-desc">Advanced team and user management</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="card recent-activity-card">
            <div className="card-header">
              <h3>Recent PTO Activity</h3>
            </div>
            <div className="card-body">
              {allRequests.length === 0 ? (
                <div className="empty-state-small">
                  <Calendar size={32} />
                  <p>No PTO requests yet</p>
                </div>
              ) : (
                <div className="recent-requests-list">
                  {allRequests
                    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
                    .slice(0, 5)
                    .map(request => (
                    <div key={request.id} className="recent-request-item">
                      <div className="request-avatar">
                        {request.requester_name?.charAt(0) || '?'}
                      </div>
                      <div className="request-details">
                        <div className="request-summary">
                          <span className="requester-name">{request.requester_name}</span>
                          <span className="request-action">requested {request.leave_type}</span>
                        </div>
                        <div className="request-meta">
                          {new Date(request.start_date).toLocaleDateString()} • {request.total_days} days
                        </div>
                      </div>
                      <div className="request-status">
                        <span className={`status-badge status-${request.status}`}>
                          {request.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="admin-section">
          <div className="section-header">
            <h3>Teams Management</h3>
            <button 
              onClick={() => setShowTeamManagementModal(true)} 
              className="btn btn-primary"
            >
              <Building2 size={16} />
              Manage Teams
            </button>
          </div>

          <div className="teams-grid">
            {allTeams.map(team => (
              <div key={team.id} className="team-card">
                <div className="team-header">
                  <div className="team-color" style={{ backgroundColor: team.color }}></div>
                  <div className="team-info">
                    <h4>{team.name}</h4>
                    {team.description && <p>{team.description}</p>}
                  </div>
                </div>
                
                <div className="team-stats">
                  <div className="team-stat">
                    <span className="stat-label">Members:</span>
                    <span className="stat-value">{team.members?.length || 0}</span>
                  </div>
                  <div className="team-stat">
                    <span className="stat-label">Department:</span>
                    <span className="stat-value">{team.department || 'N/A'}</span>
                  </div>
                  <div className="team-stat">
                    <span className="stat-label">Lead:</span>
                    <span className="stat-value">{team.team_lead || 'N/A'}</span>
                  </div>
                </div>

                <div className="team-members-preview">
                  {team.members?.slice(0, 3).map(member => (
                    <div key={member.id} className="member-avatar">
                      {member.display_name?.charAt(0) || member.displayName?.charAt(0) || '?'}
                    </div>
                  ))}
                  {team.members?.length > 3 && (
                    <div className="member-avatar more">+{team.members.length - 3}</div>
                  )}
                </div>
              </div>
            ))}
            
            {allTeams.length === 0 && (
              <div className="empty-state">
                <Building2 size={48} />
                <h4>No Teams Created</h4>
                <p>Create your first team to organize users.</p>
                <button 
                  onClick={() => setShowTeamManagementModal(true)}
                  className="btn btn-primary"
                >
                  Create Team
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-section">
          <div className="section-header">
            <h3>Users Management</h3>
            <button 
              onClick={() => setShowTeamManagementModal(true)} 
              className="btn btn-primary"
            >
              <Users size={16} />
              Manage Users
            </button>
          </div>

          <div className="users-stats-grid">
            <div className="stat-card stat-blue">
              <div className="stat-content">
                <div className="stat-value">{stats.totalUsers}</div>
                <div className="stat-label">Total Users in System</div>
              </div>
            </div>
            <div className="stat-card stat-orange">
              <div className="stat-content">
                <div className="stat-value">{stats.usersNotInSystem}</div>
                <div className="stat-label">Jira Users Not in System</div>
              </div>
            </div>
          </div>

          {getUsersNotInSystem().length > 0 && (
            <div className="card users-not-in-system-card">
              <div className="card-header">
                <h4>Internal Jira Users Not Added to System</h4>
                <div className="users-count">
                  {getUsersNotInSystem().length} users
                </div>
              </div>
              <div className="card-body">
                <p className="help-text">
                  These internal Jira users are not added to the PTO system. 
                  Consider adding them to teams for proper PTO management.
                </p>
                <div className="users-not-in-system-list">
                  {getUsersNotInSystem().slice(0, 10).map(user => (
                    <div key={user.accountId} className="user-not-in-system-item">
                      <div className="user-info">
                        <div className="user-avatar">
                          {user.displayName?.charAt(0) || '?'}
                        </div>
                        <div className="user-details">
                          <div className="user-name">{user.displayName}</div>
                          <div className="user-email">{user.emailAddress}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setShowTeamManagementModal(true);
                        }}
                        className="btn btn-sm btn-secondary"
                      >
                        Add to System
                      </button>
                    </div>
                  ))}
                  {getUsersNotInSystem().length > 10 && (
                    <div className="show-more-users">
                      +{getUsersNotInSystem().length - 10} more users
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card current-users-card">
            <div className="card-header">
              <h4>Current Users in System</h4>
            </div>
            <div className="card-body">
              <div className="users-grid">
                {allUsers.map(user => {
                  const userTeam = allTeams.find(team => team.id === user.team_id);
                  return (
                    <div key={user.id} className="user-card">
                      <div className="user-avatar">
                        {user.display_name?.charAt(0) || user.displayName?.charAt(0) || '?'}
                      </div>
                      <div className="user-info">
                        <div className="user-name">
                          {user.display_name || user.displayName}
                        </div>
                        <div className="user-email">
                          {user.email_address || user.emailAddress}
                        </div>
                        <div className="user-team">
                          {userTeam ? userTeam.name : 'No Team'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="admin-section">
          <div className="section-header">
            <h3>Analytics Dashboard</h3>
          </div>

          <div className="analytics-grid">
            <div className="card analytics-card">
              <div className="card-header">
                <h4>Requests by Status</h4>
              </div>
              <div className="card-body">
                <div className="analytics-chart">
                  <div className="chart-item">
                    <div className="chart-bar">
                      <div 
                        className="bar bar-green" 
                        style={{ height: `${(stats.approvedRequests / Math.max(stats.totalRequests, 1)) * 100}%` }}
                      ></div>
                    </div>
                    <div className="chart-label">
                      <div className="chart-value">{stats.approvedRequests}</div>
                      <div className="chart-name">Approved</div>
                    </div>
                  </div>
                  <div className="chart-item">
                    <div className="chart-bar">
                      <div 
                        className="bar bar-yellow" 
                        style={{ height: `${(stats.pendingRequests / Math.max(stats.totalRequests, 1)) * 100}%` }}
                      ></div>
                    </div>
                    <div className="chart-label">
                      <div className="chart-value">{stats.pendingRequests}</div>
                      <div className="chart-name">Pending</div>
                    </div>
                  </div>
                  <div className="chart-item">
                    <div className="chart-bar">
                      <div 
                        className="bar bar-red" 
                        style={{ height: `${(stats.declinedRequests / Math.max(stats.totalRequests, 1)) * 100}%` }}
                      ></div>
                    </div>
                    <div className="chart-label">
                      <div className="chart-value">{stats.declinedRequests}</div>
                      <div className="chart-name">Declined</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card analytics-card">
              <div className="card-header">
                <h4>Requests by Leave Type</h4>
              </div>
              <div className="card-body">
                <div className="analytics-list">
                  {Object.entries(analytics.requestsByLeaveType)
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, count]) => (
                    <div key={type} className="analytics-item">
                      <div className="item-info">
                        <span className="item-icon">
                          {type === 'vacation' ? '🏖️' : 
                           type === 'sick' ? '🤒' : 
                           type === 'personal' ? '👤' : '🎉'}
                        </span>
                        <span className="item-label">
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </span>
                      </div>
                      <div className="item-value">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card analytics-card">
              <div className="card-header">
                <h4>Requests by Team</h4>
              </div>
              <div className="card-body">
                <div className="analytics-list">
                  {Object.entries(analytics.requestsByTeam)
                    .sort(([,a], [,b]) => b - a)
                    .map(([team, count]) => (
                    <div key={team} className="analytics-item">
                      <div className="item-info">
                        <span className="item-icon">👥</span>
                        <span className="item-label">{team}</span>
                      </div>
                      <div className="item-value">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card analytics-card">
              <div className="card-header">
                <h4>Requests by Weekday</h4>
              </div>
              <div className="card-body">
                <div className="analytics-list">
                  {Object.entries(analytics.requestsByWeekday)
                    .sort(([,a], [,b]) => b - a)
                    .map(([day, count]) => (
                    <div key={day} className="analytics-item">
                      <div className="item-info">
                        <span className="item-icon">📅</span>
                        <span className="item-label">{day}</span>
                      </div>
                      <div className="item-value">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Components */}
      {showAddAdmin && (
        <Modal title="Add Admin User" onClose={() => setShowAddAdmin(false)}>
          <div className="add-admin-content">
            <p>Grant admin privileges to a user. They will be able to manage teams, users, and all PTO requests.</p>
            <UserPicker
              selectedUser={null}
              onSelect={handleAddAdmin}
              placeholder="Search and select user to grant admin privileges"
              required
            />
          </div>
        </Modal>
      )}

      {showReportModal && (
        <Modal title="Generate PTO Report" onClose={() => setShowReportModal(false)}>
          <div className="report-config">
            <div className="form-group">
              <label>Report Scope</label>
              <select
                value={reportConfig.scope}
                onChange={(e) => setReportConfig(prev => ({ ...prev, scope: e.target.value }))}
                className="form-control"
              >
                <option value="company">Full Company</option>
                <option value="team">Specific Team</option>
                <option value="user">Specific User</option>
              </select>
            </div>

            {reportConfig.scope === 'team' && (
              <div className="form-group">
                <label>Select Team</label>
                <select
                  value={reportConfig.teamId}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, teamId: e.target.value }))}
                  className="form-control"
                >
                  <option value="">Choose a team</option>
                  {allTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            )}

            {reportConfig.scope === 'user' && (
              <div className="form-group">
                <label>Select User</label>
                <select
                  value={reportConfig.userId}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, userId: e.target.value }))}
                  className="form-control"
                >
                  <option value="">Choose a user</option>
                  {allUsers.map(user => (
                    <option key={user.id} value={user.jira_account_id || user.id}>
                      {user.display_name || user.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={reportConfig.startDate}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, startDate: e.target.value }))}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={reportConfig.endDate}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, endDate: e.target.value }))}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Status Filter</label>
              <select
                value={reportConfig.status}
                onChange={(e) => setReportConfig(prev => ({ ...prev, status: e.target.value }))}
                className="form-control"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
            </div>

            <div className="form-actions">
              <button 
                onClick={() => setShowReportModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateReport}
                className="btn btn-primary"
              >
                <Download size={16} />
                Generate Report
              </button>
            </div>
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
            await invoke(teamData.id ? 'updateTeam' : 'createTeam', teamData);
            loadAllTeams();
          }}
          onDeleteTeam={async teamId => {
            await invoke('deleteTeam', { teamId, deletedBy: currentUser.accountId });
            loadAllTeams();
          }}
          onSaveUser={async userData => {
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
          isAdminMode={true}
          onClose={() => setShowAddPTOModal(false)}
          onSubmit={handleSubmitPTOForUser}
          allUsers={allUsers}
          allTeams={allTeams}
          allRequests={allRequests}
          currentUser={currentUser}
          isAdmin={true}
        />
      )}
    </div>
  );
};

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content admin-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default AdminManagement;