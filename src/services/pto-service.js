// src/services/pto-service.js
import dbService from '../database/db-service';

/**
 * Service to handle PTO request operations
 */
class PTOService {
  constructor() {
    this.dbService = dbService;
    this.ptoCollection = 'pto_requests';
    this.dailyScheduleCollection = 'pto_daily_schedules';
  }

  /**
   * Create a new PTO request
   * @param {object} requestData - PTO request data
   * @returns {Promise<object>} - Created PTO request
   */
  async createPTORequest(requestData) {
    // Generate a unique ID for the PTO request
    const pto_request_id = this.dbService.generateUUID();
    
    // Add submission timestamp
    requestData.submitted_at = new Date().toISOString();
    requestData.pto_request_id = pto_request_id;
    requestData.status = 'pending';
    
    // Create the PTO request record
    const ptoRequest = await this.dbService.create(this.ptoCollection, requestData);
    
    // Create individual daily schedule records
    if (Array.isArray(requestData.daily_schedules)) {
      const dailySchedulePromises = requestData.daily_schedules.map(schedule => {
        const dailyScheduleData = {
          daily_schedule_id: this.dbService.generateUUID(),
          pto_request_id: pto_request_id,
          date: schedule.date,
          schedule_type: schedule.schedule_type,
          leave_type: requestData.leave_type,
          hours: schedule.schedule_type === 'FULL_DAY' ? 8 : 4,
          requester_id: requestData.requester_id,
          requester_name: requestData.requester_name,
          requester_email: requestData.requester_email,
          manager_id: requestData.manager_id,
          manager_name: requestData.manager_name,
          manager_email: requestData.manager_email,
          executive_manager_id: requestData.executive_manager_id,
          executive_manager_name: requestData.executive_manager_name,
          executive_manager_email: requestData.executive_manager_email
        };
        
        return this.dbService.create(this.dailyScheduleCollection, dailyScheduleData);
      });
      
      await Promise.all(dailySchedulePromises);
    }
    
    // Update user's PTO balance
    await this.dbService.updateUserPTOBalances(requestData.requester_id);
    
    return ptoRequest;
  }

  /**
   * Get PTO requests for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - User's PTO requests
   */
  async getUserPTORequests(userId) {
    return this.dbService.query(this.ptoCollection, item => item.requester_id === userId);
  }

  /**
   * Get PTO requests for approval by a manager
   * @param {string} managerId - Manager ID
   * @returns {Promise<Array>} - PTO requests for approval
   */
  async getManagerPendingApprovals(managerId) {
    return this.dbService.query(
      this.ptoCollection, 
      item => (item.manager_id === managerId || item.executive_manager_id === managerId) && 
              item.status === 'pending'
    );
  }

  /**
   * Approve a PTO request
   * @param {string} requestId - PTO request ID
   * @param {string} approverId - Approver ID
   * @returns {Promise<object>} - Updated PTO request
   */
  async approvePTORequest(requestId, approverId) {
    const requestData = {
      status: 'approved',
      reviewed_at: new Date().toISOString()
    };
    
    const updatedRequest = await this.dbService.update(this.ptoCollection, requestId, requestData);
    
    // Update user's PTO balance
    await this.dbService.updateUserPTOBalances(updatedRequest.requester_id);
    
    return updatedRequest;
  }

  /**
   * Decline a PTO request
   * @param {string} requestId - PTO request ID
   * @param {string} declinerId - Decliner ID
   * @param {string} reason - Decline reason
   * @returns {Promise<object>} - Updated PTO request
   */
  async declinePTORequest(requestId, declinerId, reason) {
    const requestData = {
      status: 'declined',
      reviewed_at: new Date().toISOString(),
      reviewer_reason: reason
    };
    
    return await this.dbService.update(this.ptoCollection, requestId, requestData);
  }

  /**
   * Get daily PTO schedules for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Daily PTO schedules
   */
  async getDailySchedules(startDate, endDate) {
    const start = new Date(startDate).toISOString().split('T')[0];
    const end = new Date(endDate).toISOString().split('T')[0];
    
    return this.dbService.query(
      this.dailyScheduleCollection,
      item => item.date >= start && item.date <= end
    );
  }
}

// Export a singleton instance
const ptoService = new PTOService();
export default ptoService;