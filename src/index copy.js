import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import teamUserService from './services/team-user-service';

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

// Initialize Team User Service
resolver.define('initializeTeamUserService', async (req) => {
  try {
    await teamUserService.initialize();
    return {
      success: true,
      message: 'Team and User service initialized successfully'
    };
  } catch (error) {
    console.error('❌ Error initializing Team User Service:', error);
    return {
      success: false,
      message: error.message || 'Failed to initialize service'
    };
  }
});

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

// Get Current User
resolver.define('getCurrentUser', async (req) => {
  try {
    console.log('🔍 Fetching current user...');
    
    // Add timeout and retry logic
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to fetch user`);
        
        // Use a longer timeout for the request
        const response = await Promise.race([
          api.asUser().requestJira(route`/rest/api/3/myself`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
          )
        ]);
        
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
        lastError = error;
        console.warn(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all retries failed, throw the last error
    throw lastError;
    
  } catch (error) {
    console.error('❌ Error fetching current user after all retries:', error);
    
    // Return a more specific error message based on the error type
    let errorMessage = 'Failed to fetch current user: ';
    
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout')) {
      errorMessage += 'Connection timeout. Please check your internet connection and try again.';
    } else if (error.message.includes('HTTP')) {
      errorMessage += `Server error: ${error.message}`;
    } else {
      errorMessage += error.message;
    }
    
    return {
      success: false,
      message: errorMessage,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        type: 'NETWORK_ERROR'
      }
    };
  }
});
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
resolver.define('testConnectivity', async (req) => {
  try {
    console.log('🔗 Testing Jira API connectivity...');
    
    // Simple health check endpoint
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


// Search Jira Users
resolver.define('getJiraUsers', async (req) => {
  try {
    const { query } = req.payload || {};
    
    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    console.log('🔍 Searching users with query:', query);
    
    const maxRetries = 2;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          api.asUser().requestJira(route`/rest/api/3/user/search?query=${query}&maxResults=10`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('User search timeout')), 20000)
          )
        ]);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const users = await response.json();
        
        const userData = users.map(user => ({
          accountId: user.accountId,
          displayName: user.displayName,
          emailAddress: user.emailAddress,
          avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['32x32'] || null
        }));

        return {
          success: true,
          data: userData
        };
        
      } catch (error) {
        lastError = error;
        console.warn(`❌ User search attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    throw lastError;
    
  } catch (error) {
    console.error('❌ Error searching users:', error);
    
    let errorMessage = 'Failed to search users: ';
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout')) {
      errorMessage += 'Connection timeout. Please try again.';
    } else {
      errorMessage += error.message;
    }
    
    return {
      success: false,
      message: errorMessage,
      error: {
        code: error.code || 'SEARCH_ERROR',
        type: 'NETWORK_ERROR'
      }
    };
  }
});

// Enhanced Internal Jira Users - Company Specific
resolver.define('getInternalJiraUsersByGroup', async (req) => {
  try {
    const { groupName = 'jira-users' } = req.payload || {};
    console.log('🔍 Getting internal Jira users from group:', groupName);
    
    // Try multiple group names to find internal users
    const groupsToTry = [
      groupName,
      'jira-users',
      'jira-software-users', 
      'jira-administrators',
      'atlassian-users-rebelmouse' // Company-specific group
    ];
    
    let allUsers = [];
    
    for (const group of groupsToTry) {
      try {
        const response = await api.asUser().requestJira(
          route`/rest/api/3/group/member?groupname=${encodeURIComponent(group)}&maxResults=200`
        );
        
        if (response.ok) {
          const groupData = await response.json();
          if (groupData.values && groupData.values.length > 0) {
            console.log(`✅ Found ${groupData.values.length} users in group: ${group}`);
            
            // Filter for active users only and add to collection
            const activeUsers = groupData.values.filter(user => user.active !== false);
            allUsers = allUsers.concat(activeUsers);
          }
        }
      } catch (groupError) {
        console.warn(`⚠️ Could not fetch group ${group}:`, groupError.message);
        continue;
      }
    }
    
    // Remove duplicates based on accountId
    const uniqueUsers = allUsers.reduce((acc, user) => {
      if (!acc.find(u => u.accountId === user.accountId)) {
        acc.push(user);
      }
      return acc;
    }, []);
    
    // Filter for company domain users if available
    const companyDomains = ['rebelmouse.com']; // Add your company domains
    const companyUsers = uniqueUsers.filter(user => {
      if (!user.emailAddress) return false;
      return companyDomains.some(domain => user.emailAddress.toLowerCase().includes(domain.toLowerCase()));
    });
    
    // Use company users if found, otherwise use all unique users
    const finalUsers = companyUsers.length > 0 ? companyUsers : uniqueUsers;
    
    const userData = finalUsers.map(user => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['32x32'] || null,
      active: user.active
    }));

    console.log(`✅ Returning ${userData.length} internal users`);
    
    return {
      success: true,
      data: userData
    };
  } catch (error) {
    console.error('❌ Error getting internal Jira users:', error);
    return {
      success: false,
      message: 'Failed to get internal Jira users: ' + error.message
    };
  }
});


