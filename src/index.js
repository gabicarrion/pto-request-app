import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import teamUserService from './services/team-user-service'

const resolver = new Resolver();


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
    
    const response = await api.asUser().requestJira(route`/rest/api/3/myself`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const userData = await response.json();
    
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
      message: 'Failed to fetch current user: ' + error.message
    };
  }
});

// Search Jira Users
resolver.define('getJiraUsers', async (req) => {
  try {
    const { query } = req.payload;
    
    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    console.log('🔍 Searching users with query:', query);
    
    const response = await api.asUser().requestJira(
      route`/rest/api/3/user/search?query=${query}&maxResults=10`
    );
    
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
    console.error('❌ Error searching users:', error);
    return {
      success: false,
      message: 'Failed to search users: ' + error.message
    };
  }
});

// Store PTO Request
resolver.define('storePTORequest', async (req) => {
  try {
    console.log('📝 Storing PTO Request:', req.payload);
    
    const { reporter, manager, startDate, endDate, leaveType, reason, dailySchedules } = req.payload;
    
    // Validate required fields
    if (!reporter || !manager || !startDate || !endDate || !leaveType || !reason) {
      throw new Error('Missing required fields');
    }
    
    // Get existing requests
    const requests = await storage.get('pto_requests') || [];
    
    // Calculate totals
    const totalDays = dailySchedules ? 
      dailySchedules.reduce((sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5), 0) :
      Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    
    const totalHours = dailySchedules ?
      dailySchedules.reduce((sum, schedule) => sum + (schedule.type === 'FULL_DAY' ? 8 : 4), 0) :
      totalDays * 8;
    
    // Create new request
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
      reason: reason,
      status: 'pending',
      total_days: totalDays,
      total_hours: totalHours,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewer_comments: null,
      daily_schedules: dailySchedules || []
    };
    
    // Add to storage
    requests.push(newRequest);
    await storage.set('pto_requests', requests);
    
    console.log('✅ PTO request stored successfully:', newRequest.id);
    
    return {
      success: true,
      data: newRequest,
      message: 'PTO request submitted successfully'
    };
  } catch (error) {
    console.error('❌ Error storing PTO request:', error);
    return {
      success: false,
      message: 'Failed to store PTO request: ' + error.message
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
    const { managerEmail } = req.payload;
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
    const { requestId, status, comment } = req.payload;
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

// Get Teams (for team management)
resolver.define('getTeams', async (req) => {
  try {
    console.log('👥 Getting teams');
    const teams = await storage.get('pto_teams') || [];
    
    return {
      success: true,
      data: teams
    };
  } catch (error) {
    console.error('❌ Error getting teams:', error);
    return {
      success: false,
      message: 'Failed to get teams: ' + error.message
    };
  }
});

// Create Team
resolver.define('createTeam', async (req) => {
  try {
    const result = await teamUserService.createTeam(req.payload);
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
    const result = await teamUserService.updateTeam(req.payload);
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
    const { teamId, deletedBy } = req.payload;
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
    const { teamId, member } = req.payload;
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
    const { teamId, memberAccountId, removedBy } = req.payload;
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
    const { userId } = req.payload;
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
    const { teamId } = req.payload;
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
// User Management Resolvers
resolver.define('createUser', async (req) => {
  try {
    const result = await teamUserService.createUser(req.payload);
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
    const result = await teamUserService.updateUser(req.payload);
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
    const { userId, deletedBy } = req.payload;
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
    const { teamId, dateRange } = req.payload;
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
    const { startDate, endDate } = req.payload;
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


// Add these functions to your existing index.js resolver

// Admin Management Functions

// Check if user has admin status
resolver.define('checkUserAdminStatus', async (req) => {
  try {
    const { accountId } = req.payload;
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

// Add admin user
resolver.define('addAdminUser', async (req) => {
  try {
    const { accountId, addedBy } = req.payload;
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

// Remove admin user
resolver.define('removeAdminUser', async (req) => {
  try {
    const { accountId, removedBy } = req.payload;
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

// Get all admin users
resolver.define('getAdminUsers', async (req) => {
  try {
    console.log('👑 Getting admin users');
    const adminIds = await storage.get('pto_admins') || [];
    
    // Get user details for each admin
    const adminUsers = [];
    for (const adminId of adminIds) {
      try {
        // You might want to cache user details or get them from Jira
        adminUsers.push({ accountId: adminId });
      } catch (error) {
        console.warn('Could not fetch details for admin:', adminId);
      }
    }
    
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

// Admin PTO Functions

// Submit PTO request on behalf of another user (Admin only)
resolver.define('submitPTOForUser', async (req) => {
  try {
    const { requestData, submittedBy } = req.payload;
    console.log('👑 Admin submitting PTO for user:', requestData.requester_id);
    
    // Verify admin status (inline instead of using invoke)
    const admins = await storage.get('pto_admins') || [];
    if (!admins.includes(submittedBy)) {
      throw new Error('Unauthorized: Admin privileges required');
    }
    
    // Create PTO request with admin flag
    const ptoRequest = {
      id: `pto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      total_days: requestData.total_days,
      total_hours: requestData.total_hours,
      submitted_at: new Date().toISOString(),
      submitted_by_admin: true,
      admin_id: submittedBy,
      daily_schedules: requestData.daily_schedules || []
    };
    
    const requests = await storage.get('pto_requests') || [];
    requests.push(ptoRequest);
    await storage.set('pto_requests', requests);
    
    return {
      success: true,
      data: ptoRequest,
      message: 'PTO request submitted successfully by admin'
    };
  } catch (error) {
    console.error('❌ Error submitting PTO for user:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
// Enhanced Team Functions

// Get user's teams
resolver.define('getUserTeams', async (req) => {
  try {
    const { userId } = req.payload;
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
    const { teamId, dateRange } = req.payload;
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


// Replace the previous admin setup functions with these fixed versions

// Auto-setup admin users on first run
resolver.define('setupDefaultAdmin', async (req) => {
  try {
    console.log('🔧 Setting up default admin users...');
    
    // Get current admins
    const admins = await storage.get('pto_admins') || [];
    
    // Default admin email - you can change this
    const defaultAdminEmail = 'gabriela.carrion@rebelmouse.com';
    
    // Search for the user by email to get their account ID
    const userSearchResponse = await api.asUser().requestJira(
      route`/rest/api/3/user/search?query=${defaultAdminEmail}&maxResults=1`
    );
    
    if (userSearchResponse.ok) {
      const users = await userSearchResponse.json();
      if (users.length > 0) {
        const adminAccountId = users[0].accountId;
        
        // Add to admins if not already there
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

// Auto-initialize admin on database init - FIXED VERSION
resolver.define('initializePTODatabaseWithAdmin', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database with Admin Setup...');
    
    // First initialize the regular database (inline the logic instead of using invoke)
    const tables = ['pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_balances', 'pto_admins'];
    
    for (const table of tables) {
      const existing = await storage.get(table);
      if (!existing) {
        await storage.set(table, []);
        console.log(`✅ Initialized table: ${table}`);
      }
    }
    
    // Then set up default admin (inline the logic)
    const admins = await storage.get('pto_admins') || [];
    const defaultAdminEmail = 'gabriela.carrion@rebelmouse.com';
    
    let adminSetupResult = {
      success: true,
      message: 'Admin already exists or setup skipped'
    };
    
    try {
      // Search for the user by email to get their account ID
      const userSearchResponse = await api.asUser().requestJira(
        route`/rest/api/3/user/search?query=${defaultAdminEmail}&maxResults=1`
      );
      
      if (userSearchResponse.ok) {
        const users = await userSearchResponse.json();
        if (users.length > 0) {
          const adminAccountId = users[0].accountId;
          
          // Add to admins if not already there
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
    
    // Try to at least initialize the basic database
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

// Clear storage (for development/testing)
resolver.define('clearStorage', async (req) => {
  try {
    const { table } = req.payload || {};
    
    if (table) {
      await storage.set(table, []);
      console.log(`🗑️ Cleared storage table: ${table}`);
    } else {
      // Clear all PTO tables
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


// Debug and Maintenance Resolvers
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

resolver.define('initializePTODatabaseWithTeamManagement', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database with Enhanced Team Management...');
    
    // Initialize the original PTO database
    const ptoResult = await invoke('initializePTODatabase');
    
    // Initialize the enhanced team/user service
    const teamUserResult = await invoke('initializeTeamUserService');
    
    // Set up default admin if current user provided
    let adminResult = null;
    if (req.context?.accountId) {
      try {
        adminResult = await invoke('setupDefaultAdmin', {
          accountId: req.context.accountId
        });
      } catch (adminError) {
        console.warn('Could not set up default admin:', adminError);
      }
    }
    
    return {
      success: true,
      data: {
        pto: ptoResult,
        teamUser: teamUserResult,
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


export const handler = resolver.getDefinitions();