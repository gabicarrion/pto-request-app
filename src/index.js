import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
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


// Initialize PTO Database
resolver.define('initializePTODatabaseWithTeamManagement', async (req) => {
  try {
    console.log('🔧 Initializing PTO Database with Team Management...');
    
    // Initialize empty arrays for each table if they don't exist
    const tables = ['teams', 'users', 'pto_requests', 'pto_daily_schedules'];
    
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
// Replace the migrateDatabaseStructure resolver with this safer version:
resolver.define('migrateDatabaseStructure', async (req) => {
  try {
    console.log('🔄 Starting safe database migration...');
    
    // Step 1: Check if we need to cleanup first
    const ptoRequests = await storage.get('pto_requests') || [];
    const ptoSchedules = await storage.get('pto_daily_schedules') || [];
    
    const totalRecords = ptoRequests.length + ptoSchedules.length;
    console.log(`📊 Found ${totalRecords} total PTO records`);
    
    if (totalRecords > 1000) {
      return {
        success: false,
        message: `Too much PTO data (${totalRecords} records). Please cleanup PTO database first, then retry migration.`
      };
    }
    
    // Step 2: Migrate only Teams and Users (smaller datasets)
    const existingUsers = await storage.get('users') || [];
    const existingTeams = await storage.get('teams') || [];
    
    console.log(`📊 Migrating: ${existingUsers.length} users, ${existingTeams.length} teams`);
    
    // Step 3: Migrate Teams structure (keep it simple)
    const migratedTeams = existingTeams.map(team => ({
      team_id: team.id || team.team_id || `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      team_name: team.name || team.team_name || 'Unnamed Team',
      team_department: team.department || team.team_department || '',
      team_business_unit: team.business_unit || team.team_business_unit || '',
      team_manager_name: typeof team.manager === 'object' ? (team.manager.display_name || '') : (team.team_manager_name || ''),
      team_manager_id: typeof team.manager === 'object' ? (team.manager.jira_account_id || '') : (team.team_manager_id || ''),
      team_manager_email: typeof team.manager === 'object' ? (team.manager.email_address || '') : (team.team_manager_email || ''),
      team_executive_manager_name: team.team_executive_manager_name || '',
      team_executive_manager_id: team.team_executive_manager_id || '',
      team_executive_manager_email: team.team_executive_manager_email || '',
      created_at: team.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    // Step 4: Migrate Users structure (keep it simple)
    const migratedUsers = existingUsers.map(user => ({
      user_id: user.id || user.user_id || user.jira_account_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      jira_account_id: user.jira_account_id || '',
      display_name: user.display_name || 'Unknown User',
      email_address: user.email_address || '',
      team_memberships: user.team_memberships || [],
      employment_type: user.employment_type || 'full_time',
      capacity: user.capacity || 40,
      standard_availability: user.availability || user.standard_availability || {},
      isAdmin: user.isAdmin || false,
      isManager: user.isManager || [],
      isExecutive_Manager: user.isExecutive_Manager || [],
      pto_accountability_type: user.pto_accountability_type || 'standard_year',
      pto_available_in_the_period: user.pto_available_in_the_period || { vacation: 20, holiday: 10, personal: 1 },
      hiring_date: user.hire_date || user.hiring_date || new Date().toISOString(),
      used_pto_days_in_period: user.used_pto_days_in_period || { vacation: 0, holiday: 0, personal: 0 },
      remaining_pto_days_in_period: user.remaining_pto_days_in_period || { vacation: 20, holiday: 10, personal: 1 },
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    // Step 5: Save migrated data (one table at a time)
    await storage.set('teams', migratedTeams);
    console.log('✅ Teams migrated successfully');
    
    await storage.set('users', migratedUsers);
    console.log('✅ Users migrated successfully');
    
    return {
      success: true,
      message: 'Database structure migrated successfully (Teams & Users only)',
      data: {
        migratedTeams: migratedTeams.length,
        migratedUsers: migratedUsers.length,
        note: 'PTO data will be restructured automatically as new requests are created'
      }
    };
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    return {
      success: false,
      message: `Migration failed: ${error.message}`
    };
  }
});
resolver.define('cleanupConflictingTables', async (req) => {
  try {
    console.log('🧹 Cleaning up conflicting database tables...');
    
    // Remove old conflicting tables
    const oldTables = ['pto_teams', 'pto_balances'];
    const removedTables = [];
    
    for (const table of oldTables) {
      try {
        const existing = await storage.get(table);
        if (existing) {
          await storage.delete(table);
          removedTables.push(table);
          console.log(`✅ Removed old table: ${table}`);
        }
      } catch (error) {
        console.log(`⚠️ Table ${table} didn't exist or couldn't be removed`);
      }
    }
    
    return {
      success: true,
      message: 'Conflicting tables cleaned up successfully',
      removedTables: removedTables
    };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
// Add this new resolver to check storage sizes
resolver.define('checkStorageSizes', async (req) => {
  try {
    const tables = ['teams', 'users', 'pto_requests', 'pto_daily_schedules', 'pto_teams', 'pto_admins'];
    const sizes = {};
    
    for (const table of tables) {
      const data = await storage.get(table);
      if (data) {
        const jsonString = JSON.stringify(data);
        sizes[table] = {
          records: Array.isArray(data) ? data.length : 1,
          size: jsonString.length,
          sizeKB: Math.round(jsonString.length / 1024)
        };
      } else {
        sizes[table] = { records: 0, size: 0, sizeKB: 0 };
      }
    }
    
    const total = Object.values(sizes).reduce((sum, item) => sum + item.size, 0);
    
    return {
      success: true,
      data: {
        tables: sizes,
        totalSize: total,
        totalSizeKB: Math.round(total / 1024),
        maxAllowed: 245760,
        maxAllowedKB: 240
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
});
// Replace the existing cleanupPTODatabase resolver with this:
resolver.define('cleanupPTODatabase', async (req) => {
  try {
    const { adminId, confirmDelete } = req.payload || {};
    
    if (!confirmDelete) {
      return {
        success: false,
        message: 'Confirmation required for cleanup'
      };
    }
    
    console.log('🗑️ Starting PTO database cleanup...');
    
    // Clear PTO data in smaller chunks to avoid storage issues
    const tablesToClean = ['pto_requests', 'pto_daily_schedules'];
    let deletedCount = 0;
    
    for (const table of tablesToClean) {
      try {
        const data = await storage.get(table);
        if (data && Array.isArray(data)) {
          deletedCount += data.length;
        }
        // Set to empty array instead of deleting the key
        await storage.set(table, []);
        console.log(`✅ Cleaned table: ${table}`);
      } catch (error) {
        console.error(`❌ Error cleaning ${table}:`, error);
        // Continue with other tables even if one fails
      }
    }
    
    console.log(`✅ Cleanup completed. Removed ${deletedCount} records.`);
    
    return {
      success: true,
      data: { deletedCount },
      message: `Successfully cleaned up ${deletedCount} PTO records`
    };
    
  } catch (error) {
    console.error('❌ Error during PTO cleanup:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

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


// Admin Management
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

// User Management
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



// PTO Requests Management
resolver.define('getAllRequests', async (req) => {
  try {
    const { status, startDate, endDate, startAt = 0, maxResults = 100 } = req.payload || {};
    let requests = await importService.getChunkedData('pto_requests') || [];
    
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
resolver.define('submitPTORequest', async (req) => {
  try {
    const requestData = req.payload || {};
    const ptoRequests = await importService.getChunkedData('pto_requests') || [];
    
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
    await importService.storeChunkedData('pto_requests', ptoRequests);

    // Handle daily schedules if provided
    if (requestData.daily_schedules && requestData.daily_schedules.length > 0) {
      const dailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
      
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
      await importService.storeChunkedData('pto_daily_schedules', dailySchedules);
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
    
    const ptoRequests = await importService.getChunkedData('pto_requests') || [];
    
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
    await importService.storeChunkedData('pto_requests', ptoRequests);
    
    // Handle daily schedules if provided
    if (requestData.daily_schedules && requestData.daily_schedules.length > 0) {
      const dailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
      
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
      await importService.storeChunkedData('pto_daily_schedules', dailySchedules);
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
resolver.define('getPTORequests', async (req) => {
  try {
    const { requester_id, status } = req.payload || {};
    let requests = await importService.getChunkedData('pto_requests') || [];
    
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
    const requests = await importService.getChunkedData('pto_requests') || [];
    
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    requests[requestIndex].status = status;
    requests[requestIndex].reviewed_by = reviewedBy;
    requests[requestIndex].reviewed_at = new Date().toISOString();
    requests[requestIndex].comments = comments || '';
    requests[requestIndex].updated_at = new Date().toISOString();
    
    await importService.storeChunkedData('pto_requests', requests);
    
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
resolver.define('cancelPTORequest', async (req) => {
  try {
    const { requestId } = req.payload || {};
    const requests = await importService.getChunkedData('pto_requests') || [];
    
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      throw new Error('PTO request not found');
    }
    
    requests[requestIndex].status = 'cancelled';
    requests[requestIndex].updated_at = new Date().toISOString();
    
    await importService.storeChunkedData('pto_requests', requests);
    
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
resolver.define('getPendingRequests', async (req) => {
  try {
    const { managerId } = req.payload || {};
    let requests = await importService.getChunkedData('pto_requests') || [];
    
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
resolver.define('getTeamPTORequests', async (req) => {
  try {
    const { teamId, managerId, status, startDate, endDate } = req.payload || {};
    console.log('🔍 Getting team PTO requests for team:', teamId);
    
    const requests = await importService.getChunkedData('pto_requests') || [];
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
resolver.define('editPTORequest', async (req) => {
  try {
    const { requestId, updatedData, editedBy } = req.payload || {};
    const requests = await importService.getChunkedData('pto_requests') || [];
    
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
    
    await importService.storeChunkedData('pto_requests', requests);
    
    // Update daily schedules if provided
    if (updatedData.daily_schedules) {
      const dailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
      
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
      
      await importService.storeChunkedData('pto_daily_schedules', [...filteredSchedules, ...newSchedules]);
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




// Team Analytics
resolver.define('getTeamAnalytics', async (req) => {
  try {
    const { teamId, dateRange } = req.payload || {};
    const requests = await importService.getChunkedData('pto_requests') || [];
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


//Others
resolver.define('debugStorage', async (req) => {
  try {
    const users = await storage.get('users') || [];
    const teams = await storage.get('teams') || [];
    const admins = await storage.get('pto_admins') || [];
    const ptoRequests = await importService.getChunkedData('pto_requests') || [];
    const ptoDailySchedules = await importService.getChunkedData('pto_daily_schedules') || [];
    
    return {
      success: true,
      data: {
        // Return actual data arrays for export
        users,
        teams,
        admins,
        pto_requests: ptoRequests,
        pto_daily_schedules: ptoDailySchedules,
        // Keep summary for debug info
        summary: {
          totalUsers: users.length,
          totalTeams: teams.length,
          totalAdmins: admins.length,
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


// Import PTO Data
resolver.define('clearImportValidationData', async () => {
  try {
    // Remove temp data used during import workflow
    await storage.delete('temp_pto_import');
    await storage.delete('import_progress');
    // You can add other temp keys if needed
    return { success: true, message: 'Temporary import data cleared.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
resolver.define('preValidatePTOImportData', async ({ payload }) => {
  const { importData } = payload;
  const users = await storage.get('users') || [];
  const userEmails = users.map(u => (u.email_address || u.emailAddress || '').toLowerCase());

  // Allowed values
  const validLeaveTypes = ['vacation', 'sick', 'personal', 'holiday', 'other leave type'];
  const validStatuses = ['approved', 'pending', 'declined', 'cancelled'];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  const summary = {
    totalRecords: importData.length,
    uniqueRequesters: 0,
    foundRequesters: [],
    missingRequesters: [],
    uniqueManagers: 0,
    foundManagers: [],
    missingManagers: [],
    invalidLeaveTypes: [],
    invalidHours: [],
    invalidStatuses: [],
    invalidDates: [],
    missingFields: [],
    duplicateRecords: []
  };

  const requesterSet = new Set();
  const managerSet = new Set();
  const seenCombos = new Set();

  importData.forEach((row, i) => {
    const requester = (row.requester_email || '').toLowerCase();
    if (requester) requesterSet.add(requester);
    const manager = (row.manager_email || '').toLowerCase();
    if (manager) managerSet.add(manager);

    // Leave types
    if (row.leave_type && !validLeaveTypes.includes(row.leave_type.trim().toLowerCase())) {
      summary.invalidLeaveTypes.push({ row: i + 2, value: row.leave_type });
    }
    // Hours
    if (row.hours && (isNaN(Number(row.hours)) || Number(row.hours) <= 0 || Number(row.hours) > 24)) {
      summary.invalidHours.push({ row: i + 2, value: row.hours });
    }
    // Status
    if (row.status && !validStatuses.includes(row.status.trim().toLowerCase())) {
      summary.invalidStatuses.push({ row: i + 2, value: row.status });
    }
    // Date format
    if (!row.date || !dateRegex.test(row.date)) {
      summary.invalidDates.push({ row: i + 2, value: row.date });
    }
    // Required fields
    const missing = [];
    if (!row.requester_email) missing.push('requester_email');
    if (!row.manager_email) missing.push('manager_email');
    if (!row.leave_type) missing.push('leave_type');
    if (!row.date) missing.push('date');
    if (missing.length) {
      summary.missingFields.push({ row: i + 2, fields: missing });
    }
    // Duplicates
    const combo = `${row.requester_email || ''}|${row.date || ''}|${row.leave_type || ''}`;
    if (seenCombos.has(combo)) {
      summary.duplicateRecords.push({ row: i + 2, combo });
    } else {
      seenCombos.add(combo);
    }
  });

  summary.uniqueRequesters = requesterSet.size;
  summary.foundRequesters = Array.from(requesterSet).filter(e => userEmails.includes(e));
  summary.missingRequesters = Array.from(requesterSet).filter(e => !userEmails.includes(e));
  summary.uniqueManagers = managerSet.size;
  summary.foundManagers = Array.from(managerSet).filter(e => userEmails.includes(e));
  summary.missingManagers = Array.from(managerSet).filter(e => !userEmails.includes(e));

  return { success: true, summary };
});
resolver.define('preparePTOImportData', async ({ payload }) => {
  console.log('preparePTOImportData called', payload);
  const { importData } = payload;
  const users = await storage.get('users') || [];
  const emailToUser = {};
  users.forEach(u => {
    const email = (u.email_address || u.emailAddress || '').toLowerCase();
    if (email) emailToUser[email] = u;
  });

  const enriched = [];
  const errors = [];
  importData.forEach((row, i) => {
    const requesterEmail = (row.requester_email || '').toLowerCase();
    const managerEmail = (row.manager_email || '').toLowerCase();
    const requester = emailToUser[requesterEmail];
    const manager = emailToUser[managerEmail];
    if (!requester || !manager) {
      errors.push({ row: i + 2, error: !requester ? 'Requester not found' : '', error2: !manager ? 'Manager not found' : '' });
      return;
    }
    enriched.push({
      ...row,
      requester_id: requester.accountId || requester.jira_account_id || requester.id,
      requester_name: requester.displayName || requester.name,
      manager_id: manager.accountId || manager.jira_account_id || manager.id,
      manager_name: manager.displayName || manager.name,
      hours: row.hours || (row.schedule_type === 'HALF_DAY' ? 4 : 8),
      status: row.status || 'approved'
    });
  });

  await importService.storeChunkedData('temp_pto_import', enriched);

  return {
    success: enriched.length > 0,
    enrichedCount: enriched.length,
    errors,
    message: errors.length
      ? `Some rows could not be enriched and will be skipped during import.`
      : 'All data enriched and saved.'
  };
});
resolver.define('importPTODailySchedulesChunked', async ({ payload }) => {
  const { batchIndex = 0 } = payload;
  // Use importService.getChunkedData to read chunked data
  const allData = await importService.getChunkedData('temp_pto_import') || [];
  const BATCH_SIZE = 5;
  const totalBatches = Math.ceil(allData.length / BATCH_SIZE);

  // On first batch, clear previous schedules and PTO requests
  if (batchIndex === 0) {
    await importService.deleteChunkedData('pto_daily_schedules');
    await importService.deleteChunkedData('pto_requests');
    await storage.set('import_progress', { currentBatch: 0, totalBatches });
  }

  // Process this batch
  const batch = allData.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
  let currentSchedules = await importService.getChunkedData('pto_daily_schedules') || [];
  let ptoRequests = await importService.getChunkedData('pto_requests') || [];
  const errors = [];

  for (let i = 0; i < batch.length; i++) {
    try {
      const row = batch[i];
      // 1. Create a new PTO request for this row
      const requestId = `pto-${Date.now()}-${batchIndex}-${i}-${Math.random().toString(36).substr(2, 6)}`;
      const newRequest = {
        id: requestId,
        requester_id: row.requester_id,
        requester_name: row.requester_name,
        requester_email: row.requester_email,
        manager_id: row.manager_id,
        manager_name: row.manager_name,
        manager_email: row.manager_email,
        start_date: row.date,
        end_date: row.date,
        total_days: 1,
        total_hours: row.hours || 8,
        reason: row.reason || 'Imported from CSV',
        status: row.status || 'approved',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        imported: true
      };
      ptoRequests.push(newRequest);

      // 2. Add the daily schedule, linked to this request
      currentSchedules.push({
        ...row,
        id: `schedule-${Date.now()}-${batchIndex}-${i}`,
        request_id: requestId,
        import_date: new Date().toISOString(),
      });
    } catch (e) {
      errors.push({ record: batchIndex * BATCH_SIZE + i + 2, error: e.message });
    }
  }

  await importService.storeChunkedData('pto_daily_schedules', currentSchedules);
  await importService.storeChunkedData('pto_requests', ptoRequests);

  // Update progress
  await storage.set('import_progress', { currentBatch: batchIndex + 1, totalBatches });

  if (batchIndex + 1 < totalBatches) {
    // Not finished, return progress
    return { progress: { currentBatch: batchIndex + 1, totalBatches }, finished: false };
  } else {
    // All done, return final result and cleanup
    await storage.delete('temp_pto_import');
    await storage.delete('import_progress');
    return {
      finished: true,
      result: {
        success: errors.length === 0,
        data: {
          totalRecords: allData.length,
          importedRecords: allData.length - errors.length,
          failedRecords: errors.length,
          errors
        },
        message: errors.length === 0
          ? `Successfully imported ${allData.length} records.`
          : `Imported ${allData.length - errors.length}, ${errors.length} failed.`
      }
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



export const handler = resolver.getDefinitions();