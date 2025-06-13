import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@forge/bridge';
import { 
  Users, Calendar, TrendingUp, Download, CheckCircle, Clock, 
  MessageSquare, Filter, BarChart3, User, Eye
} from 'lucide-react';
import StatusBadge from '../Common/StatusBadge';
import { getLeaveTypeEmoji } from '../Common/leaveTypeUtils';
import DateRangeFilter from '../Common/DateRangeFilter';

const ManagerView = ({ currentUser, isAdmin, showNotification }) => {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('current_month');
  const [selectedMember, setSelectedMember] = useState('all');
  const [teams, setTeams] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingApproval, setProcessingApproval] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ preset: 'current_month', from: '', to: '' });


  useEffect(() => {
    loadManagerData();
  }, [currentUser]);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamRequests();
    }
  }, [selectedTeam, selectedTimeRange]);

  const loadManagerData = async () => {
    setLoading(true);
    try {
      // Load teams user manages
      const teamsResponse = await invoke('getTeams');
      if (teamsResponse.success) {
        const allTeams = teamsResponse.data || [];
        const managedTeams = isAdmin ? allTeams : allTeams.filter(team =>
          team.manager?.accountId === currentUser.accountId ||
          team.manager?.jira_account_id === currentUser.accountId
        );
        
        setTeams(managedTeams);
        if (managedTeams.length > 0 && !selectedTeam) {
          setSelectedTeam(managedTeams[0]);
        }
      }

      // Load pending requests for approval
      if (currentUser?.emailAddress) {
        const pendingResponse = await invoke('getPendingRequests', {
          managerEmail: currentUser.emailAddress
        });
        if (pendingResponse.success) {
          setPendingRequests(pendingResponse.data || []);
        }
      }
    } catch (error) {
      showNotification('Failed to load manager data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamRequests = async () => {
    if (!selectedTeam) return;
    
    try {
      const response = await invoke('getTeamPTORequests', {
        teamId: selectedTeam.id,
        dateRange: selectedTimeRange
      });
      if (response.success) {
        setTeamRequests(response.data || []);
      }
    } catch (error) {
      console.error('Error loading team requests:', error);
      setTeamRequests([]);
    }
  };

  const handleApproval = async (requestId, status) => {
    setProcessingApproval(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await invoke('updatePTORequest', {
        requestId,
        status
      });

      if (response.success) {
        showNotification(`Request ${status.toLowerCase()} successfully`);
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        loadTeamRequests(); // Refresh team data
      } else {
        showNotification(response.message || `Failed to ${status.toLowerCase()} request`, 'error');
      }
    } catch (error) {
      showNotification(`Failed to ${status.toLowerCase()} request`, 'error');
    } finally {
      setProcessingApproval(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedTeam) return;

    try {
      const reportData = filteredTeamRequests.map(request => ({
        'Date': new Date().toLocaleDateString(),
        'Manager': currentUser.displayName,
        'Team': selectedTeam.name,
        'Department': selectedTeam.department || '',
        'User': request.requester_name,
        'Start Date': request.start_date,
        'End Date': request.end_date,
        'Period': `${request.total_days} days`,
        'Leave Type': request.leave_type,
        'Reason': request.reason || '',
        'Status': request.status
      }));

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
      link.download = `team-pto-report-${selectedTeam.name}-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification('Report downloaded successfully!');
    } catch (error) {
      showNotification('Failed to generate report', 'error');
    }
  };

  const handleViewTeamCalendar = () => {
    // This would trigger navigation to calendar with team filter
    showNotification('Redirecting to team calendar view...', 'info');
  };

  // Filter team requests by selected member
  const filteredTeamRequests = useMemo(() => {
    let filtered = teamRequests;
    
    if (selectedMember !== 'all') {
      filtered = filtered.filter(request => request.requester_id === selectedMember);
    }
    
    return filtered.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  }, [teamRequests, selectedMember]);

  // Calculate analytics for the selected period
  const analytics = useMemo(() => {
    const requests = filteredTeamRequests;
    
    const totalRequests = requests.length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const pendingTeamRequests = requests.filter(r => r.status === 'pending').length;
    const declinedRequests = requests.filter(r => r.status === 'declined').length;
    const totalDaysOff = requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.total_days || 0), 0);

    // PTO by leave type
    const ptoByLeaveType = requests
      .filter(r => r.status === 'approved')
      .reduce((acc, request) => {
        const type = request.leave_type || 'unknown';
        acc[type] = (acc[type] || 0) + (request.total_days || 0);
        return acc;
      }, {});

    // PTO by team member
    const ptoByMember = requests
      .filter(r => r.status === 'approved')
      .reduce((acc, request) => {
        const name = request.requester_name || 'Unknown';
        acc[name] = (acc[name] || 0) + (request.total_days || 0);
        return acc;
      }, {});

    // PTO by weekday (for approved requests)
    const ptoByWeekday = requests
      .filter(r => r.status === 'approved')
      .reduce((acc, request) => {
        const start = new Date(request.start_date);
        const end = new Date(request.end_date);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
          acc[dayName] = (acc[dayName] || 0) + 1;
        }
        return acc;
      }, {});

    return {
      totalRequests,
      approvedRequests,
      pendingRequests: pendingTeamRequests,
      declinedRequests,
      totalDaysOff,
      ptoByLeaveType,
      ptoByMember,
      ptoByWeekday
    };
  }, [filteredTeamRequests]);

  // Get upcoming PTO
  const upcomingPTO = useMemo(() => {
    const today = new Date();
    return teamRequests
      .filter(r => r.status === 'approved' && new Date(r.start_date) >= today)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5);
  }, [teamRequests]);

  const formatDate = (dateString) => 
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

  const formatDateTime = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  if (loading) {
    return (
      <div className="manager-loading">
        <div className="loading-spinner"></div>
        <p>Loading manager dashboard...</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="manager-empty">
        <Users size={48} />
        <h3>No Teams to Manage</h3>
        <p>You don't have any teams assigned to manage. Contact your administrator if this is incorrect.</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      {/* Header */}
      <div className="manager-header">
        <div className="manager-title-section">
          <h2>Manager Dashboard</h2>
          <p>Manage team PTO requests and view analytics</p>
        </div>
        
        <div className="manager-controls">
          <select
            value={selectedTeam?.id || ''}
            onChange={(e) => setSelectedTeam(teams.find(t => t.id === e.target.value))}
            className="form-control"
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.members?.length || 0} members)
              </option>
            ))}
          </select>

          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="manager-stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{analytics.totalRequests}</div>
            <div className="stat-label">Total Requests</div>
          </div>
        </div>
        
        <div className="stat-card stat-yellow">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{pendingRequests.length}</div>
            <div className="stat-label">Pending Approval</div>
          </div>
        </div>
        
        <div className="stat-card stat-green">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{analytics.approvedRequests}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        
        <div className="stat-card stat-purple">
          <div className="stat-icon"><TrendingUp size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{analytics.totalDaysOff}</div>
            <div className="stat-label">Days Off</div>
          </div>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingRequests.length > 0 && (
        <div className="card pending-approvals-card">
          <div className="card-header">
            <h3>Pending Approvals</h3>
            <div className="pending-count">{pendingRequests.length} requests</div>
          </div>
          <div className="card-body">
            <div className="pending-requests-list">
              {pendingRequests.slice(0, 5).map(request => (
                <div key={request.id} className="pending-request-item">
                  <div className="request-info">
                    <div className="request-user">
                      <div className="user-avatar">
                        {request.requester_name?.charAt(0) || <User size={16} />}
                      </div>
                      <div className="user-details">
                        <div className="user-name">{request.requester_name}</div>
                        <div className="request-details">
                          {getLeaveTypeEmoji(request.leave_type)} {request.leave_type} • {request.total_days} days
                        </div>
                      </div>
                    </div>
                    <div className="request-dates">
                      <div>{formatDate(request.start_date)} - {formatDate(request.end_date)}</div>
                      <div className="submitted-date">Submitted {formatDateTime(request.submitted_at)}</div>
                    </div>
                  </div>
                  
                  <div className="request-actions-inline">
                    <div className="action-buttons-inline">
                      <button
                        onClick={() => handleApproval(request.id, 'approved')}
                        disabled={processingApproval[request.id]}
                        className="btn btn-sm btn-success"
                      >
                        {processingApproval[request.id] ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleApproval(request.id, 'declined')}
                        disabled={processingApproval[request.id]}
                        className="btn btn-sm btn-danger"
                      >
                        {processingApproval[request.id] ? '...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pendingRequests.length > 5 && (
              <div className="show-more">
                <p className="text-sm text-gray-600">
                  {pendingRequests.length - 5} more pending requests...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="manager-content-grid">
        {/* Team Requests Section */}
        <div className="card team-requests-card">
          <div className="card-header">
            <h3>Team Requests</h3>
            <div className="team-requests-controls">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="form-control"
              >
                <option value="all">All Members</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              
              <div className="action-buttons-group">
                <button onClick={handleGenerateReport} className="btn btn-primary">
                  <Download size={16} />
                  Generate Report
                </button>
              </div>
            </div>
          </div>
          
          <div className="card-body">
            {filteredTeamRequests.length === 0 ? (
              <div className="empty-state">
                <Users size={48} />
                <h4>No Requests Found</h4>
                <p>No PTO requests found for the selected criteria.</p>
              </div>
            ) : (
              <div className="team-requests-list">
                {filteredTeamRequests.map(request => (
                  <div key={request.id} className="team-request-item">
                    <div className="request-header-row">
                      <div className="request-user-info">
                        <div className="user-avatar">
                          {request.requester_name?.charAt(0) || '?'}
                        </div>
                        <div className="user-details">
                          <div className="user-name">{request.requester_name}</div>
                          <div className="request-type">
                            {getLeaveTypeEmoji(request.leave_type)} {request.leave_type}
                          </div>
                        </div>
                      </div>
                      
                      <div className="request-details-summary">
                        <div className="date-range">
                          {formatDate(request.start_date)} - {formatDate(request.end_date)}
                        </div>
                        <div className="duration">{request.total_days} days</div>
                      </div>
                      
                      <div className="request-status-section">
                        <StatusBadge status={request.status} />
                        <div className="submitted-date">
                          {formatDateTime(request.submitted_at)}
                        </div>
                      </div>
                    </div>
                    
                    {request.reason && (
                      <div className="request-reason-row">
                        <span className="reason-label">Reason:</span>
                        <span className="reason-text">{request.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming PTO */}
        <div className="card upcoming-pto-card">
          <div className="card-header">
            <h3>Upcoming PTO</h3>
          </div>
          <div className="card-body">
            {upcomingPTO.length === 0 ? (
              <div className="empty-state-small">
                <Calendar size={32} />
                <p>No upcoming PTO scheduled</p>
              </div>
            ) : (
              <div className="upcoming-pto-list">
                {upcomingPTO.map(request => (
                  <div key={request.id} className="upcoming-pto-item">
                    <div className="pto-user">
                      <div className="user-avatar-small">
                        {request.requester_name?.charAt(0) || '?'}
                      </div>
                      <div className="user-info-small">
                        <div className="user-name-small">{request.requester_name}</div>
                        <div className="pto-type-small">
                          {getLeaveTypeEmoji(request.leave_type)} {request.leave_type}
                        </div>
                      </div>
                    </div>
                    <div className="pto-dates-small">
                      <div className="date-range-small">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </div>
                      <div className="duration-small">{request.total_days} days</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="card analytics-card">
          <div className="card-header">
            <h3>Team Analytics</h3>
            <div className="analytics-period">
              {selectedTimeRange.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
          </div>
          <div className="card-body">
            {/* PTO by Leave Type */}
            {Object.keys(analytics.ptoByLeaveType).length > 0 && (
              <div className="analytics-section">
                <h4>PTO by Leave Type</h4>
                <div className="analytics-items">
                  {Object.entries(analytics.ptoByLeaveType)
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, days]) => (
                    <div key={type} className="analytics-item">
                      <span className="item-icon">{getLeaveTypeEmoji(type)}</span>
                      <span className="item-label">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                      <span className="item-value">{days} days</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PTO by Team Member */}
            {Object.keys(analytics.ptoByMember).length > 0 && (
              <div className="analytics-section">
                <h4>PTO by Team Member</h4>
                <div className="analytics-items">
                  {Object.entries(analytics.ptoByMember)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([member, days]) => (
                    <div key={member} className="analytics-item">
                      <span className="item-icon">👤</span>
                      <span className="item-label">{member}</span>
                      <span className="item-value">{days} days</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PTO by Weekday */}
            {Object.keys(analytics.ptoByWeekday).length > 0 && (
              <div className="analytics-section">
                <h4>Most Popular Days Off</h4>
                <div className="analytics-items">
                  {Object.entries(analytics.ptoByWeekday)
                    .sort(([,a], [,b]) => b - a)
                    .map(([day, count]) => (
                    <div key={day} className="analytics-item">
                      <span className="item-icon">📅</span>
                      <span className="item-label">{day}</span>
                      <span className="item-value">{count} days</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>


    </div>
  );
};

export default ManagerView;