import { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';

const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Fetching current user...');
        const response = await invoke('getCurrentUser');
        
        if (response.success) {
          console.log('👤 User data received:', response.data);
          
          // Check if user has admin privileges
          const adminStatus = await checkAdminStatus(response.data.accountId);
          console.log('🛡️ Admin status check result:', adminStatus);
          
          const userData = {
            ...response.data,
            isAdmin: adminStatus
          };
          
          console.log('✅ Final user data:', userData);
          setCurrentUser(userData);
          console.log('✅ Current user loaded:', userData.displayName, 'isAdmin:', userData.isAdmin);
        } else {
          throw new Error(response.message || 'Failed to fetch current user');
        }
      } catch (err) {
        console.error('❌ Error fetching current user:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // Check if user has admin privileges
  const checkAdminStatus = async (accountId) => {
    try {
      console.log('🔍 Checking admin status for account:', accountId);
      const response = await invoke('checkUserAdminStatus', { accountId });
      console.log('🛡️ Admin check response:', response);
      
      if (response.success) {
        console.log('✅ Admin status result:', response.data.isAdmin);
        return response.data.isAdmin;
      } else {
        console.warn('⚠️ Admin check failed:', response.message);
        return false;
      }
    } catch (error) {
      console.warn('❌ Could not check admin status:', error);
      return false;
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    setLoading(true);
    try {
      const response = await invoke('getCurrentUser');
      if (response.success) {
        const adminStatus = await checkAdminStatus(response.data.accountId);
        const userData = {
          ...response.data,
          isAdmin: adminStatus
        };
        setCurrentUser(userData);
        console.log('🔄 User refreshed:', userData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    currentUser,
    loading,
    error,
    refreshUser,
    isAdmin: currentUser?.isAdmin || false
  };
};

export default useCurrentUser;