// Store PTO Request
resolver.define('storePTORequest', async (req) => {
  try {
    console.log('📝 Storing enhanced PTO Request:', req.payload);
    
    const { reporter, manager, startDate, endDate, leaveType, reason, dailySchedules } = req.payload || {};
    
    // Enhanced validation
    if (!reporter || !reporter.accountId) {
      throw new Error('Reporter information is required');
    }
    
    if (!manager || !manager.accountId) {
      throw new Error('Manager information is required');
    }
    
    if (!startDate || !endDate) {
      throw new Error('Start and end dates are required');
    }
    
    if (!leaveType) {
      throw new Error('Leave type is required');
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      throw new Error('Start date cannot be after end date');
    }
    
    // Check for conflicts with existing requests
    const existingRequests = await storage.get('pto_requests') || [];
    const conflictingRequests = existingRequests.filter(request => 
      request.requester_id === reporter.accountId &&
      request.status !== 'declined' &&
      !(new Date(endDate) < new Date(request.start_date) || new Date(startDate) > new Date(request.end_date))
    );
    
    if (conflictingRequests.length > 0) {
      throw new Error('This request conflicts with existing PTO requests for the same dates');
    }
    
    // Calculate totals from daily schedules or date range
    let totalDays, totalHours;
    
    if (dailySchedules && dailySchedules.length > 0) {
      totalDays = dailySchedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5), 0
      );
      totalHours = dailySchedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 8 : 4), 0
      );
    } else {
      // Calculate based on business days
      const start = new Date(startDate);
      const end = new Date(endDate);
      let businessDays = 0;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
          businessDays++;
        }
      }
      
      totalDays = businessDays;
      totalHours = businessDays * 8;
    }
    
    // Create new request with enhanced data
    const newRequest = {
      id: `pto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requester_id: reporter.accountId,
      requester_name: reporter.displayName,
      requester_email: reporter.emailAddress,
      requester_avatar: reporter.avatarUrl,
      manager_id: manager.accountId,
      manager_name: manager.displayName,
      manager_email: manager.emailAddress,
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType,
      reason: reason || '',
      status: 'pending',
      total_days: totalDays,
      total_hours: totalHours,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewer_comments: null,
      daily_schedules: dailySchedules || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add to storage
    existingRequests.push(newRequest);
    await storage.set('pto_requests', existingRequests);
    
    // Create daily schedule records if provided
    if (dailySchedules && dailySchedules.length > 0) {
      const dailyScheduleRecords = await storage.get('pto_daily_schedules') || [];
      
      for (const schedule of dailySchedules) {
        const scheduleRecord = {
          id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          pto_request_id: newRequest.id,
          date: schedule.date,
          schedule_type: schedule.type,
          leave_type: schedule.leaveType,
          hours: schedule.type === 'FULL_DAY' ? 8 : 4,
          created_at: new Date().toISOString()
        };
        dailyScheduleRecords.push(scheduleRecord);
      }
      
      await storage.set('pto_daily_schedules', dailyScheduleRecords);
    }
    
    console.log('✅ Enhanced PTO request stored successfully:', newRequest.id);
    
    return {
      success: true,
      data: newRequest,
      message: 'PTO request submitted successfully'
    };
  } catch (error) {
    console.error('❌ Error storing enhanced PTO request:', error);
    return {
      success: false,
      message: error.message || 'Failed to store PTO request'
    };
  }
});

// Get PTO Requests
resolver.define('getPTORequests', async (req) => {
  try {
    const filters = req.payload || {};
    console.log('📋 Getting PTO Requests with filters:', filters);
    
    const requests = await storage.get('pto_requests') || [];
    
    let filteredRequests = requests;
    
    // Apply filters
    if (filters.status) {
      filteredRequests = filteredRequests.filter(r => r.status === filters.status);
    }
    
    if (filters.requester_id) {
      filteredRequests = filteredRequests.filter(r => r.requester_id === filters.requester_id);
    }
    
    if (filters.manager_email) {
      filteredRequests = filteredRequests.filter(r => r.manager_email === filters.manager_email);
    }
    
    return {
      success: true,
      data: filteredRequests
    };
  } catch (error) {
    console.error('❌ Error getting PTO requests:', error);
    return {
      success: false,
      message: 'Failed to get PTO requests: ' + error.message
    };
  }
});


// Get Pending Requests for Manager
resolver.define('getPendingRequests', async (req) => {
  try {
    const { managerEmail } = req.payload || {};
    console.log('⏳ Getting pending requests for manager:', managerEmail);
    
    const requests = await storage.get('pto_requests') || [];
    
    const pendingRequests = requests.filter(request => 
      request.status === 'pending' && request.manager_email === managerEmail
    );
    
    return {
      success: true,
      data: pendingRequests
    };
  } catch (error) {
    console.error('❌ Error getting pending requests:', error);
    return {
      success: false,
      message: 'Failed to get pending requests: ' + error.message
    };
  }
});

// Update PTO Request Status (Approve/Decline)
resolver.define('updatePTORequest', async (req) => {
  try {
    const { requestId, status, comment } = req.payload || {};
    console.log(`✅ Updating PTO request ${requestId} to ${status}`);
    
    const requests = await storage.get('pto_requests') || [];
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    // Update request
    requests[requestIndex] = {
      ...requests[requestIndex],
      status: status,
      reviewed_at: new Date().toISOString(),
      reviewer_comments: comment || null
    };
    
    // Save back to storage
    await storage.set('pto_requests', requests);
    
    return {
      success: true,
      data: requests[requestIndex],
      message: `PTO request ${status} successfully`
    };
  } catch (error) {
    console.error('❌ Error updating PTO request:', error);
    return {
      success: false,
      message: 'Failed to update PTO request: ' + error.message
    };
  }
});

// Cancel/Delete PTO Request
resolver.define('cancelPTORequest', async (req) => {
  try {
    const { requestId, cancelledBy, reason } = req.payload || {};
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    console.log(`🗑️ Cancelling PTO request ${requestId}`);
    
    const requests = await storage.get('pto_requests') || [];
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    const request = requests[requestIndex];
    
    // Check if user can cancel this request
    if (request.requester_id !== cancelledBy) {
      throw new Error('You can only cancel your own requests');
    }
    
    // Remove the request
    requests.splice(requestIndex, 1);
    await storage.set('pto_requests', requests);
    
    // Remove associated daily schedules
    const dailySchedules = await storage.get('pto_daily_schedules') || [];
    const filteredSchedules = dailySchedules.filter(s => s.pto_request_id !== requestId);
    await storage.set('pto_daily_schedules', filteredSchedules);
    
    // Log the cancellation
    const cancelLog = await storage.get('pto_cancel_log') || [];
    cancelLog.push({
      request_id: requestId,
      original_request: request,
      cancelled_by: cancelledBy,
      cancellation_reason: reason || 'User cancelled',
      cancelled_at: new Date().toISOString()
    });
    await storage.set('pto_cancel_log', cancelLog);
    
    return {
      success: true,
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

// Get Teams (for team management)
resolver.define('getTeams', async (req) => {
  try {
    console.log('👥 Getting teams');
    const result = await teamUserService.getTeams();
    return result;
  } catch (error) {
    console.error('❌ Error getting teams:', error);
    return {
      success: false,
      message: 'Failed to get teams: ' + error.message
    };
  }
});

// Team Management Resolvers
resolver.define('createTeam', async (req) => {
  try {
    const result = await teamUserService.createTeam(req.payload || {});
    return result;
  } catch (error) {
    console.error('❌ Error in createTeam resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to create team'
    };
  }
});

resolver.define('updateTeam', async (req) => {
  try {
    const result = await teamUserService.updateTeam(req.payload || {});
    return result;
  } catch (error) {
    console.error('❌ Error in updateTeam resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to update team'
    };
  }
});

resolver.define('deleteTeam', async (req) => {
  try {
    const { teamId, deletedBy } = req.payload || {};
    const result = await teamUserService.deleteTeam(teamId, deletedBy);
    return result;
  } catch (error) {
    console.error('❌ Error in deleteTeam resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete team'
    };
  }
});

resolver.define('addTeamMember', async (req) => {
  try {
    const { teamId, member } = req.payload || {};
    const result = await teamUserService.addTeamMember(teamId, member);
    return result;
  } catch (error) {
    console.error('❌ Error in addTeamMember resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to add team member'
    };
  }
});

resolver.define('removeTeamMember', async (req) => {
  try {
    const { teamId, memberAccountId, removedBy } = req.payload || {};
    const result = await teamUserService.removeTeamMember(teamId, memberAccountId, removedBy);
    return result;
  } catch (error) {
    console.error('❌ Error in removeTeamMember resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to remove team member'
    };
  }
});

// User Management Resolvers
resolver.define('getUsers', async (req) => {
  try {
    const result = await teamUserService.getUsers();
    return result;
  } catch (error) {
    console.error('❌ Error in getUsers resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to get users'
    };
  }
});

resolver.define('getUserById', async (req) => {
  try {
    const { userId } = req.payload || {};
    const result = await teamUserService.getUserById(userId);
    return result;
  } catch (error) {
    console.error('❌ Error in getUserById resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to get user'
    };
  }
});

resolver.define('getUsersByTeam', async (req) => {
  try {
    const { teamId } = req.payload || {};
    const result = await teamUserService.getUsersByTeam(teamId);
    return result;
  } catch (error) {
    console.error('❌ Error in getUsersByTeam resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to get team users'
    };
  }
});

resolver.define('createUser', async (req) => {
  try {
    const result = await teamUserService.createUser(req.payload || {});
    return result;
  } catch (error) {
    console.error('❌ Error in createUser resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to create user'
    };
  }
});

resolver.define('updateUser', async (req) => {
  try {
    const result = await teamUserService.updateUser(req.payload || {});
    return result;
  } catch (error) {
    console.error('❌ Error in updateUser resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to update user'
    };
  }
});

resolver.define('deleteUser', async (req) => {
  try {
    const { userId, deletedBy } = req.payload || {};
    const result = await teamUserService.deleteUser(userId, deletedBy);
    return result;
  } catch (error) {
    console.error('❌ Error in deleteUser resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete user'
    };
  }
});

// Get Team PTO Requests
resolver.define('getTeamPTORequests', async (req) => {
  try {
    const { teamId, dateRange } = req.payload || {};
    const result = await teamUserService.getTeamPTORequests(teamId, dateRange);
    return result;
  } catch (error) {
    console.error('❌ Error in getTeamPTORequests resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to get team PTO requests'
    };
  }
});

// Get PTO Calendar Events
resolver.define('getPTOCalendarEvents', async (req) => {
  try {
    const { startDate, endDate } = req.payload || {};
    console.log('📅 Getting calendar events from', startDate, 'to', endDate);
    
    const requests = await storage.get('pto_requests') || [];
    
    // Filter requests that overlap with the requested date range
    const events = requests
      .filter(request => request.status === 'approved')
      .filter(request => {
        const reqStart = new Date(request.start_date);
        const reqEnd = new Date(request.end_date);
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);
        
        return reqStart <= rangeEnd && reqEnd >= rangeStart;
      })
      .map(request => ({
        id: request.id,
        title: `${request.requester_name} - ${request.leave_type}`,
        start: request.start_date,
        end: request.end_date,
        user: {
          name: request.requester_name,
          email: request.requester_email,
          avatarUrl: request.requester_avatar || null
        },
        type: request.leave_type,
        reason: request.reason,
        status: request.status
      }));
    
    return {
      success: true,
      data: events
    };
  } catch (error) {
    console.error('❌ Error getting calendar events:', error);
    return {
      success: false,
      message: 'Failed to get calendar events: ' + error.message
    };
  }
});

// Admin Management Functions
resolver.define('checkUserAdminStatus', async (req) => {
  try {
    const { accountId } = req.payload || {};
    console.log('🔍 Checking admin status for:', accountId);
    
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
      message: error.message
    };
  }
});

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

resolver.define('getInternalJiraUsers', async (payload) => {
  const { projectKey, startAt = 0, maxResults = 50 } = payload;
  console.log(`[Backend] getProjectUsersPaginated called for project: ${projectKey}, startAt: ${startAt}, maxResults: ${maxResults}`);
  
  try {
    const response = await asUser().requestJira(
      route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
    );
    
    if (!response.ok) {
      throw new Error(`Jira API returned ${response.status}`);
    }
    
    const users = await response.json();    
    // Ensure users is an array
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

resolver.define('getInternalJiraUsersByGroup', async (req) => {
  try {
    const { groupName = 'jira-users' } = req.payload || {};
    console.log('🔍 Getting internal Jira users from group:', groupName);
    
    // Try multiple group names to find internal users
    const groupsToTry = [
      groupName,
      'jira-users',
      'jira-software-users', 
      'jira-administrators',
      'atlassian-users-rebelmouse' // Company-specific group
    ];
    
    let allUsers = [];
    
    for (const group of groupsToTry) {
      try {
        const response = await api.asUser().requestJira(
          route`/rest/api/3/group/member?groupname=${encodeURIComponent(group)}&maxResults=200`
        );
        
        if (response.ok) {
          const groupData = await response.json();
          if (groupData.values && groupData.values.length > 0) {
            console.log(`✅ Found ${groupData.values.length} users in group: ${group}`);
            
            // Filter for active users only and add to collection
            const activeUsers = groupData.values.filter(user => user.active !== false);
            allUsers = allUsers.concat(activeUsers);
          }
        }
      } catch (groupError) {
        console.warn(`⚠️ Could not fetch group ${group}:`, groupError.message);
        continue;
      }
    }
    
    // Remove duplicates based on accountId
    const uniqueUsers = allUsers.reduce((acc, user) => {
      if (!acc.find(u => u.accountId === user.accountId)) {
        acc.push(user);
      }
      return acc;
    }, []);
    
    // Filter for company domain users if available
    const companyDomains = ['rebelmouse.com']; // Add your company domains
    const companyUsers = uniqueUsers.filter(user => {
      if (!user.emailAddress) return false;
      return companyDomains.some(domain => user.emailAddress.toLowerCase().includes(domain.toLowerCase()));
    });
    
    // Use company users if found, otherwise use all unique users
    const finalUsers = companyUsers.length > 0 ? companyUsers : uniqueUsers;
    
    const userData = finalUsers.map(user => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['32x32'] || null,
      active: user.active
    }));

    console.log(`✅ Returning ${userData.length} internal users`);
    
    return {
      success: true,
      data: userData
    };
  } catch (error) {
    console.error('❌ Error getting internal Jira users:', error);
    return {
      success: false,
      message: 'Failed to get internal Jira users: ' + error.message
    };
  }
});


// Enhanced User Creation from Jira
resolver.define('createUserFromJira', async (req) => {
  try {
    const { jiraUser, teamId, additionalData } = req.payload || {};
    
    if (!jiraUser || !jiraUser.accountId) {
      throw new Error('Jira user data is required');
    }
    
    console.log('👤 Creating user from Jira data:', jiraUser.displayName);
    
    // Check if user already exists
    const users = await storage.get('users') || [];
    const existingUser = users.find(user => 
      user.jira_account_id === jiraUser.accountId ||
      user.email_address === jiraUser.emailAddress
    );
    
    if (existingUser) {
      return {
        success: false,
        message: 'User already exists in the system'
      };
    }
    
    // Create user with Jira data
    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      first_name: additionalData?.firstName || jiraUser.displayName?.split(' ')[0] || '',
      last_name: additionalData?.lastName || jiraUser.displayName?.split(' ').slice(1).join(' ') || '',
      display_name: jiraUser.displayName || '',
      email_address: jiraUser.emailAddress || '',
      jira_account_id: jiraUser.accountId,
      employment_type: additionalData?.employmentType || 'full-time',
      hire_date: additionalData?.hireDate || '',
      team_id: teamId || null,
      capacity: additionalData?.capacity || 40,
      availability: additionalData?.availability || getDefaultAvailability(),
      avatar_url: jiraUser.avatarUrl || '',
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

// Get Company Statistics
resolver.define('getCompanyStatistics', async (req) => {
  try {
    console.log('📊 Getting company statistics');
    
    const [teamsResponse, usersResponse, requestsResponse, jiraUsersResponse] = await Promise.all([
      storage.get('teams') || [],
      storage.get('users') || [],
      storage.get('pto_requests') || [],
      invoke('getInternalJiraUsersByGroup', { groupName: 'jira-users' })
    ]);
    
    const teams = teamsResponse || [];
    const users = usersResponse || [];
    const requests = requestsResponse || [];
    const jiraUsers = jiraUsersResponse.success ? jiraUsersResponse.data : [];
    
    // Calculate statistics
    const stats = {
      // Basic counts
      totalTeams: teams.length,
      totalUsers: users.length,
      totalRequests: requests.length,
      totalJiraUsers: jiraUsers.length,
      
      // Request statistics
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      approvedRequests: requests.filter(r => r.status === 'approved').length,
      declinedRequests: requests.filter(r => r.status === 'declined').length,
      
      // Time-based statistics
      thisMonthRequests: requests.filter(r => {
        const requestDate = new Date(r.submitted_at);
        const now = new Date();
        return requestDate.getMonth() === now.getMonth() && 
               requestDate.getFullYear() === now.getFullYear();
      }).length,
      
      // User adoption
      usersWithTeams: users.filter(u => u.team_id).length,
      usersWithoutTeams: users.filter(u => !u.team_id).length,
      jiraUsersNotInSystem: jiraUsers.filter(jiraUser => 
        !users.some(systemUser => 
          systemUser.jira_account_id === jiraUser.accountId ||
          systemUser.email_address === jiraUser.emailAddress
        )
      ).length,
      
      // Department statistics
      departmentStats: teams.reduce((acc, team) => {
        const dept = team.department || 'Unassigned';
        if (!acc[dept]) {
          acc[dept] = { teams: 0, members: 0 };
        }
        acc[dept].teams++;
        acc[dept].members += team.members?.length || 0;
        return acc;
      }, {}),
      
      // Leave type statistics
      leaveTypeStats: requests.reduce((acc, request) => {
        const type = request.leave_type || 'unknown';
        if (!acc[type]) {
          acc[type] = { count: 0, days: 0 };
        }
        acc[type].count++;
        acc[type].days += request.total_days || 0;
        return acc;
      }, {})
    };
    
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('❌ Error getting company statistics:', error);
    return {
      success: false,
      message: error.message || 'Failed to get company statistics'
    };
  }
});

// Bulk User Import from Jira
resolver.define('bulkImportUsersFromJira', async (req) => {
  try {
    const { selectedUserIds, defaultTeamId, defaultDepartment } = req.payload || {};
    
    if (!selectedUserIds || selectedUserIds.length === 0) {
      throw new Error('No users selected for import');
    }
    
    console.log(`📥 Bulk importing ${selectedUserIds.length} users from Jira`);
    
    // Get Jira users
    const jiraUsersResponse = await invoke('getInternalJiraUsersByGroup');
    if (!jiraUsersResponse.success) {
      throw new Error('Failed to get Jira users');
    }
    
    const jiraUsers = jiraUsersResponse.data || [];
    const selectedJiraUsers = jiraUsers.filter(user => 
      selectedUserIds.includes(user.accountId)
    );
    
    // Get existing users to avoid duplicates
    const existingUsers = await storage.get('users') || [];
    const existingIds = existingUsers.map(user => user.jira_account_id);
    
    const usersToImport = selectedJiraUsers.filter(jiraUser => 
      !existingIds.includes(jiraUser.accountId)
    );
    
    if (usersToImport.length === 0) {
      return {
        success: false,
        message: 'All selected users already exist in the system'
      };
    }
    
    // Create users
    const newUsers = usersToImport.map(jiraUser => ({
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      first_name: jiraUser.displayName?.split(' ')[0] || '',
      last_name: jiraUser.displayName?.split(' ').slice(1).join(' ') || '',
      display_name: jiraUser.displayName || '',
      email_address: jiraUser.emailAddress || '',
      jira_account_id: jiraUser.accountId,
      employment_type: 'full-time',
      hire_date: '',
      team_id: defaultTeamId || null,
      capacity: 40,
      availability: getDefaultAvailability(),
      avatar_url: jiraUser.avatarUrl || '',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_from_jira: true,
      bulk_imported: true
    }));
    
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
      message: error.message || 'Failed to bulk import users'
    };
  }
});

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

// Submit PTO request on behalf of another user (Admin only)
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
        sum + (schedule.type === 'FULL_DAY' ? 8 : 4), 0
      );
    } else {
      // Calculate based on date range
      const start = new Date(requestData.start_date);
      const end = new Date(requestData.end_date);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      totalDays = totalDays || daysDiff;
      totalHours = totalHours || (daysDiff * 8);
    }
    
    // Get existing requests
    const requests = await storage.get('pto_requests') || [];
    
    // Create new request with admin privileges
    const newRequest = {
      id: `pto-admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requester_id: requestData.requester_id,
      requester_name: requestData.requester_name,
      requester_email: requestData.requester_email,
      requester_avatar: requestData.requester_avatar,
      manager_id: requestData.manager_id,
      manager_name: requestData.manager_name,
      manager_email: requestData.manager_email,
      start_date: requestData.start_date,
      end_date: requestData.end_date,
      leave_type: requestData.leave_type,
      reason: requestData.reason,
      status: requestData.status || 'approved', // Admin can directly approve
      total_days: totalDays,
      total_hours: totalHours,
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewer_comments: 'Created by admin',
      submitted_by_admin: true,
      admin_id: submittedBy,
      daily_schedules: requestData.daily_schedules || []
    };
    
    // Add to storage
    requests.push(newRequest);
    await storage.set('pto_requests', requests);
    
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

