import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { Users, Calendar, TrendingUp, User, Download } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { getLeaveTypeEmoji } from '../components/leaveTypeUtils';

const TeamPage = ({ teamData, requests, currentUser }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('current_month');
  const [selectedTeamMember, setSelectedTeamMember] = useState('all');
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamRequests, setTeamRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => { if (currentUser) fetchTeams(); }, [currentUser]);
  useEffect(() => { if (selectedTeam) fetchTeamRequests(); }, [selectedTeam, selectedTimeRange]);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await invoke('getTeams');
      if (response.success) {
        const teamsData = response.data || [];
        setTeams(teamsData);
        const userTeam = teamsData.find(team =>
          team.manager?.accountId === currentUser.accountId ||
          team.members?.some(member => member.accountId === currentUser.accountId)
        );
        setSelectedTeam(userTeam || teamsData[0] || null);
      } else {
        throw new Error(response.message || 'Failed to load teams');
      }
    } catch (err) {
      setError('Failed to load teams: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamRequests = async () => {
    if (!selectedTeam) return;
    try {
      const response = await invoke('getTeamPTORequests', {
        teamId: selectedTeam.id,
        dateRange: selectedTimeRange
      });
      setTeamRequests(response.success ? (response.data || []) : []);
    } catch {
      setTeamRequests([]);
    }
  };

  const handleViewTeamCalendar = async () => {
    if (!selectedTeam) return;
    try {
      const today = new Date();
      const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);
      const response = await invoke('getPTOCalendarEvents', {
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      if (response.success) {
        const teamMemberEmails = selectedTeam.members.map(m => m.emailAddress);
        const teamEvents = (response.data || []).filter(event =>
          teamMemberEmails.includes(event.user?.email)
        );
        setCalendarEvents(teamEvents);
        alert(`Found ${teamEvents.length} team PTO events. (Calendar integration coming soon)`);
      }
    } catch {
      alert('Failed to load calendar events');
    }
  };

  const handleGenerateReport = () => {
    if (!selectedTeam) return;
    try {
      const reportData = filteredRequests.map(request => ({
        'Employee Name': request.requester_name,
        'Email': request.requester_email,
        'Leave Type': request.leave_type,
        'Start Date': request.start_date,
        'End Date': request.end_date,
        'Total Days': request.total_days,
        'Status': request.status,
        'Submitted Date': new Date(request.submitted_at).toLocaleDateString(),
        'Reason': request.reason
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
      alert('Report downloaded successfully!');
    } catch {
      alert('Failed to generate report');
    }
  };

  const getTeamStats = () => {
    const activeRequests = teamRequests || [];
    const totalRequests = activeRequests.length;
    const approvedRequests = activeRequests.filter(r => r.status === 'approved').length;
    const pendingRequests = activeRequests.filter(r => r.status === 'pending').length;
    const totalDaysOff = activeRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.total_days || 0), 0);
    return { totalRequests, approvedRequests, pendingRequests, totalDaysOff };
  };

  const getUpcomingPTO = () => {
    const today = new Date();
    return (teamRequests || [])
      .filter(r => r.status === 'approved' && new Date(r.start_date) >= today)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5);
  };

  const filterRequestsByMember = () => {
    let filtered = teamRequests || [];
    if (selectedTeamMember !== 'all') {
      filtered = filtered.filter(r => r.requester_id === selectedTeamMember);
    }
    return filtered.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  };

  const getTeamMembers = () => (selectedTeam?.members || []);
  const stats = getTeamStats();
  const upcomingPTO = getUpcomingPTO();
  const filteredRequests = filterRequestsByMember();
  const teamMembers = getTeamMembers();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading team information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3 className="error-title">Error Loading Teams</h3>
        <p className="error-desc">{error}</p>
        <button className="btn btn-primary" onClick={fetchTeams}>Retry</button>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="empty-state-card">
        <Users size={48} className="empty-icon" />
        <h3>No Teams Found</h3>
        <p>You don't have access to any teams yet. Contact your administrator to be added to a team.</p>
      </div>
    );
  }

  return (
    <div className="team-dashboard">
      {/* Team Header & Selector */}
      <div className="card team-header-card">
        <div className="team-header">
          <div className="team-header-title">
            <div className="team-header-icon"><Users size={20} /></div>
            <div>
              <h1>Team Dashboard</h1>
              <p>Manage and overview team PTO requests</p>
            </div>
          </div>
          <select
            className="team-select"
            value={selectedTeam?.id || ''}
            onChange={e => setSelectedTeam(teams.find(t => t.id === e.target.value))}
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.members?.length || 0} members)
              </option>
            ))}
          </select>
        </div>
        {selectedTeam && (
          <div className="team-meta">
            <div>
              <h3>{selectedTeam.name}</h3>
              {selectedTeam.description && <p>{selectedTeam.description}</p>}
              <p className="team-manager">Manager: {selectedTeam.manager?.displayName || 'Not assigned'}</p>
            </div>
            <div className="team-member-count">
              <div>{teamMembers.length}</div>
              <div>Team Members</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="team-stats-cards">
        <div className="team-stat-card stat-blue">
          <span className="team-stat-label">Total Requests</span>
          <span className="team-stat-value">{stats.totalRequests}</span>
          <Calendar size={20} />
        </div>
        <div className="team-stat-card stat-green">
          <span className="team-stat-label">Approved</span>
          <span className="team-stat-value">{stats.approvedRequests}</span>
          <TrendingUp size={20} />
        </div>
        <div className="team-stat-card stat-yellow">
          <span className="team-stat-label">Pending</span>
          <span className="team-stat-value">{stats.pendingRequests}</span>
          <Calendar size={20} />
        </div>
        <div className="team-stat-card stat-purple">
          <span className="team-stat-label">Total Days Off</span>
          <span className="team-stat-value">{stats.totalDaysOff}</span>
          <Users size={20} />
        </div>
      </div>

      <div className="team-dashboard-panels">
        {/* Team Members */}
        <div className="card team-members-panel">
          <h3>Team Members</h3>
          {teamMembers.length === 0 ? (
            <div className="empty-panel">
              <User size={24} className="empty-icon" />
              <p>No team members</p>
            </div>
          ) : (
            teamMembers.map(member => {
              const memberRequests = (teamRequests || []).filter(r => r.requester_id === member.accountId);
              const activePTO = memberRequests.filter(r =>
                r.status === 'approved' &&
                new Date(r.start_date) <= new Date() &&
                new Date(r.end_date) >= new Date()
              );
              return (
                <div key={member.accountId} className="team-member-row">
                  <div className="team-member-avatar">
                    {member.displayName?.charAt(0) || 'U'}
                  </div>
                  <div className="team-member-details">
                    <div>{member.displayName || 'Unknown'}</div>
                    <div>{member.emailAddress || ''}</div>
                  </div>
                  {activePTO.length > 0 && <div className="on-pto-badge">On PTO</div>}
                </div>
              );
            })
          )}
        </div>

        {/* Upcoming PTO */}
        <div className="card upcoming-pto-panel">
          <h3>Upcoming PTO</h3>
          {upcomingPTO.length === 0 ? (
            <div className="empty-panel">
              <Calendar size={32} className="empty-icon" />
              <p>No upcoming PTO scheduled</p>
            </div>
          ) : (
            upcomingPTO.map(request => (
              <div key={request.id} className="upcoming-pto-row">
                <span className="upcoming-pto-emoji">{getLeaveTypeEmoji(request.leave_type)}</span>
                <div className="upcoming-pto-details">
                  <div>{request.requester_name}</div>
                  <div>{new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</div>
                </div>
                <div className="upcoming-pto-days">{request.total_days}d</div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="card quick-actions-panel">
          <h3>Quick Actions</h3>
          <button className="btn quick-action-btn" onClick={handleViewTeamCalendar}>
            <Calendar size={20} />
            <span>View Team Calendar</span>
          </button>
          <button className="btn quick-action-btn" onClick={handleGenerateReport}>
            <Download size={20} />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="card recent-requests-panel">
        <div className="recent-requests-header">
          <h3>Recent Team Requests</h3>
          <div className="recent-requests-filters">
            <select className="filter-select" value={selectedTeamMember} onChange={e => setSelectedTeamMember(e.target.value)}>
              <option value="all">All Members</option>
              {teamMembers.map(member => (
                <option key={member.accountId} value={member.accountId}>{member.displayName}</option>
              ))}
            </select>
            <select className="filter-select" value={selectedTimeRange} onChange={e => setSelectedTimeRange(e.target.value)}>
              <option value="current_month">This Month</option>
              <option value="next_month">Next Month</option>
              <option value="next_3_months">Next 3 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
        {filteredRequests.length === 0 ? (
          <div className="empty-panel">
            <Users size={32} className="empty-icon" />
            <p>No requests found for the selected criteria</p>
          </div>
        ) : (
          filteredRequests.slice(0, 10).map(request => (
            <div key={request.id} className="recent-request-row">
              <div className="recent-request-user">
                <div className="recent-request-avatar">
                  {request.requester_name?.charAt(0) || <User size={16} />}
                </div>
                <div>
                  <div>{request.requester_name}</div>
                  <div>{getLeaveTypeEmoji(request.leave_type)} {request.leave_type} • {request.total_days} days</div>
                </div>
              </div>
              <div className="recent-request-info">
                <div>
                  <div>{new Date(request.start_date).toLocaleDateString()}</div>
                  <div>{new Date(request.submitted_at).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={request.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamPage;
