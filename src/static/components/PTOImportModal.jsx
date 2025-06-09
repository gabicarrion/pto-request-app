import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

const PTOImportModal = ({ isOpen, onClose, currentUser, showNotification, onImportSuccess }) => {
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setImportFile(null);
      setImportData([]);
      setValidationResult(null);
      return;
    }
    
    setImportFile(file);
    setValidationResult(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvData = e.target.result;
          const rows = csvData.split('\n');
          const headers = rows[0].split(',').map(h => h.trim());
          
          const parsedData = rows.slice(1)
            .filter(row => row && row.trim().length > 0) // Skip empty rows
            .map((row, rowIndex) => {
              try {
                const values = row.split(',').map(v => v ? v.trim().replace(/^"|"$/g, '') : ''); // Remove quotes
                const record = {};
                headers.forEach((header, index) => {
                  record[header] = index < values.length ? values[index] : '';
                });
                return record;
              } catch (error) {
                console.warn(`Error parsing row ${rowIndex + 2}:`, error);
                return null;
              }
            })
            .filter(record => record !== null); // Remove failed parsing attempts
          
          if (parsedData.length === 0) {
            showNotification('No valid data found in CSV file', 'error');
            setImportData([]);
            return;
          }
          
          setImportData(parsedData);
          showNotification(`CSV file loaded with ${parsedData.length} records. Click "Validate Data" to proceed.`);
        } catch (error) {
          console.error('CSV parsing error:', error);
          showNotification('Failed to parse CSV file', 'error');
          setImportData([]);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('File reading error:', error);
      showNotification('Failed to read file', 'error');
      setImportFile(null);
      setImportData([]);
    }
  };

  const validateBatch = async (batchIndex = 0) => {
    try {
      // Use a smaller batch size for Jira user validation
      const BATCH_SIZE = 5; // Reduced batch size for more frequent updates
      
      // Only update UI for first batch if not already initialized
      if (batchIndex === 0 && !validationResult?.data?.initializing) {
        setValidationResult({
          success: true,
          data: {
            isComplete: false,
            currentBatch: 0,
            totalBatches: Math.ceil(importData.length / BATCH_SIZE),
            initializing: true,
            validation: {
              validRecords: [],
              invalidRecords: 0
            }
          },
          message: "Starting validation and preparing data for import..."
        });
        
        // Give UI time to update before starting the first batch
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Validate the current batch and prepare data for import
      const validationResponse = await invoke('validatePTOImportData', { 
        importData: batchIndex === 0 ? importData : [], // Only send full data for first batch
        adminId: currentUser.accountId,
        checkJiraUsers: true,
        prepareForImport: true, // This flag tells the backend to fully prepare records for import
        batchSize: BATCH_SIZE,
        batchIndex
      });
      
      // Update UI with stable timing - don't update too frequently
      const shouldUpdateUI = batchIndex === 0 || 
                            validationResponse.data?.isComplete || 
                            batchIndex % 3 === 0 || 
                            batchIndex === validationResponse.data?.totalBatches - 1;
      
      // Use debounced updates for smoother UI
      if (shouldUpdateUI) {
        // Preserve the initializing state during the first phase
        const preserveInitializing = batchIndex === 0 && validationResult?.data?.initializing;
        
        // Create a copy of the response to avoid reference issues
        const updatedResult = {
          ...validationResponse,
          data: {
            ...validationResponse.data,
            // Preserve initializing flag if we're still in the first phase
            initializing: preserveInitializing ? true : validationResponse.data?.initializing,
            // Add a timestamp for debugging
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Update state with the new result
        setValidationResult(prevState => {
          // If we already have a state and we're in the initial phase, preserve certain values
          if (prevState?.data?.initializing && batchIndex === 0) {
            return {
              ...updatedResult,
              data: {
                ...updatedResult.data,
                initializing: true,
                // Keep the message consistent during initialization
                message: prevState.message || "Basic validation passed. Preparing data for import..."
              }
            };
          }
          return updatedResult;
        });
        
        // Give UI time to render between updates - longer delay for smoother experience
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Check if we need to process more batches
      if (validationResponse.success && !validationResponse.data?.isComplete) {
        // If this is the first batch with actual user validation, mark the transition
        if (batchIndex === 0 && validationResult?.data?.initializing) {
          // Update state to transition from initializing to user validation
          setValidationResult(prevState => ({
            ...prevState,
            data: {
              ...prevState.data,
              initializing: false, // No longer in initializing phase
              currentBatch: 1, // Starting first batch of user validation
              message: "Starting user validation phase..."
            }
          }));
          
          // Give UI time to update before continuing
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // Show progress notification less frequently (every 20 batches)
        if (batchIndex % 20 === 0 || batchIndex === 0 || batchIndex === validationResponse.data.totalBatches - 1) {
          const progress = validationResponse.data.currentBatch / validationResponse.data.totalBatches * 100;
          const validCount = validationResponse.data.validation?.validRecords?.length || 0;
          const invalidCount = validationResponse.data.validation?.invalidRecords || 0;
          
          // Only show notification for significant progress updates
          if (batchIndex === 0 || progress >= 25 || progress >= 50 || progress >= 75 || progress >= 90) {
            showNotification(
              `Validating data: ${Math.round(progress)}% complete. ` +
              `${validCount} valid records ready for import.`
            );
          }
        }
        
        // Process next batch
        if (validationResponse.data.currentBatch < validationResponse.data.totalBatches) {
          // Use a longer delay to prevent UI freezing and allow React to update
          const nextBatchDelay = (batchIndex < 3) ? 600 : 300; // ms between batches
          
          setTimeout(() => {
            validateBatch(validationResponse.data.currentBatch);
          }, nextBatchDelay);
          return;
        }
      } else if (validationResponse.success && validationResponse.data?.isComplete) {
        // When validation is complete, show a summary
        const validCount = validationResponse.data.validation?.validRecords?.length || 0;
        const invalidCount = validationResponse.data.validation?.invalidRecords || 0;
        
        // Final update with complete data - mark the third phase as active
        const finalResult = {
          ...validationResponse,
          data: {
            ...validationResponse.data,
            validationComplete: true
          }
        };
        
        setValidationResult(finalResult);
        
        // Wait a moment before showing the final notification
        await new Promise(resolve => setTimeout(resolve, 500));
        
        showNotification(
          `Validation complete! ${validCount} records are ready for import. ` +
          `${invalidCount > 0 ? `${invalidCount} records have errors.` : 'No errors found.'} ` +
          `Click "Import Data" to proceed.`
        );
        
        // Only now set validating to false since the process is actually complete
        setIsValidating(false);
      }
      
      // Handle errors
      if (!validationResponse.success) {
        // Show more details about validation errors
        const errorCount = validationResponse.data?.validation?.errors?.length || 0;
        const jiraErrors = validationResponse.data?.validation?.errors?.filter(e => 
          e.errors?.some(err => err.includes('not found in Jira'))
        ).length || 0;
        
        let errorMessage = validationResponse.message || 'Validation failed';
        if (jiraErrors > 0) {
          errorMessage += ` (${jiraErrors} users not found in Jira)`;
        }
        
        showNotification(errorMessage, 'error');
        
        // Set validating to false on error
        setIsValidating(false);
      }
    } catch (error) {
      console.error('Validation error:', error);
      
      // Format error message for better user experience
      let errorMessage = 'Failed to validate data';
      
      if (error.toString().includes('network') || error.toString().includes('tunnel')) {
        errorMessage = 'Network error during validation. Please check your connection and try again.';
      } else if (error.toString().includes('timeout')) {
        errorMessage = 'The validation process timed out. Try with a smaller file or try again later.';
      } else {
        errorMessage = 'Validation error: ' + error.toString();
      }
      
      showNotification(errorMessage, 'error');
      
      setValidationResult({
        success: false,
        message: errorMessage,
        error: error.toString()
      });
      
      // Set validating to false on error
      setIsValidating(false);
    }
  };
  
  const handleValidateData = async () => {
    if (!importData || importData.length === 0) {
      showNotification('No data to validate', 'error');
      return;
    }
    
    // Set initial validation state to prevent flickering
    setValidationResult({
      success: true,
      data: {
        isComplete: false,
        currentBatch: 0,
        totalBatches: Math.ceil(importData.length / 5), // Use same batch size as validateBatch
        initializing: true,
        validation: {
          validRecords: [],
          invalidRecords: 0
        }
      },
      message: "Starting validation and preparing data for import..."
    });
    
    setIsValidating(true);
    
    // Give UI time to stabilize before starting the validation process
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Start the validation process with the first batch
    validateBatch(0);
  };

  const handleImportPTOs = async () => {
    if (!validationResult?.success || !validationResult?.data?.validationComplete) {
      showNotification('Please complete validation before importing', 'error');
      return;
    }
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      // Set initial import state for UI feedback
      setImportResult({
        success: true,
        inProgress: true,
        message: "Starting import process...",
        data: {
          importedRecords: 0,
          totalRecords: validationResult.data.validation?.validRecords?.length || 0,
          progress: 0
        }
      });
      
      // Give UI time to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Show notification about the import starting
      showNotification(`Starting import process. This should be fast since data is already prepared.`);
      
      // Update progress indicator to show we're working
      setImportResult(prev => ({
        ...prev,
        data: {
          ...prev.data,
          progress: 10
        }
      }));
      
      // Give UI time to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Use a single import call with the stored validation data
      const response = await invoke('importPTODailySchedules', { 
        adminId: currentUser.accountId,
        useStoredValidation: true // Use the data that was prepared during validation
      });
      
      // Give UI time to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Store the import result with completed status
      setImportResult({
        ...response,
        inProgress: false
      });
      
      if (response.success) {
        // Show a more detailed success message
        const successMessage = response.data?.importedRecords === response.data?.totalRecords
          ? `Successfully imported all ${response.data?.importedRecords} PTO records`
          : `Imported ${response.data?.importedRecords} of ${response.data?.totalRecords} PTO records`;
          
        showNotification(successMessage);
        
        // Call the onImportSuccess callback to refresh data in parent component
        if (onImportSuccess) {
          onImportSuccess();
        }
        
        // Don't close the modal immediately so user can see the results
        if (response.data?.importedRecords === response.data?.totalRecords) {
          // Only auto-close if all records were imported successfully
          setTimeout(() => {
            onClose();
            resetState();
          }, 5000); // Give user 5 seconds to see the success message
        }
      } else {
        showNotification(response.message || 'Failed to import PTO daily schedules', 'error');
        console.error('Import errors:', response.data?.errors);
      }
    } catch (error) {
      console.error('Import error:', error);
      
      // Format the error message to be more user-friendly
      let errorMessage = 'Failed to import data';
      if (error.toString().includes('network') || error.toString().includes('tunnel')) {
        errorMessage = 'Network error during import. Please check your connection and try again.';
      } else {
        errorMessage = 'Import error: ' + error.toString();
      }
      
      showNotification(errorMessage, 'error');
      
      setImportResult({
        success: false,
        inProgress: false,
        message: errorMessage,
        error: error.toString()
      });
    } finally {
      setIsImporting(false);
      
      // Check import status after a short delay to get final counts
      setTimeout(async () => {
        try {
          const statusResponse = await invoke('checkPTOImportStatus', {
            adminId: currentUser.accountId
          });
          
          if (statusResponse.success) {
            console.log('Import status:', statusResponse.data);
          }
        } catch (statusError) {
          console.error('Failed to check import status:', statusError);
        }
      }, 1000);
    }
  };

  const resetState = async () => {
    setImportFile(null);
    setImportData([]);
    setValidationResult(null);
    setImportResult(null);
    setIsValidating(false);
    setIsImporting(false);
    
    // Clear any stored validation data in the backend
    try {
      await invoke('clearImportValidationData');
      console.log('✅ Cleared import validation data');
    } catch (error) {
      console.error('❌ Error clearing validation data:', error);
    }
  };

  // Clear validation state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Import PTO Requests</h3>
          <button className="modal-close" onClick={async () => {
            await resetState();
            onClose();
          }}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="import-pto-content">
            <p>Import PTO daily schedules from a CSV file. The CSV should have the following columns:</p>
            <ul className="csv-columns-list">
              <li><strong>requester_email</strong> - Email address of the employee</li>
              <li><strong>manager_email</strong> - Email address of the manager</li>
              <li><strong>leave_type</strong> - Type of leave (vacation, sick, personal, etc.)</li>
              <li><strong>date</strong> - Date of PTO in YYYY-MM-DD format</li>
              <li><strong>status</strong> - Status of the PTO (approved, pending, declined, cancelled)</li>
              <li>schedule_type - Optional: FULL_DAY or HALF_DAY (defaults to FULL_DAY)</li>
              <li>hours - Optional: Number of hours (defaults to 8 for FULL_DAY, 4 for HALF_DAY)</li>
              <li>created_at - Optional: Creation timestamp (defaults to current time)</li>
            </ul>
            <div className="alert alert-info">
              <p><strong>Note:</strong> The system will automatically look up user account IDs based on email addresses.</p>
              <p>Valid leave types: vacation, sick, personal, holiday, other leave type</p>
            </div>
            
            {/* Step 1: File Selection */}
            <div className="import-step">
              <h4>Step 1: Select CSV File</h4>
              <div className="form-group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="form-control"
                  disabled={isValidating || isImporting}
                />
                {importFile && (
                  <div className="file-info">
                    <p>Selected file: {importFile.name}</p>
                    <p>Records found: {importData.length}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Step 2: Validate Data */}
            <div className="import-step">
              <h4>Step 2: Validate Data</h4>
              <button 
                onClick={handleValidateData}
                className="btn btn-secondary"
                disabled={!importData.length || isValidating || isImporting}
              >
                {isValidating ? 'Validating...' : 'Validate Data'}
              </button>
              
              {isValidating && (
                <div className="validation-progress">
                  {validationResult?.data ? (
                    <>
                      {/* Simplified progress bar with smoother transitions */}
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${Math.round(((validationResult.data?.currentBatch || 0) / (validationResult.data?.totalBatches || 1)) * 100)}%`,
                            transition: 'width 0.8s ease-in-out'
                          }}
                        ></div>
                      </div>
                      
                      {/* Validation phase indicator */}
                      <div className="validation-phase-indicator">
                        <div className={`phase ${validationResult.data.initializing ? 'active' : 'complete'}`}>
                          <div className="phase-dot"></div>
                          <span>Format check</span>
                        </div>
                        <div className={`phase ${validationResult.data.currentBatch > 0 && !validationResult.data.validationComplete ? 'active' : (validationResult.data.currentBatch > 0 ? 'complete' : '')}`}>
                          <div className="phase-dot"></div>
                          <span>User validation</span>
                        </div>
                        <div className={`phase ${validationResult.data.validationComplete ? 'active' : ''}`}>
                          <div className="phase-dot"></div>
                          <span>Ready for import</span>
                        </div>
                      </div>
                      
                      {/* Simplified stats with cleaner layout */}
                      <div className="progress-stats">
                        <div className="progress-status-container">
                          <span className="progress-status">
                            {validationResult.data.initializing && validationResult.data.currentBatch === 0
                              ? "Basic validation passed. Preparing data for import..." 
                              : validationResult.data.currentBatch > 0
                                ? `Validating user data: batch ${validationResult.data.currentBatch} of ${validationResult.data.totalBatches}`
                                : "Starting validation and preparing data for import..."
                            }
                          </span>
                          
                          {/* Progress percentage */}
                          <span className="progress-percentage">
                            {Math.round(((validationResult.data?.currentBatch || 0) / (validationResult.data?.totalBatches || 1)) * 100)}%
                          </span>
                        </div>
                        
                        {/* Always show summary information */}
                        <div className="progress-summary">
                          <div className="summary-row">
                            <span className="summary-label">Total records:</span>
                            <span className="summary-value">
                              {importData.length}
                            </span>
                          </div>
                          
                          <div className="summary-row">
                            <span className="summary-label">Records validated:</span>
                            <span className="summary-value">
                              <span className="valid-count">{validationResult.data.validation?.validRecords?.length || 0} valid</span>
                              <span className="invalid-count">{validationResult.data.validation?.invalidRecords || 0} invalid</span>
                            </span>
                          </div>
                          
                          {validationResult.data.currentBatch > 0 && (
                            <>
                              <div className="summary-row">
                                <span className="summary-label">Jira users found:</span>
                                <span className="summary-value">
                                  {validationResult.data.batchValidation?.userCache ? 
                                    Object.keys(validationResult.data.batchValidation.userCache).length : 0} users
                                </span>
                              </div>
                              
                              <div className="summary-row">
                                <span className="summary-label">Estimated completion:</span>
                                <span className="summary-value">
                                  {Math.round((validationResult.data.totalBatches - validationResult.data.currentBatch) * 2)} seconds
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <div className="progress-message">
                          {validationResult.data.currentBatch > 0 ? 
                            "Preparing data for import. Each record is being enhanced with Jira user information." :
                            validationResult.data.initializing ? 
                              `Basic validation passed. ${importData.length} records have valid format. Preparing data for import...` :
                              "Starting validation and preparing data for import..."}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="validation-initial">
                        <div className="validation-spinner"></div>
                        <div className="initial-validation-message">
                          <h5>Validating Data Format</h5>
                          <p>Checking CSV structure and required fields...</p>
                          <p className="validation-tip">This is the first step before user validation begins</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {validationResult && validationResult.data?.validationComplete && (
                <div className="validation-complete-summary" style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '6px',
                  marginTop: '15px',
                  marginBottom: '15px',
                  border: '1px solid #e9ecef'
                }}>
                  <div className="validation-phase-indicator" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '15px',
                    position: 'relative'
                  }}>
                    {/* Add connector lines */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '16%',
                      right: '16%',
                      height: '2px',
                      backgroundColor: '#4CAF50',
                      zIndex: 1
                    }}></div>
                    
                    <div className="phase complete" style={{
                      flex: '1',
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: 2
                    }}>
                      <div className="phase-dot" style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#4CAF50',
                        borderRadius: '50%',
                        margin: '0 auto 5px',
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 2px #4CAF50'
                      }}></div>
                      <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: 'bold' }}>Format check</span>
                    </div>
                    <div className="phase complete" style={{
                      flex: '1',
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: 2
                    }}>
                      <div className="phase-dot" style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#4CAF50',
                        borderRadius: '50%',
                        margin: '0 auto 5px',
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 2px #4CAF50'
                      }}></div>
                      <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: 'bold' }}>User validation</span>
                    </div>
                    <div className="phase active" style={{
                      flex: '1',
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: 2
                    }}>
                      <div className="phase-dot" style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#2196F3',
                        borderRadius: '50%',
                        margin: '0 auto 5px',
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 2px #2196F3'
                      }}></div>
                      <span style={{ fontSize: '12px', color: '#2196F3', fontWeight: 'bold' }}>Ready for import</span>
                    </div>
                  </div>
                  
                  <div className="progress-summary" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div className="summary-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px'
                    }}>
                      <span className="summary-label" style={{ fontWeight: 'bold' }}>Total records:</span>
                      <span className="summary-value">{importData.length}</span>
                    </div>
                    <div className="summary-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px'
                    }}>
                      <span className="summary-label" style={{ fontWeight: 'bold' }}>Records validated:</span>
                      <span className="summary-value">
                        <span className="valid-count" style={{ color: '#4CAF50', marginRight: '10px' }}>
                          {validationResult.data.validation?.validRecords?.length || 0} valid
                        </span>
                        <span className="invalid-count" style={{ color: '#f44336' }}>
                          {validationResult.data.validation?.invalidRecords || 0} invalid
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {validationResult && (
                <div className={`validation-result ${validationResult.success ? 'success' : 'error'}`}>
                  <div className="validation-header">
                    {validationResult.success ? (
                      <CheckCircle size={20} className="success-icon" />
                    ) : (
                      <AlertTriangle size={20} className="error-icon" />
                    )}
                    <span>{validationResult.message}</span>
                  </div>
                  
                  {validationResult.data?.validation && (
                    <div className="validation-details">
                      <p>Total records: {validationResult.data.validation.totalRecords}</p>
                      <p>Valid records: {validationResult.data.validation.validRecords?.length || 0}</p>
                      <p>Invalid records: {validationResult.data.validation.invalidRecords || 0}</p>
                      
                      {validationResult.data.validation.errors?.length > 0 && (
                        <div className="validation-errors">
                          <h5>Errors:</h5>
                          <div className="error-table-container">
                            <table className="error-table">
                              <thead>
                                <tr>
                                  <th>Record #</th>
                                  <th>Error</th>
                                  <th>Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {validationResult.data.validation.errors.slice(0, 10).map((error, index) => (
                                  <tr key={index} className="error-row">
                                    <td>{error.record}</td>
                                    <td className="error-message">
                                      {error.errors.join(', ')}
                                    </td>
                                    <td>
                                      {error.data && (
                                        <div className="error-data">
                                          {error.data.requester_email && <div>Requester: {error.data.requester_email}</div>}
                                          {error.data.manager_email && <div>Manager: {error.data.manager_email}</div>}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {validationResult.data.validation.errors.length > 10 && (
                              <div className="more-errors">...and {validationResult.data.validation.errors.length - 10} more errors</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {validationResult.data?.userCheckResults && (
                    <div className="user-check-results">
                      <h5>User Check Results:</h5>
                      <ul>
                        {validationResult.data.userCheckResults.map((result, index) => (
                          <li key={index}>
                            <strong>Record {result.record}:</strong> 
                            Requester: {result.requester.found ? '✓' : '✗'} 
                            {result.requester.found ? ` (${result.requester.details.displayName})` : ` (${result.requester.email})`}, 
                            Manager: {result.manager.found ? '✓' : '✗'}
                            {result.manager.found ? ` (${result.manager.details.displayName})` : ` (${result.manager.email})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Step 3: Import Data */}
            <div className="import-step">
              <h4>Step 3: Import Data</h4>
              <button 
                onClick={handleImportPTOs}
                className="btn btn-primary"
                disabled={!validationResult?.success || isImporting}
              >
                {isImporting ? 'IMPORTING...' : 'Import Data'}
              </button>
              
              {/* Import Progress Display */}
              {isImporting && importResult?.inProgress && (
                <div className="import-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${Math.round(((importResult?.recordsProcessed || 0) / (importResult?.totalRecords || 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="progress-stats">
                    <span>Processing batch {importResult?.batchNumber || 1} of {importResult?.totalBatches || 1}</span>
                    <span>{importResult?.recordsProcessed || 0} of {importResult?.totalRecords || 0} records processed</span>
                    <span>{importResult?.importedRecords || 0} imported, {importResult?.failedRecords || 0} failed</span>
                  </div>
                </div>
              )}
              
              {/* Import Results Display */}
              {importResult && !importResult.inProgress && (
                <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
                  <div className="import-result-header">
                    {importResult.success ? (
                      <CheckCircle size={20} className="success-icon" />
                    ) : (
                      <AlertTriangle size={20} className="error-icon" />
                    )}
                    <span>{importResult.message}</span>
                  </div>
                  
                  {importResult.data && (
                    <div className="import-result-details">
                      <div className="import-stats">
                        <div className="stat-item">
                          <span className="stat-label">Total Records:</span>
                          <span className="stat-value">{importResult?.data?.totalRecords || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Imported:</span>
                          <span className="stat-value success">{importResult?.data?.importedRecords || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Failed:</span>
                          <span className="stat-value error">{importResult?.data?.failedRecords || 0}</span>
                        </div>
                      </div>
                      
                      {importResult.data.errors && importResult.data.errors.length > 0 && (
                        <div className="import-errors">
                          <h5>Failed Records:</h5>
                          <div className="error-table-container">
                            <table className="error-table">
                              <thead>
                                <tr>
                                  <th>Record #</th>
                                  <th>Error</th>
                                  <th>Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {importResult.data.errors.slice(0, 10).map((error, index) => (
                                  <tr key={index} className="error-row">
                                    <td>{error.record}</td>
                                    <td className="error-message">
                                      {error.batch ? `Batch ${error.batch}: ${error.error}` : 
                                       error.error || (error.errors && error.errors.join(', '))}
                                    </td>
                                    <td>
                                      {error.data && (
                                        <div className="error-data">
                                          {error.data.requester_email && <div>Requester: {error.data.requester_email}</div>}
                                          {error.data.manager_email && <div>Manager: {error.data.manager_email}</div>}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {importResult.data.errors.length > 10 && (
                              <div className="more-errors">...and {importResult.data.errors.length - 10} more errors</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {importResult.success && importResult.data?.importedRecords > 0 && (
                    <div className="import-success-message">
                      <p>✅ PTO records have been successfully imported.</p>
                      <p>The modal will close automatically in a few seconds, or you can close it manually.</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="form-actions">
                <button 
                  onClick={() => {
                    onClose();
                    resetState();
                  }}
                  className="btn btn-secondary"
                  disabled={isImporting}
                >
                  {importResult && importResult.success ? 'Close' : 'Cancel'}
                </button>
                <button 
                  onClick={handleImportPTOs}
                  className="btn btn-primary"
                  disabled={!validationResult || !validationResult.success || isImporting || (importResult && importResult.success)}
                >
                  {isImporting ? (
                    <>
                      <span className="spinner"></span>
                      Importing...
                    </>
                  ) : importResult && importResult.success ? 'Imported Successfully' : 'Import Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTOImportModal;