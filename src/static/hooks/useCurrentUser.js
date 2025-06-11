import React from 'react';
import { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';

const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async (useRetry = false) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching current user...');
      
      // First try the main method
      let response = await invoke('getCurrentUser');
      
      // If main method fails with network error, try fallback
      if (!response.success && response.error?.type === 'NETWORK_ERROR') {
        console.log('🔄 Main method failed, trying fallback...');
        response = await invoke('getCurrentUserFallback');
      }
      
      if (response.success) {
        console.log('👤 User data received:', response.data);
        
        // Check if user has admin privileges (with error handling)
        let adminStatus = false;
        try {
          const adminResponse = await invoke('checkUserAdminStatus', { 
            accountId: response.data.accountId 
          });
          adminStatus = adminResponse.success ? adminResponse.data.isAdmin : false;
        } catch (adminError) {
          console.warn('⚠️ Could not check admin status:', adminError);
          // Continue without admin status rather than failing completely
        }
        
        const userData = {
          ...response.data,
          isAdmin: adminStatus
        };
        
        console.log('✅ Current user loaded:', userData.displayName, 'isAdmin:', userData.isAdmin);
        setCurrentUser(userData);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error(response.message || 'Failed to fetch current user');
      }
    } catch (err) {
      console.error('❌ Error fetching current user:', err);
      setError(err.message);
      
      // Auto-retry logic for network errors
      if (err.message.includes('timeout') || err.message.includes('fetch failed')) {
        if (retryCount < 3) {
          console.log(`🔄 Auto-retrying in 5 seconds... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            fetchCurrentUser(true);
          }, 5000);
          return; // Don't set loading to false yet
        } else {
          setError('Network connection failed after multiple attempts. Please check your internet connection and refresh the page.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual retry function
  const refreshUser = async () => {
    setRetryCount(0);
    await fetchCurrentUser();
  };

  // Test connectivity function
  const testConnectivity = async () => {
    try {
      const response = await invoke('testConnectivity');
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Connectivity test failed: ' + error.message
      };
    }
  };

  return {
    currentUser,
    loading,
    error,
    refreshUser,
    testConnectivity,
    isAdmin: currentUser?.isAdmin || false,
    retryCount
  };
};

export default useCurrentUser;