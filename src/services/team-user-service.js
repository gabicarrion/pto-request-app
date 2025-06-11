import { storage } from '@forge/api';

// Enhanced Team and User Management Service
export class TeamUserService {
  constructor() {
    this.TEAMS_KEY = 'teams';
    this.USERS_KEY = 'users';
    this.TEAM_MEMBERS_KEY = 'team_members';
  }

  // Initialize storage
  async initialize() {
    try {
      const tables = [this.TEAMS_KEY, this.USERS_KEY, this.TEAM_MEMBERS_KEY];
      
      for (const table of tables) {
        const existing = await storage.get(table);
        if (!existing) {
          await storage.set(table, []);
          console.log(`✅ Created ${table} table`);
        }
      }
      
      await this.migrateUserTeamMemberships();
      return {
        success: true,
        message: 'TeamUserService initialized successfully'
      };
    } catch (error) {
      console.error('❌ Error initializing TeamUserService:', error);
      return {
        success: false,
        message: error.message || 'Failed to initialize TeamUserService'
      };
    }
  }

  // Team Management
  async createTeam(teamData) {
    try {
      const teams = await storage.get(this.TEAMS_KEY) || [];
      
      const newTeam = {
        id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: teamData?.name || '',
        description: teamData?.description || '',
        team_lead: teamData?.team_lead || teamData?.teamLead || '',
        department: teamData?.department || '',
        color: teamData?.color || '#667eea',
        manager: teamData?.manager || null,
        members: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: teamData?.createdBy || null
      };

      teams.push(newTeam);
      await storage.set(this.TEAMS_KEY, teams);

      console.log('✅ Team created:', newTeam.name);
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
  }

  async updateTeam(teamData) {
    try {
      if (!teamData?.id) {
        throw new Error('Team ID is required for update');
      }

      const teams = await storage.get(this.TEAMS_KEY) || [];
      const teamIndex = teams.findIndex(team => team.id === teamData.id);

      if (teamIndex === -1) {
        throw new Error('Team not found');
      }

      teams[teamIndex] = {
        ...teams[teamIndex],
        name: teamData.name || teams[teamIndex].name,
        description: teamData.description || '',
        team_lead: teamData.team_lead || teamData.teamLead || '',
        department: teamData.department || '',
        color: teamData.color || '#667eea',
        manager: teamData.manager || teams[teamIndex].manager,
        updated_at: new Date().toISOString(),
        updated_by: teamData.updatedBy || null
      };

      await storage.set(this.TEAMS_KEY, teams);

      console.log('✅ Team updated:', teams[teamIndex].name);
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
  }

  async deleteTeam(teamId, deletedBy) {
    try {
      if (!teamId) {
        throw new Error('Team ID is required for deletion');
      }

      const teams = await storage.get(this.TEAMS_KEY) || [];
      const teamIndex = teams.findIndex(team => team.id === teamId);

      if (teamIndex === -1) {
        throw new Error('Team not found');
      }

      const teamName = teams[teamIndex].name;

      // Remove team members associations
      const users = await storage.get(this.USERS_KEY) || [];
      const updatedUsers = users.map(user => {
        if ((user.team_memberships || []).some(m => m.team_id === teamId)) {
          return {
            ...user,
            team_memberships: user.team_memberships.filter(m => m.team_id !== teamId),
            updated_at: new Date().toISOString()
          };
        }
        return user;
      });
      await storage.set(this.USERS_KEY, updatedUsers);

      // Remove the team
      teams.splice(teamIndex, 1);
      await storage.set(this.TEAMS_KEY, teams);

      console.log('✅ Team deleted:', teamName);
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
  }

  async getTeams() {
    try {
      const teams = await storage.get(this.TEAMS_KEY) || [];
      const users = await storage.get(this.USERS_KEY) || [];

      // Enrich teams with member information
      const enrichedTeams = teams.map(team => ({
        ...team,
        members: users.filter(user => (user.team_memberships || []).some(m => m.team_id === team.id))
      }));

      return {
        success: true,
        data: enrichedTeams
      };
    } catch (error) {
      console.error('❌ Error getting teams:', error);
      return {
        success: false,
        message: error.message || 'Failed to get teams'
      };
    }
  }

  // User Management
  async createUser(userData) {
    try {
      const users = await storage.get(this.USERS_KEY) || [];
      let teamMemberships = userData.team_memberships || userData.teamMemberships || [];
      if (!Array.isArray(teamMemberships)) {
        if (userData.team_id || userData.teamId) {
          teamMemberships = [{ team_id: userData.team_id || userData.teamId, role: 'Member' }];
        } else {
          teamMemberships = [];
        }
      }
      const newUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        first_name: userData?.first_name || userData?.firstName || '',
        last_name: userData?.last_name || userData?.lastName || '',
        display_name: userData?.display_name || userData?.displayName || '',
        email_address: userData?.email_address || userData?.emailAddress || '',
        jira_account_id: userData?.jira_account_id || userData?.jiraAccountId || '',
        employment_type: userData?.employment_type || userData?.employmentType || 'full-time',
        hire_date: userData?.hire_date || userData?.hireDate || '',
        team_memberships: teamMemberships,
        capacity: userData?.capacity || 40,
        availability: userData?.availability || this.getDefaultAvailability(),
        avatar_url: userData?.avatar_url || userData?.avatarUrl || '',
        status: userData?.status || 'active',
        isAdmin: userData?.isAdmin === true,
        manager: userData?.manager || '',
        executive_manager: userData?.executive_manager || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userData?.createdBy || null
      };
      users.push(newUser);
      await storage.set(this.USERS_KEY, users);
      console.log('✅ User created:', newUser.display_name);
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
  }

  async updateUser(userData) {
    try {
      if (!userData?.id) {
        throw new Error('User ID is required for update');
      }
      const users = await storage.get(this.USERS_KEY) || [];
      const userIndex = users.findIndex(user => user.id === userData.id);
      if (userIndex === -1) {
        throw new Error('User not found');
      }
      let teamMemberships = userData.team_memberships || userData.teamMemberships || users[userIndex].team_memberships || [];
      if (!Array.isArray(teamMemberships)) {
        if (userData.team_id || userData.teamId) {
          teamMemberships = [{ team_id: userData.team_id || userData.teamId, role: 'Member' }];
        }
      }
      users[userIndex] = {
        ...users[userIndex],
        first_name: userData.first_name || userData.firstName || users[userIndex].first_name,
        last_name: userData.last_name || userData.lastName || users[userIndex].last_name,
        display_name: userData.display_name || userData.displayName || users[userIndex].display_name,
        email_address: userData.email_address || userData.emailAddress || users[userIndex].email_address,
        jira_account_id: userData.jira_account_id || userData.jiraAccountId || users[userIndex].jira_account_id,
        employment_type: userData.employment_type || userData.employmentType || users[userIndex].employment_type,
        hire_date: userData.hire_date || userData.hireDate || users[userIndex].hire_date,
        team_memberships: teamMemberships,
        capacity: userData.capacity || users[userIndex].capacity,
        availability: userData.availability || users[userIndex].availability,
        avatar_url: userData.avatar_url || userData.avatarUrl || users[userIndex].avatar_url,
        status: userData.status || users[userIndex].status,
        isAdmin: userData.isAdmin !== undefined ? userData.isAdmin : users[userIndex].isAdmin === true,
        manager: userData.manager !== undefined ? userData.manager : users[userIndex].manager || '',
        executive_manager: userData.executive_manager !== undefined ? userData.executive_manager : users[userIndex].executive_manager || '',
        updated_at: new Date().toISOString(),
        updated_by: userData.updatedBy || null
      };
      await storage.set(this.USERS_KEY, users);
      console.log('✅ User updated:', users[userIndex].display_name);
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
  }

  async deleteUser(userId, deletedBy) {
    try {
      if (!userId) {
        throw new Error('User ID is required for deletion');
      }

      const users = await storage.get(this.USERS_KEY) || [];
      const userIndex = users.findIndex(user => user.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const userName = users[userIndex].display_name;
      users.splice(userIndex, 1);
      await storage.set(this.USERS_KEY, users);

      console.log('✅ User deleted:', userName);
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
  }

  async getUsers() {
    try {
      const users = await storage.get(this.USERS_KEY) || [];
      
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
  }

  async getUserById(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const users = await storage.get(this.USERS_KEY) || [];
      const user = users.find(u => u.id === userId);
      
      if (!user) {
        throw new Error('User not found');
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
  }

  async getUsersByTeam(teamId) {
    try {
      if (!teamId) {
        throw new Error('Team ID is required');
      }

      const users = await storage.get(this.USERS_KEY) || [];
      const teamUsers = users.filter(user => (user.team_memberships || []).some(m => m.team_id === teamId));
      
      return {
        success: true,
        data: teamUsers
      };
    } catch (error) {
      console.error('❌ Error getting team users:', error);
      return {
        success: false,
        message: error.message || 'Failed to get team users'
      };
    }
  }

  // Team Member Management
  async addTeamMember(teamId, memberData) {
    try {
      if (!teamId || !memberData) {
        throw new Error('Team ID and member data are required');
      }

      // Validate manager role if being assigned
      if (memberData.role === 'Manager') {
        const canBeManager = await this.validateTeamManager(teamId, memberData.id, 'Manager');
        if (!canBeManager) {
          throw new Error('Team already has a manager');
        }
      }

      const teams = await storage.get(this.TEAMS_KEY) || [];
      const users = await storage.get(this.USERS_KEY) || [];
      const teamIndex = teams.findIndex(team => team.id === teamId);
      
      if (teamIndex === -1) {
        throw new Error('Team not found');
      }

      let user;
      const existingUserIndex = users.findIndex(u => 
        u.jira_account_id === memberData.jira_account_id || 
        u.jira_account_id === memberData.accountId
      );

      if (existingUserIndex !== -1) {
        // Update existing user
        const prevTeamMemberships = users[existingUserIndex].team_memberships || [];
        const existingMembership = prevTeamMemberships.find(m => m.team_id === teamId);
        
        if (existingMembership) {
          // Update existing membership
          if (memberData.role === 'Manager') {
            const canBeManager = await this.validateTeamManager(teamId, users[existingUserIndex].id, 'Manager');
            if (!canBeManager) {
              throw new Error('Team already has a manager');
            }
          }
          prevTeamMemberships[prevTeamMemberships.indexOf(existingMembership)] = {
            team_id: teamId,
            role: memberData.role || 'Member'
          };
        } else {
          // Add new membership
          prevTeamMemberships.push({
            team_id: teamId,
            role: memberData.role || 'Member'
          });
        }

        users[existingUserIndex] = {
          ...users[existingUserIndex],
          ...memberData,
          team_memberships: prevTeamMemberships,
          updated_at: new Date().toISOString()
        };
        user = users[existingUserIndex];
      } else {
        // Create new user
        user = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          first_name: memberData.first_name || memberData.firstName || '',
          last_name: memberData.last_name || memberData.lastName || '',
          display_name: memberData.display_name || memberData.displayName || '',
          email_address: memberData.email_address || memberData.emailAddress || '',
          jira_account_id: memberData.jira_account_id || memberData.accountId || '',
          employment_type: memberData.employment_type || 'full-time',
          hire_date: memberData.hire_date || memberData.hiringDate || '',
          team_memberships: [{
            team_id: teamId,
            role: memberData.role || 'Member'
          }],
          capacity: memberData.capacity || 40,
          availability: memberData.availability || this.getDefaultAvailability(),
          avatar_url: memberData.avatar_url || memberData.avatarUrl || '',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        users.push(user);
      }

      await storage.set(this.USERS_KEY, users);
      console.log('✅ Team member added:', user.display_name, 'to team:', teams[teamIndex].name);
      return {
        success: true,
        data: user,
        message: 'Team member added successfully'
      };
    } catch (error) {
      console.error('❌ Error adding team member:', error);
      return {
        success: false,
        message: error.message || 'Failed to add team member'
      };
    }
  }

  async removeTeamMember(teamId, memberAccountId, removedBy) {
    try {
      if (!teamId || !memberAccountId) {
        throw new Error('Team ID and member account ID are required');
      }
      const users = await storage.get(this.USERS_KEY) || [];
      const userIndex = users.findIndex(user => 
        (user.team_memberships || []).some(m => m.team_id === teamId && m.team_id === memberAccountId)
      );
      if (userIndex === -1) {
        throw new Error('Team member not found');
      }
      const userName = users[userIndex].display_name;
      // Remove from team (remove team_id from team_memberships array)
      const prevTeamMemberships = users[userIndex].team_memberships || [];
      users[userIndex] = {
        ...users[userIndex],
        team_memberships: prevTeamMemberships.filter(m => m.team_id !== teamId),
        updated_at: new Date().toISOString(),
        updated_by: removedBy
      };
      await storage.set(this.USERS_KEY, users);
      console.log('✅ Team member removed:', userName);
      return {
        success: true,
        message: 'Team member removed successfully'
      };
    } catch (error) {
      console.error('❌ Error removing team member:', error);
      return {
        success: false,
        message: error.message || 'Failed to remove team member'
      };
    }
  }

  // Utility Methods
  getDefaultAvailability() {
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

  // Analytics and Reporting
  async getTeamAnalytics(teamId, dateRange = 'current_month') {
    try {
      if (!teamId) {
        throw new Error('Team ID is required');
      }

      const teams = await storage.get(this.TEAMS_KEY) || [];
      const users = await storage.get(this.USERS_KEY) || [];
      const ptoRequests = await storage.get('pto_requests') || [];

      const team = teams.find(t => t.id === teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      const teamMembers = users.filter(user => (user.team_memberships || []).some(m => m.team_id === teamId));
      const teamMemberIds = teamMembers.map(member => member.jira_account_id || member.id);

      // Filter PTO requests by date range
      const now = new Date();
      let startDate, endDate;

      switch (dateRange) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          endDate = now;
          break;
        case 'year_to_date':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
        default:
          startDate = new Date(0);
          endDate = now;
      }

      const teamRequests = ptoRequests.filter(request => 
        teamMemberIds.includes(request.requester_id) &&
        new Date(request.submitted_at) >= startDate &&
        new Date(request.submitted_at) <= endDate
      );

      // Calculate analytics
      const analytics = {
        totalRequests: teamRequests.length,
        approvedRequests: teamRequests.filter(r => r.status === 'approved').length,
        pendingRequests: teamRequests.filter(r => r.status === 'pending').length,
        declinedRequests: teamRequests.filter(r => r.status === 'declined').length,
        totalDaysOff: teamRequests
          .filter(r => r.status === 'approved')
          .reduce((sum, r) => sum + (r.total_days || 0), 0),
        leaveTypeBreakdown: {},
        memberStats: {}
      };

      // Leave type breakdown
      teamRequests.forEach(request => {
        const type = request.leave_type || 'unknown';
        analytics.leaveTypeBreakdown[type] = (analytics.leaveTypeBreakdown[type] || 0) + 1;
      });

      // Member statistics
      teamMembers.forEach(member => {
        const memberRequests = teamRequests.filter(r => r.requester_id === (member.jira_account_id || member.id));
        analytics.memberStats[member.id] = {
          name: member.display_name || `${member.first_name} ${member.last_name}`,
          totalRequests: memberRequests.length,
          approvedRequests: memberRequests.filter(r => r.status === 'approved').length,
          pendingRequests: memberRequests.filter(r => r.status === 'pending').length,
          approvedDays: memberRequests
            .filter(r => r.status === 'approved')
            .reduce((sum, r) => sum + (r.total_days || 0), 0)
        };
      });

      return {
        success: true,
        data: {
          team: {
            ...team,
            members: teamMembers
          },
          analytics,
          requests: teamRequests,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            type: dateRange
          }
        }
      };
    } catch (error) {
      console.error('❌ Error getting team analytics:', error);
      return {
        success: false,
        message: error.message || 'Failed to get team analytics'
      };
    }
  }

  async getTeamPTORequests(teamId, dateRange = 'current_month') {
    try {
      if (!teamId) {
        throw new Error('Team ID is required');
      }

      const users = await storage.get(this.USERS_KEY) || [];
      const ptoRequests = await storage.get('pto_requests') || [];

      const teamMembers = users.filter(user => (user.team_memberships || []).some(m => m.team_id === teamId));
      const teamMemberIds = teamMembers.map(member => member.jira_account_id || member.id);

      // Filter by date range
      const now = new Date();
      let startDate, endDate;

      switch (dateRange) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'next_month':
          startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
          break;
        case 'next_3_months':
          startDate = now;
          endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
          break;
        default:
          startDate = new Date(0);
          endDate = new Date(2099, 11, 31);
      }

      const teamRequests = ptoRequests.filter(request => {
        const inTeam = teamMemberIds.includes(request.requester_id);
        const inDateRange = new Date(request.start_date) <= endDate && 
                           new Date(request.end_date) >= startDate;
        return inTeam && inDateRange;
      });

      return {
        success: true,
        data: teamRequests
      };
    } catch (error) {
      console.error('❌ Error getting team PTO requests:', error);
      return {
        success: false,
        message: error.message || 'Failed to get team PTO requests'
      };
    }
  }

  // Integration with PTO system
  async getUserTeams(userId) {
    try {
      if (!userId) {
        return {
          success: true,
          data: []
        };
      }

      const teams = await storage.get(this.TEAMS_KEY) || [];
      const users = await storage.get(this.USERS_KEY) || [];

      // Find user's team
      const user = users.find(u => u.jira_account_id === userId || u.id === userId);
      if (!user || !user.team_memberships || user.team_memberships.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      const userTeams = teams.filter(team => (user.team_memberships || []).some(m => m.team_id === team.id));
      const enrichedTeams = userTeams.map(team => ({
        ...team,
        members: users.filter(u => (u.team_memberships || []).some(m => m.team_id === team.id))
      }));

      return {
        success: true,
        data: enrichedTeams
      };
    } catch (error) {
      console.error('❌ Error getting user teams:', error);
      return {
        success: false,
        message: error.message || 'Failed to get user teams'
      };
    }
  }

  // Search and lookup
  async searchUsers(query) {
    try {
      const users = await storage.get(this.USERS_KEY) || [];
      
      if (!query || query.length < 2) {
        return {
          success: true,
          data: []
        };
      }

      const searchTerm = query.toLowerCase();
      const matchingUsers = users.filter(user => {
        const displayName = (user.display_name || '').toLowerCase();
        const firstName = (user.first_name || '').toLowerCase();
        const lastName = (user.last_name || '').toLowerCase();
        const email = (user.email_address || '').toLowerCase();
        
        return displayName.includes(searchTerm) ||
               firstName.includes(searchTerm) ||
               lastName.includes(searchTerm) ||
               email.includes(searchTerm);
      });

      return {
        success: true,
        data: matchingUsers.slice(0, 10) // Limit results
      };
    } catch (error) {
      console.error('❌ Error searching users:', error);
      return {
        success: false,
        message: error.message || 'Failed to search users'
      };
    }
  }

  // Data migration and cleanup
  async migrateFromPTOTeams() {
    try {
      console.log('🔄 Migrating from PTO teams to enhanced teams...');
      
      const ptoTeams = await storage.get('pto_teams') || [];
      const existingTeams = await storage.get(this.TEAMS_KEY) || [];
      
      if (ptoTeams.length === 0) {
        console.log('ℹ️ No PTO teams to migrate');
        return { 
          success: true, 
          migrated: 0,
          message: 'No PTO teams found to migrate'
        };
      }

      let migratedCount = 0;
      
      for (const ptoTeam of ptoTeams) {
        // Check if team already exists
        const existingTeam = existingTeams.find(t => t.name === ptoTeam.name);
        if (existingTeam) {
          console.log(`⏭️ Skipping existing team: ${ptoTeam.name}`);
          continue;
        }

        // Create enhanced team
        const enhancedTeam = {
          id: ptoTeam.id || `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: ptoTeam.name || 'Unnamed Team',
          description: ptoTeam.description || '',
          team_lead: ptoTeam.manager_id ? 
            (ptoTeam.manager?.displayName || 'Unknown') : '',
          department: ptoTeam.department || '',
          color: '#667eea',
          manager: ptoTeam.manager || null,
          members: [],
          created_at: ptoTeam.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          migrated_from: 'pto_teams'
        };

        existingTeams.push(enhancedTeam);
        migratedCount++;

        // Migrate team members if they exist
        if (ptoTeam.members && Array.isArray(ptoTeam.members)) {
          const users = await storage.get(this.USERS_KEY) || [];
          
          for (const member of ptoTeam.members) {
            try {
              const existingUser = users.find(u => 
                u.jira_account_id === member.accountId ||
                u.email_address === member.emailAddress
              );

              if (!existingUser) {
                const newUser = {
                  id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  first_name: member.firstName || '',
                  last_name: member.lastName || '',
                  display_name: member.displayName || member.name || '',
                  email_address: member.emailAddress || '',
                  jira_account_id: member.accountId || '',
                  employment_type: 'full-time',
                  hire_date: member.hiringDate || '',
                  team_memberships: [{ team_id: enhancedTeam.id, role: 'Member' }],
                  capacity: 40,
                  availability: this.getDefaultAvailability(),
                  avatar_url: member.avatarUrl || '',
                  status: 'active',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  migrated_from: 'pto_teams'
                };
                users.push(newUser);
              } else {
                // Update existing user's team
                const prevTeamMemberships = existingUser.team_memberships || [];
                const newTeamMemberships = prevTeamMemberships.some(m => m.team_id === enhancedTeam.id) ? prevTeamMemberships : [...prevTeamMemberships, { team_id: enhancedTeam.id, role: 'Member' }];
                existingUser.team_memberships = newTeamMemberships;
                existingUser.updated_at = new Date().toISOString();
              }
            } catch (memberError) {
              console.warn('Error migrating member:', member, memberError);
            }
          }
          
          await storage.set(this.USERS_KEY, users);
        }
      }

      await storage.set(this.TEAMS_KEY, existingTeams);
      
      console.log(`✅ Migrated ${migratedCount} teams from PTO system`);
      return {
        success: true,
        migrated: migratedCount,
        message: `Successfully migrated ${migratedCount} teams`
      };
    } catch (error) {
      console.error('❌ Error migrating PTO teams:', error);
      return {
        success: false,
        message: error.message || 'Failed to migrate PTO teams'
      };
    }
  }

  // Debug and maintenance
  async debugStorage(table = null) {
    try {
      if (table) {
        const data = await storage.get(table) || [];
        console.log(`📊 ${table}:`, JSON.stringify(data, null, 2));
        return {
          success: true,
          data: { [table]: data }
        };
      } else {
        const teams = await storage.get(this.TEAMS_KEY) || [];
        const users = await storage.get(this.USERS_KEY) || [];
        
        const debug = {
          teams: teams,
          users: users,
          summary: {
            totalTeams: teams.length,
            totalUsers: users.length,
            usersWithTeams: users.filter(u => (u.team_memberships || []).length > 0).length,
            usersWithoutTeams: users.filter(u => (u.team_memberships || []).length === 0).length
          }
        };
        
        console.log('📊 Debug Storage:', JSON.stringify(debug, null, 2));
        return {
          success: true,
          data: debug
        };
      }
    } catch (error) {
      console.error('❌ Error debugging storage:', error);
      return {
        success: false,
        message: error.message || 'Failed to debug storage'
      };
    }
  }

  async clearStorage(table = null) {
    try {
      if (table) {
        await storage.set(table, []);
        console.log(`🗑️ Cleared ${table}`);
      } else {
        await storage.set(this.TEAMS_KEY, []);
        await storage.set(this.USERS_KEY, []);
        console.log('🗑️ Cleared all team and user storage');
      }
      
      return {
        success: true,
        message: `Storage cleared: ${table || 'all'}`
      };
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
      return {
        success: false,
        message: error.message || 'Failed to clear storage'
      };
    }
  }

  // MIGRATION: On initialization, convert team_ids to team_memberships for all users
  async migrateUserTeamMemberships() {
    const users = await storage.get(this.USERS_KEY) || [];
    let changed = false;
    const migrated = users.map(user => {
      if (user.team_memberships && !user.team_memberships) {
        changed = true;
        return {
          ...user,
          team_memberships: user.team_memberships.map(m => ({ team_id: m.team_id, role: m.role })),
          team_ids: undefined
        };
      }
      if (!user.team_memberships) {
        return { ...user, team_memberships: [] };
      }
      return user;
    });
    if (changed) {
      await storage.set(this.USERS_KEY, migrated);
      console.log('✅ Migrated users to team_memberships array');
    }
  }

  // Add validation method for team manager
  async validateTeamManager(teamId, userId, newRole) {
    if (newRole !== 'Manager') return true;
    
    const users = await storage.get(this.USERS_KEY) || [];
    const existingManager = users.find(user => 
      (user.team_memberships || []).some(m => 
        m.team_id === teamId && m.role === 'Manager' && user.id !== userId
      )
    );
    
    return !existingManager;
  }

  // Add admin management methods
  async addAdminUser(userId) {
    const users = await storage.get(this.USERS_KEY) || [];
    const user = users.find(u => u.id === userId || u.jira_account_id === userId);
    if (user) {
      user.isAdmin = true;
      await storage.set(this.USERS_KEY, users);
      return { success: true };
    }
    return { success: false, message: 'User not found' };
  }

  async removeAdminUser(userId) {
    const users = await storage.get(this.USERS_KEY) || [];
    const user = users.find(u => u.id === userId || u.jira_account_id === userId);
    if (user) {
      user.isAdmin = false;
      await storage.set(this.USERS_KEY, users);
      return { success: true };
    }
    return { success: false, message: 'User not found' };
  }

  // Migration: set isAdmin false for all users except provided admin IDs
  async migrateIsAdmin(adminAccountIds = []) {
    const users = await storage.get(this.USERS_KEY) || [];
    users.forEach(user => {
      user.isAdmin = adminAccountIds.includes(user.id) || adminAccountIds.includes(user.jira_account_id);
    });
    await storage.set(this.USERS_KEY, users);
    console.log('✅ Migrated isAdmin property for all users');
    return { success: true };
  }
}

// Create and export singleton instance for Forge backend
const teamUserService = new TeamUserService();
export default teamUserService;

// Script: Remove admin rights from all users
export async function removeAllAdmins() {
  const users = await storage.get('users') || [];
  users.forEach(user => { user.isAdmin = false; });
  await storage.set('users', users);
  console.log('✅ All admin rights removed from users');
  return { success: true, message: 'All admin rights removed from users' };
}