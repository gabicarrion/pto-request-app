import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Calendar, Building2, UserCheck, X
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
        <button className={`tab-btn${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab-btn${activeTab === 'analytics' ? ' active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
      </div>
      {/* Overview */}
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
            </div>
          </div>
          {/* Recent PTO Activity */}
          <div className="card">
            <div className="card-header">Recent PTO Requests</div>
            <div className="card-body">
              {allRequests.slice(0, 5).map(request => (
                <div key={request.id} className="request-row">
                  <div className="request-avatar">
                    {request.requester_name?.charAt(0) || '?'}
                  </div>
                  <div className="request-info">
                    <span className="request-user">{request.requester_name}</span>
                    <span className="request-type">requested {request.leave_type}</span>
                    <div className="request-date">{new Date(request.start_date).toLocaleDateString()}</div>
                  </div>
                  <span className={`status-badge status-${request.status}`}>{request.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Analytics */}
      {activeTab === 'analytics' && (
        <div className="dashboard-section">
          <div className="card">
            <div className="card-header">PTO Requests by Status</div>
            <div className="card-body">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Approved</td><td>{stats.approvedRequests}</td></tr>
                  <tr><td>Pending</td><td>{stats.pendingRequests}</td></tr>
                  <tr><td>Total</td><td>{stats.totalRequests}</td></tr>
                </tbody>
              </table>
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
          <button className="btn btn-link" onClick={() => setShowAddAdmin(false)}>Close</button>
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
