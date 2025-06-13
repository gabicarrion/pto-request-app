// src/database/db-service.js
import api, { route } from '@forge/api';
import { storage } from '@forge/api';
import { SCHEMA } from './schema';

/**
 * Database service class for handling all storage operations
 */
class DatabaseService {
  constructor() {
    this.schema = SCHEMA;
    this.collections = Object.keys(this.schema);
  }

  /**
   * Create a new record in the specified collection
   * @param {string} collection - The collection name (must be defined in schema)
   * @param {object} data - The data to store
   * @returns {Promise<object>} - The stored data with ID
   */
  async create(collection, data) {
    if (!this.collections.includes(collection)) {
      throw new Error(`Collection not found in schema: ${collection}`);
    }
    
    // Generate ID if not provided based on the primary key field (assuming collection_id format)
    const idField = `${collection.slice(0, -1)}_id`;
    if (!data[idField]) {
      data[idField] = this.generateUUID();
    }
    
    // Add timestamps
    const now = new Date().toISOString();
    if (!data.created_at) {
      data.created_at = now;
    }
    if (!data.updated_at) {
      data.updated_at = now;
    }
    
    // Validate data against schema
    this.validateAgainstSchema(collection, data);
    
    // Store in Forge storage
    const key = `${collection}:${data[idField]}`;
    await storage.set(key, data);
    
    return data;
  }

  /**
   * Retrieve a record by ID from the specified collection
   * @param {string} collection - The collection name
   * @param {string} id - The record ID
   * @returns {Promise<object|null>} - The retrieved data or null if not found
   */
  async getById(collection, id) {
    if (!id) {
      return null;
    }
    
    try {
      const key = `${collection}:${id}`;
      return await storage.get(key);
    } catch (error) {
      console.error(`Error retrieving ${collection}:${id}:`, error);
      return null;
    }
  }

  /**
   * Update a record in the specified collection
   * @param {string} collection - The collection name
   * @param {string} id - The record ID
   * @param {object} data - The updated data (partial update supported)
   * @returns {Promise<object>} - The updated data
   */
  async update(collection, id, data) {
    if (!this.collections.includes(collection)) {
      throw new Error(`Collection not found in schema: ${collection}`);
    }
    
    // Get existing record
    const key = `${collection}:${id}`;
    const existingData = await storage.get(key);
    
    if (!existingData) {
      throw new Error(`Record not found: ${key}`);
    }
    
    // Update data and timestamp
    const updatedData = { 
      ...existingData, 
      ...data, 
      updated_at: new Date().toISOString() 
    };
    
    // Validate updated data against schema
    this.validateAgainstSchema(collection, updatedData);
    
    // Store updated data
    await storage.set(key, updatedData);
    return updatedData;
  }

  /**
   * Delete a record from the specified collection
   * @param {string} collection - The collection name
   * @param {string} id - The record ID
   * @returns {Promise<boolean>} - Success status
   */
  async delete(collection, id) {
    if (!id) {
      return false;
    }
    
    const key = `${collection}:${id}`;
    try {
      await storage.delete(key);
      return true;
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      return false;
    }
  }

  /**
   * Query records from a collection based on a filter function
   * @param {string} collection - The collection name
   * @param {function} filterFn - Filter function to apply (optional)
   * @returns {Promise<Array>} - Array of matching records
   */
  async query(collection, filterFn = null) {
    if (!this.collections.includes(collection)) {
      throw new Error(`Collection not found in schema: ${collection}`);
    }
    
    try {
      // Get all keys with the collection prefix
      const regex = new RegExp(`^${collection}:`);
      const keys = await storage.query().whereKey(regex).getKeys();
      
      if (keys.length === 0) {
        return [];
      }
      
      // Fetch all items
      const items = await Promise.all(keys.map(key => storage.get(key)));
      const validItems = items.filter(item => item !== null && item !== undefined);
      
      // Apply filter if provided
      return filterFn ? validItems.filter(filterFn) : validItems;
    } catch (error) {
      console.error(`Error querying ${collection}:`, error);
      return [];
    }
  }

