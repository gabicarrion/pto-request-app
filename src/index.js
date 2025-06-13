// src/index.js
import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import userService from './services/user-service';
import teamService from './services/team-service';
import ptoService from './services/pto-service';

// Create a resolver to handle frontend calls
const resolver = new Resolver();

// User endpoints
resolver.define('getCurrentUser', async () => {
  return await userService.getCurrentUser();
});

resolver.define('searchUsers', async ({ query }) => {
  return await userService.searchUsers(query);
});

resolver.define('getUserById', async ({ userId }) => {
  return await userService.getUserById(userId);
});

resolver.define('updateUser', async ({ userId, userData }) => {
  return await userService.updateUser(userId, userData);
});

resolver.define('isCurrentUserAdmin', async () => {
  return await userService.isCurrentUserAdmin();
});

resolver.define('isCurrentUserManager', async () => {
  return await userService.isCurrentUserManager();
});

resolver.define('isCurrentUserExecutiveManager', async () => {
  return await userService.isCurrentUserExecutiveManager();
});

resolver.define('getUserManagers', async ({ userId }) => {
  return await userService.getUserManagers(userId);
});

// Team endpoints
resolver.define('getAllTeams', async () => {
  return await teamService.getAllTeams();
});

resolver.define('getTeamById', async ({ teamId }) => {
  return await teamService.getTeamById(teamId);
});

resolver.define('createTeam', async ({ teamData }) => {
  return await teamService.createTeam(teamData);
});

resolver.define('updateTeam', async ({ teamId, teamData }) => {
  return await teamService.updateTeam(teamId, teamData);
});

resolver.define('deleteTeam', async ({ teamId }) => {
  return await teamService.deleteTeam(teamId);
});

resolver.define('addUserToTeam', async ({ teamId, userId, userDisplayName, userEmail, role }) => {
  return await teamService.addUserToTeam(teamId, userId, userDisplayName, userEmail, role);
});

resolver.define('removeUserFromTeam', async ({ teamId, userId }) => {
  return await teamService.removeUserFromTeam(teamId, userId);
});

resolver.define('getUserTeams', async ({ userId }) => {
  return await teamService.getUserTeams(userId);
});

// PTO request endpoints
resolver.define('createPTORequest', async ({ requestData }) => {
  return await ptoService.createPTORequest(requestData);
});

resolver.define('getUserPTORequests', async ({ userId }) => {
  return await ptoService.getUserPTORequests(userId);
});

resolver.define('getManagerPendingApprovals', async ({ managerId }) => {
  return await ptoService.getManagerPendingApprovals(managerId);
});

resolver.define('approvePTORequest', async ({ requestId, approverId }) => {
  return await ptoService.approvePTORequest(requestId, approverId);
});

resolver.define('declinePTORequest', async ({ requestId, declinerId, reason }) => {
  return await ptoService.declinePTORequest(requestId, declinerId, reason);
});

resolver.define('getDailySchedules', async ({ startDate, endDate }) => {
  return await ptoService.getDailySchedules(startDate, endDate);
});

// Listen for frontend invocations
export const handler = resolver.getDefinitions();

// Initialize any required data on app startup
export async function initializeData() {
  // Check if data already initialized
  const initialized = await storage.get('app:initialized');
  if (initialized) return;
  
  // Create default admin user if it doesn't exist
  const adminExists = await storage.query()
    .where('isAdmin', true)
    .getMany();
    
  if (!adminExists || adminExists.length === 0) {
    // Get current user as admin
    const currentUser = await userService.getCurrentUser();
    await userService.updateUser(currentUser.user_id, { isAdmin: true });
  }
  
  // Mark as initialized
  await storage.set('app:initialized', true);
}