// Get user's teams
resolver.define('getUserTeams', async (req) => {
  try {
    const { userId } = req.payload || {};
    const result = await teamUserService.getUserTeams(userId);
    return result;
  } catch (error) {
    console.error('❌ Error in getUserTeams resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to get user teams'
    };
  }
});

// Get team analytics
resolver.define('getTeamAnalytics', async (req) => {
  try {
    const { teamId, dateRange } = req.payload || {};
    const result = await teamUserService.getTeamAnalytics(teamId, dateRange);
    return result;
  } catch (error) {
    console.error('❌ Error in getTeamAnalytics resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to get team analytics'
    };
  }
});

// Auto-setup admin users on first run
resolver.define('setupDefaultAdmin', async (req) => {
  try {
    console.log('🔧 Setting up default admin users...');
    
    const admins = await storage.get('pto_admins') || [];
    const defaultAdminEmail = 'gabriela.carrion@rebelmouse.com';
    
    const userSearchResponse = await api.asUser().requestJira(
      route`/rest/api/3/user/search?query=${defaultAdminEmail}&maxResults=1`
    );
    
    if (userSearchResponse.ok) {
      const users = await userSearchResponse.json();
      if (users.length > 0) {
        const adminAccountId = users[0].accountId;
        
        if (!admins.includes(adminAccountId)) {
          admins.push(adminAccountId);
          await storage.set('pto_admins', admins);
          
          console.log('✅ Default admin added:', defaultAdminEmail, adminAccountId);
          
          return {
            success: true,
            message: `Default admin ${defaultAdminEmail} added successfully`,
            data: { adminAccountId, adminEmail: defaultAdminEmail }
          };
        } else {
          return {
            success: true,
            message: `${defaultAdminEmail} is already an admin`,
            data: { adminAccountId, adminEmail: defaultAdminEmail }
          };
        }
      } else {
        return {
          success: false,
          message: `User ${defaultAdminEmail} not found in Jira`
        };
      }
    } else {
      throw new Error('Failed to search for user');
    }
  } catch (error) {
    console.error('❌ Error setting up default admin:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Auto-initialize admin on database init
resolver.define('initializePTODatabaseWithAdmin', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database with Admin Setup...');
    
    const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances', 'pto_admins'];
    
    for (const table of tables) {
      const existing = await storage.get(table);
      if (!existing) {
        await storage.set(table, []);
        console.log(`✅ Initialized table: ${table}`);
      }
    }
    
    const admins = await storage.get('pto_admins') || [];
    const defaultAdminEmail = 'gabriela.carrion@rebelmouse.com';
    
    let adminSetupResult = {
      success: true,
      message: 'Admin already exists or setup skipped'
    };
    
    try {
      const userSearchResponse = await api.asUser().requestJira(
        route`/rest/api/3/user/search?query=${defaultAdminEmail}&maxResults=1`
      );
      
      if (userSearchResponse.ok) {
        const users = await userSearchResponse.json();
        if (users.length > 0) {
          const adminAccountId = users[0].accountId;
          
          if (!admins.includes(adminAccountId)) {
            admins.push(adminAccountId);
            await storage.set('pto_admins', admins);
            
            console.log('✅ Default admin added:', defaultAdminEmail, adminAccountId);
            adminSetupResult = {
              success: true,
              message: `Default admin ${defaultAdminEmail} added successfully`,
              data: { adminAccountId, adminEmail: defaultAdminEmail }
            };
          } else {
            adminSetupResult = {
              success: true,
              message: `${defaultAdminEmail} is already an admin`,
              data: { adminAccountId, adminEmail: defaultAdminEmail }
            };
          }
        } else {
          adminSetupResult = {
            success: false,
            message: `User ${defaultAdminEmail} not found in Jira`
          };
        }
      } else {
        adminSetupResult = {
          success: false,
          message: 'Failed to search for admin user'
        };
      }
    } catch (adminError) {
      console.warn('❌ Admin setup failed, but database initialized:', adminError);
      adminSetupResult = {
        success: false,
        message: 'Admin setup failed: ' + adminError.message
      };
    }
    
    return {
      success: true,
      message: 'PTO Database initialized successfully',
      data: {
        database: { success: true, message: 'Database tables initialized' },
        admin: adminSetupResult
      }
    };
  } catch (error) {
    console.error('❌ Database and admin initialization failed:', error);
    
    try {
      const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances', 'pto_admins'];
      for (const table of tables) {
        const existing = await storage.get(table);
        if (!existing) {
          await storage.set(table, []);
        }
      }
      
      return {
        success: true,
        message: 'Database initialized, but admin setup failed: ' + error.message,
        data: {
          database: { success: true },
          admin: { success: false, message: error.message }
        }
      };
    } catch (fallbackError) {
      return {
        success: false,
        message: 'Complete initialization failed: ' + fallbackError.message
      };
    }
  }
});

resolver.define('initializePTODatabaseWithTeamManagement', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database with Enhanced Team Management...');
    
    // Initialize the original PTO database first
    const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances', 'pto_admins'];
    
    for (const table of tables) {
      const existing = await storage.get(table);
      if (!existing) {
        await storage.set(table, []);
        console.log(`✅ Initialized table: ${table}`);
      }
    }
    
    // Initialize the enhanced team/user service
    await teamUserService.initialize();
    
    // Set up default admin
    let adminResult = null;
    try {
      const admins = await storage.get('pto_admins') || [];
      const defaultAdminEmail = 'gabriela.carrion@rebelmouse.com';
      
      const userSearchResponse = await api.asUser().requestJira(
        route`/rest/api/3/user/search?query=${defaultAdminEmail}&maxResults=1`
      );
      
      if (userSearchResponse.ok) {
        const users = await userSearchResponse.json();
        if (users.length > 0) {
          const adminAccountId = users[0].accountId;
          
          if (!admins.includes(adminAccountId)) {
            admins.push(adminAccountId);
            await storage.set('pto_admins', admins);
            
            adminResult = {
              success: true,
              message: `Default admin ${defaultAdminEmail} added successfully`
            };
          } else {
            adminResult = {
              success: true,
              message: `${defaultAdminEmail} is already an admin`
            };
          }
        }
      }
    } catch (adminError) {
      console.warn('Could not set up default admin:', adminError);
      adminResult = {
        success: false,
        message: adminError.message
      };
    }
    
    return {
      success: true,
      data: {
        pto: { success: true, message: 'PTO tables initialized' },
        teamUser: { success: true, message: 'Team/User service initialized' },
        admin: adminResult,
        initialized: true,
        timestamp: new Date().toISOString()
      },
      message: 'PTO Database with Enhanced Team Management initialized successfully'
    };
  } catch (error) {
    console.error('❌ Error initializing PTO Database with Team Management:', error);
    return {
      success: false,
      message: error.message || 'Failed to initialize database'
    };
  }
});

// Clear storage (for development/testing)
resolver.define('clearStorage', async (req) => {
  try {
    const { table } = req.payload || {};
    
    if (table) {
      await storage.set(table, []);
      console.log(`🗑️ Cleared storage table: ${table}`);
    } else {
      const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances'];
      for (const tableName of tables) {
        await storage.set(tableName, []);
      }
      console.log('🗑️ Cleared all PTO storage tables');
    }
    
    return {
      success: true,
      message: table ? `Cleared ${table}` : 'Cleared all PTO tables'
    };
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Debug function to check storage
resolver.define('debugStorage', async (req) => {
  try {
    const { table } = req.payload || {};
    const data = await storage.get(table || 'pto_requests');
    
    return {
      success: true,
      data: {
        table: table || 'pto_requests',
        count: Array.isArray(data) ? data.length : 0,
        records: data || []
      }
    };
  } catch (error) {
    console.error('❌ Debug storage error:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Debug and Maintenance Resolvers for Team User Service
resolver.define('debugTeamUserStorage', async (req) => {
  try {
    const { table } = req.payload || {};
    const result = await teamUserService.debugStorage(table);
    return result;
  } catch (error) {
    console.error('❌ Error in debugTeamUserStorage resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to debug storage'
    };
  }
});

resolver.define('clearTeamUserStorage', async (req) => {
  try {
    const { table } = req.payload || {};
    const result = await teamUserService.clearStorage(table);
    return result;
  } catch (error) {
    console.error('❌ Error in clearTeamUserStorage resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to clear storage'
    };
  }
});

resolver.define('migrateFromPTOTeams', async (req) => {
  try {
    const result = await teamUserService.migrateFromPTOTeams();
    return result;
  } catch (error) {
    console.error('❌ Error in migrateFromPTOTeams resolver:', error);
    return {
      success: false,
      message: error.message || 'Failed to migrate teams'
    };
  }
});

export const handler = resolver.getDefinitions();