import { PTODatabase } from './pto-db';
import { invoke } from '@forge/bridge';

export class PTOService {
  constructor() {
    this.db = new PTODatabase();
  }

  // Submit new PTO request
  async submitPTORequest(requestData) {
    try {
      // Validate request data
      this.validatePTORequest(requestData);
      
      // Calculate total days and hours
      const { totalDays, totalHours } = this.calculatePTOTotals(requestData.dailySchedules);
      
      // Create main PTO request
      const ptoRequest = await this.db.create('pto_requests', {
        requester_id: requestData.reporter.accountId,
        requester_name: requestData.reporter.displayName,
        requester_email: requestData.reporter.emailAddress,
        manager_id: requestData.manager.accountId,
        manager_name: requestData.manager.displayName,
        manager_email: requestData.manager.emailAddress,
        start_date: requestData.startDate,
        end_date: requestData.endDate,
        leave_type: requestData.leaveType,
        reason: requestData.reason,
        status: 'pending',
        total_days: totalDays,
        total_hours: totalHours,
        submitted_at: new Date().toISOString()
      });

      // Create daily schedule records
      if (requestData.dailySchedules && requestData.dailySchedules.length > 0) {
        for (const schedule of requestData.dailySchedules) {
          await this.db.create('pto_daily_schedules', {
            pto_request_id: ptoRequest.id,
            date: schedule.date,
            schedule_type: schedule.type,
            hours: this.getHoursForScheduleType(schedule.type)
          });
        }
      }

      // Send notification to manager
      await this.notifyManager(ptoRequest);
      

      return {
        success: true,
        data: ptoRequest,
        message: 'PTO request submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting PTO request:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get PTO requests with filters
  async getPTORequests(filters = {}) {
    try {
      const requests = await this.db.findAll('pto_requests', filters);
      
      // Enrich with daily schedules
      for (const request of requests) {
        request.dailySchedules = await this.db.findByField('pto_daily_schedules', 'pto_request_id', request.id);
      }
      
      return {
        success: true,
        data: requests
      };
    } catch (error) {
      console.error('Error getting PTO requests:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Approve/Decline PTO request
  async updatePTORequestStatus(requestId, status) {
    try {
      const request = await this.db.findById('pto_requests', requestId);
      if (!request) {
        throw new Error('PTO request not found');
      }

      const updatedRequest = await this.db.update('pto_requests', requestId, {
        status: status.toLowerCase(),
        reviewed_at: new Date().toISOString()
      });

      // Notify requester
      await this.notifyRequester(updatedRequest);
      
      // If approved, integrate with resource management
      if (status.toLowerCase() === 'approved') {
        await this.integrateWithResourceManagement(updatedRequest);
      }

      return {
        success: true,
        data: updatedRequest,
        message: `PTO request ${status.toLowerCase()} successfully`
      };
    } catch (error) {
      console.error('Error updating PTO request:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Integration with Resource Management App
  async integrateWithResourceManagement(ptoRequest) {
    try {
      // This will communicate with your resource management app
      // to automatically adjust availability
      
      const integrationData = {
        userId: ptoRequest.requester_id,
        startDate: ptoRequest.start_date,
        endDate: ptoRequest.end_date,
        dailySchedules: await this.db.findByField('pto_daily_schedules', 'pto_request_id', ptoRequest.id),
        ptoRequestId: ptoRequest.id,
        type: 'pto_approved'
      };

      // Call the resource management app's integration endpoint
      await invoke('integrateResourceAvailability', integrationData);
      
      console.log('✅ PTO integrated with resource management', integrationData);
    } catch (error) {
      console.error('❌ Failed to integrate with resource management:', error);
      // Don't fail the approval if integration fails
    }
  }

  // Helper methods
  validatePTORequest(data) {
    if (!data.reporter || !data.manager) {
      throw new Error('Reporter and manager are required');
    }
    if (!data.startDate || !data.endDate) {
      throw new Error('Start and end dates are required');
    }
    if (!data.leaveType) {
      throw new Error('Leave type is required');
    }
    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new Error('Start date cannot be after end date');
    }
  }

  calculatePTOTotals(dailySchedules) {
    if (!dailySchedules || dailySchedules.length === 0) {
      return { totalDays: 0, totalHours: 0 };
    }

    const totalHours = dailySchedules.reduce((sum, schedule) => {
      return sum + this.getHoursForScheduleType(schedule.type);
    }, 0);

    const totalDays = dailySchedules.reduce((sum, schedule) => {
      return sum + (schedule.type === 'FULL_DAY' ? 1 : 0.5);
    }, 0);

    return { totalDays, totalHours };
  }

  getHoursForScheduleType(type) {
    const scheduleHours = {
      'FULL_DAY': 8,
      'HALF_DAY_MORNING': 4,
      'HALF_DAY_AFTERNOON': 4
    };
    return scheduleHours[type] || 8;
  }

  async notifyManager(ptoRequest) {
    // Implementation for manager notification
    console.log(`📧 Notifying manager: ${ptoRequest.manager_name} about PTO request from ${ptoRequest.requester_name}`);
  }

  async notifyRequester(ptoRequest) {
    // Implementation for requester notification  
    console.log(`📧 Notifying requester: ${ptoRequest.requester_name} about PTO request ${ptoRequest.status}`);
  }


  getDefaultAllocation(leaveType) {
    const defaults = {
      'vacation': 20,
      'sick': 10,
      'personal': 5,
      'holiday': 0
    };
    return defaults[leaveType.toLowerCase()] || 0;
  }

  // Add import/export helpers to PTOService
  async exportDatabase() {
    const tables = Object.keys(this.db.tables || PTO_SCHEMA);
    const exportData = {};
    for (const table of tables) {
      exportData[table] = await this.db.findAll(table);
    }
    return exportData;
  }

  async importDatabase({ table, data }) {
    if (!table || !Array.isArray(data)) throw new Error('Table and data array required');
    await this.db.overwriteTable(table, data);
    return true;
  }



  async updatePTOUsedDays(userId, leave_type, year, used_days) {
    const all = await this.db.findAll('pto_balances');
    const idx = all.findIndex(b => b.user_id === userId && b.leave_type === leave_type && b.year === year);
    if (idx !== -1) {
      all[idx].used_days = used_days;
      all[idx].remaining_days = all[idx].allocated_days - used_days;
      await this.db.overwriteTable('pto_balances', all);
      return true;
    }
    return false;
  }
}

export default new PTOService();