// src/services/import-service.js
import { storage } from '@forge/api';
import api, { route } from '@forge/api';

// Service for handling PTO imports with chunked storage support
export const importService = {
  // Store for validated data ready for import
  validatedData: null,
  
  /**
   * Store large data by splitting into chunks
   * @param {string} baseKey - Base storage key
   * @param {Object} data - Data to store
   * @param {number} maxChunkSize - Max characters per chunk (default 200KB)
   * @returns {Promise<Object>} - Storage result
   */
  async storeChunkedData(baseKey, data, maxChunkSize = 200000) {
    try {
      const dataString = JSON.stringify(data);
      const totalSize = dataString.length;
      
      console.log(`📦 Storing chunked data: ${totalSize} characters, max chunk: ${maxChunkSize}`);
      
      if (totalSize <= maxChunkSize) {
        // Small enough to store in one piece
        await storage.set(baseKey, data);
        console.log(`✅ Stored in single chunk: ${baseKey}`);
        return { success: true, chunks: 1, totalSize };
      }
      
      // Split into chunks
      const chunks = [];
      for (let i = 0; i < dataString.length; i += maxChunkSize) {
        chunks.push(dataString.slice(i, i + maxChunkSize));
      }
      
      console.log(`📦 Splitting into ${chunks.length} chunks`);
      
      // Store chunk metadata
      const metadata = {
        totalChunks: chunks.length,
        totalSize,
        timestamp: new Date().toISOString(),
        chunked: true
      };
      await storage.set(`${baseKey}_meta`, metadata);
      
      // Store each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${baseKey}_chunk_${i}`;
        await storage.set(chunkKey, chunks[i]);
        console.log(`✅ Stored chunk ${i + 1}/${chunks.length}: ${chunks[i].length} chars`);
      }
      
      return { success: true, chunks: chunks.length, totalSize };
      
    } catch (error) {
      console.error('❌ Error storing chunked data:', error);
      throw error;
    }
  },

  /**
   * Retrieve chunked data and reassemble
   * @param {string} baseKey - Base storage key
   * @returns {Promise<Object>} - Reassembled data
   */
  async getChunkedData(baseKey) {
    try {
      // Try to get metadata first
      const metadata = await storage.get(`${baseKey}_meta`);
      
      if (!metadata || !metadata.chunked) {
        // Not chunked, try direct retrieval
        const data = await storage.get(baseKey);
        return data;
      }
      
      console.log(`📦 Retrieving ${metadata.totalChunks} chunks for ${baseKey}`);
      
      // Retrieve all chunks
      const chunks = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${baseKey}_chunk_${i}`;
        const chunk = await storage.get(chunkKey);
        if (chunk === null || chunk === undefined) {
          throw new Error(`Missing chunk ${i} for ${baseKey}`);
        }
        chunks.push(chunk);
      }
      
      // Reassemble data
      const dataString = chunks.join('');
      const data = JSON.parse(dataString);
      
      console.log(`✅ Reassembled ${chunks.length} chunks: ${dataString.length} chars`);
      return data;
      
    } catch (error) {
      console.error('❌ Error retrieving chunked data:', error);
      throw error;
    }
  },

  /**
   * Delete chunked data and all its chunks
   * @param {string} baseKey - Base storage key
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteChunkedData(baseKey) {
    try {
      let deletedCount = 0;
      
      // Try to get metadata to see if it's chunked
      const metadata = await storage.get(`${baseKey}_meta`);
      
      if (metadata && metadata.chunked) {
        console.log(`🗑️ Deleting ${metadata.totalChunks} chunks for ${baseKey}`);
        
        // Delete all chunks
        for (let i = 0; i < metadata.totalChunks; i++) {
          const chunkKey = `${baseKey}_chunk_${i}`;
          try {
            await storage.delete(chunkKey);
            deletedCount++;
          } catch (error) {
            console.warn(`⚠️ Could not delete chunk ${chunkKey}:`, error.message);
          }
        }
        
        // Delete metadata
        try {
          await storage.delete(`${baseKey}_meta`);
          deletedCount++;
        } catch (error) {
          console.warn(`⚠️ Could not delete metadata ${baseKey}_meta:`, error.message);
        }
      }
      
      // Try to delete base key (for non-chunked or cleanup)
      try {
        await storage.delete(baseKey);
        deletedCount++;
      } catch (error) {
        console.warn(`⚠️ Could not delete base key ${baseKey}:`, error.message);
      }
      
      console.log(`✅ Deleted ${deletedCount} storage keys for ${baseKey}`);
      return { success: true, deletedCount };
      
    } catch (error) {
      console.error('❌ Error deleting chunked data:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clear any stored validation data - CHUNKED VERSION
   */
  async clearValidationData() {
    console.log('🧹 Clearing stored validation data (including chunks)');
    this.validatedData = null;
    
    // Keys that might be chunked
    const chunkedKeys = [
      'temp_import_validation',
      'temp_import_data',
      'temp_validation_data',
      'import_validation_cache'
    ];
    
    // Simple keys to delete directly
    const simpleKeys = [
      'temp_import_status',
      'validation_progress',
      'import_progress'
    ];
    
    let totalDeleted = 0;
    const errors = [];
    
    // Clean chunked data
    for (const key of chunkedKeys) {
      try {
        const result = await this.deleteChunkedData(key);
        totalDeleted += result.deletedCount || 0;
      } catch (error) {
        console.warn(`⚠️ Issue clearing chunked data ${key}:`, error.message);
        errors.push(`${key}: ${error.message}`);
      }
    }
    
    // Clean simple keys
    for (const key of simpleKeys) {
      try {
        await storage.delete(key);
        totalDeleted++;
        console.log(`✅ Cleared simple key: ${key}`);
      } catch (error) {
        if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
          console.warn(`⚠️ Issue clearing ${key}:`, error.message);
          errors.push(`${key}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Cleared ${totalDeleted} storage entries total`);
    
    return { 
      success: true, 
      deletedCount: totalDeleted, 
      errors: errors.length > 0 ? errors : undefined 
    };
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
    
    const validRecords = [];
    const validLeaveTypes = this.getValidLeaveTypes();
    const errors = [];
    // Cache for users to avoid redundant lookups
    const userCache = {};
    
    // Validate input data
    if (!Array.isArray(importData) || importData.length === 0) {
      return {
        valid: false,
        totalRecords: 0,
        validRecords: [],
        invalidRecords: 0,
        errors: ['No valid import data provided']
      };
    }
    
    // Ensure importData is a valid array
    if (!importData || !Array.isArray(importData)) {
      return {
        valid: false,
        totalRecords: 0,
        validRecords: [],
        invalidRecords: 0,
        errors: ['Import data must be an array']
      };
    }

    for (const [index, record] of importData.entries()) {
      const recordErrors = [];
      const enhancedRecord = record ? { ...record } : {};
      
      // Check if record exists and is an object
      if (!record || typeof record !== 'object') {
        errors.push({
          record: index + 1,
          errors: ['Invalid record format'],
          data: record
        });
        continue;
      }

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
      
      // Check if users exist in your database if requested
      if (checkJiraUsers && recordErrors.length === 0) {
        try {
          // Get users from your database instead of Jira API
          const users = await storage.get('users') || [];
          
          // Create email lookup map for faster searching - IMPROVED VERSION
          const emailToUserMap = {};
          users.forEach(user => {
            // Get all possible email fields and normalize them
            const emails = [
              user.email_address,
              user.emailAddress, 
              user.email
            ].filter(Boolean); // Remove undefined/null values
            
            emails.forEach(email => {
              const normalizedEmail = email.toLowerCase().trim();
              if (normalizedEmail && normalizedEmail.includes('@')) {
                emailToUserMap[normalizedEmail] = {
                  accountId: user.jira_account_id || user.accountId || user.id,
                  displayName: user.display_name || user.displayName || user.name,
                  emailAddress: user.email_address || user.emailAddress || user.email,
                  originalUser: user // Keep reference to original user for debugging
                };
              }
            });
          });
          
          console.log(`🔍 Database lookup: Found ${users.length} users in database`);
          console.log(`📧 Email lookup map has ${Object.keys(emailToUserMap).length} entries`);
          
          // DEBUG: Log first few entries to see what emails we have
          const sampleEmails = Object.keys(emailToUserMap).slice(0, 5);
          console.log(`📧 Sample emails in lookup:`, sampleEmails);
          
          // Check requester in your database
          const requesterEmail = record.requester_email.toLowerCase().trim();
          const requester = emailToUserMap[requesterEmail];
          
          if (!requester) {
            // DEBUG: Show available emails that are similar
            const similarEmails = Object.keys(emailToUserMap).filter(email => 
              email.includes(requesterEmail.split('@')[0]) || 
              requesterEmail.includes(email.split('@')[0])
            );
            
            recordErrors.push(`Requester not found in user database: ${record.requester_email}${similarEmails.length > 0 ? ` (Similar: ${similarEmails.join(', ')})` : ''}`);
          } else {
            // Add requester details to enhanced record
            enhancedRecord.requester_id = requester.accountId;
            enhancedRecord.requester_name = requester.displayName;
            enhancedRecord.requester_email = requester.emailAddress;
            console.log(`✅ Found requester: ${requester.displayName} (${requester.emailAddress})`);
          }
          
          // Check manager in your database
          const managerEmail = record.manager_email.toLowerCase().trim();
          const manager = emailToUserMap[managerEmail];
          
          if (!manager) {
            // DEBUG: Show available emails that are similar
            const similarEmails = Object.keys(emailToUserMap).filter(email => 
              email.includes(managerEmail.split('@')[0]) || 
              managerEmail.includes(email.split('@')[0])
            );
            
            recordErrors.push(`Manager not found in user database: ${record.manager_email}${similarEmails.length > 0 ? ` (Similar: ${similarEmails.join(', ')})` : ''}`);
          } else {
            // Add manager details to enhanced record
            enhancedRecord.manager_id = manager.accountId;
            enhancedRecord.manager_name = manager.displayName;
            enhancedRecord.manager_email = manager.emailAddress;
            console.log(`✅ Found manager: ${manager.displayName} (${manager.emailAddress})`);
          }
          
          // Add other enhanced fields
          enhancedRecord.schedule_type = record.schedule_type || 'FULL_DAY';
          enhancedRecord.hours = record.hours || (enhancedRecord.schedule_type === 'HALF_DAY' ? 4 : 8);
          enhancedRecord.created_at = record.created_at || new Date().toISOString();
          enhancedRecord.pto_request_id = record.pto_request_id || `pto-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          enhancedRecord.import_date = new Date().toISOString();
          enhancedRecord.imported = true;
          
          // Keep original emails for reference
          enhancedRecord.original_requester_email = record.requester_email;
          enhancedRecord.original_manager_email = record.manager_email;
          
        } catch (error) {
          recordErrors.push(`Error checking user database: ${error.message}`);
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
 * Import PTO daily schedules from CSV data - CHUNKED STORAGE VERSION
 * @param {Array<Object>} importData - Array of PTO records to import
 * @param {Boolean} skipValidation - Skip validation (use for pre-validated records)
 * @returns {Promise<Object>} - Result of the import operation
 */
async importPTODailySchedules(importData, skipValidation = false) {
  try {
    console.log(`📥 OPTIMIZED: Importing ${importData.length} PTO daily schedules${skipValidation ? ' (pre-validated)' : ''}`);
    
    // Input validation
    if (!Array.isArray(importData) || importData.length === 0) {
      return {
        success: false,
        message: 'No valid import data provided',
        data: { importedRecords: 0, failedRecords: 0, errors: [] }
      };
    }

    let validRecords = importData;
    
    // Only validate if not already validated
    if (!skipValidation) {
      console.log('🔍 Quick validation of import data...');
      const validation = await this.validateImportData(importData, false);
      if (!validation.valid) {
        return {
          success: false,
          data: validation,
          message: `Validation failed: ${validation.invalidRecords} records have errors`
        };
      }
      validRecords = validation.validRecords;
    }

    // Get existing schedules using chunked retrieval
    console.log('📦 Loading existing daily schedules...');
    let dailySchedules;
    try {
      dailySchedules = await this.getChunkedData('pto_daily_schedules') || [];
    } catch (error) {
      console.warn('⚠️ Could not load existing schedules, starting fresh:', error.message);
      dailySchedules = [];
    }
    
    const importedSchedules = [];
    const errors = [];
    
    // Process in SMALLER batches for better memory management
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(validRecords.length / BATCH_SIZE);
    
    console.log(`📦 Processing ${validRecords.length} records in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, validRecords.length);
      const batch = validRecords.slice(startIdx, endIdx);
      
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
      
      // Save after every few batches using chunked storage to prevent overflow
      if ((batchIndex + 1) % 10 === 0 || batchIndex === totalBatches - 1) {
        try {
          console.log(`💾 Saving progress: ${dailySchedules.length} total schedules...`);
          await this.storeChunkedData('pto_daily_schedules', dailySchedules);
          console.log(`✅ Saved batch progress ${batchIndex + 1}/${totalBatches}`);
        } catch (storageError) {
          console.error(`❌ Storage error at batch ${batchIndex + 1}:`, storageError);
          // If storage fails, we need to stop the process
          throw new Error(`Storage limit exceeded during import. Successfully processed ${importedSchedules.length} records before failure.`);
        }
      }
      
      // Small delay to prevent overwhelming the system
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    const successCount = importedSchedules.length;
    const failureCount = errors.length;
    
    console.log(`🎉 Import complete: ${successCount} imported, ${failureCount} failed`);
    
    return {
      success: successCount > 0,
      data: {
        totalRecords: validRecords.length,
        importedRecords: successCount,
        failedRecords: failureCount,
        errors: errors.slice(0, 20) // Limit error details for performance
      },
      message: `Import complete: ${successCount} records imported successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`
    };
    
  } catch (error) {
    console.error('❌ Critical error in import process:', error);
    return {
      success: false,
      message: `Import failed: ${error.message}`,
      data: { importedRecords: 0, failedRecords: 0, errors: [{ error: error.message }] },
      error: error.toString()
    };
  }
},
/**
 * Get daily schedules with chunked support
 * @returns {Promise<Array>} - Array of daily schedules
 */
async getDailySchedules() {
  try {
    console.log('📦 Loading daily schedules with chunked support...');
    const schedules = await this.getChunkedData('pto_daily_schedules') || [];
    console.log(`✅ Loaded ${schedules.length} daily schedules`);
    return schedules;
  } catch (error) {
    console.warn('⚠️ Could not load daily schedules:', error.message);
    return [];
  }
},

/**
 * Save daily schedules with chunked support
 * @param {Array} schedules - Array of schedules to save
 * @returns {Promise<Object>} - Save result
 */
async saveDailySchedules(schedules) {
  try {
    console.log(`💾 Saving ${schedules.length} daily schedules with chunked support...`);
    const result = await this.storeChunkedData('pto_daily_schedules', schedules);
    console.log(`✅ Saved daily schedules: ${result.chunks} chunks`);
    return { success: true, ...result };
  } catch (error) {
    console.error('❌ Error saving daily schedules:', error);
    throw error;
  }
}
};

export default importService;