import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import teamUserService from './services/team-user-service';
import resourceApiService from './services/resource-api-service';
import { importService } from './services/import-service';

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




// Simplified getInternalJiraUsers function using only assignable users
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

// Enhanced bulk import function
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

// Enhanced createUserFromJira function
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

// Enhanced search function for database users only
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


// In your backend resolver/function
resolver.define("getProjectUsers", async ({ payload }) => {
  const { projectKey, maxResults = 1000, getAllPages = true } = payload;
  console.log(`[Backend] getProjectUsers called for project: ${projectKey}`);
  
  try {
    let allUsers = [];
    let startAt = 0;
    const pageSize = 50;
    let hasMoreUsers = true; // Add this flag instead of checking users.length
    
    while (hasMoreUsers && allUsers.length < maxResults) { // Use while instead of do...while
      console.log(`[Backend] Fetching users from ${startAt} to ${startAt + pageSize}`);
      
      const response = await asUser().requestJira(
        route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${pageSize}`
      );
      
      if (!response.ok) {
        throw new Error(`Jira API returned ${response.status}`);
      }
      
      const users = await response.json(); // This is now properly scoped
      console.log(`[Backend] Got ${users.length} users in this batch`);
      
      // Ensure users is an array before concatenating
      if (Array.isArray(users)) {
        allUsers = allUsers.concat(users);
        
        // Check if we should continue (if we got less than pageSize, we're done)
        hasMoreUsers = users.length === pageSize && getAllPages;
      } else {
        console.warn('[Backend] Jira API returned non-array response:', users);
        hasMoreUsers = false; // Stop the loop
      }
      
      startAt += pageSize;
    }
    
    console.log(`[Backend] Total users loaded: ${allUsers.length}`);
    
    // Always return an array
    return Array.isArray(allUsers) ? allUsers : [];
    
  } catch (error) {
    console.error(`[Backend] Error fetching project users for ${projectKey}:`, error);
    // Always return an empty array on error
    return [];
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


// Debug function to check storage
resolver.define('debugStorage', async (req) => {
  try {
    console.log('🔍 Debugging storage state');
    
    const users = await storage.get('users') || [];
    const teams = await storage.get('teams') || [];
    const admins = await storage.get('pto_admins') || [];
    const ptoRequests = await storage.get('pto_requests') || [];
    const ptoDailySchedules = await storage.get('pto_daily_schedules') || [];
    
    console.log(`Users in storage: ${users.length}`);
    console.log(`Teams in storage: ${teams.length}`);
    console.log(`Admins in storage: ${admins.length}`);
    console.log(`PTO Requests in storage: ${ptoRequests.length}`);
    console.log(`PTO Daily Schedules in storage: ${ptoDailySchedules.length}`);
    
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

// Admin PTO Management Functions
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

// Import PTOs from CSV
resolver.define('importPTOs', async (req) => {
  try {
    const { ptoData } = req.payload || {};
    console.log('📥 Importing PTO data:', ptoData.length, 'records');

    if (!Array.isArray(ptoData)) {
      throw new Error('Invalid data format: expected array of PTO records');
    }

    const requests = await storage.get('pto_requests') || [];
    const dailySchedules = await storage.get('pto_daily_schedules') || [];
    const importedRequests = [];
    const importedSchedules = [];

    for (const pto of ptoData) {
      // Generate new IDs for the request
      const requestId = `pto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the PTO request
      const newRequest = {
        id: requestId,
        requester_id: pto.requester_id,
        requester_name: pto.requester_name,
        requester_email: pto.requester_email,
        manager_id: pto.manager_id,
        manager_name: pto.manager_name,
        manager_email: pto.manager_email,
        start_date: pto.start_date,
        end_date: pto.end_date,
        leave_type: pto.leave_type || 'vacation',
        reason: pto.reason || 'Imported PTO',
        status: pto.status || 'approved',
        total_days: pto.total_days,
        total_hours: pto.total_hours,
        submitted_at: pto.submitted_at || new Date().toISOString(),
        reviewed_at: pto.reviewed_at || new Date().toISOString(),
        reviewer_comments: pto.reviewer_comments || 'Imported PTO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      requests.push(newRequest);
      importedRequests.push(newRequest);

      // Create daily schedules if provided
      if (pto.daily_schedules && Array.isArray(pto.daily_schedules)) {
        for (const schedule of pto.daily_schedules) {
          const scheduleRecord = {
            id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            pto_request_id: requestId,
            date: schedule.date,
            schedule_type: schedule.schedule_type || 'FULL_DAY',
            leave_type: schedule.leave_type || pto.leave_type || 'vacation',
            hours: schedule.hours || (schedule.schedule_type === 'FULL_DAY' ? 8 : 4),
            requester_id: pto.requester_id,
            requester_name: pto.requester_name,
            requester_email: pto.requester_email,
            manager_id: pto.manager_id,
            manager_name: pto.manager_name,
            manager_email: pto.manager_email,
            created_at: new Date().toISOString()
          };
          dailySchedules.push(scheduleRecord);
          importedSchedules.push(scheduleRecord);
        }
      }
    }

    // Save all changes
    await storage.set('pto_requests', requests);
    await storage.set('pto_daily_schedules', dailySchedules);

    return {
      success: true,
      data: {
        importedRequests: importedRequests.length,
        importedSchedules: importedSchedules.length
      },
      message: `Successfully imported ${importedRequests.length} PTO requests and ${importedSchedules.length} daily schedules`
    };
  } catch (error) {
    console.error('❌ Error importing PTOs:', error);
    return {
      success: false,
      message: error.message || 'Failed to import PTOs'
    };
  }
});

// Export PTO Daily Schedules
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

// Import PTO Daily Schedules from CSV
resolver.define('importPTODailySchedules', async (req) => {
  try {
    const { importData, adminId, skipValidation = false, useStoredValidation = false } = req.payload || {};
    console.log('📥 Importing PTO daily schedules:', importData?.length, 'records', 
      skipValidation ? '(pre-validated)' : '', 
      useStoredValidation ? '(using stored validation)' : ''
    );
    
    // Verify admin status
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(adminId)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    // Set a longer timeout for large imports
    const startTime = Date.now();
    const TIMEOUT_THRESHOLD = 20000; // 20 seconds, leaving 5 seconds buffer for Forge's 25s limit
    
    let dataToImport;
    let result;
    
    // Check if we should use the stored validation data
    if (useStoredValidation) {
      // Get the stored validation data
      const storedValidation = await storage.get(`pto_import_validation_${adminId}`);
      
      if (!storedValidation || !storedValidation.validRecords || !storedValidation.preparedForImport) {
        throw new Error('No prepared validation data found. Please validate the data first.');
      }
      
      console.log(`Using stored validation with ${storedValidation.validRecords.length} prepared records`);
      dataToImport = storedValidation.validRecords;
      
      // Use the import service to handle the import with the prepared data
      result = await importService.importPTODailySchedules(dataToImport, true);
      
      // Clean up stored validation after successful import
      await storage.delete(`pto_import_validation_${adminId}`);
    } else {
      // Use the provided import data
      if (!Array.isArray(importData) || importData.length === 0) {
        throw new Error('Invalid data format: expected array of PTO records');
      }
      
      dataToImport = importData;
      // Use the import service to handle the import
      result = await importService.importPTODailySchedules(dataToImport, skipValidation);
    }
    
    // Log the import activity
    const adminLog = await storage.get('pto_admin_log') || [];
    adminLog.push({
      action: 'PTO_DAILY_SCHEDULES_IMPORT',
      admin_id: adminId,
      timestamp: new Date().toISOString(),
      details: {
        total: dataToImport.length,
        imported: result.data?.importedRecords || 0,
        failed: result.data?.failedRecords || 0,
        processingTime: Date.now() - startTime,
        skipValidation,
        useStoredValidation
      }
    });
    await storage.set('pto_admin_log', adminLog);
    
    return result;
  } catch (error) {
    console.error('❌ Error importing PTO daily schedules:', error);
    return {
      success: false,
      message: error.message || 'Failed to import PTO daily schedules. For large imports, try importing in smaller batches of 20-50 records at a time.',
      error: error.toString()
    };
  }
});

// Check PTO Import Status
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

// Validate PTO Import Data
resolver.define('validatePTOImportData', async (req) => {
  try {
    const { 
      importData, 
      adminId, 
      checkJiraUsers = true, 
      prepareForImport = true, // New flag to fully prepare records for import
      batchSize = 10, 
      batchIndex = 0 
    } = req.payload || {};
    
    console.log(`🔍 Validating PTO import data: batch ${batchIndex + 1}, ${importData?.length} records, prepareForImport=${prepareForImport}`);
    
    // Verify admin status
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(adminId)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    if (!Array.isArray(importData) || importData.length === 0) {
      throw new Error('Invalid data format: expected array of PTO records');
    }
    
    // For large datasets, validate basic format without checking Jira users first
    const isLargeDataset = importData.length > 20;
    
    // First pass: validate basic format without checking Jira users
    const basicValidation = await importService.validateImportData(importData, false);
    
    // If basic validation fails, return those errors immediately
    if (!basicValidation.valid) {
      return {
        success: false,
        data: { 
          validation: basicValidation,
          isComplete: true
        },
        message: `Validation failed: ${basicValidation.invalidRecords} records have format errors`
      };
    }
    
    // If we don't need to check Jira users or if it's a small dataset, we're done
    if (!checkJiraUsers || (isLargeDataset && batchIndex === 0)) {
      // For large datasets on first batch, just return the basic validation
      if (isLargeDataset) {
        return {
          success: true,
          data: {
            validation: basicValidation,
            isComplete: false,
            totalBatches: Math.ceil(basicValidation.validRecords.length / batchSize),
            currentBatch: 0
          },
          message: `Basic validation passed. ${basicValidation.validRecords.length} records have valid format. ${prepareForImport ? 'Preparing data for import...' : ''}`
        };
      }
      
      // For small datasets, return the full validation
      return {
        success: true,
        data: { 
          validation: basicValidation,
          isComplete: true
        },
        message: `Validation complete: ${basicValidation.validRecords.length} valid records, ${basicValidation.invalidRecords} invalid records`
      };
    }
    
    // For large datasets, process in batches
    // Get the batch to process
    const validRecords = basicValidation.validRecords;
    const totalBatches = Math.ceil(validRecords.length / batchSize);
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, validRecords.length);
    const currentBatch = validRecords.slice(startIndex, endIndex);
    
    console.log(`Processing batch ${batchIndex + 1} of ${totalBatches}: records ${startIndex + 1}-${endIndex}`);
    
    // Validate this batch with Jira user checks and prepare for import if requested
    const batchValidation = await importService.validateImportData(currentBatch, true, prepareForImport);
    
    // Get previous validation results from storage if this isn't the first batch
    let combinedValidation;
    if (batchIndex > 0) {
      const previousValidation = await storage.get(`pto_import_validation_${adminId}`) || {
        valid: true,
        totalRecords: validRecords.length,
        validRecords: [],
        invalidRecords: 0,
        errors: [],
        preparedForImport: prepareForImport
      };
      
      // Combine the results
      combinedValidation = {
        valid: previousValidation.valid && batchValidation.valid,
        totalRecords: validRecords.length,
        validRecords: [...previousValidation.validRecords, ...batchValidation.validRecords],
        invalidRecords: previousValidation.invalidRecords + batchValidation.invalidRecords,
        errors: [...previousValidation.errors, ...batchValidation.errors],
        userCache: { ...(previousValidation.userCache || {}), ...(batchValidation.userCache || {}) },
        preparedForImport: prepareForImport
      };
    } else {
      combinedValidation = batchValidation;
      combinedValidation.totalRecords = validRecords.length;
      combinedValidation.preparedForImport = prepareForImport;
    }
    
    // Store the combined validation for the next batch
    await storage.set(`pto_import_validation_${adminId}`, combinedValidation);
    
    // Check if this is the last batch
    const isComplete = endIndex >= validRecords.length;
    
          // If this is the last batch, we can clear the stored validation
      if (isComplete) {
        // Instead of deleting, keep the validation results for import
        // We'll delete it after import is complete
        if (!prepareForImport) {
          await storage.delete(`pto_import_validation_${adminId}`);
        }
      }
    
    // Extract user check results for display
    const userCheckResults = [];
    
    // Show sample results from this batch
    if (batchValidation.userCache) {
      const sampleSize = Math.min(3, batchValidation.validRecords.length);
      
      for (let i = 0; i < sampleSize; i++) {
        if (i < batchValidation.validRecords.length) {
          const record = batchValidation.validRecords[i];
          
          userCheckResults.push({
            record: startIndex + i + 1,
            requester: {
              email: record.requester_email,
              found: !!record.requester_id,
              details: record.requester_id ? {
                accountId: record.requester_id,
                displayName: record.requester_name
              } : null
            },
            manager: {
              email: record.manager_email,
              found: !!record.manager_id,
              details: record.manager_id ? {
                accountId: record.manager_id,
                displayName: record.manager_name
              } : null
            }
          });
        }
      }
    }
    
    return {
      success: combinedValidation.valid,
      data: { 
        validation: combinedValidation,
        batchValidation,
        userCheckResults: userCheckResults.length > 0 ? userCheckResults : undefined,
        isComplete,
        totalBatches,
        currentBatch: batchIndex + 1
      },
      message: isComplete 
        ? `Validation complete: ${combinedValidation.validRecords.length} valid records, ${combinedValidation.invalidRecords} invalid records` 
        : `Batch ${batchIndex + 1}/${totalBatches} validated: ${combinedValidation.validRecords.length}/${validRecords.length} records processed`
    };
  } catch (error) {
    console.error('❌ Error validating PTO import data:', error);
    return {
      success: false,
      message: error.message || 'Failed to validate PTO import data',
      error: error.toString()
    };
  }
});

// Clear import validation data
resolver.define('clearImportValidationData', async (req) => {
  try {
    console.log('🧹 Clearing import validation data');
    const result = await importService.clearValidationData();
    return {
      success: true,
      message: 'Import validation data cleared successfully'
    };
  } catch (error) {
    console.error('❌ Error clearing import validation data:', error);
    return {
      success: false,
      message: 'Failed to clear import validation data: ' + error.message
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