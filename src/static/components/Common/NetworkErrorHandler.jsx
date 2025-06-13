import React from 'react';
import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

const NetworkErrorHandler = ({ 
  error, 
  onRetry, 
  onTestConnectivity,
  loading = false,
  retryCount = 0 
}) => {
  const [testing, setTesting] = useState(false);
  const [connectivityResult, setConnectivityResult] = useState(null);

  const handleTestConnectivity = async () => {
    setTesting(true);
    setConnectivityResult(null);
    
    try {
      const result = await onTestConnectivity();
      setConnectivityResult(result);
    } catch (err) {
      setConnectivityResult({
        success: false,
        message: 'Test failed: ' + err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const isNetworkError = error && (
    error.includes('timeout') ||
    error.includes('fetch failed') ||
    error.includes('Connection timeout') ||
    error.includes('network')
  );

  if (!error) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* Error Icon */}
        <div className="text-center mb-6">
          {isNetworkError ? (
            <WifiOff size={64} className="text-red-500 mx-auto mb-4" />
          ) : (
            <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
          )}
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isNetworkError ? 'Connection Problem' : 'Authentication Error'}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          
          {retryCount > 0 && (
            <p className="text-sm text-yellow-600 mb-4">
              Attempted {retryCount} automatic retries
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button 
            onClick={onRetry}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={20} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Retrying...' : 'Try Again'}
          </button>
          
          {isNetworkError && (
            <button 
              onClick={handleTestConnectivity}
              disabled={testing}
              className="w-full flex items-center justify-center px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Wifi size={20} className={`mr-2 ${testing ? 'animate-pulse' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Refresh Page
          </button>
        </div>

        {/* Connectivity Test Result */}
        {connectivityResult && (
          <div className={`mt-4 p-3 rounded-lg ${
            connectivityResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              {connectivityResult.success ? (
                <Wifi size={16} className="text-green-600 mr-2" />
              ) : (
                <WifiOff size={16} className="text-red-600 mr-2" />
              )}
              <span className={`text-sm ${
                connectivityResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {connectivityResult.message}
              </span>
            </div>
            
            {connectivityResult.success && connectivityResult.data && (
              <div className="mt-2 text-xs text-green-600">
                Server: {connectivityResult.data.serverTitle} ({connectivityResult.data.version})
              </div>
            )}
          </div>
        )}

        {/* Troubleshooting Tips */}
        {isNetworkError && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">Troubleshooting Tips:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Check your internet connection</li>
              <li>• Try refreshing the page</li>
              <li>• Check if Jira is accessible in another tab</li>
              <li>• Contact your system administrator if the problem persists</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkErrorHandler;