// src/services/import-service.js
import api, { route, storage } from '@forge/api';
import teamUserService from './team-user-service';

// Service for handling PTO imports
export const importService = {
  // Store for validated data ready for import
  validatedData: null,
  
  /**
   * Clear any stored validation data
   */
  async clearValidationData() {
    console.log('🧹 Clearing stored validation data');
    this.validatedData = null;
    // Also clear any temporary storage keys used for validation
    try {
      await storage.delete('temp_import_validation');
      console.log('✅ Cleared temporary import validation data from storage');
    } catch (error) {
      console.error('❌ Error clearing temporary validation data:', error);
    }
    return { success: true };
  },
  /**
   * Search for a user by email in Jira
   * @param {string} email - Email address to search for
   * @returns {Promise<Object>} - User object with account_id
   */
  async getUserByEmail(email) {
    try {
      console.log(`🔍 Searching for user with email: ${email}`);
      
      const response = await api.asApp().requestJira(
        route`/rest/api/3/user/search?query=${email}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response from Jira API: ${errorText}`);
        throw new Error(`Failed to search user: ${response.status}`);
      }
      
      const users = await response.json();
      
      if (users.length === 0) {
        console.warn(`No user found with email: ${email}`);
        return null;
      }
      
      // Find exact email match
      const exactMatch = users.find(u => u.emailAddress?.toLowerCase() === email.toLowerCase());
      if (exactMatch) {
        console.log(`✅ Found exact match for ${email}: ${exactMatch.accountId}`);
        return {
          accountId: exactMatch.accountId,
          displayName: exactMatch.displayName,
          emailAddress: exactMatch.emailAddress,
          avatarUrl: exactMatch.avatarUrls?.['48x48']
        };
      }
      
      // If no exact match, return the first result
      console.log(`✅ Found closest match for ${email}: ${users[0].accountId}`);
      return {
        accountId: users[0].accountId,
        displayName: users[0].displayName,
        emailAddress: users[0].emailAddress,
        avatarUrl: users[0].avatarUrls?.['48x48']
      };
    } catch (error) {
      console.error(`❌ Error searching for user by email ${email}:`, error);
      return null;
    }
  },
  
  /**
   * Get valid leave types
   * @returns {Array<string>} Array of valid leave types
   */
  getValidLeaveTypes() {
    return [
      'vacation',
      'sick',
      'personal',
      'holiday',
      'other leave type'
    ];
  },
  
  /**
   * Validate the import data format and check Jira users
   * @param {Array<Object>} importData - Array of PTO records to validate
   * @param {Boolean} checkJiraUsers - Whether to check if users exist in Jira
   * @param {Boolean} prepareForImport - Whether to fully prepare records for import
   * @returns {Promise<Object>} - Validation result with errors if any
   */
  async validateImportData(importData, checkJiraUsers = false, prepareForImport = false) {
    if (!Array.isArray(importData) || importData.length === 0) {
      return {
        valid: false,
        errors: ['No valid import data provided']
      };
    }
    
    const errors = [];
    const validRecords = [];
    const validLeaveTypes = this.getValidLeaveTypes();
    
    // Cache for users to avoid redundant lookups
    const userCache = {};
    
    for (const [index, record] of importData.entries()) {
      const recordErrors = [];
      const enhancedRecord = { ...record };
      
      // Check required fields
      if (!record.requester_email) {
        recordErrors.push('Missing requester_email');
      }
      
      if (!record.manager_email) {
        recordErrors.push('Missing manager_email');
      }
      
      if (!record.leave_type) {
        recordErrors.push('Missing leave_type');
      } else {
        // Convert leave type to lowercase for case-insensitive comparison
        const normalizedLeaveType = record.leave_type.toLowerCase();
        
        // Check if it's a valid leave type
        if (!validLeaveTypes.includes(normalizedLeaveType)) {
          recordErrors.push(`Invalid leave_type: "${record.leave_type}". Must be one of: ${validLeaveTypes.join(', ')}`);
        } else {
          // Normalize the leave_type to ensure consistent casing
          enhancedRecord.leave_type = normalizedLeaveType;
        }
      }
      
      if (!record.status) {
        recordErrors.push('Missing status');
      } else {
        // Normalize status to lowercase
        enhancedRecord.status = record.status.toLowerCase();
      }
      
      if (!record.date) {
        recordErrors.push('Missing date');
      } else {
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(record.date)) {
          recordErrors.push('Invalid date format. Expected YYYY-MM-DD');
        }
      }
      
      // Add validation for email format
      if (record.requester_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.requester_email)) {
        recordErrors.push('Invalid requester_email format');
      }
      
      if (record.manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.manager_email)) {
        recordErrors.push('Invalid manager_email format');
      }
      
      // Check status values
      if (record.status && !['pending', 'approved', 'declined', 'cancelled'].includes(record.status.toLowerCase())) {
        recordErrors.push('Invalid status. Must be one of: pending, approved, declined, cancelled');
      }
      
      // Check if users exist in Jira if requested
      if (checkJiraUsers && recordErrors.length === 0) {
        try {
          // Check requester
          let requester = userCache[record.requester_email];
          if (!requester) {
            requester = await this.getUserByEmail(record.requester_email);
            if (requester) {
              userCache[record.requester_email] = requester;
            }
          }
          
          if (!requester) {
            recordErrors.push(`Requester not found in Jira with email: ${record.requester_email}`);
          } else {
            // Add requester details to enhanced record
            enhancedRecord.requester_id = requester.accountId;
            enhancedRecord.requester_name = requester.displayName;
          }
          
          // Check manager
          let manager = userCache[record.manager_email];
          if (!manager) {
            manager = await this.getUserByEmail(record.manager_email);
            if (manager) {
              userCache[record.manager_email] = manager;
            }
          }
          
          if (!manager) {
            recordErrors.push(`Manager not found in Jira with email: ${record.manager_email}`);
          } else {
            // Add manager details to enhanced record
            enhancedRecord.manager_id = manager.accountId;
            enhancedRecord.manager_name = manager.displayName;
          }
          
          // Add other enhanced fields
          enhancedRecord.schedule_type = record.schedule_type || 'FULL_DAY';
          enhancedRecord.hours = record.hours || (enhancedRecord.schedule_type === 'HALF_DAY' ? 4 : 8);
          enhancedRecord.created_at = record.created_at || new Date().toISOString();
          enhancedRecord.pto_request_id = record.pto_request_id || `pto-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          enhancedRecord.import_date = new Date().toISOString();
          enhancedRecord.imported = true;
        } catch (error) {
          recordErrors.push(`Error checking Jira users: ${error.message}`);
        }
      }
      
      if (recordErrors.length > 0) {
        errors.push({
          record: index + 1,
          errors: recordErrors,
          data: record
        });
      } else {
        validRecords.push(checkJiraUsers ? enhancedRecord : record);
      }
    }
    
    return {
      valid: errors.length === 0,
      totalRecords: importData.length,
      validRecords,
      invalidRecords: errors.length,
      errors,
      userCache: checkJiraUsers ? userCache : null
    };
  },
  
  /**
   * Process a batch of PTO records
   * @param {Array<Object>} records - Batch of records to process
   * @param {Array<Object>} dailySchedules - Current daily schedules
   * @returns {Promise<Object>} - Result of batch processing
   */
  async processBatch(records, dailySchedules) {
    const importedSchedules = [];
    const errors = [];
    
    for (const [index, record] of records.entries()) {
      try {
        // Generate a unique schedule ID
        const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create a new daily schedule record
        const scheduleRecord = {
          id: scheduleId,
          ...record,
          requester_email: record.requester_email,
          manager_email: record.manager_email
        };
        
        dailySchedules.push(scheduleRecord);
        importedSchedules.push(scheduleRecord);
      } catch (recordError) {
        console.error(`❌ Error importing record:`, recordError);
        errors.push({
          record: index + 1,
          error: recordError.message,
          data: record
        });
      }
    }
    
    return {
      importedSchedules,
      errors
    };
  },
  
  /**
   * Import PTO daily schedules from CSV data
   * @param {Array<Object>} importData - Array of PTO records to import
   * @param {Boolean} skipValidation - Skip validation (use for pre-validated records)
   * @returns {Promise<Object>} - Result of the import operation
   */
  async importPTODailySchedules(importData, skipValidation = false) {
    try {
      console.log(`📥 Importing ${importData.length} PTO daily schedules${skipValidation ? ' (pre-validated)' : ''}`);
      
      // Get valid records - either validate or use as-is if skipValidation is true
      let validRecords;
      
      if (skipValidation) {
        // Use the records as-is (they should already be validated)
        validRecords = importData;
      } else {
        // Validate the import data and check Jira users in one step
        const validation = await this.validateImportData(importData, true);
        if (!validation.valid) {
          return {
            success: false,
            data: validation,
            message: `Invalid import data: ${validation.invalidRecords} records have errors`
          };
        }
        validRecords = validation.validRecords;
      }
      
      const dailySchedules = await storage.get('pto_daily_schedules') || [];
      const importedSchedules = [];
      const errors = [];
      
      // Process in smaller batches to prevent timeouts
      const BATCH_SIZE = 10; // Process 10 records at a time
      
      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        const batch = validRecords.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(validRecords.length/BATCH_SIZE)}`);
        
        const batchResult = await this.processBatch(batch, dailySchedules);
        importedSchedules.push(...batchResult.importedSchedules);
        errors.push(...batchResult.errors);
        
        // Save changes after each batch to avoid data loss in case of timeout
        if (batchResult.importedSchedules.length > 0) {
          await storage.set('pto_daily_schedules', dailySchedules);
          console.log(`Saved batch ${i/BATCH_SIZE + 1} with ${batchResult.importedSchedules.length} records`);
        }
      }
      
      return {
        success: importedSchedules.length > 0,
        data: {
          totalRecords: validation.validRecords.length,
          importedRecords: importedSchedules.length,
          failedRecords: errors.length,
          errors: errors
        },
        message: `Successfully imported ${importedSchedules.length} of ${validation.validRecords.length} PTO daily schedules`
      };
    } catch (error) {
      console.error('❌ Error importing PTO daily schedules:', error);
      return {
        success: false,
        message: error.message || 'Failed to import PTO daily schedules',
        error: error.toString()
      };
    }
  }
};

export default importService; 