// src/services/user-service.js
import dbService from '../database/db-service';

/**
 * Service to handle user-related operations
 */
class UserService {
  constructor() {
    this.dbService = dbService;
    this.userCollection = 'users';
  }

  /**
   * Get current authenticated user
   * @returns {Promise<object>} - Current user from database or creates if not exists
   */
  async getCurrentUser() {
    return await this.dbService.getOrCreateCurrentUser();
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} - User data
   */
  async getUserById(userId) {
    return await this.dbService.getById(this.userCollection, userId);
  }

  /**
   * Search users by name or email
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Matching users
   */
  async searchUsers(query) {
    return await this.dbService.searchUsers(query);
  }

  /**
   * Update user data
   * @param {string} userId - User ID
   * @param {object} userData - Updated user data
   * @returns {Promise<object>} - Updated user
   */
  async updateUser(userId, userData) {
    return await this.dbService.update(this.userCollection, userId, userData);
  }

  /**
   * Check if current user is admin
   * @returns {Promise<boolean>} - Is admin status
   */
  async isCurrentUserAdmin() {
    const currentUser = await this.getCurrentUser();
    return currentUser && currentUser.isAdmin === true;
  }

  /**
   * Check if current user is a manager
   * @returns {Promise<boolean>} - Is manager status
   */
  async isCurrentUserManager() {
    const currentUser = await this.getCurrentUser();
    return currentUser && 
           (Array.isArray(currentUser.isManager) && currentUser.isManager.length > 0);
  }

  /**
   * Check if current user is an executive manager
   * @returns {Promise<boolean>} - Is executive manager status
   */
  async isCurrentUserExecutiveManager() {
    const currentUser = await this.getCurrentUser();
    return currentUser && 
           (Array.isArray(currentUser.isExecutive_Manager) && currentUser.isExecutive_Manager.length > 0);
  }

  /**
   * Get user's managers
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of manager objects
   */
  async getUserManagers(userId) {
    return await this.dbService.getUserManagers(userId);
  }
}

// Export a singleton instance
const userService = new UserService();
export default userService;