  /**
   * Validate data against the schema
   * @param {string} collection - The collection name
   * @param {object} data - The data to validate
   * @private
   */
  validateAgainstSchema(collection, data) {
    const schema = this.schema[collection];
    
    // Basic validation - ensure required fields are present with correct types
    for (const [field, type] of Object.entries(schema)) {
      // Skip validation for fields not present in data (for partial updates)
      if (data[field] === undefined || data[field] === null) {
        continue;
      }
      
      // Validate field type
      if (type === 'string' || type === 'text') {
        if (typeof data[field] !== 'string') {
          throw new Error(`Field ${field} should be a string`);
        }
      } else if (type === 'number') {
        if (typeof data[field] !== 'number') {
          throw new Error(`Field ${field} should be a number`);
        }
      } else if (type === 'boolean') {
        if (typeof data[field] !== 'boolean') {
          throw new Error(`Field ${field} should be a boolean`);
        }
      } else if (type === 'json') {
        // For JSON fields, ensure it's an object or array
        if (typeof data[field] !== 'object') {
          throw new Error(`Field ${field} should be an object or array`);
        }
      } else if (type === 'date' || type === 'datetime') {
        // For date fields, ensure it's a valid date string
        if (!(typeof data[field] === 'string' && !isNaN(Date.parse(data[field])))) {
          throw new Error(`Field ${field} should be a valid date string`);
        }
      }
    }
  }

  /**
   * Generate a UUID for new records
   * @returns {string} - A new UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * Get current Jira user information
   * @returns {Promise<object>} - User information
   */
  async getCurrentUser() {
    try {
      const response = await api.asUser().requestJira(route`/rest/api/3/myself`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch current user: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        accountId: data.accountId,
        displayName: data.displayName,
        emailAddress: data.emailAddress
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }
  
  /**
   * Search for Jira users
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of matching users
   */
  async searchJiraUsers(query) {
    if (!query || query.length < 2) {
      return [];
    }
    
    try {
      const response = await api.asApp().requestJira(
        route`/rest/api/3/user/search?query=${query}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to search users: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error searching Jira users:', error);
      return [];
    }
  }
  
  /**
   * Initialize a user from Jira data if they don't exist in our database
   * @param {object} jiraUser - Jira user data
   * @returns {Promise<object>} - Created or existing user
   */
  async initializeUserFromJira(jiraUser) {
    // First, check if user already exists
    const users = await this.query('users', user => 
      user.jira_account_id === jiraUser.accountId
    );
    
    if (users && users.length > 0) {
      return users[0];
    }
    
    // Create new user with default values
    const newUser = {
      user_id: jiraUser.accountId,
      jira_account_id: jiraUser.accountId,
      display_name: jiraUser.displayName,
      email_address: jiraUser.emailAddress,
      team_memberships: [],
      employment_type: 'full_time',
      capacity: 40,
      standard_availability: {
        monday: 8,
        tuesday: 8,
        wednesday: 8,
        thursday: 8,
        friday: 8,
        saturday: 0,
        sunday: 0
      },
      isAdmin: false,
      isManager: [],
      isExecutive_Manager: [],
      pto_accountability_type: 'standard_year',
      pto_available_in_the_period: {
        vacation: 20,
        sick: 10,
        personal: 1,
        holiday: 0,
        other: 0
      },
      hiring_date: new Date().toISOString().split('T')[0],
      used_pto_days_in_period: {
        vacation: 0,
        sick: 0,
        personal: 0,
        holiday: 0,
        other: 0
      },
      remaining_pto_days_in_period: {
        vacation: 20,
        sick: 10,
        personal: 1,
        holiday: 0,
        other: 0
      }
    };
    
    // Create user in database
    return await this.create('users', newUser);
  }
  
  /**
   * Get or create a user based on current Jira user
   * @returns {Promise<object>} - User object
   */
  async getOrCreateCurrentUser() {
    try {
      // Get Jira user information
      const jiraUser = await this.getCurrentUser();
      
      // Initialize user if needed
      return await this.initializeUserFromJira(jiraUser);
    } catch (error) {
      console.error('Error in getOrCreateCurrentUser:', error);
      throw error;
    }
  }
  
  /**
   * Search for users in our system
   * @param {string} query - Search string for name or email
   * @returns {Promise<Array>} - Matching users
   */
  async searchUsers(query) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    
    const searchTerm = query.toLowerCase();
    
    try {
      // First try to search our database
      const dbUsers = await this.query('users', user => 
        user.display_name.toLowerCase().includes(searchTerm) || 
        user.email_address.toLowerCase().includes(searchTerm)
      );
      
      // If we have enough results, return them
      if (dbUsers.length >= 5) {
        return dbUsers;
      }
      
      // Otherwise, search Jira users as well
      const jiraUsers = await this.searchJiraUsers(query);
      
      // Convert Jira users to our format and filter out duplicates
      const existingUserIds = new Set(dbUsers.map(u => u.jira_account_id));
      
      const newJiraUsers = jiraUsers
        .filter(ju => !existingUserIds.has(ju.accountId))
        .map(ju => ({
          user_id: ju.accountId,
          jira_account_id: ju.accountId,
          display_name: ju.displayName,
          email_address: ju.emailAddress
        }));
      
      // Combine results
      return [...dbUsers, ...newJiraUsers].slice(0, 10); // Limit to 10 results
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }
  
  /**
   * Update PTO balances for a user
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Updated user with PTO balances
   */
  async updateUserPTOBalances(userId) {
    try {
      // Get user
      const user = await this.getById('users', userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      
      // Get all approved PTO requests for this user
      const approvedRequests = await this.query(
        'pto_requests',
        req => req.requester_id === userId && req.status === 'approved'
      );
      
      // Initialize used PTO days counters
      const usedPtoDays = {
        vacation: 0,
        sick: 0,
        personal: 0,
        holiday: 0,
        other: 0
      };
      
      // Calculate used days from daily schedules
      for (const request of approvedRequests) {
        if (request.daily_schedules && Array.isArray(request.daily_schedules)) {
          for (const schedule of request.daily_schedules) {
            // Calculate days based on schedule type
            const dayValue = schedule.schedule_type === 'FULL_DAY' ? 1 : 0.5;
            usedPtoDays[request.leave_type] += dayValue;
          }
        }
      }
      
      // Calculate remaining days
      const remainingPtoDays = {};
      const availableDays = user.pto_available_in_the_period || {
        vacation: 20,
        sick: 0,
        personal: 1,
        holiday: 10,
        other: 0
      };
      
      for (const type in availableDays) {
        remainingPtoDays[type] = availableDays[type] - (usedPtoDays[type] || 0);
      }
      
      // Update user record
      const updateData = {
        used_pto_days_in_period: usedPtoDays,
        remaining_pto_days_in_period: remainingPtoDays
      };
      
      return await this.update('users', userId, updateData);
    } catch (error) {
      console.error('Error updating user PTO balances:', error);
      throw error;
    }
  }
  
  /**
   * Get a user's managers based on their team memberships
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of manager objects
   */
  async getUserManagers(userId) {
    try {
      // Get user
      const user = await this.getById('users', userId);
      if (!user || !Array.isArray(user.team_memberships) || user.team_memberships.length === 0) {
        return [];
      }
      
      // Get all teams the user is a member of
      const userTeams = user.team_memberships.filter(membership => 
        membership.role === 'Member'
      );
      
      if (userTeams.length === 0) {
        return [];
      }
      
      // Get team data for those teams
      const teams = await Promise.all(
        userTeams.map(membership => this.getById('teams', membership.team_id))
      );
      
      // Filter out any null results (teams that may have been deleted)
      const validTeams = teams.filter(Boolean);
      
      if (validTeams.length === 0) {
        return [];
      }
      
      // Extract managers with team context
      const managers = [];
      const executiveManagers = [];
      
      for (const team of validTeams) {
        if (team.team_manager_id) {
          managers.push({
            id: team.team_manager_id,
            name: team.team_manager_name,
            email: team.team_manager_email,
            team: team.team_name,
            role: 'Manager'
          });
        }
        
        if (team.team_executive_manager_id) {
          executiveManagers.push({
            id: team.team_executive_manager_id,
            name: team.team_executive_manager_name,
            email: team.team_executive_manager_email,
            team: team.team_name,
            role: 'Executive Manager'
          });
        }
      }
      
      // Combine managers and remove duplicates by ID
      const allManagers = [...managers, ...executiveManagers];
      const uniqueManagersMap = new Map();
      
      for (const manager of allManagers) {
        if (!uniqueManagersMap.has(manager.id)) {
          uniqueManagersMap.set(manager.id, manager);
        }
      }
      
      return Array.from(uniqueManagersMap.values());
    } catch (error) {
      console.error('Error getting user managers:', error);
      return [];
    }
  }
}

// Export a singleton instance
const dbService = new DatabaseService();
export default dbService;