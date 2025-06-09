// Test data initialization script for PTO Request app
import { storage } from '@forge/api';
import teamUserService from './services/team-user-service';

export async function initializeTestData() {
  console.log('🔧 Initializing test data...');
  
  try {
    // Initialize the service
    await teamUserService.initialize();
    
    // Create test teams
    const team1 = await teamUserService.createTeam({
      name: 'Design Team',
      description: 'UI/UX Design Team',
      department: 'Design',
      color: '#4CAF50'
    });
    
    const team2 = await teamUserService.createTeam({
      name: 'Development Team',
      description: 'Software Development Team',
      department: 'Engineering',
      color: '#2196F3'
    });
    
    // Create test users
    const user1 = await teamUserService.createUser({
      first_name: 'John',
      last_name: 'Doe',
      display_name: 'John Doe',
      email_address: 'john.doe@example.com',
      employment_type: 'full-time',
      capacity: 40,
      team_memberships: [
        { team_id: team1.data.id, role: 'Manager' }
      ]
    });
    
    const user2 = await teamUserService.createUser({
      first_name: 'Jane',
      last_name: 'Smith',
      display_name: 'Jane Smith',
      email_address: 'jane.smith@example.com',
      employment_type: 'full-time',
      capacity: 40,
      team_memberships: [
        { team_id: team2.data.id, role: 'Manager' }
      ]
    });
    
    const user3 = await teamUserService.createUser({
      first_name: 'Bob',
      last_name: 'Johnson',
      display_name: 'Bob Johnson',
      email_address: 'bob.johnson@example.com',
      employment_type: 'contractor',
      capacity: 30,
      team_memberships: [
        { team_id: team1.data.id, role: 'Member' },
        { team_id: team2.data.id, role: 'Member' }
      ]
    });
    
    // Create some PTO requests
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.setDate(now.getDate() + 1)).toISOString().split('T')[0];
    const nextWeek = new Date(now.setDate(now.getDate() + 7)).toISOString().split('T')[0];
    
    const ptoRequests = [
      {
        id: `pto-${Date.now()}-1`,
        requester_id: user1.data.id,
        manager_id: user2.data.id,
        start_date: tomorrow,
        end_date: nextWeek,
        leave_type: 'vacation',
        status: 'approved',
        created_at: today,
        updated_at: today
      },
      {
        id: `pto-${Date.now()}-2`,
        requester_id: user3.data.id,
        manager_id: user1.data.id,
        start_date: nextWeek,
        end_date: nextWeek,
        leave_type: 'sick',
        status: 'approved',
        created_at: today,
        updated_at: today
      }
    ];
    
    await storage.set('pto_requests', ptoRequests);
    
    // Create daily schedules for PTO
    const dailySchedules = [
      {
        id: `daily-${Date.now()}-1`,
        pto_id: ptoRequests[0].id,
        requester_id: ptoRequests[0].requester_id,
        date: tomorrow,
        hours: 8,
        leave_type: 'vacation',
        status: 'approved'
      },
      {
        id: `daily-${Date.now()}-2`,
        pto_id: ptoRequests[0].id,
        requester_id: ptoRequests[0].requester_id,
        date: nextWeek,
        hours: 8,
        leave_type: 'vacation',
        status: 'approved'
      },
      {
        id: `daily-${Date.now()}-3`,
        pto_id: ptoRequests[1].id,
        requester_id: ptoRequests[1].requester_id,
        date: nextWeek,
        hours: 8,
        leave_type: 'sick',
        status: 'approved'
      }
    ];
    
    await storage.set('pto_daily_schedules', dailySchedules);
    
    return {
      success: true,
      message: 'Test data initialized successfully',
      data: {
        teams: [team1.data, team2.data],
        users: [user1.data, user2.data, user3.data],
        ptoRequests,
        dailySchedules
      }
    };
  } catch (error) {
    console.error('❌ Error initializing test data:', error);
    return {
      success: false,
      message: error.message || 'Failed to initialize test data'
    };
  }
}

// Export a handler function to be called from Forge
export async function handler() {
  return await initializeTestData();
} 