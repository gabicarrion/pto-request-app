import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Helper function for default availability
function getDefaultAvailability() {
  return [
    { dayOfWeek: 1, dayName: 'Monday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 2, dayName: 'Tuesday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 3, dayName: 'Wednesday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 4, dayName: 'Thursday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 5, dayName: 'Friday', isWorkingDay: true, startTime: '09:00', endTime: '17:00', hoursPerDay: 8 },
    { dayOfWeek: 6, dayName: 'Saturday', isWorkingDay: false, startTime: '', endTime: '', hoursPerDay: 0 },
    { dayOfWeek: 7, dayName: 'Sunday', isWorkingDay: false, startTime: '', endTime: '', hoursPerDay: 0 }
  ];
}

// Initialize PTO Database
resolver.define('initializePTODatabase', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database...');
    
    // Initialize empty arrays for each table if they don't exist
    const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances'];
    
    for (const table of tables) {
      const existing = await storage.get(table);
      if (!existing) {
        await storage.set(table, []);
        console.log(`✅ Initialized table: ${table}`);
      }
    }
    
    return {
      success: true,
      message: 'PTO Database initialized successfully'
    };
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Initialize PTO Database with Team Management (simplified)
resolver.define('initializePTODatabaseWithTeamManagement', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database with Team Management...');
    
    // Initialize empty arrays for each table if they don't exist
    const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances', 'pto_admins', 'teams', 'users'];
    
    for (const table of tables) {
      const existing = await storage.get(table);
      if (!existing) {
        await storage.set(table, []);
        console.log(`✅ Initialized table: ${table}`);
      }
    }
    
    return {
      success: true,
      data: {
        pto: { success: true, message: 'PTO tables initialized' },
        teamUser: { success: true, message: 'Team/User tables initialized' },
        admin: { success: true, message: 'Admin setup ready' },
        initialized: true,
        timestamp: new Date().toISOString()
      },
      message: 'PTO Database with Team Management initialized successfully'
    };
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Get Current User
resolver.define('getCurrentUser', async (req) => {
  try {
    console.log('🔍 Fetching current user...');
    
    const response = await api.asUser().requestJira(route`/rest/api/3/myself`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const userData = await response.json();
    
    console.log('✅ Successfully fetched user data');
    return {
      success: true,
      data: {
        accountId: userData.accountId,
        displayName: userData.displayName,
        emailAddress: userData.emailAddress,
        avatarUrl: userData.avatarUrls?.['48x48'] || userData.avatarUrls?.['32x32'] || null
      }
    };
    
  } catch (error) {
    console.error('❌ Error fetching current user:', error);
    
    return {
      success: false,
      message: 'Failed to fetch current user: ' + error.message,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        type: 'NETWORK_ERROR'
      }
    };
  }
});

// Get Current User Fallback
resolver.define('getCurrentUserFallback', async (req) => {
  try {
    console.log('🔍 Using fallback method to get current user...');
    
    // Try to get user info from request context first
    if (req.context && req.context.accountId) {
      console.log('✅ Found user in request context');
      return {
        success: true,
        data: {
          accountId: req.context.accountId,
          displayName: req.context.displayName || 'Unknown User',
          emailAddress: req.context.emailAddress || '',
          avatarUrl: null
        },
        source: 'context'
      };
    }
    
    // If no context, return a generic error
    return {
      success: false,
      message: 'Unable to determine current user from context',
      error: {
        code: 'NO_USER_CONTEXT',
        type: 'CONTEXT_ERROR'
      }
    };
    
  } catch (error) {
    console.error('❌ Error in fallback user fetch:', error);
    return {
      success: false,
      message: 'Fallback user fetch failed: ' + error.message
    };
  }
});

// Check User Admin Status
resolver.define('checkUserAdminStatus', async (req) => {
  try {
    const { accountId } = req.payload || {};
    console.log('👑 Checking admin status for:', accountId);
    
    const admins = await storage.get('pto_admins') || [];
    const isAdmin = admins.includes(accountId);
    
    return {
      success: true,
      data: { isAdmin }
    };
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return {
      success: false,
      data: { isAdmin: false },
      message: error.message
    };
  }
});

// Add Admin User
resolver.define('addAdminUser', async (req) => {
  try {
    const { accountId, addedBy } = req.payload || {};
    console.log('👑 Adding admin user:', accountId);
    
    const admins = await storage.get('pto_admins') || [];
    
    if (!admins.includes(accountId)) {
      admins.push(accountId);
      await storage.set('pto_admins', admins);
      
      // Log the action
      const adminLog = await storage.get('pto_admin_log') || [];
      adminLog.push({
        action: 'ADMIN_ADDED',
        targetUserId: accountId,
        performedBy: addedBy,
        timestamp: new Date().toISOString()
      });
      await storage.set('pto_admin_log', adminLog);
    }
    
    return {
      success: true,
      message: 'Admin user added successfully'
    };
  } catch (error) {
    console.error('❌ Error adding admin user:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Remove Admin User
resolver.define('removeAdminUser', async (req) => {
  try {
    const { accountId, removedBy } = req.payload || {};
    console.log('👑 Removing admin user:', accountId);
    
    const admins = await storage.get('pto_admins') || [];
    const updatedAdmins = admins.filter(id => id !== accountId);
    
    await storage.set('pto_admins', updatedAdmins);
    
    // Log the action
    const adminLog = await storage.get('pto_admin_log') || [];
    adminLog.push({
      action: 'ADMIN_REMOVED',
      targetUserId: accountId,
      performedBy: removedBy,
      timestamp: new Date().toISOString()
    });
    await storage.set('pto_admin_log', adminLog);
    
    return {
      success: true,
      message: 'Admin user removed successfully'
    };
  } catch (error) {
    console.error('❌ Error removing admin user:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Get Admin Users
resolver.define('getAdminUsers', async (req) => {
  try {
    console.log('👑 Getting admin users');
    const adminIds = await storage.get('pto_admins') || [];
    
    const adminUsers = adminIds.map(adminId => ({ accountId: adminId }));
    
    return {
      success: true,
      data: adminUsers
    };
  } catch (error) {
    console.error('❌ Error getting admin users:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
// Basic API handlers for webtriggers
export const usersApiHandler = async (req) => {
  try {
    console.log('🔍 Users API handler called');
    
    // Simple response for now
    return {
      body: JSON.stringify({
        success: true,
        message: 'Users API endpoint',
        data: []
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 200
    };
  } catch (error) {
    console.error('❌ Error in users API handler:', error);
    return {
      body: JSON.stringify({
        success: false,
        message: error.message
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 500
    };
  }
};

export const teamsApiHandler = async (req) => {
  try {
    console.log('🔍 Teams API handler called');
    
    return {
      body: JSON.stringify({
        success: true,
        message: 'Teams API endpoint',
        data: []
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 200
    };
  } catch (error) {
    console.error('❌ Error in teams API handler:', error);
    return {
      body: JSON.stringify({
        success: false,
        message: error.message
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 500
    };
  }
};

export const availabilityApiHandler = async (req) => {
  try {
    console.log('🔍 Availability API handler called');
    
    return {
      body: JSON.stringify({
        success: true,
        message: 'Availability API endpoint',
        data: []
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 200
    };
  } catch (error) {
    console.error('❌ Error in availability API handler:', error);
    return {
      body: JSON.stringify({
        success: false,
        message: error.message
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 500
    };
  }
};

// Teams Management
resolver.define('getTeams', async (req) => {
  try {
    const teams = await storage.get('teams') || [];
    return {
      success: true,
      data: teams
    };
  } catch (error) {
    console.error('❌ Error getting teams:', error);
    return {
      success: false,
      message: error.message || 'Failed to get teams'
    };
  }
});

resolver.define('createTeam', async (req) => {
  try {
    const teamData = req.payload || {};
    const teams = await storage.get('teams') || [];
    
    const newTeam = {
      id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: teamData.name || '',
      description: teamData.description || '',
      department: teamData.department || '',
      color: teamData.color || '#667eea',
      manager: teamData.manager || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    teams.push(newTeam);
    await storage.set('teams', teams);

    return {
      success: true,
      data: newTeam,
      message: 'Team created successfully'
    };
  } catch (error) {
    console.error('❌ Error creating team:', error);
    return {
      success: false,
      message: error.message || 'Failed to create team'
    };
  }
});

// Users Management
resolver.define('getUsers', async (req) => {
  try {
    const users = await storage.get('users') || [];
    return {
      success: true,
      data: users
    };
  } catch (error) {
    console.error('❌ Error getting users:', error);
    return {
      success: false,
      message: error.message || 'Failed to get users'
    };
  }
});

resolver.define('createUser', async (req) => {
  try {
    const userData = req.payload || {};
    const users = await storage.get('users') || [];
    
    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      first_name: userData.firstName || '',
      last_name: userData.lastName || '',
      display_name: userData.displayName || '',
      email_address: userData.emailAddress || '',
      jira_account_id: userData.jiraAccountId || '',
      employment_type: userData.employmentType || 'full-time',
      hire_date: userData.hireDate || '',
      team_id: userData.teamId || null,
      capacity: userData.capacity || 40,
      availability: userData.availability || getDefaultAvailability(),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    users.push(newUser);
    await storage.set('users', users);

    return {
      success: true,
      data: newUser,
      message: 'User created successfully'
    };
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return {
      success: false,
      message: error.message || 'Failed to create user'
    };
  }
});

// PTO Requests Management
resolver.define('submitPTORequest', async (req) => {
  try {
    const requestData = req.payload || {};
    const ptoRequests = await storage.get('pto_requests') || [];
    
    const newRequest = {
      id: `pto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requester_id: requestData.requester_id,
      requester_name: requestData.requester_name,
      requester_email: requestData.requester_email,
      manager_id: requestData.manager_id,
      manager_name: requestData.manager_name,
      manager_email: requestData.manager_email,
      start_date: requestData.start_date,
      end_date: requestData.end_date,
      total_days: requestData.total_days || 0,
      total_hours: requestData.total_hours || 0,
      reason: requestData.reason || '',
      status: 'pending',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    ptoRequests.push(newRequest);
    await storage.set('pto_requests', ptoRequests);

    // Handle daily schedules if provided
    if (requestData.daily_schedules && requestData.daily_schedules.length > 0) {
      const dailySchedules = await storage.get('pto_daily_schedules') || [];
      
      const scheduleRecords = requestData.daily_schedules.map(schedule => ({
        id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        request_id: newRequest.id,
        date: schedule.date,
        type: schedule.type,
        leave_type: schedule.leaveType || 'vacation',
        hours: schedule.hours || (schedule.type === 'FULL_DAY' ? 8 : 4),
        requester_id: requestData.requester_id,
        created_at: new Date().toISOString()
      }));
      
      dailySchedules.push(...scheduleRecords);
      await storage.set('pto_daily_schedules', dailySchedules);
    }

    return {
      success: true,
      data: newRequest,
      message: 'PTO request submitted successfully'
    };
  } catch (error) {
    console.error('❌ Error submitting PTO request:', error);
    return {
      success: false,
      message: error.message || 'Failed to submit PTO request'
    };
  }
});

resolver.define('getPTORequests', async (req) => {
  try {
    const { requester_id, status } = req.payload || {};
    let requests = await storage.get('pto_requests') || [];
    
    // Filter by requester if provided
    if (requester_id) {
      requests = requests.filter(request => request.requester_id === requester_id);
    }
    
    // Filter by status if provided
    if (status && status !== 'all') {
      requests = requests.filter(request => request.status === status);
    }
    
    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return {
      success: true,
      data: requests
    };
  } catch (error) {
    console.error('❌ Error getting PTO requests:', error);
    return {
      success: false,
      message: error.message || 'Failed to get PTO requests'
    };
  }
});

resolver.define('updatePTORequestStatus', async (req) => {
  try {
    const { requestId, status, reviewedBy, comments } = req.payload || {};
    const requests = await storage.get('pto_requests') || [];
    
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    requests[requestIndex].status = status;
    requests[requestIndex].reviewed_by = reviewedBy;
    requests[requestIndex].reviewed_at = new Date().toISOString();
    requests[requestIndex].comments = comments || '';
    requests[requestIndex].updated_at = new Date().toISOString();
    
    await storage.set('pto_requests', requests);
    
    return {
      success: true,
      data: requests[requestIndex],
      message: 'PTO request status updated successfully'
    };
  } catch (error) {
    console.error('❌ Error updating PTO request status:', error);
    return {
      success: false,
      message: error.message || 'Failed to update PTO request status'
    };
  }
});
// User Teams Management
resolver.define('getUserTeams', async (req) => {
  try {
    const { userId } = req.payload || {};
    const teams = await storage.get('teams') || [];
    const users = await storage.get('users') || [];
    
    // Find user
    const user = users.find(u => u.id === userId || u.jira_account_id === userId);
    if (!user) {
      return {
        success: true,
        data: []
      };
    }
    
    // Get user's teams (if user has team_memberships array)
    let userTeams = [];
    if (user.team_memberships && Array.isArray(user.team_memberships)) {
      userTeams = teams.filter(team => 
        user.team_memberships.some(membership => membership.team_id === team.id)
      );
    } else if (user.team_id) {
      // Legacy: if user has a single team_id
      const team = teams.find(t => t.id === user.team_id);
      if (team) userTeams = [team];
    }
    
    return {
      success: true,
      data: userTeams
    };
  } catch (error) {
    console.error('❌ Error getting user teams:', error);
    return {
      success: false,
      message: error.message || 'Failed to get user teams',
      data: []
    };
  }
});

// Update Team
resolver.define('updateTeam', async (req) => {
  try {
    const teamData = req.payload || {};
    const teams = await storage.get('teams') || [];
    
    const teamIndex = teams.findIndex(t => t.id === teamData.id);
    if (teamIndex === -1) {
      throw new Error('Team not found');
    }
    
    teams[teamIndex] = {
      ...teams[teamIndex],
      ...teamData,
      updated_at: new Date().toISOString()
    };
    
    await storage.set('teams', teams);
    
    return {
      success: true,
      data: teams[teamIndex],
      message: 'Team updated successfully'
    };
  } catch (error) {
    console.error('❌ Error updating team:', error);
    return {
      success: false,
      message: error.message || 'Failed to update team'
    };
  }
});

// Delete Team
resolver.define('deleteTeam', async (req) => {
  try {
    const { teamId } = req.payload || {};
    const teams = await storage.get('teams') || [];
    
    const filteredTeams = teams.filter(t => t.id !== teamId);
    await storage.set('teams', filteredTeams);
    
    return {
      success: true,
      message: 'Team deleted successfully'
    };
  } catch (error) {
    console.error('❌ Error deleting team:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete team'
    };
  }
});

// Update User
resolver.define('updateUser', async (req) => {
  try {
    const userData = req.payload || {};
    const users = await storage.get('users') || [];
    
    const userIndex = users.findIndex(u => u.id === userData.id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    users[userIndex] = {
      ...users[userIndex],
      ...userData,
      updated_at: new Date().toISOString()
    };
    
    await storage.set('users', users);
    
    return {
      success: true,
      data: users[userIndex],
      message: 'User updated successfully'
    };
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return {
      success: false,
      message: error.message || 'Failed to update user'
    };
  }
});

// Delete User
resolver.define('deleteUser', async (req) => {
  try {
    const { userId } = req.payload || {};
    const users = await storage.get('users') || [];
    
    const filteredUsers = users.filter(u => u.id !== userId);
    await storage.set('users', filteredUsers);
    
    return {
      success: true,
      message: 'User deleted successfully'
    };
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete user'
    };
  }
});

// Get User by ID
resolver.define('getUserById', async (req) => {
  try {
    const { userId } = req.payload || {};
    const users = await storage.get('users') || [];
    
    const user = users.find(u => u.id === userId || u.jira_account_id === userId);
    
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    return {
      success: true,
      data: user
    };
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return {
      success: false,
      message: error.message || 'Failed to get user'
    };
  }
});

// Cancel PTO Request
resolver.define('cancelPTORequest', async (req) => {
  try {
    const { requestId } = req.payload || {};
    const requests = await storage.get('pto_requests') || [];
    
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    requests[requestIndex].status = 'cancelled';
    requests[requestIndex].updated_at = new Date().toISOString();
    
    await storage.set('pto_requests', requests);
    
    return {
      success: true,
      data: requests[requestIndex],
      message: 'PTO request cancelled successfully'
    };
  } catch (error) {
    console.error('❌ Error cancelling PTO request:', error);
    return {
      success: false,
      message: error.message || 'Failed to cancel PTO request'
    };
  }
});
// PTO Balances Management
resolver.define('getUserPTOBalances', async (req) => {
  try {
    const { accountId } = req.payload || {};
    const balances = await storage.get('pto_balances') || [];
    
    const userBalances = balances.filter(b => b.user_id === accountId || b.account_id === accountId);
    
    return {
      success: true,
      data: userBalances
    };
  } catch (error) {
    console.error('❌ Error getting PTO balances:', error);
    return {
      success: false,
      message: error.message || 'Failed to get PTO balances'
    };
  }
});

// Search Database Users
resolver.define('searchDatabaseUsers', async (req) => {
  try {
    const { query, filterBy = 'all', startAt = 0, maxResults = 50 } = req.payload || {};
    const users = await storage.get('users') || [];
    
    let filteredUsers = [...users];
    
    // Apply search query if provided
    if (query && query.length >= 1) {
      const searchLower = query.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        (user.display_name || '').toLowerCase().includes(searchLower) ||
        (user.first_name || '').toLowerCase().includes(searchLower) ||
        (user.last_name || '').toLowerCase().includes(searchLower) ||
        (user.email_address || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(startAt, startAt + maxResults);
    
    return {
      success: true,
      data: {
        users: paginatedUsers,
        total,
        startAt,
        maxResults,
        isLast: startAt + maxResults >= total
      }
    };
  } catch (error) {
    console.error('❌ Error searching users:', error);
    return {
      success: false,
      message: error.message || 'Failed to search users'
    };
  }
});

// Get Pending Requests (for managers)
resolver.define('getPendingRequests', async (req) => {
  try {
    const { managerId } = req.payload || {};
    let requests = await storage.get('pto_requests') || [];
    
    // Filter for pending requests
    requests = requests.filter(request => request.status === 'pending');
    
    // If managerId provided, filter by manager
    if (managerId) {
      requests = requests.filter(request => request.manager_id === managerId);
    }
    
    // Sort by submission date (oldest first for managers to review)
    requests.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    
    return {
      success: true,
      data: requests
    };
  } catch (error) {
    console.error('❌ Error getting pending requests:', error);
    return {
      success: false,
      message: error.message || 'Failed to get pending requests'
    };
  }
});

// Get All Requests (for admins)
resolver.define('getAllRequests', async (req) => {
  try {
    const { status, startDate, endDate, startAt = 0, maxResults = 100 } = req.payload || {};
    let requests = await storage.get('pto_requests') || [];
    
    // Filter by status if provided
    if (status && status !== 'all') {
      requests = requests.filter(request => request.status === status);
    }
    
    // Filter by date range if provided
    if (startDate) {
      requests = requests.filter(request => request.start_date >= startDate);
    }
    if (endDate) {
      requests = requests.filter(request => request.end_date <= endDate);
    }
    
    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Apply pagination
    const total = requests.length;
    const paginatedRequests = requests.slice(startAt, startAt + maxResults);
    
    return {
      success: true,
      data: {
        requests: paginatedRequests,
        total,
        startAt,
        maxResults,
        isLast: startAt + maxResults >= total
      }
    };
  } catch (error) {
    console.error('❌ Error getting all requests:', error);
    return {
      success: false,
      message: error.message || 'Failed to get all requests'
    };
  }
});

// Team Analytics
resolver.define('getTeamAnalytics', async (req) => {
  try {
    const { teamId, dateRange } = req.payload || {};
    const requests = await storage.get('pto_requests') || [];
    const users = await storage.get('users') || [];
    
    // Get team members
    const teamMembers = users.filter(user => {
      if (user.team_memberships && Array.isArray(user.team_memberships)) {
        return user.team_memberships.some(membership => membership.team_id === teamId);
      }
      return user.team_id === teamId;
    });
    
    const teamMemberIds = teamMembers.map(member => member.jira_account_id || member.id);
    
    // Filter requests for team members
    let teamRequests = requests.filter(request => 
      teamMemberIds.includes(request.requester_id)
    );
    
    // Apply date filter if provided
    if (dateRange && dateRange.start) {
      teamRequests = teamRequests.filter(request => request.start_date >= dateRange.start);
    }
    if (dateRange && dateRange.end) {
      teamRequests = teamRequests.filter(request => request.end_date <= dateRange.end);
    }
    
    // Calculate analytics
    const analytics = {
      totalMembers: teamMembers.length,
      totalRequests: teamRequests.length,
      pendingRequests: teamRequests.filter(r => r.status === 'pending').length,
      approvedRequests: teamRequests.filter(r => r.status === 'approved').length,
      declinedRequests: teamRequests.filter(r => r.status === 'declined').length,
      totalDaysRequested: teamRequests.reduce((sum, req) => sum + (req.total_days || 0), 0),
      requests: teamRequests.slice(0, 10) // Latest 10 requests
    };
    
    return {
      success: true,
      data: analytics
    };
  } catch (error) {
    console.error('❌ Error getting team analytics:', error);
    return {
      success: false,
      message: error.message || 'Failed to get team analytics'
    };
  }
});

// Debug Storage
resolver.define('debugStorage', async (req) => {
  try {
    const users = await storage.get('users') || [];
    const teams = await storage.get('teams') || [];
    const admins = await storage.get('pto_admins') || [];
    const ptoRequests = await storage.get('pto_requests') || [];
    const ptoDailySchedules = await storage.get('pto_daily_schedules') || [];
    
    return {
      success: true,
      data: {
        users: users.length,
        teams: teams.length,
        admins: admins.length,
        ptoRequests: ptoRequests.length,
        ptoDailySchedules: ptoDailySchedules.length,
        summary: {
          totalUsers: users.length,
          totalTeams: teams.length,
          totalAdmins: admins.length,
          totalRequests: ptoRequests.length
        }
      }
    };
  } catch (error) {
    console.error('❌ Error debugging storage:', error);
    return {
      success: false,
      message: error.message || 'Failed to debug storage'
    };
  }
});

// Test Connectivity
resolver.define('testConnectivity', async (req) => {
  try {
    console.log('🔗 Testing Jira API connectivity...');
    
    const response = await Promise.race([
      api.asUser().requestJira(route`/rest/api/3/serverInfo`),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connectivity test timeout')), 15000)
      )
    ]);
    
    if (response.ok) {
      const serverInfo = await response.json();
      return {
        success: true,
        message: 'Jira API connectivity is working',
        data: {
          serverTitle: serverInfo.serverTitle,
          version: serverInfo.version,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      return {
        success: false,
        message: `Connectivity test failed: HTTP ${response.status}`,
        status: response.status
      };
    }
  } catch (error) {
    console.error('❌ Connectivity test failed:', error);
    return {
      success: false,
      message: 'Connectivity test failed: ' + error.message,
      error: {
        code: error.code || 'CONNECTIVITY_ERROR',
        type: 'NETWORK_ERROR'
      }
    };
  }
});

// Get Internal Jira Users
resolver.define('getInternalJiraUsers', async (req) => {
  try {
    const { startAt = 0, maxResults = 50 } = req.payload || {};
    console.log(`🔍 Getting internal Jira users - startAt: ${startAt}, maxResults: ${maxResults}`);
    
    const projectKey = 'SDTI'; // Use your project key
    const usersResponse = await api.asUser().requestJira(
      route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
    );
    
    if (!usersResponse.ok) {
      throw new Error(`Failed to get users: ${usersResponse.status}`);
    }
    
    const users = await usersResponse.json();
    const userArray = Array.isArray(users) ? users : [];
    
    return {
      success: true,
      data: {
        users: userArray,
        startAt: startAt,
        maxResults: maxResults,
        total: userArray.length,
        isLast: userArray.length < maxResults
      }
    };
  } catch (error) {
    console.error('❌ Error getting Jira users:', error);
    return {
      success: false,
      message: error.message || 'Failed to get Jira users',
      data: {
        users: [],
        startAt: 0,
        maxResults: maxResults,
        total: 0,
        isLast: true
      }
    };
  }
});

// Create User from Jira
resolver.define('createUserFromJira', async (req) => {
  try {
    const { jiraUser, teamId, additionalData } = req.payload || {};
    
    if (!jiraUser || !jiraUser.accountId) {
      throw new Error('Jira user data is required');
    }
    
    console.log('👤 Creating user from Jira data:', jiraUser.displayName);
    
    // Get detailed user information from Jira if we only have basic data
    let detailedUser = jiraUser;
    if (!jiraUser.emailAddress && jiraUser.accountId) {
      try {
        const userResponse = await api.asUser().requestJira(
          route`/rest/api/3/user?accountId=${jiraUser.accountId}`
        );
        
        if (userResponse.ok) {
          detailedUser = await userResponse.json();
        }
      } catch (error) {
        console.warn('Could not get detailed user info:', error.message);
      }
    }
    
    // Check if user already exists
    const users = await storage.get('users') || [];
    const existingUser = users.find(user => 
      user.jira_account_id === detailedUser.accountId ||
      user.email_address === detailedUser.emailAddress
    );
    
    if (existingUser) {
      return {
        success: false,
        message: 'User already exists in the system',
        data: existingUser
      };
    }
    
    // Create user with Jira data and additional details
    const nameParts = (detailedUser.displayName || '').split(' ');
    const firstName = additionalData?.firstName || nameParts[0] || '';
    const lastName = additionalData?.lastName || nameParts.slice(1).join(' ') || '';
    
    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      first_name: firstName,
      last_name: lastName,
      display_name: detailedUser.displayName || '',
      email_address: detailedUser.emailAddress || '',
      jira_account_id: detailedUser.accountId,
      employment_type: additionalData?.employmentType || 'full-time',
      hire_date: additionalData?.hireDate || '',
      team_id: teamId || null,
      capacity: additionalData?.capacity || 40,
      availability: additionalData?.availability || getDefaultAvailability(),
      avatar_url: detailedUser.avatarUrls?.['48x48'] || detailedUser.avatarUrls?.['32x32'] || '',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_from_jira: true
    };
    
    users.push(newUser);
    await storage.set('users', users);
    
    console.log('✅ User created from Jira:', newUser.display_name);
    
    return {
      success: true,
      data: newUser,
      message: 'User created successfully from Jira data'
    };
  } catch (error) {
    console.error('❌ Error creating user from Jira:', error);
    return {
      success: false,
      message: error.message || 'Failed to create user from Jira'
    };
  }
});

// Bulk Import Users
resolver.define('bulkImportUsers', async (req) => {
  try {
    const { selectedUserIds, defaultTeamId } = req.payload || {};
    
    if (!selectedUserIds || selectedUserIds.length === 0) {
      throw new Error('No users selected for import');
    }
    
    console.log(`🔄 Bulk importing ${selectedUserIds.length} users`);
    
    // Get detailed user information from Jira for each user
    const userDetails = [];
    const batchSize = 10;
    
    for (let i = 0; i < selectedUserIds.length; i += batchSize) {
      const batch = selectedUserIds.slice(i, i + batchSize);
      
      for (const accountId of batch) {
        try {
          const userResponse = await api.asUser().requestJira(
            route`/rest/api/3/user?accountId=${accountId}`
          );
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            userDetails.push(userData);
          }
        } catch (error) {
          console.warn(`Failed to get details for user ${accountId}:`, error.message);
        }
      }
      
      // Small delay between batches
      if (i + batchSize < selectedUserIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Get existing users to avoid duplicates
    const existingUsers = await storage.get('users') || [];
    const existingIds = existingUsers.map(user => 
      user.jira_account_id || user.email_address
    ).filter(Boolean);
    
    const usersToImport = userDetails.filter(jiraUser => 
      !existingIds.includes(jiraUser.accountId) && 
      !existingIds.includes(jiraUser.emailAddress)
    );
    
    if (usersToImport.length === 0) {
      return {
        success: false,
        message: 'All selected users already exist in the system',
        data: {
          importedCount: 0,
          skippedCount: selectedUserIds.length,
          importedUsers: []
        }
      };
    }
    
    // Create users with enhanced data
    const newUsers = usersToImport.map(jiraUser => {
      const nameParts = (jiraUser.displayName || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        first_name: firstName,
        last_name: lastName,
        display_name: jiraUser.displayName || '',
        email_address: jiraUser.emailAddress || '',
        jira_account_id: jiraUser.accountId,
        employment_type: 'full-time',
        hire_date: '',
        team_id: defaultTeamId || null,
        capacity: 40,
        availability: getDefaultAvailability(),
        avatar_url: jiraUser.avatarUrls?.['48x48'] || jiraUser.avatarUrls?.['32x32'] || '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_from_jira: true,
        bulk_imported: true
      };
    });
    
    // Add to storage
    const updatedUsers = [...existingUsers, ...newUsers];
    await storage.set('users', updatedUsers);
    
    console.log(`✅ Successfully imported ${newUsers.length} users`);
    
    return {
      success: true,
      data: {
        importedCount: newUsers.length,
        skippedCount: selectedUserIds.length - newUsers.length,
        importedUsers: newUsers
      },
      message: `Successfully imported ${newUsers.length} users from Jira`
    };
  } catch (error) {
    console.error('❌ Error bulk importing users:', error);
    return {
      success: false,
      message: error.message || 'Failed to bulk import users',
      data: {
        importedCount: 0,
        skippedCount: 0,
        importedUsers: []
      }
    };
  }
});

// Get Project Users (Paginated)
resolver.define('getProjectUsersPaginated', async (req) => {
  try {
    const { projectKey, startAt = 0, maxResults = 50 } = req.payload;
    console.log(`[Backend] getProjectUsersPaginated called for project: ${projectKey}, startAt: ${startAt}, maxResults: ${maxResults}`);
    
    const response = await api.asUser().requestJira(
      route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
    );
    
    if (!response.ok) {
      throw new Error(`Jira API returned ${response.status}`);
    }
    
    const users = await response.json();    
    const userArray = Array.isArray(users) ? users : [];
    
    return {
      users: userArray,
      startAt: startAt,
      maxResults: maxResults,
      total: userArray.length,
      isLast: userArray.length < maxResults
    };
    
  } catch (error) {
    console.error(`[Backend] Error in getProjectUsersPaginated for ${projectKey}:`, error);
    return {
      users: [],
      startAt: 0,
      maxResults: maxResults,
      total: 0,
      isLast: true,
      error: error.message
    };
  }
});

// Get Team PTO Requests
resolver.define('getTeamPTORequests', async (req) => {
  try {
    const { teamId, managerId, status, startDate, endDate } = req.payload || {};
    console.log('🔍 Getting team PTO requests for team:', teamId);
    
    const requests = await storage.get('pto_requests') || [];
    const users = await storage.get('users') || [];
    const teams = await storage.get('teams') || [];
    
    let teamRequests = [];
    
    if (teamId) {
      // Get specific team's requests
      const team = teams.find(t => t.id === teamId);
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Find team members
      const teamMembers = users.filter(user => {
        if (user.team_memberships && Array.isArray(user.team_memberships)) {
          return user.team_memberships.some(membership => membership.team_id === teamId);
        }
        return user.team_id === teamId;
      });
      
      const teamMemberIds = teamMembers.map(member => member.jira_account_id || member.id);
      teamRequests = requests.filter(request => teamMemberIds.includes(request.requester_id));
      
    } else if (managerId) {
      // Get requests for teams managed by this manager
      const managedTeams = teams.filter(team => 
        team.manager?.jira_account_id === managerId || 
        team.manager?.id === managerId
      );
      
      const managedTeamIds = managedTeams.map(team => team.id);
      const managedTeamMembers = users.filter(user => {
        if (user.team_memberships && Array.isArray(user.team_memberships)) {
          return user.team_memberships.some(membership => 
            managedTeamIds.includes(membership.team_id)
          );
        }
        return managedTeamIds.includes(user.team_id);
      });
      
      const managedMemberIds = managedTeamMembers.map(member => member.jira_account_id || member.id);
      teamRequests = requests.filter(request => managedMemberIds.includes(request.requester_id));
    } else {
      // Return all requests if no specific team or manager
      teamRequests = requests;
    }
    
    // Filter by status if provided
    if (status && status !== 'all') {
      teamRequests = teamRequests.filter(request => request.status === status);
    }
    
    // Filter by date range if provided
    if (startDate) {
      teamRequests = teamRequests.filter(request => request.start_date >= startDate);
    }
    if (endDate) {
      teamRequests = teamRequests.filter(request => request.end_date <= endDate);
    }
    
    // Sort by submission date (newest first)
    teamRequests.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    
    // Enrich with user data
    const enrichedRequests = teamRequests.map(request => {
      const requester = users.find(u => 
        u.jira_account_id === request.requester_id || u.id === request.requester_id
      );
      
      return {
        ...request,
        requester_details: requester ? {
          display_name: requester.display_name,
          email_address: requester.email_address,
          avatar_url: requester.avatar_url
        } : null
      };
    });
    
    return {
      success: true,
      data: enrichedRequests
    };
  } catch (error) {
    console.error('❌ Error getting team PTO requests:', error);
    return {
      success: false,
      message: error.message || 'Failed to get team PTO requests',
      data: []
    };
  }
});

// Get Users by Team
resolver.define('getUsersByTeam', async (req) => {
  try {
    const { teamId } = req.payload || {};
    const users = await storage.get('users') || [];
    
    if (!teamId) {
      return {
        success: true,
        data: []
      };
    }
    
    const teamUsers = users.filter(user => {
      if (user.team_memberships && Array.isArray(user.team_memberships)) {
        return user.team_memberships.some(membership => membership.team_id === teamId);
      }
      return user.team_id === teamId;
    });
    
    return {
      success: true,
      data: teamUsers
    };
  } catch (error) {
    console.error('❌ Error getting users by team:', error);
    return {
      success: false,
      message: error.message || 'Failed to get team users',
      data: []
    };
  }
});

// Submit PTO for User (Admin function)
resolver.define('submitPTOForUser', async (req) => {
  try {
    const { requestData, submittedBy } = req.payload;
    console.log('👑 Admin submitting PTO for user:', requestData.requester_id);
    
    // Verify admin status
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(submittedBy)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    // Validate required fields
    if (!requestData.requester_id || !requestData.start_date || !requestData.end_date) {
      throw new Error('Missing required fields: requester_id, start_date, end_date');
    }
    
    // Calculate totals if not provided
    let totalDays = requestData.total_days;
    let totalHours = requestData.total_hours;
    
    if (requestData.daily_schedules && requestData.daily_schedules.length > 0) {
      totalDays = requestData.daily_schedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5), 0
      );
      totalHours = requestData.daily_schedules.reduce((sum, schedule) => 
        sum + (schedule.hours || (schedule.type === 'FULL_DAY' ? 8 : 4)), 0
      );
    }
    
    const ptoRequests = await storage.get('pto_requests') || [];
    
    const newRequest = {
      id: `pto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requester_id: requestData.requester_id,
      requester_name: requestData.requester_name || 'Unknown User',
      requester_email: requestData.requester_email || '',
      manager_id: requestData.manager_id,
      manager_name: requestData.manager_name || '',
      manager_email: requestData.manager_email || '',
      start_date: requestData.start_date,
      end_date: requestData.end_date,
      total_days: totalDays || 0,
      total_hours: totalHours || 0,
      reason: requestData.reason || 'Admin submitted request',
      status: 'approved', // Admin submissions are auto-approved
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: submittedBy,
      comments: 'Submitted by admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_by_admin: true
    };
    
    ptoRequests.push(newRequest);
    await storage.set('pto_requests', ptoRequests);
    
    // Handle daily schedules if provided
    if (requestData.daily_schedules && requestData.daily_schedules.length > 0) {
      const dailySchedules = await storage.get('pto_daily_schedules') || [];
      
      const dailyScheduleRecords = requestData.daily_schedules.map(schedule => ({
        id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        request_id: newRequest.id,
        date: schedule.date,
        type: schedule.type,
        leave_type: schedule.leaveType || 'vacation',
        hours: schedule.hours || (schedule.type === 'FULL_DAY' ? 8 : 4),
        requester_id: requestData.requester_id,
        created_at: new Date().toISOString()
      }));
      
      dailySchedules.push(...dailyScheduleRecords);
      await storage.set('pto_daily_schedules', dailySchedules);
    }
    
    console.log('✅ Admin PTO request created:', newRequest.id);
    
    return {
      success: true,
      data: newRequest,
      message: 'PTO request created successfully by admin'
    };
  } catch (error) {
    console.error('❌ Error creating admin PTO request:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Add Team Member
resolver.define('addTeamMember', async (req) => {
  try {
    const { teamId, member } = req.payload || {};
    const users = await storage.get('users') || [];
    
    const userIndex = users.findIndex(u => 
      u.id === member.user_id || u.jira_account_id === member.user_id
    );
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    // Initialize team_memberships if it doesn't exist
    if (!users[userIndex].team_memberships) {
      users[userIndex].team_memberships = [];
    }
    
    // Check if user is already a member of this team
    const existingMembership = users[userIndex].team_memberships.find(
      membership => membership.team_id === teamId
    );
    
    if (existingMembership) {
      // Update existing membership
      existingMembership.role = member.role || 'Member';
      existingMembership.updated_at = new Date().toISOString();
    } else {
      // Add new membership
      users[userIndex].team_memberships.push({
        team_id: teamId,
        role: member.role || 'Member',
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    users[userIndex].updated_at = new Date().toISOString();
    await storage.set('users', users);
    
    return {
      success: true,
      data: users[userIndex],
      message: 'Team member added successfully'
    };
  } catch (error) {
    console.error('❌ Error adding team member:', error);
    return {
      success: false,
      message: error.message || 'Failed to add team member'
    };
  }
});

// Remove Team Member
resolver.define('removeTeamMember', async (req) => {
  try {
    const { teamId, memberAccountId } = req.payload || {};
    const users = await storage.get('users') || [];
    
    const userIndex = users.findIndex(u => 
      u.id === memberAccountId || u.jira_account_id === memberAccountId
    );
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    // Remove team membership
    if (users[userIndex].team_memberships) {
      users[userIndex].team_memberships = users[userIndex].team_memberships.filter(
        membership => membership.team_id !== teamId
      );
    }
    
    users[userIndex].updated_at = new Date().toISOString();
    await storage.set('users', users);
    
    return {
      success: true,
      data: users[userIndex],
      message: 'Team member removed successfully'
    };
  } catch (error) {
    console.error('❌ Error removing team member:', error);
    return {
      success: false,
      message: error.message || 'Failed to remove team member'
    };
  }
});
// Clear Import Validation Data
resolver.define('clearImportValidationData', async (req) => {
  try {
    console.log('🧹 Clearing import validation data');
    
    // Keys that might contain validation data
    const validationKeys = [
      'temp_import_validation',
      'temp_import_data',
      'temp_validation_data',
      'import_validation_cache',
      'temp_import_status',
      'validation_progress',
      'import_progress'
    ];
    
    let deletedCount = 0;
    
    for (const key of validationKeys) {
      try {
        await storage.delete(key);
        deletedCount++;
        console.log(`✅ Cleared: ${key}`);
      } catch (error) {
        // Ignore "not found" errors
        if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
          console.warn(`⚠️ Issue clearing ${key}:`, error.message);
        }
      }
    }
    
    console.log(`✅ Cleared ${deletedCount} validation entries`);
    
    return {
      success: true,
      deletedCount: deletedCount,
      message: 'Import validation data cleared successfully'
    };
  } catch (error) {
    console.error('❌ Error clearing validation data:', error);
    return {
      success: false,
      message: error.message || 'Failed to clear validation data'
    };
  }
});

// Validate Import Data
resolver.define('validatePTOImportData', async (req) => {
  try {
    const { importData, adminId, checkJiraUsers = true, batchIndex = 0, batchSize = 50 } = req.payload;
    
    // Admin verification
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(adminId)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    console.log(`🔍 CHUNKED: Validating batch ${batchIndex} (${importData.length} records)`);
    
    // For first batch, do complete validation setup
    if (batchIndex === 0 && Array.isArray(importData) && importData.length > 0) {
      
      // STEP 1: Basic format validation (fast)
      console.log('📋 Step 1: Basic format validation...');
      const basicValidation = await importService.validateImportData(importData, false);
      if (!basicValidation.valid) {
        return {
          success: false,
          data: {
            validation: basicValidation,
            isComplete: true
          },
          message: `Basic validation failed: ${basicValidation.errors.length} format errors`
        };
      }
      
      // STEP 2: User database lookup (optimized)
      console.log('👥 Step 2: User database validation...');
      const users = await storage.get('users') || [];
      
      if (users.length === 0) {
        return {
          success: false,
          message: 'User database is empty. Please import users from Jira first.',
          data: { validation: { errors: ['No users in database'] }, isComplete: true }
        };
      }
      
      console.log(`📋 Found ${users.length} users in database for validation`);
      
      // Create email lookup map
      const emailToUserMap = {};
      users.forEach(user => {
        const email = (user.email_address || user.emailAddress || '').toLowerCase();
        if (email) {
          emailToUserMap[email] = {
            accountId: user.jira_account_id || user.accountId || user.id,
            displayName: user.display_name || user.displayName || user.name,
            emailAddress: user.email_address || user.emailAddress
          };
        }
      });
      
      console.log(`📋 Created email lookup map with ${Object.keys(emailToUserMap).length} entries`);
      
      // STEP 3: Enhanced validation with user data
      console.log('🔄 Step 3: Enhanced validation with user lookup...');
      const enhancedRecords = [];
      const finalErrors = [];
      
      for (let i = 0; i < basicValidation.validRecords.length; i++) {
        const record = basicValidation.validRecords[i];
        
        // Look up requester in your database
        const requesterEmail = record.requester_email.toLowerCase();
        const requester = emailToUserMap[requesterEmail];
        if (!requester) {
          finalErrors.push({
            record: i + 1,
            errors: [`Requester not found in user database: ${record.requester_email}`],
            data: record
          });
          continue;
        }
        
        // Look up manager in your database
        const managerEmail = record.manager_email.toLowerCase();
        const manager = emailToUserMap[managerEmail];
        if (!manager) {
          finalErrors.push({
            record: i + 1,
            errors: [`Manager not found in user database: ${record.manager_email}`],
            data: record
          });
          continue;
        }
        
        // Create import-ready record with all required fields
        enhancedRecords.push({
          ...record,
          // Enhanced with user data from YOUR database
          requester_id: requester.accountId,
          requester_name: requester.displayName,
          requester_email: requester.emailAddress,
          manager_id: manager.accountId,
          manager_name: manager.displayName,
          manager_email: manager.emailAddress,
          // Import metadata
          import_source: 'csv_bulk_import',
          import_timestamp: new Date().toISOString(),
          hours: record.hours || (record.schedule_type === 'HALF_DAY' ? 4 : 8),
          // Keep originals for reference
          original_requester_email: record.requester_email,
          original_manager_email: record.manager_email
        });
      }
      
      console.log(`✅ Enhanced validation complete: ${enhancedRecords.length} ready, ${finalErrors.length} errors`);
      
      // Store validated data using CHUNKED storage to handle large datasets
      const validationKey = `pto_import_validation_${adminId}`;
      const validationData = {
        validRecords: enhancedRecords,
        preparedForImport: true,
        timestamp: new Date().toISOString(),
        totalRecords: importData.length,
        errors: finalErrors
      };

      let storeResult;
      try {
        // Use chunked storage for large datasets
        storeResult = await importService.storeChunkedData(validationKey, validationData);
        console.log(`✅ Stored validation data: ${storeResult.chunks} chunks, ${storeResult.totalSize} chars`);
      } catch (storageError) {
        console.error('❌ Failed to store validation data:', storageError);
        return {
          success: false,
          message: `Failed to store validation data: ${storageError.message}. Dataset may be too large.`,
          data: { validation: { errors: [storageError.message] }, isComplete: true }
        };
      }
      
      console.log(`✅ CHUNKED Validation complete: ${enhancedRecords.length} ready, ${finalErrors.length} errors`);
      
      return {
        success: true,
        data: {
          isComplete: true,
          validationComplete: true,
          validation: {
            totalRecords: importData.length,
            validRecords: enhancedRecords.slice(0, 5), // Show fewer for preview
            validRecordsCount: enhancedRecords.length, // This is the key fix
            invalidRecords: finalErrors.length,
            errors: finalErrors.slice(0, 10), // Fewer errors for faster display
            chunkedStorage: true,
            chunks: storeResult ? storeResult.chunks : 1
          }
        },
        message: `Database validation complete: ${enhancedRecords.length} of ${importData.length} records ready for import`
      };
    }
    
    // For non-zero batch index, return stored progress
    return {
      success: true,
      data: {
        isComplete: false,
        currentBatch: batchIndex,
        totalBatches: Math.ceil(importData.length / batchSize)
      },
      message: 'Batch validation in progress...'
    };
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    return {
      success: false,
      message: 'Validation failed: ' + error.message,
      data: { validation: { errors: [error.message] }, isComplete: true }
    };
  }
});

resolver.define('importPTODailySchedules', async (req) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Import timeout after 45 seconds')), 45000); // Increased timeout
  });

  const importPromise = async () => {
    const importKey = 'import_in_progress';
    
    try {
      const { importData, adminId, skipValidation = false, useStoredValidation = false } = req.payload || {};
      
      console.log('📥 CHUNKED IMPORT: Starting PTO daily schedules import', 
        useStoredValidation ? '(using stored validation)' : 
        skipValidation ? '(pre-validated)' : ''
      );
      
      // Verify admin status
      const admins = await storage.get('pto_admins') || [];
      if (!admins.includes(adminId)) {
        throw new Error('Unauthorized: Admin privileges required');
      }

      // Check for concurrent imports
      const existingImport = await storage.get(importKey);
      if (existingImport) {
        return {
          success: false,
          message: 'Another import is already in progress. Please wait and try again.',
          data: { importedRecords: 0, failedRecords: 0, errors: [] }
        };
      }

      // Mark import as in progress
      await storage.set(importKey, {
        startTime: new Date().toISOString(),
        adminId: adminId,
        status: 'importing'
      });
      
      let dataToImport;
      
      if (useStoredValidation) {
        try {
          const validationKey = `pto_import_validation_${adminId}`;
          const storedValidation = await importService.getChunkedData(validationKey);
          
          if (!storedValidation || !storedValidation.validRecords || !storedValidation.preparedForImport) {
            throw new Error('No prepared validation data found. Please validate the data first.');
          }
          
          console.log(`📦 Using chunked validation with ${storedValidation.validRecords.length} prepared records`);
          dataToImport = storedValidation.validRecords;
          
        } catch (retrievalError) {
          console.error('❌ Failed to retrieve stored validation:', retrievalError);
          throw new Error(`Could not retrieve validation data: ${retrievalError.message}`);
        }
      } else {
        // Use direct import data
        if (!Array.isArray(importData) || importData.length === 0) {
          throw new Error('Invalid data format: expected array of PTO records');
        }
        dataToImport = importData;
        console.log(`📋 Using direct import data: ${dataToImport.length} records`);
      }

      // Log the actual data size we're about to process
      console.log(`🔍 ACTUAL DATA TO IMPORT: ${dataToImport.length} records`);
      
      // Increased size limit for chunked processing
      if (dataToImport.length > 2000) {
        await storage.delete(importKey);
        return {
          success: false,
          message: `Import size too large: ${dataToImport.length} records. Maximum allowed is 2000 records per import.`,
          data: { importedRecords: 0, failedRecords: 0, errors: [] }
        };
      }

      // START WITH FRESH DATA TO AVOID DUPLICATES
      console.log('📦 Starting fresh import (clearing existing daily schedules to prevent duplicates)...');
      
      // Optional: Backup existing data before clearing
      try {
        const existingSchedules = await importService.getChunkedData('pto_daily_schedules') || [];
        if (existingSchedules.length > 0) {
          console.log(`📋 Backing up ${existingSchedules.length} existing schedules before import...`);
          const backupKey = `pto_daily_schedules_backup_${Date.now()}`;
          await importService.storeChunkedData(backupKey, existingSchedules);
          console.log(`✅ Backup stored as: ${backupKey}`);
        }
      } catch (backupError) {
        console.warn('⚠️ Could not backup existing data:', backupError.message);
        // Continue with import even if backup fails
      }

      let dailySchedules = []; // Start fresh
      const importedSchedules = [];
      const errors = [];
      
      // Dynamic batch sizing based on data size
      let BATCH_SIZE;
      if (dataToImport.length <= 50) {
        BATCH_SIZE = 5;  // Small datasets
      } else if (dataToImport.length <= 200) {
        BATCH_SIZE = 10; // Medium datasets
      } else if (dataToImport.length <= 500) {
        BATCH_SIZE = 15; // Large datasets
      } else {
        BATCH_SIZE = 20; // Very large datasets
      }
      
      const totalBatches = Math.ceil(dataToImport.length / BATCH_SIZE);
      console.log(`📦 Processing ${dataToImport.length} records in ${totalBatches} batches of ${BATCH_SIZE}`);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, dataToImport.length);
        const batch = dataToImport.slice(startIdx, endIdx);
        
        console.log(`⚡ Processing batch ${batchIndex + 1}/${totalBatches} (records ${startIdx + 1}-${endIdx})`);
        
        // Process batch with error handling
        for (const [recordIndex, record] of batch.entries()) {
          try {
            const globalIndex = startIdx + recordIndex;
            const scheduleId = `schedule-${Date.now()}-${globalIndex}-${Math.random().toString(36).substr(2, 6)}`;
            
            // Create schedule record with all required fields
            const scheduleRecord = {
              id: scheduleId,
              pto_request_id: record.pto_request_id || `pto-import-${Date.now()}-${globalIndex}`,
              date: record.date,
              schedule_type: record.schedule_type || 'FULL_DAY',
              leave_type: record.leave_type,
              hours: record.hours || (record.schedule_type === 'HALF_DAY' ? 4 : 8),
              // User information
              requester_id: record.requester_id,
              requester_name: record.requester_name,
              requester_email: record.requester_email,
              // Manager information  
              manager_id: record.manager_id,
              manager_name: record.manager_name,
              manager_email: record.manager_email,
              // Status and metadata
              status: record.status || 'approved',
              reason: record.reason || 'Imported from CSV',
              // Import tracking
              imported: true,
              import_date: new Date().toISOString(),
              import_batch: batchIndex + 1,
              import_source: 'csv_bulk_import',
              created_at: record.created_at || new Date().toISOString()
            };
            
            dailySchedules.push(scheduleRecord);
            importedSchedules.push(scheduleRecord);
            
          } catch (recordError) {
            console.error(`❌ Error processing record ${startIdx + recordIndex + 1}:`, recordError);
            errors.push({
              record: startIdx + recordIndex + 1,
              error: recordError.message,
              data: record
            });
          }
        }
        
        // Dynamic save frequency based on dataset size
        let saveFrequency;
        if (dataToImport.length <= 100) {
          saveFrequency = 5;   // Save every 5 batches for small datasets
        } else if (dataToImport.length <= 500) {
          saveFrequency = 10;  // Save every 10 batches for medium datasets
        } else {
          saveFrequency = 15;  // Save every 15 batches for large datasets
        }
        
        // Save progress periodically and at the end
        if ((batchIndex + 1) % saveFrequency === 0 || batchIndex === totalBatches - 1) {
          try {
            console.log(`💾 Saving progress: ${dailySchedules.length} total schedules...`);
            await importService.storeChunkedData('pto_daily_schedules', dailySchedules);
            console.log(`✅ Saved batch progress ${batchIndex + 1}/${totalBatches}`);
          } catch (storageError) {
            console.error(`❌ Storage error at batch ${batchIndex + 1}:`, storageError);
            // Clean up on storage failure
            await storage.delete(importKey);
            throw new Error(`Storage limit exceeded during import. Successfully processed ${importedSchedules.length} records before failure.`);
          }
        }
        
        // Dynamic delay based on dataset size
        if (batchIndex < totalBatches - 1) {
          let delay;
          if (dataToImport.length <= 100) {
            delay = 50;   // Fast processing for small datasets
          } else if (dataToImport.length <= 500) {
            delay = 75;   // Medium delay for medium datasets
          } else {
            delay = 100;  // Longer delay for large datasets
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Progress update every 20 batches for large imports
        if ((batchIndex + 1) % 20 === 0) {
          console.log(`🔄 Progress update: ${batchIndex + 1}/${totalBatches} batches completed (${importedSchedules.length} records processed)`);
        }
      }
      
      const successCount = importedSchedules.length;
      const failureCount = errors.length;
      
      console.log(`🎉 Import complete: ${successCount} imported, ${failureCount} failed`);
      
      // Clean up stored validation after successful import
      if (useStoredValidation) {
        try {
          const validationKey = `pto_import_validation_${adminId}`;
          await importService.deleteChunkedData(validationKey);
          console.log('✅ Cleaned up stored validation data');
        } catch (cleanupError) {
          console.warn('⚠️ Could not clean up validation data:', cleanupError.message);
        }
      }
      
      // Log the import activity
      const adminLog = await storage.get('pto_admin_log') || [];
      adminLog.push({
        action: 'PTO_DAILY_SCHEDULES_IMPORT',
        admin_id: adminId,
        timestamp: new Date().toISOString(),
        details: {
          total: dataToImport.length,
          imported: successCount,
          failed: failureCount,
          useStoredValidation,
          chunkedStorage: true,
          timeoutProtected: true,
          batchSize: BATCH_SIZE,
          totalBatches: totalBatches
        }
      });
      await storage.set('pto_admin_log', adminLog);
      
      return {
        success: successCount > 0,
        data: {
          totalRecords: dataToImport.length,
          importedRecords: successCount,
          failedRecords: failureCount,
          errors: errors.slice(0, 50) // Show more errors for large datasets
        },
        message: `Import complete: ${successCount} records imported successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`
      };
      
    } catch (error) {
      console.error('❌ Error importing PTO daily schedules:', error);
      return {
        success: false,
        message: error.message || 'Failed to import PTO daily schedules.',
        error: error.toString()
      };
    } finally {
      // Always clear the import lock
      try {
        await storage.delete(importKey);
        console.log('✅ Cleared import lock');
      } catch (error) {
        console.warn('⚠️ Could not clear import lock:', error.message);
      }
    }
  };

  try {
    return await Promise.race([importPromise(), timeoutPromise]);
  } catch (error) {
    if (error.message.includes('timeout')) {
      return {
        success: false,
        message: 'Import timed out after 45 seconds. This usually means the dataset is very large. Try splitting into smaller batches.',
        data: { importedRecords: 0, failedRecords: 0, errors: [] }
      };
    }
    throw error;
  }
});


// Edit PTO Request
resolver.define('editPTORequest', async (req) => {
  try {
    const { requestId, updatedData, editedBy } = req.payload || {};
    const requests = await storage.get('pto_requests') || [];
    
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    const existingRequest = requests[requestIndex];
    
    // Only allow editing of pending requests
    if (existingRequest.status !== 'pending') {
      throw new Error('Can only edit pending requests');
    }
    
    // Update the request
    requests[requestIndex] = {
      ...existingRequest,
      ...updatedData,
      status: 'pending', // Reset to pending after edit
      updated_at: new Date().toISOString(),
      edited_by: editedBy,
      edited_at: new Date().toISOString()
    };
    
    await storage.set('pto_requests', requests);
    
    // Update daily schedules if provided
    if (updatedData.daily_schedules) {
      const dailySchedules = await storage.get('pto_daily_schedules') || [];
      
      // Remove old schedules for this request
      const filteredSchedules = dailySchedules.filter(s => s.request_id !== requestId);
      
      // Add new schedules
      const newSchedules = updatedData.daily_schedules.map(schedule => ({
        id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        request_id: requestId,
        date: schedule.date,
        type: schedule.type,
        leave_type: schedule.leaveType || 'vacation',
        hours: schedule.hours || (schedule.type === 'FULL_DAY' ? 8 : 4),
        requester_id: existingRequest.requester_id,
        created_at: new Date().toISOString()
      }));
      
      await storage.set('pto_daily_schedules', [...filteredSchedules, ...newSchedules]);
    }
    
    return {
      success: true,
      data: requests[requestIndex],
      message: 'PTO request updated successfully and resubmitted for approval'
    };
  } catch (error) {
    console.error('❌ Error editing PTO request:', error);
    return {
      success: false,
      message: error.message || 'Failed to edit PTO request'
    };
  }
});

// Debug User Emails
resolver.define('debugUserEmails', async (req) => {
  try {
    const { searchEmail } = req.payload || {};
    const users = await storage.get('users') || [];
    
    console.log(`🔍 Debug: Searching for email: ${searchEmail}`);
    console.log(`👥 Total users in database: ${users.length}`);
    
    // Show all users with their email fields
    const userEmailInfo = users.map((user, index) => ({
      index: index + 1,
      id: user.id,
      jira_account_id: user.jira_account_id,
      display_name: user.display_name || user.displayName,
      email_address: user.email_address,
      emailAddress: user.emailAddress,
      email: user.email
    }));
    
    // If searching for specific email, show matches
    if (searchEmail) {
      const normalizedSearch = searchEmail.toLowerCase().trim();
      const matches = users.filter(user => {
        const emails = [user.email_address, user.emailAddress, user.email].filter(Boolean);
        return emails.some(email => email.toLowerCase().trim() === normalizedSearch);
      });
      
      console.log(`🎯 Found ${matches.length} matches for ${searchEmail}`);
      
      return {
        success: true,
        data: {
          searchEmail,
          totalUsers: users.length,
          matches: matches.length,
          matchedUsers: matches,
          allUserEmails: userEmailInfo.slice(0, 10) // First 10 for debugging
        }
      };
    }
    
    return {
      success: true,
      data: {
        totalUsers: users.length,
        userEmailInfo: userEmailInfo.slice(0, 10) // First 10 for debugging
      }
    };
  } catch (error) {
    console.error('❌ Debug user emails error:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Delete PTO Balance
resolver.define('deletePTOBalance', async (req) => {
  try {
    const { user_id, leave_type, year } = req.payload || {};
    const balances = await storage.get('pto_balances') || [];
    
    const filteredBalances = balances.filter(b => 
      !(b.user_id === user_id && b.leave_type === leave_type && b.year === year)
    );
    
    await storage.set('pto_balances', filteredBalances);
    
    return { 
      success: true,
      message: 'PTO balance deleted successfully'
    };
  } catch (error) {
    return { 
      success: false, 
      message: error.message 
    };
  }
});

// Import Database
resolver.define('importDatabase', async (req) => {
  try {
    const { data, type } = req.payload || {};
    console.log(`📥 Importing ${type} data`);
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format');
    }
    
    if (type === 'users') {
      const users = await storage.get('users') || [];
      const newUsers = data.map(userData => ({
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...userData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        imported: true
      }));
      
      await storage.set('users', [...users, ...newUsers]);
      
      return {
        success: true,
        data: { imported: newUsers.length },
        message: `Successfully imported ${newUsers.length} users`
      };
    } else if (type === 'teams') {
      const teams = await storage.get('teams') || [];
      const newTeams = data.map(teamData => ({
        id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...teamData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        imported: true
      }));
      
      await storage.set('teams', [...teams, ...newTeams]);
      
      return {
        success: true,
        data: { imported: newTeams.length },
        message: `Successfully imported ${newTeams.length} teams`
      };
    }
    
    throw new Error('Unsupported import type');
  } catch (error) {
    console.error('❌ Error importing database:', error);
    return {
      success: false,
      message: error.message || 'Failed to import data'
    };
  }
});

// Validate Database Import
resolver.define('validateDatabaseImport', async (req) => {
  try {
    const { importData, batchIndex = 0 } = req.payload || {};
    const batchSize = 100;
    
    if (!importData || !Array.isArray(importData)) {
      throw new Error('Invalid import data format');
    }
    
    console.log(`🔍 Validating database import batch ${batchIndex}`);
    
    // Simple validation - just check for required fields
    const enhancedRecords = importData.map((record, index) => {
      const enhanced = { ...record };
      
      // Add validation flags
      enhanced._validation = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      // Basic validation
      if (record.type === 'user' && !record.display_name) {
        enhanced._validation.errors.push('Missing display name');
        enhanced._validation.isValid = false;
      }
      
      if (record.type === 'team' && !record.name) {
        enhanced._validation.errors.push('Missing team name');
        enhanced._validation.isValid = false;
      }
      
      return enhanced;
    });
    
    // For final batch, return complete results
    if (batchIndex === 0 || (batchIndex + 1) * batchSize >= importData.length) {
      return {
        success: true,
        data: {
          validation: {
            totalRecords: enhancedRecords.length,
            validRecords: enhancedRecords.filter(r => r._validation.isValid).length,
            invalidRecords: enhancedRecords.filter(r => !r._validation.isValid).length,
            errors: enhancedRecords.filter(r => !r._validation.isValid).map(r => r._validation.errors).flat()
          },
          isComplete: true,
          enhancedData: enhancedRecords,
          chunks: 1
        },
        message: `Database validation complete: ${enhancedRecords.length} records processed`
      };
    }
    
    return {
      success: true,
      data: {
        isComplete: false,
        currentBatch: batchIndex,
        totalBatches: Math.ceil(importData.length / batchSize)
      },
      message: 'Batch validation in progress...'
    };
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    return {
      success: false,
      message: 'Validation failed: ' + error.message,
      data: { validation: { errors: [error.message] }, isComplete: true }
    };
  }
});

// Bulk Import Users from Jira
resolver.define('bulkImportUsersFromJira', async (req) => {
  try {
    const { selectedUserIds, defaultTeamId, defaultDepartment } = req.payload || {};
    
    if (!selectedUserIds || selectedUserIds.length === 0) {
      throw new Error('No users selected for import');
    }
    
    console.log(`📥 Bulk importing ${selectedUserIds.length} users from Jira`);
    
    // Get detailed user information from Jira for selected users
    const userDetails = [];
    const batchSize = 10;
    
    for (let i = 0; i < selectedUserIds.length; i += batchSize) {
      const batch = selectedUserIds.slice(i, i + batchSize);
      
      for (const accountId of batch) {
        try {
          const userResponse = await api.asUser().requestJira(
            route`/rest/api/3/user?accountId=${accountId}`
          );
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            userDetails.push(userData);
          }
        } catch (error) {
          console.warn(`Failed to get details for user ${accountId}:`, error.message);
        }
      }
      
      // Small delay between batches
      if (i + batchSize < selectedUserIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Process the results similar to your existing bulkImportUsers function
    return await this.resolve('bulkImportUsers', {
      payload: { selectedUserIds, defaultTeamId }
    });
  } catch (error) {
    console.error('❌ Error bulk importing users from Jira:', error);
    return {
      success: false,
      message: error.message || 'Failed to bulk import users from Jira'
    };
  }
});
export const handler = resolver.getDefinitions();