// In PTO Request app: src/services/resource-api-service.js
import { storage } from '@forge/api';
import importService from './import-service';
import teamUserService from './team-user-service';

export const resourceApiService = {
  // Get all users with their availability
  async getAllUsers() {
    try {
      const result = await teamUserService.getAllUsers();
      if (!result.success) throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  },
  
  // Get all teams with members
  async getAllTeams() {
    try {
      const result = await teamUserService.getTeams();
      if (!result.success) throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.error('Error getting teams:', error);
      throw error;
    }
  },
  
  // Get user availability including PTO
  async getUserAvailability(userId, date) {
    try {
      const user = await teamUserService.getUserById(userId);
      if (!user.success) throw new Error(user.message);
      
      // Get PTO requests for this user on this date
      const ptoRequests = await importService.getChunkedData('pto_daily_schedules') || [];
      const userPtoForDate = ptoRequests.filter(pto => 
        pto.requester_id === userId && 
        pto.date === date &&
        pto.status !== 'declined'
      );
      
      // Calculate availability reduction based on PTO
      const baseAvailability = user.data.availability.find(a => 
        a.dayOfWeek === new Date(date).getDay() + 1
      ) || { isWorkingDay: false, hoursPerDay: 0 };
      
      const ptoHours = userPtoForDate.reduce((total, pto) => total + pto.hours, 0);
      const availableHours = Math.max(0, baseAvailability.hoursPerDay - ptoHours);
      
      return {
        userId,
        date,
        baseAvailability,
        ptoRequests: userPtoForDate,
        availableHours,
        isPtoDay: ptoHours >= baseAvailability.hoursPerDay
      };
    } catch (error) {
      console.error('Error getting user availability:', error);
      throw error;
    }
  }
};

// Export resolver functions to be exposed to other apps
export default {
  getUsers: async () => await resourceApiService.getAllUsers(),
  getTeams: async () => await resourceApiService.getAllTeams(),
  getUserAvailability: async (userId, date) => await resourceApiService.getUserAvailability(userId, date)
};