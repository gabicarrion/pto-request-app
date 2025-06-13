import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@forge/bridge';

const usePTORequests = (currentUser) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch PTO requests
  const fetchRequests = useCallback(async (filters = {}) => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📋 Fetching PTO requests with filters:', filters);
      const response = await invoke('getPTORequests', filters);
      
      if (response.success) {
        setRequests(response.data || []);
        console.log(`✅ Loaded ${response.data?.length || 0} PTO requests`);
      } else {
        throw new Error(response.message || 'Failed to fetch PTO requests');
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching PTO requests:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Submit new PTO request
  const submitRequest = useCallback(async (requestData) => {
    setLoading(true);
    setError(null);

    try {
      console.log('📝 Submitting PTO request:', requestData);
      const response = await invoke('storePTORequest', requestData);
      
      if (response.success) {
        // Refresh requests to get the updated list
        await fetchRequests();
        return { success: true, data: response.data };
      } else {
        throw new Error(response.message || 'Failed to submit PTO request');
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ Error submitting PTO request:', err);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, [fetchRequests]);

  // Update PTO request status (for approvals)
  const updateRequestStatus = useCallback(async (requestId, status, comments = '') => {
    setLoading(true);
    setError(null);

    try {
      console.log(`✅ Updating PTO request ${requestId} to ${status}`);
      const response = await invoke('updatePTORequest', { 
        requestId, 
        status, 
        comment: comments 
      });
      
      if (response.success) {
        // Update local state to reflect the change
        setRequests(prev => prev.map(request =>
          request.id === requestId
            ? { 
                ...request, 
                status, 
                reviewer_comments: comments,
                reviewed_at: new Date().toISOString()
              }
            : request
        ));
        return { success: true };
      } else {
        throw new Error(response.message || 'Failed to update PTO request');
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ Error updating PTO request:', err);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel PTO request (remove from system)
  const cancelRequest = useCallback(async (requestId) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🗑️ Cancelling PTO request ${requestId}`);
      
      // Since you don't have a specific cancel endpoint, we can update status to 'cancelled'
      // or remove it entirely. For now, let's update the status
      const response = await invoke('updatePTORequest', { 
        requestId, 
        status: 'cancelled', 
        comment: 'Cancelled by user' 
      });
      
      if (response.success) {
        // Remove from local state
        setRequests(prev => prev.filter(request => request.id !== requestId));
        return { success: true };
      } else {
        throw new Error(response.message || 'Failed to cancel PTO request');
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ Error cancelling PTO request:', err);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get requests by user
  const getUserRequests = useCallback((userId) => {
    return requests.filter(request => request.requester_id === userId);
  }, [requests]);

  // Get pending requests (for managers)
  const getPendingRequests = useCallback(() => {
    return requests.filter(request => request.status === 'pending');
  }, [requests]);

  // Get requests by status
  const getRequestsByStatus = useCallback((status) => {
    return requests.filter(request => request.status === status);
  }, [requests]);

  // Get requests by date range
  const getRequestsByDateRange = useCallback((startDate, endDate) => {
    return requests.filter(request => {
      const requestStart = new Date(request.start_date);
      const requestEnd = new Date(request.end_date);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      
      return (requestStart >= rangeStart && requestStart <= rangeEnd) ||
             (requestEnd >= rangeStart && requestEnd <= rangeEnd) ||
             (requestStart <= rangeStart && requestEnd >= rangeEnd);
    });
  }, [requests]);

  // Get pending requests for current user as manager
  const getPendingRequestsForManager = useCallback(async () => {
    if (!currentUser?.emailAddress) return [];
    
    try {
      console.log('📋 Fetching pending requests for manager:', currentUser.emailAddress);
      const response = await invoke('getPendingRequests', { 
        managerEmail: currentUser.emailAddress 
      });
      
      if (response.success) {
        return response.data || [];
      } else {
        console.error('Failed to fetch pending requests:', response.message);
        return [];
      }
    } catch (err) {
      console.error('❌ Error fetching pending requests for manager:', err);
      return [];
    }
  }, [currentUser]);

  // Initialize data when user is available
  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser, fetchRequests]);

  return {
    requests,
    loading,
    error,
    fetchRequests,
    submitRequest,
    updateRequestStatus,
    cancelRequest,
    getUserRequests,
    getPendingRequests,
    getRequestsByStatus,
    getRequestsByDateRange,
    getPendingRequestsForManager
  };
};

export default usePTORequests;