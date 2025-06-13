import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { CheckCircle, XCircle, RefreshCw, User, Users, Calendar } from 'lucide-react';
import StatusBadge from '../components/Common/StatusBadge';
import RequestModal from '../components/Modal/RequestModal';
import { getLeaveTypeEmoji, getLeaveTypeLabel } from '../components/Common/leaveTypeUtils';

/**
 * ManagerTab component for reviewing and responding to team PTO requests
 * 
 * @param {Object} props
 * @param {Object} props.currentUser - Current user information
 */
const ManagerTab = ({ currentUser }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Load manager data on component mount
  useEffect(() => {
    if (currentUser) {
      loadManagerData();
      loadTeamsAndUsers();
    }
  }, [currentUser]);
  
  // Load pending and approved team requests
  const loadManagerData = async () => {
    setLoading(true);
    
    try {
      // Get manager's teams
      const teamsResponse = await invoke('getManagerTeams', { 
        managerId: currentUser.id || currentUser.accountId || currentUser.jira_account_id
      });
      
      if (teamsResponse.success) {
        const managerTeams = teamsResponse.data || [];
        
        // Get team members
        const membersPromises = managerTeams.map(team => 
          invoke('getTeamMembers', { teamId: team.id })
        );
        
        const membersResponses = await Promise.all(membersPromises);
        const allMembers = membersResponses.flatMap(response => 
          response.success ? response.data : []
        );
        
        // Remove duplicates (if a user is in multiple teams)
        const uniqueMembers = Array.from(
          new Map(allMembers.map(member => [member.id, member])).values()
        );
        
        setTeamMembers(uniqueMembers);
        
        // Get pending requests for team members
        const pendingPromises = uniqueMembers.map(member => 
          invoke('getUserPendingRequests', { 
            userId: member.id || member.accountId || member.jira_account_id
          })
        );
        
        const pendingResponses = await Promise.all(pendingPromises);
        const allPendingRequests = pendingResponses.flatMap(response => 
          response.success ? response.data : []
        );
        
        setPendingRequests(allPendingRequests);
        
        // Get approved requests for team members
        const approvedPromises = uniqueMembers.map(member => 
          invoke('getUserApprovedRequests', { 
            userId: member.id || member.accountId || member.jira_account_id
          })
        );
        
        const approvedResponses = await Promise.all(approvedPromises);
        const allApprovedRequests = approvedResponses.flatMap(response => 
          response.success ? response.data : []
        );
        
        setApprovedRequests(allApprovedRequests);
      }
    } catch (error) {
      console.error('Failed to load manager data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Load teams and users for the request modal
  const loadTeamsAndUsers = async () => {
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
    } catch (error) {
      console.error('Failed to load teams and users:', error);
    }
  };
  
  // Handle approving a request
  const handleApproveRequest = async (requestId) => {
    setLoading(true);
    
    try {
      await invoke('approvePtoRequest', { requestId });
      
      // Refresh data
      await loadManagerData();
    } catch (error) {
      console.error('Failed to approve request:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle declining a request
  const handleDeclineRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to decline this request?')) {
      return;
    }
    
    setLoading(true);
    
    try {
      await invoke('declinePtoRequest', { requestId });
      
      // Refresh data
      await loadManagerData();
    } catch (error) {
      console.error('Failed to decline request:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format date range for display
  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Format the dates
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    
    if (startDate === endDate) {
      return start.toLocaleDateString(undefined, options);
    }
    
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  };
  
  // Get user display name
  const getUserDisplayName = (userId) => {
    const user = users.find(u => u.id === userId || u.jira_account_id === userId);
    
    if (user) {
      return user.display_name || user.displayName || `${user.first_name} ${user.last_name}`;
    }
    
    return 'Unknown User';
  };
  
  // Handle creating or updating a request
  const handleSubmitRequest = async (requestData) => {
    try {
      if (requestData.id) {
        // Update existing request
        await invoke('updatePtoRequest', requestData);
      } else {
        // Create new request
        await invoke('createPtoRequest', requestData);
      }
      
      // Refresh data
      await loadManagerData();
      
      return true;
    } catch (error) {
      console.error('Failed to submit request:', error);
      return false;
    }
  };
  
  // Get active requests based on current tab
  const getActiveRequests = () => {
    return activeTab === 'pending' ? pendingRequests : approvedRequests;
  };
  
  return (
    <div className="manager-tab">
      <div className="tab-header">
        <h2>Manager Dashboard</h2>
        
        <div className="tab-actions">
          <button 
            className="refresh-button" 
            onClick={loadManagerData} 
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      
      <div className="team-summary">
        <h3>Your Team</h3>
        <div className="team-members-count">
          <Users size={16} />
          <span>{teamMembers.length} team members</span>
        </div>
      </div>
      
      <div className="requests-tabs">
        <button 
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Requests ({pendingRequests.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Approved Requests ({approvedRequests.length})
        </button>
      </div>
      
      {loading && getActiveRequests().length === 0 ? (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" />
          <p>Loading requests...</p>
        </div>
      ) : getActiveRequests().length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>No {activeTab === 'pending' ? 'Pending' : 'Approved'} Requests</h3>
          <p>
            {activeTab === 'pending' 
              ? "There are no pending PTO requests from your team members." 
              : "There are no approved PTO requests from your team members."}
          </p>
        </div>
      ) : (
        <div className="requests-list manager-requests">
          {getActiveRequests().map(request => (
            <div key={request.id} className="request-card">
              <div className="request-card-header">
                <div className="request-type">
                  <span className="leave-type-emoji">
                    {getLeaveTypeEmoji(request.leave_type)}
                  </span>
                  <span className="leave-type-label">
                    {getLeaveTypeLabel(request.leave_type)}
                  </span>
                </div>
                <StatusBadge status={request.status} />
              </div>
              
              <div className="request-card-body">
                <div className="requester-info">
                  <User size={16} />
                  <span>{getUserDisplayName(request.requester_id)}</span>
                </div>
                
                <div className="request-date">
                  <Calendar size={16} />
                  <span>{formatDateRange(request.start_date, request.end_date)}</span>
                </div>
                
                <div className="request-duration">
                  <span>
                    {request.total_days} day{request.total_days !== 1 ? 's' : ''} 
                    ({request.total_hours} hours)
                  </span>
                </div>
                
                {request.reason && (
                  <div className="request-reason">
                    <p>"{request.reason}"</p>
                  </div>
                )}
              </div>
              
              <div className="request-card-footer">
                {activeTab === 'pending' ? (
                  <div className="request-actions">
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={() => handleApproveRequest(request.id)}
                      disabled={loading}
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeclineRequest(request.id)}
                      disabled={loading}
                    >
                      <XCircle size={14} />
                      Decline
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowModal(true);
                      }}
                      disabled={loading}
                    >
                      View
                    </button>
                  </div>
                ) : (
                  <div className="request-actions">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowModal(true);
                      }}
                      disabled={loading}
                    >
                      View
                    </button>
                  </div>
                )}
                
                <div className="request-meta">
                  <span className="request-date-submitted">
                    Submitted: {new Date(request.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Request Modal */}
      {showModal && (
        <RequestModal
          isOpen={showModal}
          onClose={() => {
            setSelectedRequest(null);
            setShowModal(false);
          }}
          currentUser={currentUser}
          teams={teams || []}
          users={users || []}
          onSubmit={handleSubmitRequest}
          editRequest={selectedRequest}
        />
      )}
    </div>
  );
};

export default ManagerTab;