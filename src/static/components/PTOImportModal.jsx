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
    console.log('🔍 DEBUG: File selected:', file);
    
    if (!file) {
      console.log('🔍 DEBUG: No file selected, resetting state');
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
          console.log('🔍 DEBUG: CSV data type:', typeof csvData);
          console.log('🔍 DEBUG: CSV data length:', csvData ? csvData.length : 'undefined');
          
          if (!csvData) {
            throw new Error('No data read from file');
          }
          
          const rows = csvData.split('\n');
          console.log('🔍 DEBUG: Rows after split:', rows);
          console.log('🔍 DEBUG: Rows length:', rows ? rows.length : 'undefined');
          
          if (!rows || rows.length === 0) {
            throw new Error('No rows found in CSV');
          }
          
          const headers = rows[0] ? rows[0].split(',').map(h => h ? h.trim() : '') : [];
          console.log('🔍 DEBUG: Headers:', headers);
          console.log('🔍 DEBUG: Headers length:', headers ? headers.length : 'undefined');
          
          if (!headers || headers.length === 0) {
            throw new Error('No headers found in CSV');
          }
          
          let parsedData = [];
          
          if (rows.length > 1) {
            const dataRows = rows.slice(1);
            console.log('🔍 DEBUG: Data rows:', dataRows);
            console.log('🔍 DEBUG: Data rows length:', dataRows ? dataRows.length : 'undefined');
            
            for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
              const row = dataRows[rowIndex];
              console.log(`🔍 DEBUG: Processing row ${rowIndex}:`, row);
              
              if (!row || row.trim().length === 0) {
                console.log(`🔍 DEBUG: Skipping empty row ${rowIndex}`);
                continue;
              }
              
              try {
                const values = row.split(',').map(v => v ? v.trim().replace(/^"|"$/g, '') : '');
                console.log(`🔍 DEBUG: Values for row ${rowIndex}:`, values);
                
                const record = {};
                headers.forEach((header, index) => {
                  record[header] = index < values.length ? values[index] : '';
                });
                
                console.log(`🔍 DEBUG: Record for row ${rowIndex}:`, record);
                parsedData.push(record);
              } catch (rowError) {
                console.warn(`🔍 DEBUG: Error parsing row ${rowIndex + 2}:`, rowError);
              }
            }
          }
          
          console.log('🔍 DEBUG: Final parsed data:', parsedData);
          console.log('🔍 DEBUG: Final parsed data length:', parsedData ? parsedData.length : 'undefined');
          
          if (!parsedData || parsedData.length === 0) {
            showNotification('No valid data found in CSV file', 'error');
            setImportData([]);
            return;
          }
          
          setImportData(parsedData);
          showNotification(`CSV file loaded with ${parsedData.length} records. Click "Validate Data" to proceed.`);
        } catch (error) {
          console.error('🔍 DEBUG: CSV parsing error:', error);
          showNotification('Failed to parse CSV file: ' + error.message, 'error');
          setImportData([]);
        }
      };
      
      reader.onerror = (error) => {
        console.error('🔍 DEBUG: FileReader error:', error);
        showNotification('Failed to read file', 'error');
        setImportFile(null);
        setImportData([]);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('🔍 DEBUG: File reading error:', error);
      showNotification('Failed to read file: ' + error.message, 'error');
      setImportFile(null);
      setImportData([]);
    }
  };

  const validateBatch = async (batchIndex = 0) => {
    try {
      console.log(`🔍 Frontend: Starting validation batch ${batchIndex}`);
      
      // For first batch, send the import data
      const requestPayload = {
        adminId: currentUser.accountId,
        checkJiraUsers: true,
        prepareForImport: true,
        batchSize: 5,
        batchIndex: batchIndex
      };
  
      // Only send importData on the first batch
      if (batchIndex === 0) {
        if (!importData || !Array.isArray(importData) || importData.length === 0) {
          showNotification('No valid data to validate', 'error');
          setIsValidating(false);
          return;
        }
        requestPayload.importData = importData;
      }
  
      console.log(`🔍 Frontend: Sending request for batch ${batchIndex}`);
      
      const validationResponse = await invoke('validatePTOImportData', requestPayload);
      
      console.log(`🔍 Frontend: Received response for batch ${batchIndex}:`, {
        success: validationResponse.success,
        isComplete: validationResponse.data?.isComplete,
        currentBatch: validationResponse.data?.currentBatch,
        totalBatches: validationResponse.data?.totalBatches
      });
  
      // Update UI with current progress
      setValidationResult(validationResponse);
  
      // Handle response
      if (!validationResponse.success) {
        console.error('❌ Frontend: Validation failed:', validationResponse.message);
        showNotification(validationResponse.message || 'Validation failed', 'error');
        setIsValidating(false);
        return;
      }
  
      // Check if validation is complete
      if (validationResponse.data?.isComplete || validationResponse.data?.validationComplete) {
        console.log('✅ Frontend: Validation complete!');
        const validCount = validationResponse.data.validation?.validRecords?.length || 0;
        const invalidCount = validationResponse.data.validation?.invalidRecords || 0;
        
        showNotification(
          `Validation complete! ${validCount} records ready for import. ${invalidCount} records have errors.`
        );
        setIsValidating(false);
        return;
      }
  
      // If not complete, continue with next batch
      if (validationResponse.data?.currentBatch < validationResponse.data?.totalBatches) {
        const nextBatch = validationResponse.data.currentBatch;
        console.log(`🔄 Frontend: Moving to next batch ${nextBatch}`);
        
        // Small delay before next batch
        setTimeout(() => {
          validateBatch(nextBatch);
        }, 500);
      } else {
        console.log('✅ Frontend: All batches processed');
        setIsValidating(false);
      }
  
    } catch (error) {
      console.error('❌ Frontend: Validation error:', error);
      showNotification('Validation error: ' + error.message, 'error');
      setIsValidating(false);
    }
  };
  
  const handleValidateData = async () => {
    if (!importData || !Array.isArray(importData) || importData.length === 0) {
      showNotification('No data to validate', 'error');
      return;
    }
    
    console.log('🔍 Starting database validation process...');
    setIsValidating(true);
    
    // Set initial state
    setValidationResult({
      success: true,
      data: {
        isComplete: false,
        validationInProgress: true
      },
      message: "Validating data format and looking up users in database..."
    });
    
    try {
      // Single validation call using YOUR user database
      const response = await invoke('validatePTOImportData', {
        importData: importData,
        adminId: currentUser.accountId,
        checkJiraUsers: true, // This now means "check user database"
        batchIndex: 0,
        batchSize: 50
      });
      
      setValidationResult(response);
      setIsValidating(false);
      
      if (response.success && response.data?.validationComplete) {
        const validCount = response.data.validation?.validRecords?.length || 0;
        const invalidCount = response.data.validation?.invalidRecords || 0;
        
        showNotification(
          `Database validation complete! ${validCount} records ready for import. ${invalidCount > 0 ? `${invalidCount} records have errors.` : ''}`
        );
      } else {
        showNotification(response.message || 'Validation failed', 'error');
      }
      
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        success: false,
        message: 'Validation failed: ' + error.message
      });
      setIsValidating(false);
      showNotification('Validation failed: ' + error.message, 'error');
    }
  };

  const handleImportPTOs = async () => {
    if (!validationResult?.success || !validationResult?.data?.validationComplete) {
      showNotification('Please complete validation before importing', 'error');
      return;
    }
    
    setIsImporting(true);
    setImportResult({
      success: true,
      inProgress: true,
      message: "Starting import process...",
      data: { importedRecords: 0, totalRecords: validationResult.data.validation?.validRecords?.length || 0 }
    });
    
    try {
      showNotification('Starting import process...');
      
      // Use streamlined import with stored validation
      const response = await invoke('importPTODailySchedules', { 
        adminId: currentUser.accountId,
        useStoredValidation: true
      });
      
      setImportResult({
        ...response,
        inProgress: false
      });
      
      if (response.success) {
        const successMessage = `Successfully imported ${response.data?.importedRecords || 0} PTO records`;
        showNotification(successMessage);
        
        if (onImportSuccess) {
          onImportSuccess();
        }
        
        // Auto-close on full success
        if (response.data?.importedRecords === response.data?.totalRecords) {
          setTimeout(() => {
            onClose();
            resetState();
          }, 3000);
        }
      } else {
        showNotification(response.message || 'Import failed', 'error');
      }
      
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = 'Import failed: ' + error.message;
      showNotification(errorMessage, 'error');
      setImportResult({
        success: false,
        inProgress: false,
        message: errorMessage
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = async () => {
    setImportFile(null);
    setImportData([]);
    setValidationResult(null);
    setImportResult(null);
    setIsValidating(false);
    setIsImporting(false);
    
    // Clear any stored validation data in the backend with proper adminId
    try {
      if (currentUser && currentUser.accountId) {
        const response = await invoke('clearImportValidationData', {
          adminId: currentUser.accountId // Ensure this is passed as string
        });
        console.log('✅ Backend validation data cleared:', response);
      } else {
        console.warn('⚠️ No current user available for cleanup');
        // Try to clear without adminId
        await invoke('clearImportValidationData', {});
      }
    } catch (error) {
      console.error('❌ Error clearing validation data:', error);
      // Don't fail the reset process if cleanup fails
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
            try {
              // Only cleanup if there was actual validation data
              if (validationResult && validationResult.success && currentUser?.accountId) {
                console.log('🧹 Cleaning up validation data from modal close');
                await invoke('clearImportValidationData', {
                  adminId: currentUser.accountId
                });
              }
            } catch (error) {
              console.error('❌ Error clearing data on close:', error);
            }
            
            onClose();
            await resetState();
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
              <p><strong>Note:</strong> The system will look up user account IDs from your existing user database based on email addresses.</p>
              <p>Valid leave types: vacation, sick, personal, holiday, other leave type</p>
              <p><strong>Make sure the email addresses in your CSV match the emails in your user database!</strong></p>
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
                    <p>Records found: {importData && Array.isArray(importData) ? importData.length : 0}</p>
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
                disabled={!importData || !Array.isArray(importData) || importData.length === 0 || isValidating || isImporting}
              >
                {isValidating ? 'Validating...' : 'Validate Data'}
              </button>
              
              {isValidating && (
                <div className="validation-progress">
                  <div className="validation-spinner-container">
                    <div className="validation-spinner"></div>
                    <div className="validation-message">
                      <h5>Validating Import Data</h5>
                      <p>Checking format and user database...</p>
                      <div className="validation-stats">
                        <span>📄 {importData.length} records to process</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {validationResult && !isValidating && (
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
                    <div className="validation-summary">
                      <div className="summary-grid">
                        <div className="summary-item">
                          <span className="summary-label">Total:</span>
                          <span className="summary-value">{validationResult.data.validation.totalRecords}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Ready:</span>
                          <span className="summary-value success">{validationResult.data.validation.validRecords?.length || 0}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Errors:</span>
                          <span className="summary-value error">{validationResult.data.validation.invalidRecords || 0}</span>
                        </div>
                      </div>
                      
                      {validationResult.data.validation.errors?.length > 0 && (
                        <div className="validation-errors">
                          <h5>Issues Found ({validationResult.data.validation.errors.length}):</h5>
                          <div className="error-list">
                            {validationResult.data.validation.errors.slice(0, 5).map((error, index) => (
                              <div key={index} className="error-item">
                                <span className="error-record">Row {error.record}:</span>
                                <span className="error-message">{error.errors.join(', ')}</span>
                                {error.data?.requester_email && (
                                  <span className="error-email">({error.data.requester_email})</span>
                                )}
                              </div>
                            ))}
                            {validationResult.data.validation.errors.length > 5 && (
                              <div className="error-more">
                                +{validationResult.data.validation.errors.length - 5} more errors
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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