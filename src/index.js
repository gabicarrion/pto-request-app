import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import teamUserService from './services/team-user-service';
import resourceApiService from './services/resource-api-service';
import { importService } from './services/import-service';
import ptoService from './database/pto-service';

const resolver = new Resolver();
const cleanupCache = new Map();

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
resolver.define('getInternalJiraUsers', async (req) => {
  try {
    const { startAt = 0, maxResults = 50 } = req.payload || {};
    console.log(`🔍 Getting internal Jira users - startAt: ${startAt}, maxResults: ${maxResults}`);
    
    // Use a fixed project key instead of searching for one
    const projectKey = 'SDTI';
    console.log(`Using project ${projectKey} to get assignable users`);
    
    const usersResponse = await api.asUser().requestJira(
      route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
    );
    
    if (!usersResponse.ok) {
      throw new Error(`Failed to get users: ${usersResponse.status}`);
    }
    
    const users = await usersResponse.json();
    
    // Get database users to filter out existing ones
    const dbUsers = await storage.get('users') || [];
    const existingIds = new Set();
    dbUsers.forEach(user => {
      if (user.jira_account_id) existingIds.add(user.jira_account_id);
      if (user.email_address) existingIds.add(user.email_address.toLowerCase());
    });

    // Filter users that don't exist in database
    const newUsers = users.filter(user => {
      const accountId = user.accountId;
      return !existingIds.has(accountId);
    });

    // Get email addresses for new users in batches
    const userDetails = [];
    const batchSize = 10;
    
    for (let i = 0; i < newUsers.length; i += batchSize) {
      const batch = newUsers.slice(i, i + batchSize);
      const batchPromises = batch.map(async (user) => {
        try {
          const userResponse = await api.asUser().requestJira(
            route`/rest/api/3/user?accountId=${user.accountId}`
          );
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            return {
              accountId: user.accountId,
              displayName: user.displayName,
              emailAddress: userData.emailAddress,
              avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['32x32'] || null,
              active: user.active !== false
            };
          }
        } catch (error) {
          console.warn(`Failed to get details for user ${user.accountId}:`, error.message);
          // If we can't get detailed info, use the basic info
          return {
            accountId: user.accountId,
            displayName: user.displayName,
            emailAddress: null,
            avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['32x32'] || null,
            active: user.active !== false
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      userDetails.push(...batchResults);
      
      // Small delay between batches to be nice to the API
      if (i + batchSize < newUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Sort by display name
    userDetails.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    
    const total = users.length >= maxResults ? startAt + maxResults + 1 : startAt + users.length;
    const isLast = users.length < maxResults;
    
    console.log(`✅ Found ${userDetails.length} new assignable users with details`);
    
    return {
      success: true,
      data: {
        users: userDetails,
        startAt,
        maxResults,
        total,
        isLast
      }
    };
  } catch (error) {
    console.error('❌ Error getting Jira users:', error);
    return {
      success: false,
      message: 'Failed to get Jira users: ' + error.message,
      data: {
        users: [],
        startAt: 0,
        maxResults,
        total: 0,
        isLast: true
      }
    };
  }
});
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
          requester_id: reporter.accountId,
          requester_name: reporter.displayName,
          requester_email: reporter.emailAddress,
          manager_id: manager.accountId,
          manager_name: manager.displayName,
          manager_email: manager.emailAddress,
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
resolver.define('getPTORequests', async (req) => {
  try {
    const filters = req.payload || {};
    console.log('📋 Getting PTO Requests with filters:', filters);
    
    // Get regular PTO requests using chunked retrieval
    let requests = [];
    try {
      requests = await importService.getChunkedData('pto_requests') || [];
      console.log('📦 Loaded PTO requests from chunked storage:', requests.length);
    } catch (error) {
      console.warn('⚠️ Could not load chunked requests, trying direct:', error.message);
      requests = await storage.get('pto_requests') || [];
      console.log('📦 Loaded PTO requests from direct storage:', requests.length);
    }
    
    // Get daily schedules (imported data) using chunked retrieval
    let dailySchedules = [];
    try {
      dailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
      console.log('📦 Loaded daily schedules from chunked storage:', dailySchedules.length);
    } catch (error) {
      console.warn('⚠️ Could not load chunked daily schedules, trying direct:', error.message);
      dailySchedules = await storage.get('pto_daily_schedules') || [];
      console.log('📦 Loaded daily schedules from direct storage:', dailySchedules.length);
    }
    
    // Transform daily schedules to match the expected format for the frontend
    const transformedSchedules = dailySchedules.map(schedule => ({
      ...schedule,
      // Ensure these fields exist for frontend compatibility
      start_date: schedule.date,
      end_date: schedule.date,
      total_days: schedule.hours ? schedule.hours / 8 : 1,
      total_hours: schedule.hours || 8,
      submitted_at: schedule.created_at,
      // Mark as imported data
      is_imported: true,
      source: 'daily_schedule'
    }));
    
    // Combine both types of data
    let allEvents = [...requests, ...transformedSchedules];
    
    console.log('📋 Combined data:', {
      requests: requests.length,
      dailySchedules: dailySchedules.length,
      transformed: transformedSchedules.length,
      total: allEvents.length
    });
    
    // Apply filters to combined data
    if (filters.status) {
      allEvents = allEvents.filter(r => r.status === filters.status);
    }
    
    if (filters.requester_id) {
      allEvents = allEvents.filter(r => r.requester_id === filters.requester_id);
    }
    
    if (filters.manager_email) {
      allEvents = allEvents.filter(r => r.manager_email === filters.manager_email);
    }
    
    if (filters.startDate && filters.endDate) {
      allEvents = allEvents.filter(event => {
        const eventDate = event.date || event.start_date;
        return eventDate >= filters.startDate && eventDate <= filters.endDate;
      });
    }
    
    console.log('📋 Returning filtered events:', allEvents.length);
    
    return {
      success: true,
      data: allEvents
    };
  } catch (error) {
    console.error('❌ Error getting PTO requests:', error);
    return {
      success: false,
      message: 'Failed to get PTO requests: ' + error.message
    };
  }
});
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
// not being used:
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
//
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
//used in team-user-service.js
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
//
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
})
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
resolver.define('bulkImportUsersFromJira', async (req) => {
  try {
    const { selectedUserIds, defaultTeamId, defaultDepartment } = req.payload || {};
    
    if (!selectedUserIds || selectedUserIds.length === 0) {
      throw new Error('No users selected for import');
    }
    
    console.log(`📥 Bulk importing ${selectedUserIds.length} users from Jira`);
    
    // Get detailed user information from Jira for selected users
    const userDetails = [];
    const batchSize = 10; // Process in batches to avoid API limits
    
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
      
      // Small delay between batches to be nice to the API
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
resolver.define('searchDatabaseUsers', async (req) => {
  try {
    const { query, filterBy = 'all', startAt = 0, maxResults = 50 } = req.payload || {};
    console.log('🔍 Searching database users:', { query, filterBy, startAt, maxResults });
    
    const users = await storage.get('users') || [];
    let filteredUsers = [...users];
    
    // Apply team filter
    if (filterBy === 'withTeam') {
      filteredUsers = filteredUsers.filter(user => user.team_id);
    } else if (filterBy === 'withoutTeam') {
      filteredUsers = filteredUsers.filter(user => !user.team_id);
    }
    
    // Apply search query if provided
    if (query && query.length >= 1) {
      const searchLower = query.toLowerCase();
      filteredUsers = filteredUsers.filter(user => {
        const displayName = (user.display_name || user.displayName || '').toLowerCase();
        const email = (user.email_address || user.emailAddress || '').toLowerCase();
        const firstName = (user.first_name || user.firstName || '').toLowerCase();
        const lastName = (user.last_name || user.lastName || '').toLowerCase();
        
        return displayName.includes(searchLower) || 
               email.includes(searchLower) ||
               firstName.includes(searchLower) ||
               lastName.includes(searchLower);
      });
    }
    
    // Sort by display name
    filteredUsers.sort((a, b) => {
      const nameA = (a.display_name || a.displayName || '').toLowerCase();
      const nameB = (b.display_name || b.displayName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Apply pagination
    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(startAt, startAt + maxResults);
    const isLast = (startAt + paginatedUsers.length) >= total;
    
    return {
      success: true,
      data: {
        users: paginatedUsers,
        total,
        startAt,
        maxResults,
        isLast
      }
    };
  } catch (error) {
    console.error('❌ Error searching database users:', error);
    return {
      success: false,
      message: error.message || 'Failed to search users'
    };
  }
});
resolver.define('editPTORequest', async (req) => {
  try {
    const { requestId, updatedData, editedBy } = req.payload || {};
    console.log(`✏️ Editing PTO request ${requestId}`);
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    const requests = await storage.get('pto_requests') || [];
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    const existingRequest = requests[requestIndex];
    
    // Check if user can edit this request
    if (existingRequest.requester_id !== editedBy) {
      throw new Error('You can only edit your own requests');
    }
    
    // Only allow editing of pending requests
    if (existingRequest.status !== 'pending') {
      throw new Error('Only pending requests can be edited');
    }
    
    // Check for conflicts with other requests (excluding the current one)
    if (updatedData.startDate && updatedData.endDate) {
      const conflictingRequests = requests.filter(request => 
        request.id !== requestId &&
        request.requester_id === editedBy &&
        request.status !== 'declined' &&
        !(new Date(updatedData.endDate) < new Date(request.start_date) || 
          new Date(updatedData.startDate) > new Date(request.end_date))
      );
      
      if (conflictingRequests.length > 0) {
        throw new Error('This request conflicts with existing PTO requests for the same dates');
      }
    }
    
    // Calculate new totals if daily schedules are provided
    let totalDays = updatedData.totalDays;
    let totalHours = updatedData.totalHours;
    
    if (updatedData.dailySchedules && updatedData.dailySchedules.length > 0) {
      totalDays = updatedData.dailySchedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5), 0
      );
      totalHours = updatedData.dailySchedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 8 : 4), 0
      );
    }
    
    // Update the request - reset to pending and clear review data
    requests[requestIndex] = {
      ...existingRequest,
      ...updatedData,
      total_days: totalDays || existingRequest.total_days,
      total_hours: totalHours || existingRequest.total_hours,
      status: 'pending', // Reset to pending after edit
      reviewed_at: null,
      daily_schedules: updatedData.dailySchedules || [],
      reviewer_comments: null,
      updated_at: new Date().toISOString(),
      edited_at: new Date().toISOString(),
      edit_history: [
        ...(existingRequest.edit_history || []),
        {
          edited_at: new Date().toISOString(),
          edited_by: editedBy,
          previous_data: {
            start_date: existingRequest.start_date,
            end_date: existingRequest.end_date,
            reason: existingRequest.reason,
            total_days: existingRequest.total_days
          }
        }
      ]
    };
    
    await storage.set('pto_requests', requests);
    
    // Update daily schedules if provided
    if (updatedData.dailySchedules) {
      const allSchedules = await storage.get('pto_daily_schedules') || [];
      const filteredSchedules = allSchedules.filter(s => s.pto_request_id !== requestId);
      
      const newSchedules = updatedData.dailySchedules.map(schedule => ({
        id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pto_request_id: requestId,
        date: schedule.date,
        schedule_type: schedule.type,
        leave_type: schedule.leaveType,
        hours: schedule.type === 'FULL_DAY' ? 8 : 4,
        requester_id: existingRequest.requester_id,
        requester_name: existingRequest.requester_name,
        requester_email: existingRequest.requester_email,
        manager_id: existingRequest.manager_id,
        manager_name: existingRequest.manager_name,
        manager_email: existingRequest.manager_email,
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
resolver.define("getProjectUsersPaginated", async ({ payload }) => {
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
      // Calculate based on date range (business days only)
      const start = new Date(requestData.start_date);
      const end = new Date(requestData.end_date);
      let businessDays = 0;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
          businessDays++;
        }
      }
      
      totalDays = totalDays || businessDays;
      totalHours = totalHours || (businessDays * 8);
    }
    
    // Get existing requests to check for conflicts
    const existingRequests = await storage.get('pto_requests') || [];
    
    // Check for conflicts (only if this is a new request, not an import override)
    if (!requestData.import_source) {
      const conflictingRequests = existingRequests.filter(request => 
        request.requester_id === requestData.requester_id &&
        request.status !== 'declined' &&
        !(new Date(requestData.end_date) < new Date(request.start_date) || 
          new Date(requestData.start_date) > new Date(request.end_date))
      );
      
      if (conflictingRequests.length > 0) {
        throw new Error('This request conflicts with existing PTO requests for the same dates');
      }
    }
    
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
      reviewer_comments: requestData.reviewer_comments || 'Created by admin',
      submitted_by_admin: true,
      admin_id: submittedBy,
      daily_schedules: requestData.daily_schedules || [],
      import_source: requestData.import_source || null,
      imported_by: requestData.imported_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add to storage
    existingRequests.push(newRequest);
    await storage.set('pto_requests', existingRequests);
    
    // Create daily schedule records if provided
    if (requestData.daily_schedules && requestData.daily_schedules.length > 0) {
      const dailyScheduleRecords = await storage.get('pto_daily_schedules') || [];
      
      for (const schedule of requestData.daily_schedules) {
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
resolver.define('debugStorage', async (req) => {
  try {
    console.log('🔍 Debugging storage state');
    
    const users = await storage.get('users') || [];
    const teams = await storage.get('teams') || [];
    const admins = await storage.get('pto_admins') || [];
    const ptoRequests = await storage.get('pto_requests') || [];
    
    // ADD: Check both chunked and direct storage for daily schedules
    let ptoDailySchedules = [];
    try {
      ptoDailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
      console.log('📦 Loaded daily schedules from chunked storage:', ptoDailySchedules.length);
    } catch (chunkError) {
      console.warn('⚠️ Could not load chunked daily schedules, trying direct storage:', chunkError.message);
      ptoDailySchedules = await storage.get('pto_daily_schedules') || [];
      console.log('📦 Loaded daily schedules from direct storage:', ptoDailySchedules.length);
    }
    
    console.log(`Users in storage: ${users.length}`);
    console.log(`Teams in storage: ${teams.length}`);
    console.log(`Admins in storage: ${admins.length}`);
    console.log(`PTO Requests in storage: ${ptoRequests.length}`);
    console.log(`PTO Daily Schedules in storage: ${ptoDailySchedules.length}`);
    
    // ADD: Sample daily schedule data for debugging
    if (ptoDailySchedules.length > 0) {
      console.log('Sample daily schedule:', ptoDailySchedules[0]);
    }
    
    return {
      success: true,
      data: {
        users,
        teams,
        admins,
        pto_requests: ptoRequests,
        pto_daily_schedules: ptoDailySchedules,
        summary: {
          userCount: users.length,
          teamCount: teams.length,
          adminCount: admins.length,
          ptoRequestCount: ptoRequests.length,
          ptoScheduleCount: ptoDailySchedules.length
        }
      }
    };
  } catch (error) {
    console.error('❌ Error debugging storage:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
resolver.define('cleanupPTODatabase', async (req) => {
  try {
    const { adminId, confirmDelete } = req.payload || {};
    
    // Verify admin status
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(adminId)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    if (!confirmDelete) {
      throw new Error('Confirmation required for cleanup');
    }
    
    console.log('🗑️ CLEANUP: Starting PTO database cleanup by admin:', adminId);
    
    let deletedCount = 0;
    const cleanupLog = [];
    
    // Clean up regular PTO requests
    try {
      const ptoRequests = await storage.get('pto_requests') || [];
      if (ptoRequests.length > 0) {
        await storage.set('pto_requests', []);
        deletedCount += ptoRequests.length;
        cleanupLog.push(`Deleted ${ptoRequests.length} PTO requests`);
        console.log(`✅ Deleted ${ptoRequests.length} PTO requests`);
      }
    } catch (error) {
      console.warn('⚠️ Could not clean PTO requests:', error.message);
      cleanupLog.push(`Failed to clean PTO requests: ${error.message}`);
    }
    
    // Clean up daily schedules (chunked storage)
    try {
      const dailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
      if (dailySchedules.length > 0) {
        // Delete chunked data
        await importService.deleteChunkedData('pto_daily_schedules');
        // Also clear direct storage
        await storage.set('pto_daily_schedules', []);
        
        deletedCount += dailySchedules.length;
        cleanupLog.push(`Deleted ${dailySchedules.length} daily schedules (chunked)`);
        console.log(`✅ Deleted ${dailySchedules.length} daily schedules`);
      }
    } catch (error) {
      console.warn('⚠️ Could not clean daily schedules:', error.message);
      cleanupLog.push(`Failed to clean daily schedules: ${error.message}`);
      
      // Try direct storage cleanup
      try {
        const directSchedules = await storage.get('pto_daily_schedules') || [];
        if (directSchedules.length > 0) {
          await storage.set('pto_daily_schedules', []);
          deletedCount += directSchedules.length;
          cleanupLog.push(`Deleted ${directSchedules.length} daily schedules (direct)`);
        }
      } catch (directError) {
        console.warn('⚠️ Could not clean direct daily schedules:', directError.message);
      }
    }
    
    // Clean up PTO balances
    try {
      const ptoBalances = await storage.get('pto_balances') || [];
      if (ptoBalances.length > 0) {
        await storage.set('pto_balances', []);
        deletedCount += ptoBalances.length;
        cleanupLog.push(`Deleted ${ptoBalances.length} PTO balances`);
        console.log(`✅ Deleted ${ptoBalances.length} PTO balances`);
      }
    } catch (error) {
      console.warn('⚠️ Could not clean PTO balances:', error.message);
      cleanupLog.push(`Failed to clean PTO balances: ${error.message}`);
    }
    
    // Clean up any remaining validation data
    try {
      await importService.clearValidationData();
      cleanupLog.push('Cleared validation data');
    } catch (error) {
      console.warn('⚠️ Could not clear validation data:', error.message);
    }
    
    // Log the cleanup activity
    const adminLog = await storage.get('pto_admin_log') || [];
    adminLog.push({
      action: 'PTO_DATABASE_CLEANUP',
      admin_id: adminId,
      timestamp: new Date().toISOString(),
      details: {
        deletedCount,
        cleanupLog
      }
    });
    await storage.set('pto_admin_log', adminLog);
    
    console.log(`🎉 CLEANUP COMPLETE: ${deletedCount} items deleted`);
    
    return {
      success: true,
      data: {
        deletedCount,
        cleanupLog
      },
      message: `Successfully cleaned up PTO database: ${deletedCount} items deleted`
    };
    
  } catch (error) {
    console.error('❌ Error cleaning up PTO database:', error);
    return {
      success: false,
      message: error.message || 'Failed to cleanup PTO database'
    };
  }
});
// not being used:
resolver.define('adminEditPTORequest', async (req) => {
  try {
    const { requestId, updatedData, adminId } = req.payload || {};
    console.log(`👑 Admin editing PTO request ${requestId}`);
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    const requests = await storage.get('pto_requests') || [];
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    const existingRequest = requests[requestIndex];
    
    // Calculate new totals if daily schedules are provided
    let totalDays = updatedData.totalDays;
    let totalHours = updatedData.totalHours;
    
    if (updatedData.dailySchedules && updatedData.dailySchedules.length > 0) {
      totalDays = updatedData.dailySchedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5), 0
      );
      totalHours = updatedData.dailySchedules.reduce((sum, schedule) => 
        sum + (schedule.type === 'FULL_DAY' ? 8 : 4), 0
      );
    }
    
    // Update the request
    requests[requestIndex] = {
      ...existingRequest,
      ...updatedData,
      total_days: totalDays || existingRequest.total_days,
      total_hours: totalHours || existingRequest.total_hours,
      updated_at: new Date().toISOString(),
      last_edited_by: adminId,
      last_edited_at: new Date().toISOString(),
      edit_history: [
        ...(existingRequest.edit_history || []),
        {
          edited_at: new Date().toISOString(),
          edited_by: adminId,
          is_admin_edit: true,
          previous_data: {
            start_date: existingRequest.start_date,
            end_date: existingRequest.end_date,
            reason: existingRequest.reason,
            status: existingRequest.status,
            total_days: existingRequest.total_days
          }
        }
      ]
    };
    
    await storage.set('pto_requests', requests);
    
    // Update daily schedules if provided
    if (updatedData.dailySchedules) {
      const allSchedules = await storage.get('pto_daily_schedules') || [];
      const filteredSchedules = allSchedules.filter(s => s.pto_request_id !== requestId);
      
      const newSchedules = updatedData.dailySchedules.map(schedule => ({
        id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pto_request_id: requestId,
        date: schedule.date,
        schedule_type: schedule.type,
        leave_type: schedule.leaveType,
        hours: schedule.type === 'FULL_DAY' ? 8 : 4,
        requester_id: existingRequest.requester_id,
        requester_name: existingRequest.requester_name,
        requester_email: existingRequest.requester_email,
        manager_id: existingRequest.manager_id,
        manager_name: existingRequest.manager_name,
        manager_email: existingRequest.manager_email,
        created_at: new Date().toISOString()
      }));
      
      await storage.set('pto_daily_schedules', [...filteredSchedules, ...newSchedules]);
    }
    
    return {
      success: true,
      data: requests[requestIndex],
      message: 'PTO request updated successfully by admin'
    };
  } catch (error) {
    console.error('❌ Error in admin edit PTO request:', error);
    return {
      success: false,
      message: error.message || 'Failed to edit PTO request'
    };
  }
});


resolver.define('adminDeletePTORequest', async (req) => {
  try {
    const { requestId, adminId, reason } = req.payload || {};
    console.log(`👑 Admin deleting PTO request ${requestId}`);
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    
    const requests = await storage.get('pto_requests') || [];
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    const deletedRequest = requests[requestIndex];
    
    // Remove the request
    requests.splice(requestIndex, 1);
    await storage.set('pto_requests', requests);
    
    // Remove associated daily schedules
    const dailySchedules = await storage.get('pto_daily_schedules') || [];
    const filteredSchedules = dailySchedules.filter(s => s.pto_request_id !== requestId);
    await storage.set('pto_daily_schedules', filteredSchedules);
    
    // Log the deletion
    const deleteLog = await storage.get('pto_delete_log') || [];
    deleteLog.push({
      request_id: requestId,
      original_request: deletedRequest,
      deleted_by: adminId,
      is_admin_delete: true,
      deletion_reason: reason || 'Admin deleted',
      deleted_at: new Date().toISOString()
    });
    await storage.set('pto_delete_log', deleteLog);
    
    return {
      success: true,
      message: 'PTO request deleted successfully by admin'
    };
  } catch (error) {
    console.error('❌ Error in admin delete PTO request:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete PTO request'
    };
  }
});
resolver.define('exportPTODailySchedules', async (req) => {
  try {
    const { filters } = req.payload || {};
    console.log('📤 Exporting PTO daily schedules');

    let schedules = await storage.get('pto_daily_schedules') || [];

    // Apply filters if provided
    if (filters) {
      if (filters.startDate) {
        schedules = schedules.filter(s => s.date >= filters.startDate);
      }
      if (filters.endDate) {
        schedules = schedules.filter(s => s.date <= filters.endDate);
      }
      if (filters.requesterId) {
        schedules = schedules.filter(s => s.requester_id === filters.requesterId);
      }
      if (filters.managerId) {
        schedules = schedules.filter(s => s.manager_id === filters.managerId);
      }
      if (filters.leaveType) {
        schedules = schedules.filter(s => s.leave_type === filters.leaveType);
      }
    }

    return {
      success: true,
      data: schedules,
      message: `Exported ${schedules.length} daily schedules`
    };
  } catch (error) {
    console.error('❌ Error exporting PTO daily schedules:', error);
    return {
      success: false,
      message: error.message || 'Failed to export PTO daily schedules'
    };
  }
});
// Import PTO Daily Schedules from CSV - CHUNKED VERSION
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
// Check PTO Import Status - not being used:
resolver.define('checkPTOImportStatus', async (req) => {
  try {
    const { adminId } = req.payload || {};
    console.log('🔍 Checking PTO import status');
    
    // Verify admin status
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(adminId)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    // Get import logs from admin log
    const adminLog = await storage.get('pto_admin_log') || [];
    const importLogs = adminLog.filter(log => log.action === 'PTO_DAILY_SCHEDULES_IMPORT');
    
    // Get imported daily schedules
    const dailySchedules = await storage.get('pto_daily_schedules') || [];
    const importedSchedules = dailySchedules.filter(schedule => schedule.imported === true);
    
    return {
      success: true,
      data: {
        importLogs,
        importedSchedulesCount: importedSchedules.length,
        lastImport: importLogs.length > 0 ? importLogs[importLogs.length - 1] : null
      },
      message: `Found ${importLogs.length} import logs and ${importedSchedules.length} imported schedules`
    };
  } catch (error) {
    console.error('❌ Error checking PTO import status:', error);
    return {
      success: false,
      message: error.message || 'Failed to check PTO import status',
      error: error.toString()
    };
  }
});

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
// Clear import validation data - CHUNKED VERSION
resolver.define('clearImportValidationData', async (req) => {
  try {
    const { adminId } = req.payload || {};
    
    // Check if we recently cleaned for this admin (within 30 seconds)
    const cacheKey = `cleanup_${adminId}`;
    const lastCleanup = cleanupCache.get(cacheKey);
    const now = Date.now();
    
    if (lastCleanup && (now - lastCleanup) < 30000) {
      console.log('🚫 Skipping cleanup - too recent');
      return {
        success: true,
        message: 'Cleanup skipped - recently cleaned',
        data: { deletedCount: 0 }
      };
    }
    
    console.log('🧹 Proceeding with cleanup, adminId:', adminId);
    
    // ... rest of the cleanup logic stays the same ...
    
    // Cache the cleanup time
    cleanupCache.set(cacheKey, now);
    
    // Clean old cache entries (keep only last 10 minutes)
    for (const [key, time] of cleanupCache.entries()) {
      if (now - time > 600000) { // 10 minutes
        cleanupCache.delete(key);
      }
    }
    
    return {
      success: true,
      message: totalDeleted > 0 ? `Cleaned ${totalDeleted} entries` : 'No cleanup needed',
      data: { deletedCount: totalDeleted }
    };
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return {
      success: false,
      message: 'Cleanup failed: ' + error.message
    };
  }
});
// Export the resolver handler
export const handler = resolver.getDefinitions();

// Resource API handler for inter-app communication
export async function resourceApiHandler(request) {
  console.log('Resource API request received:', request.payload);
  
  try {
    const { action, params } = JSON.parse(request.payload);
    
    if (!action) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Action is required'
        })
      };
    }
    
    // Map actions to resource API service functions
    switch (action) {
      case 'getUsers':
        const users = await resourceApiService.getUsers();
        return {
          statusCode: 200,
          body: JSON.stringify(users)
        };
        
      case 'getTeams':
        const teams = await resourceApiService.getTeams();
        return {
          statusCode: 200,
          body: JSON.stringify(teams)
        };
        
      case 'getUserAvailability':
        if (!params || !params.userId || !params.date) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              success: false,
              message: 'userId and date parameters are required'
            })
          };
        }
        
        const availability = await resourceApiService.getUserAvailability(params.userId, params.date);
        return {
          statusCode: 200,
          body: JSON.stringify(availability)
        };
        
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: `Unknown action: ${action}`
          })
        };
    }
  } catch (error) {
    console.error('Error in resource API handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Internal server error'
      })
    };
  }
}

// API handlers for cross-app communication
export async function usersApiHandler(request) {
  console.log('Users API request received');
  
  try {
    const users = await resourceApiService.getAllUsers();
    return {
      body: JSON.stringify(users),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 200
    };
  } catch (error) {
    console.error('Error in users API handler:', error);
    return {
      body: JSON.stringify({
        success: false,
        message: error.message || 'Internal server error'
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 500
    };
  }
}

export async function teamsApiHandler(request) {
  console.log('Teams API request received');
  
  try {
    const teams = await resourceApiService.getAllTeams();
    return {
      body: JSON.stringify(teams),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 200
    };
  } catch (error) {
    console.error('Error in teams API handler:', error);
    return {
      body: JSON.stringify({
        success: false,
        message: error.message || 'Internal server error'
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 500
    };
  }
}

export async function availabilityApiHandler(request) {
  console.log('Availability API request received:', request.body);
  
  try {
    const { userId, date } = JSON.parse(request.body);
    
    if (!userId || !date) {
      return {
        body: JSON.stringify({
          success: false,
          message: 'userId and date parameters are required'
        }),
        headers: {
          'Content-Type': 'application/json'
        },
        statusCode: 400
      };
    }
    
    const availability = await resourceApiService.getUserAvailability(userId, date);
    return {
      body: JSON.stringify(availability),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 200
    };
  } catch (error) {
    console.error('Error in availability API handler:', error);
    return {
      body: JSON.stringify({
        success: false,
        message: error.message || 'Internal server error'
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      statusCode: 500
    };
  }
}

// PTO Balances for current user
resolver.define('getUserPTOBalances', async (req) => {
  try {
    const { accountId } = req.payload || {};
    if (!accountId) {
      throw new Error('accountId is required');
    }
    const currentYear = new Date().getFullYear();
    const allBalances = await storage.get('pto_balances') || [];
    const userBalances = allBalances.filter(b => b.user_id === accountId && b.year === currentYear);
    // Group by leave type
    const balancesByType = {};
    userBalances.forEach(b => {
      balancesByType[b.leave_type] = {
        allocated_days: b.allocated_days,
        used_days: b.used_days,
        remaining_days: b.remaining_days,
        year: b.year
      };
    });
    return {
      success: true,
      data: balancesByType
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
});

resolver.define('deletePTOBalance', async (req) => {
  try {
    const { user_id, leave_type, year } = req.payload || {};
    await ptoService.deletePTOBalance({ user_id, leave_type, year });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

resolver.define('importDatabase', async (req) => {
  try {
    const { table, data } = req.payload || {};
    await ptoService.importDatabase({ table, data });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});