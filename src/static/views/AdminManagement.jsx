import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Users, Calendar, Building2, UserCheck, X, Download, 
  BarChart3, Database, FileText, TrendingUp, Clock, CheckCircle, XCircle, Settings, Plus, Upload, AlertTriangle
} from 'lucide-react';
import { invoke } from '@forge/bridge';
import UserPicker from '../components/UserPicker';
import PTOSubmissionModal from '../components/PTOSubmissionModal';
import TeamManagementModal from '../components/TeamManagementModal';
import UserPTOManagement from '../components/UserPTOManagement';
import PTOImportModal from '../components/PTOImportModal';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportDatabaseModal, setShowImportDatabaseModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    startDate: '',
    endDate: '',
    requesterId: '',
    managerId: '',
    leaveType: ''
  });

  // Report configuration state
  const [reportConfig, setReportConfig] = useState({
    scope: 'company',
    teamId: '',
    userId: '',
    startDate: '',
    endDate: '',
    status: 'all'
  });

  // Add a state to force remount of PTOSubmissionModal
  const [ptoModalKey, setPtoModalKey] = useState(Date.now());

  const [stats, setStats] = useState({
    totalAdmins: 0,
    totalTeams: 0,
    totalUsers: 0,
    totalRequests: 0,
    approvedRequests: 0,
    pendingRequests: 0,
    declinedRequests: 0
  });

  const fileInputRef = useRef();

  // Add PTO Balances tab/section
  const [activeAdminTab, setActiveAdminTab] = useState('actions');

  // In the import modal logic, add table selection and update upload logic
  const [importTable, setImportTable] = useState('users');
  const tableOptions = [
    { value: 'users', label: 'Users' },
    { value: 'teams', label: 'Teams' },
    { value: 'pto_balances', label: 'PTO Balances' },
    // Add more as needed
  ];

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
      if (response.success) {
        const adminUsers = response.data || [];
        // Get full user details from database
        const dbResponse = await invoke('getUsers');
        const dbUsers = dbResponse.success ? dbResponse.data || [] : [];
        
        // Map admin users with full details
        const enrichedAdminUsers = adminUsers.map(admin => {
          const userDetails = dbUsers.find(u => 
            u.jira_account_id === admin.accountId || 
            u.email_address === admin.emailAddress
          );
          return userDetails || admin;
        });
        
        setAdminUsers(enrichedAdminUsers);
      }
    } catch (error) {
      console.error('Failed to load admin users:', error);
    }
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
      const response = await invoke('getInternalJiraUsers', {
        startAt: 0,
        maxResults: 50
      });
      if (response.success) {
        setJiraUsers(response.data.users || []);
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

  // Add normalizeManager function
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

  const handleSubmitPTOForUser = async (ptoData) => {
    if (!ptoData?.targetUser) {
      showNotification('Please select a user for PTO', 'error');
      return;
    }
    try {
      const normalizedManager = normalizeManager(ptoData.manager);
      const response = await invoke('submitPTOForUser', {
        requestData: {
          requester_id: ptoData.targetUser.accountId,
          requester_name: ptoData.targetUser.displayName,
          requester_email: ptoData.targetUser.emailAddress,
          manager_id: normalizedManager?.accountId || 'admin',
          manager_name: normalizedManager?.displayName || currentUser.displayName,
          manager_email: normalizedManager?.emailAddress || currentUser.emailAddress,
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
        const teamUsers = allUsers.filter(user => (user.team_ids || []).includes(reportConfig.teamId));
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
        const userTeams = user ? allTeams.filter(t => (user.team_ids || []).includes(t.id)) : [];

        return {
          'Date': new Date().toLocaleDateString(),
          'Manager': request.manager_name || '',
          'Team': userTeams.map(t => t.name).join(', '),
          'Department': userTeams.length > 0 ? userTeams[0].department : '',
          'User': request.requester_name,
          'Start Date': request.start_date,
          'End Date': request.end_date,
          'Total Days': request.total_days || 0,
          'Leave Type': request.leave_type,
          'Reason': request.reason || '',
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

  // Update stats based on current data
  useEffect(() => {
    setStats({
      totalAdmins: adminUsers.length,
      totalTeams: allTeams.length,
      totalUsers: allUsers.length,
      totalRequests: allRequests.length,
      pendingRequests: allRequests.filter(r => r.status === 'pending').length,
      approvedRequests: allRequests.filter(r => r.status === 'approved').length,
      declinedRequests: allRequests.filter(r => r.status === 'declined').length,
      usersNotInSystem: getUsersNotInSystem()?.length || 0
    });
  }, [adminUsers, allTeams, allUsers, allRequests]);

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

  // When opening the modal, increment the key
  const openAddPTOModal = () => {
    setPtoModalKey(Date.now());
    setShowAddPTOModal(true);
  };

  // Add CSV export helper
  function exportToCSV(data, filename) {
    if (!Array.isArray(data) || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(h => '"' + (row[h] ?? '').toString().replace(/"/g, '""') + '"').join(','));
    }
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Add export handler
  const handleExportDatabase = async () => {
    try {
      const response = await invoke('debugStorage');
      if (response.success && response.data) {
        if (response.data.users) exportToCSV(response.data.users, 'users.csv');
        if (response.data.teams) exportToCSV(response.data.teams, 'teams.csv');
        if (response.data.admins) exportToCSV(response.data.admins.map(a => ({ accountId: a })), 'admins.csv');
        if (response.data.pto_requests) exportToCSV(response.data.pto_requests, 'pto_requests.csv');
        if (response.data.pto_daily_schedules) exportToCSV(response.data.pto_daily_schedules, 'pto_daily_schedules.csv');
        showNotification('Database exported as CSV files!');
      } else {
        showNotification('Failed to export database', 'error');
      }
    } catch (err) {
      showNotification('Failed to export database', 'error');
    }
  };

  const handleExportPTODailySchedules = async () => {
    try {
      const response = await invoke('exportPTODailySchedules', { filters: exportFilters });
      if (response.success) {
        exportToCSV(response.data, 'pto_daily_schedules.csv');
        showNotification('Daily schedules exported successfully!');
        setShowExportModal(false);
      } else {
        showNotification(response.message || 'Failed to export daily schedules', 'error');
      }
    } catch (error) {
      showNotification('Failed to export daily schedules', 'error');
    }
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
        <button className={`admin-tab${activeAdminTab === 'actions' ? ' active' : ''}`} onClick={() => setActiveAdminTab('actions')}>Actions</button>
        <button className={`admin-tab${activeAdminTab === 'pto-balances' ? ' active' : ''}`} onClick={() => setActiveAdminTab('pto-balances')}>PTO Balances</button>
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
                  onClick={openAddPTOModal} 
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

                <button 
                  onClick={handleExportDatabase} 
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-yellow">
                    <Download size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Export Database</div>
                    <div className="action-desc">Download all tables as CSV</div>
                  </div>
                </button>

                <button 
                  onClick={() => setShowImportModal(true)} 
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-purple">
                    <Upload size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Import PTOs</div>
                    <div className="action-desc">Import PTO daily schedules from CSV</div>
                  </div>
                </button>

                <button 
                  onClick={() => setShowExportModal(true)} 
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-pink">
                    <Download size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Export Daily Schedules</div>
                    <div className="action-desc">Export PTO daily schedules</div>
                  </div>
                </button>

                <button
                  onClick={async () => {
                    if (!window.confirm('This will check all teams and fix any manager fields that are objects. Proceed?')) return;
                    setLoading(true);
                    try {
                      // 1. Fetch all teams
                      const response = await invoke('getTeams');
                      if (!response.success) throw new Error('Failed to fetch teams');
                      const teams = response.data || [];
                      let fixedCount = 0;

                      // 2. For each team, fix manager if needed
                      for (const team of teams) {
                        if (team.manager && typeof team.manager === 'object') {
                          const fixedManager =
                            team.manager.jira_account_id ||
                            team.manager.accountId ||
                            team.manager.id ||
                            null;
                          if (fixedManager) {
                            // 3. Save the fixed team
                            await invoke('updateTeam', { ...team, manager: fixedManager });
                            fixedCount++;
                          }
                        }
                      }
                      showNotification(`✅ Fixed ${fixedCount} teams with object managers.`);
                      loadAllTeams(); // Refresh teams
                    } catch (err) {
                      showNotification('Failed to fix teams: ' + err.message, 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-orange">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Fix Team Managers</div>
                    <div className="action-desc">Convert all manager fields to IDs</div>
                  </div>
                </button>

                {/* CLEANUP BUTTON - NOW IN MAIN ACTIONS GRID */}
                <button 
                  onClick={async () => {
                    if (!window.confirm('⚠️ WARNING: This will DELETE ALL PTO data (requests + daily schedules). This cannot be undone. Are you sure?')) {
                      return;
                    }
                    
                    if (!window.confirm('Final confirmation: Delete ALL PTO data? Type YES to confirm.')) {
                      return;
                    }
                    
                    setLoading(true);
                    try {
                      const response = await invoke('cleanupPTODatabase', {
                        adminId: currentUser.accountId,
                        confirmDelete: true
                      });
                      
                      if (response.success) {
                        showNotification(`✅ Cleanup complete: ${response.data.deletedCount} items removed`);
                        loadAllAdminData(); // Refresh all data
                      } else {
                        showNotification(response.message || 'Cleanup failed', 'error');
                      }
                    } catch (error) {
                      showNotification('Cleanup failed: ' + error.message, 'error');
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  className="admin-action-btn"
                  disabled={loading}
                >
                  <div className="action-icon bg-red">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">🗑️ Cleanup PTO Database</div>
                    <div className="action-desc">Delete ALL PTO requests and schedules</div>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await invoke('checkStorageSizes');
                      if (response.success) {
                        const { data } = response;
                        let message = `📊 Storage Report (${data.totalSizeKB}KB / ${data.maxAllowedKB}KB max):\n\n`;
                        
                        Object.entries(data.tables).forEach(([table, info]) => {
                          message += `${table}: ${info.records} records, ${info.sizeKB}KB\n`;
                        });
                        
                        if (data.totalSize > data.maxAllowed * 0.8) {
                          message += '\n⚠️ WARNING: Storage is over 80% full!';
                        }
                        
                        alert(message);
                      } else {
                        showNotification('Failed to check storage sizes', 'error');
                      }
                    } catch (error) {
                      showNotification('Storage check failed: ' + error.message, 'error');
                    }
                  }}
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-yellow">
                    <FileText size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">📊 Check Storage</div>
                    <div className="action-desc">View storage usage by table</div>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('This will migrate your database to the new structure. This process will backup and restructure your existing data. Proceed?')) {
                      setLoading(true);
                      try {
                        const response = await invoke('migrateDatabaseStructure');
                        if (response.success) {
                          showNotification(`✅ Migration completed: ${response.data.migratedUsers} users, ${response.data.migratedTeams} teams, ${response.data.migratedPtoRequests} PTO requests migrated.`);
                          // Refresh the data
                          loadStats();
                        } else {
                          showNotification(response.message || 'Migration failed', 'error');
                        }
                      } catch (error) {
                        showNotification('Migration failed: ' + error.message, 'error');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  className="admin-action-btn"
                  disabled={loading}
                >
                  <div className="action-icon bg-blue">
                    <Settings size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">🔄 Migrate Database</div>
                    <div className="action-desc">Restructure database to new schema</div>
                  </div>
                </button>

                <button
                  onClick={() => setShowImportDatabaseModal(true)}
                  className="admin-action-btn"
                >
                  <div className="action-icon bg-orange">
                    <Upload size={20} />
                  </div>
                  <div className="action-content">
                    <div className="action-title">Import Database</div>
                    <div className="action-desc">Upload a JSON file to replace all data</div>
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

      {activeTab === 'users' && (
        <div className="admin-section">
          <UserPTOManagement
            currentUser={currentUser}
            showNotification={showNotification}
            isAdmin={true}
          />
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
              useBackendSearch={false}
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
          key={ptoModalKey}
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

      {showImportModal && (
        <PTOImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          currentUser={currentUser}
          showNotification={showNotification}
          onImportSuccess={loadAllRequests}
        />
      )}

      {showExportModal && (
        <Modal title="Export PTO Daily Schedules" onClose={() => setShowExportModal(false)}>
          <div className="export-filters">
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={exportFilters.startDate}
                  onChange={(e) => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={exportFilters.endDate}
                  onChange={(e) => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Requester</label>
              <select
                value={exportFilters.requesterId}
                onChange={(e) => setExportFilters(prev => ({ ...prev, requesterId: e.target.value }))}
                className="form-control"
              >
                <option value="">All Requesters</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.jira_account_id || user.id}>
                    {user.display_name || user.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Manager</label>
              <select
                value={exportFilters.managerId}
                onChange={(e) => setExportFilters(prev => ({ ...prev, managerId: e.target.value }))}
                className="form-control"
              >
                <option value="">All Managers</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.jira_account_id || user.id}>
                    {user.display_name || user.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Leave Type</label>
              <select
                value={exportFilters.leaveType}
                onChange={(e) => setExportFilters(prev => ({ ...prev, leaveType: e.target.value }))}
                className="form-control"
              >
                <option value="">All Types</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="holiday">Holiday</option>
                <option value="other leave type">Other Leave Type</option>
              </select>
            </div>

            <div className="form-actions">
              <button 
                onClick={() => setShowExportModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleExportPTODailySchedules}
                className="btn btn-primary"
              >
                <Download size={16} />
                Export Schedules
              </button>
              <button 
                onClick={async () => {
                  try {
                    const response = await invoke('debugStorage');
                    console.log('🔍 DEBUG Storage Response:', response);
                    
                    if (response.success) {
                      const summary = response.data.summary;
                      showNotification(
                        `Storage Debug: ${summary.ptoRequestCount} PTO requests, ${summary.ptoScheduleCount} daily schedules`,
                        'info'
                      );
                      
                      // Also test getPTORequests
                      const ptoResponse = await invoke('getPTORequests');
                      console.log('🔍 DEBUG getPTORequests Response:', ptoResponse);
                      
                      if (ptoResponse.success) {
                        showNotification(
                          `getPTORequests returned: ${ptoResponse.data?.length || 0} total events`,
                          'info'
                        );
                      }
                    }
                  } catch (error) {
                    console.error('Debug error:', error);
                    showNotification('Debug failed: ' + error.message, 'error');
                  }
                }} 
                className="btn btn-secondary"
              >
                <Download size={16} />
                Debug Storage
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showImportDatabaseModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, margin: 'auto', padding: 24 }}>
            <h4>Import Database</h4>
            <div className="form-group">
              <label>Table to Replace</label>
              <select className="form-control" value={importTable} onChange={e => setImportTable(e.target.value)}>
                {tableOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>CSV File</label>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (e) => {
                  const text = e.target.result;
                  // Parse CSV
                  const rows = text.split(/\r?\n/).filter(Boolean);
                  const headers = rows[0].split(',').map(h => h.trim());
                  const data = rows.slice(1).map(row => {
                    const values = row.split(',');
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = values[i]; });
                    return obj;
                  });
                  // Confirm replace
                  if (!window.confirm(`This will replace all data in the '${importTable}' table. Proceed?`)) return;
                  // Call backend to overwrite table
                  await invoke('importDatabase', { table: importTable, data });
                  setShowImportDatabaseModal(false);
                  showNotification(`Imported ${data.length} records into ${importTable}.`, 'success');
                  if (importTable === 'users') await loadUsers();
                  if (importTable === 'teams') await loadTeams();
                  if (importTable === 'pto_requests') await loadAllRequests();
                  if (importTable === 'pto_daily_schedules') await loadAllRequests();
                };
                reader.readAsText(file);
              }} />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowImportDatabaseModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
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