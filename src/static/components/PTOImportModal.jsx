import React, { useState, useEffect } from 'react';
import { Upload, Download, CheckCircle, XCircle, AlertTriangle, User, Calendar, X, FileText } from 'lucide-react';
import { invoke } from '@forge/bridge';

const PTOImportModal = ({ isOpen, onClose, currentUser, allUsers, allTeams, showNotification }) => {
  const [step, setStep] = useState('upload'); // 'upload', 'validate', 'review', 'import'
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [validatedData, setValidatedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [importResults, setImportResults] = useState(null);

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.csv')) {
      showNotification('Please upload a CSV file', 'error');
      return;
    }

    setFile(uploadedFile);
    setLoading(true);

    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = { rowNumber: index + 2 }; // +2 because we start from row 2 (after header)
        
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        
        return row;
      });

      setCsvData(data);
      setStep('validate');
      showNotification(`Loaded ${data.length} records from CSV`);
    } catch (error) {
      showNotification(`Error reading CSV: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateData = async () => {
    if (csvData.length === 0) return;

    setLoading(true);
    setProgress(0);
    setValidationResults([]);
    setValidatedData([]);

    const results = [];
    const validated = [];
    let valid = 0;
    let invalid = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const result = {
        rowNumber: row.rowNumber,
        original: row,
        validated: null,
        errors: [],
        warnings: [],
        status: 'pending'
      };

      try {
        // Validate required fields
        const requiredFields = ['employee_email', 'start_date', 'end_date', 'leave_type'];
        const missingFields = requiredFields.filter(field => !row[field]);
        
        if (missingFields.length > 0) {
          result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate dates
        const startDate = new Date(row.start_date);
        const endDate = new Date(row.end_date);
        
        if (isNaN(startDate.getTime())) {
          result.errors.push('Invalid start_date format');
        }
        
        if (isNaN(endDate.getTime())) {
          result.errors.push('Invalid end_date format');
        }
        
        if (startDate > endDate) {
          result.errors.push('Start date cannot be after end date');
        }

        // Validate leave type
        const validLeaveTypes = ['vacation', 'sick', 'personal', 'holiday'];
        if (!validLeaveTypes.includes(row.leave_type?.toLowerCase())) {
          result.errors.push(`Invalid leave_type. Must be one of: ${validLeaveTypes.join(', ')}`);
        }

        // Find user by email
        let targetUser = null;
        if (row.employee_email) {
          // First check in system users
          targetUser = allUsers.find(user => 
            user.email_address?.toLowerCase() === row.employee_email.toLowerCase() ||
            user.emailAddress?.toLowerCase() === row.employee_email.toLowerCase()
          );

          // If not found in system, try to get from Jira
          if (!targetUser) {
            try {
              const jiraResponse = await invoke('getJiraUsers', { 
                query: row.employee_email 
              });
              
              if (jiraResponse.success && jiraResponse.data.length > 0) {
                const jiraUser = jiraResponse.data.find(u => 
                  u.emailAddress?.toLowerCase() === row.employee_email.toLowerCase()
                );
                
                if (jiraUser) {
                  targetUser = jiraUser;
                  result.warnings.push('User found in Jira but not in PTO system');
                }
              }
            } catch (error) {
              console.warn('Error searching Jira user:', error);
            }
          }
        }

        if (!targetUser) {
          result.errors.push(`User not found: ${row.employee_email}`);
        }

        // Find manager
        let manager = null;
        if (targetUser) {
          // Try to find manager from user's team
          const userInSystem = allUsers.find(u => 
            u.email_address?.toLowerCase() === row.employee_email.toLowerCase()
          );
          
          if (userInSystem?.team_id) {
            const userTeam = allTeams.find(team => team.id === userInSystem.team_id);
            if (userTeam?.manager) {
              manager = userTeam.manager;
            }
          }

          // If no manager found, use provided manager_email or default
          if (!manager && row.manager_email) {
            manager = allUsers.find(user => 
              user.email_address?.toLowerCase() === row.manager_email.toLowerCase()
            );
            
            if (!manager) {
              result.warnings.push(`Manager not found: ${row.manager_email}. Will use system default.`);
            }
          }
        }

        // Calculate total days (simple business days calculation)
        let totalDays = 1;
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
          totalDays = daysDiff;
        }

        // Create validated record if no errors
        if (result.errors.length === 0) {
          result.validated = {
            requester_id: targetUser.accountId || targetUser.jira_account_id,
            requester_name: targetUser.displayName || targetUser.display_name,
            requester_email: targetUser.emailAddress || targetUser.email_address,
            requester_avatar: targetUser.avatarUrl || targetUser.avatar_url,
            manager_id: manager?.accountId || manager?.jira_account_id || 'admin',
            manager_name: manager?.displayName || manager?.display_name || 'System Admin',
            manager_email: manager?.emailAddress || manager?.email_address || 'admin@system.com',
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            leave_type: row.leave_type.toLowerCase(),
            reason: row.reason || 'Imported from CSV',
            total_days: totalDays,
            total_hours: totalDays * 8,
            status: 'approved', // Admin import defaults to approved
            daily_schedules: [],
            import_source: 'csv_import',
            imported_by: currentUser.accountId
          };
          
          result.status = 'valid';
          valid++;
          validated.push(result.validated);
        } else {
          result.status = 'invalid';
          invalid++;
        }

      } catch (error) {
        result.errors.push(`Validation error: ${error.message}`);
        result.status = 'invalid';
        invalid++;
      }

      results.push(result);
      setProgress(Math.round(((i + 1) / csvData.length) * 100));
      setValidCount(valid);
      setInvalidCount(invalid);
      
      // Update state periodically for UI feedback
      if (i % 10 === 0 || i === csvData.length - 1) {
        setValidationResults([...results]);
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for UI updates
      }
    }

    setValidationResults(results);
    setValidatedData(validated);
    setLoading(false);
    setStep('review');
    
    showNotification(
      `Validation complete: ${valid} valid, ${invalid} invalid records`,
      valid > 0 ? 'success' : 'error'
    );
  };

  const handleImport = async () => {
    if (validatedData.length === 0) {
      showNotification('No valid records to import', 'error');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStep('import');

    const results = {
      total: validatedData.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < validatedData.length; i++) {
      const record = validatedData[i];
      
      try {
        const response = await invoke('submitPTOForUser', {
          requestData: record,
          submittedBy: currentUser.accountId
        });

        if (response.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(`Row ${i + 1}: ${response.message}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${error.message}`);
      }

      setProgress(Math.round(((i + 1) / validatedData.length) * 100));
      
      // Update UI periodically
      if (i % 5 === 0 || i === validatedData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    setImportResults(results);
    setLoading(false);
    
    showNotification(
      `Import complete: ${results.successful} successful, ${results.failed} failed`,
      results.successful > 0 ? 'success' : 'error'
    );
  };

  const downloadTemplate = () => {
    const template = [
      'employee_email,start_date,end_date,leave_type,reason,manager_email',
      'john.doe@company.com,2025-01-15,2025-01-19,vacation,Family vacation,manager@company.com',
      'jane.smith@company.com,2025-02-10,2025-02-10,sick,Medical appointment,manager@company.com'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pto_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setStep('upload');
    setFile(null);
    setCsvData([]);
    setValidationResults([]);
    setValidatedData([]);
    setProgress(0);
    setValidCount(0);
    setInvalidCount(0);
    setImportResults(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px', width: '95vw' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            <Upload size={22} />
            Import PTO Records
          </h3>
          <button onClick={handleClose} className="modal-close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Progress Indicator */}
          <div className="import-progress-steps">
            <div className={`progress-step ${step === 'upload' ? 'active' : step !== 'upload' ? 'completed' : ''}`}>
              <div className="step-number">1</div>
              <span>Upload CSV</span>
            </div>
            <div className={`progress-step ${step === 'validate' ? 'active' : ['review', 'import'].includes(step) ? 'completed' : ''}`}>
              <div className="step-number">2</div>
              <span>Validate Data</span>
            </div>
            <div className={`progress-step ${step === 'review' ? 'active' : step === 'import' ? 'completed' : ''}`}>
              <div className="step-number">3</div>
              <span>Review Results</span>
            </div>
            <div className={`progress-step ${step === 'import' ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <span>Import</span>
            </div>
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="import-step">
              <div className="upload-section">
                <div className="upload-instructions">
                  <h4>Upload PTO Records CSV</h4>
                  <p>Upload a CSV file containing PTO records to import. Make sure your CSV includes the required columns.</p>
                  
                  <div className="required-columns">
                    <h5>Required Columns:</h5>
                    <ul>
                      <li><code>employee_email</code> - Employee's email address</li>
                      <li><code>start_date</code> - Start date (YYYY-MM-DD format)</li>
                      <li><code>end_date</code> - End date (YYYY-MM-DD format)</li>
                      <li><code>leave_type</code> - Type of leave (vacation, sick, personal, holiday)</li>
                    </ul>
                    
                    <h5>Optional Columns:</h5>
                    <ul>
                      <li><code>reason</code> - Reason for PTO</li>
                      <li><code>manager_email</code> - Manager's email (if different from team manager)</li>
                    </ul>
                  </div>

                  <button onClick={downloadTemplate} className="btn btn-secondary">
                    <Download size={16} />
                    Download Template
                  </button>
                </div>

                <div className="file-upload-area">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={loading}
                    style={{ display: 'none' }}
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className={`upload-dropzone ${loading ? 'disabled' : ''}`}>
                    <FileText size={48} />
                    <h4>Choose CSV File</h4>
                    <p>Click to select a CSV file to upload</p>
                    {file && <div className="selected-file">Selected: {file.name}</div>}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Validate */}
          {step === 'validate' && (
            <div className="import-step">
              <div className="validation-section">
                <h4>Validating Data...</h4>
                <p>Checking {csvData.length} records for validity and matching with system users.</p>
                
                <div className="validation-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">{progress}% complete</div>
                </div>

                <div className="validation-stats">
                  <div className="stat-item stat-success">
                    <CheckCircle size={20} />
                    <span>{validCount} Valid</span>
                  </div>
                  <div className="stat-item stat-error">
                    <XCircle size={20} />
                    <span>{invalidCount} Invalid</span>
                  </div>
                </div>

                <button 
                  onClick={validateData} 
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Validating...' : 'Start Validation'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="import-step">
              <div className="review-section">
                <h4>Validation Results</h4>
                <p>Review the validation results before importing.</p>

                <div className="validation-summary">
                  <div className="summary-stats">
                    <div className="summary-stat stat-success">
                      <CheckCircle size={24} />
                      <div>
                        <div className="stat-number">{validCount}</div>
                        <div className="stat-label">Valid Records</div>
                      </div>
                    </div>
                    <div className="summary-stat stat-error">
                      <XCircle size={24} />
                      <div>
                        <div className="stat-number">{invalidCount}</div>
                        <div className="stat-label">Invalid Records</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="validation-results-list">
                  {validationResults.slice(0, 10).map((result, index) => (
                    <div key={index} className={`validation-result ${result.status}`}>
                      <div className="result-header">
                        <div className="result-status">
                          {result.status === 'valid' ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <XCircle size={16} className="text-red-600" />
                          )}
                          <span>Row {result.rowNumber}</span>
                        </div>
                        <div className="result-user">
                          {result.original.employee_email}
                        </div>
                      </div>
                      
                      {result.errors.length > 0 && (
                        <div className="result-errors">
                          {result.errors.map((error, i) => (
                            <div key={i} className="error-item">
                              <XCircle size={12} />
                              {error}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {result.warnings.length > 0 && (
                        <div className="result-warnings">
                          {result.warnings.map((warning, i) => (
                            <div key={i} className="warning-item">
                              <AlertTriangle size={12} />
                              {warning}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {validationResults.length > 10 && (
                    <div className="results-more">
                      Showing 10 of {validationResults.length} results...
                    </div>
                  )}
                </div>

                <div className="review-actions">
                  <button 
                    onClick={() => setStep('validate')} 
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Back to Validation
                  </button>
                  <button 
                    onClick={handleImport}
                    disabled={loading || validCount === 0}
                    className="btn btn-primary"
                  >
                    Import {validCount} Valid Records
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Import */}
          {step === 'import' && (
            <div className="import-step">
              <div className="import-section">
                <h4>Importing Records...</h4>
                <p>Creating PTO requests in the system.</p>
                
                <div className="import-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">{progress}% complete</div>
                </div>

                {importResults && (
                  <div className="import-results">
                    <div className="import-summary">
                      <div className="summary-stat stat-success">
                        <CheckCircle size={24} />
                        <div>
                          <div className="stat-number">{importResults.successful}</div>
                          <div className="stat-label">Imported Successfully</div>
                        </div>
                      </div>
                      <div className="summary-stat stat-error">
                        <XCircle size={24} />
                        <div>
                          <div className="stat-number">{importResults.failed}</div>
                          <div className="stat-label">Failed to Import</div>
                        </div>
                      </div>
                    </div>

                    {importResults.errors.length > 0 && (
                      <div className="import-errors">
                        <h5>Import Errors:</h5>
                        <div className="error-list">
                          {importResults.errors.slice(0, 5).map((error, index) => (
                            <div key={index} className="error-item">
                              <XCircle size={12} />
                              {error}
                            </div>
                          ))}
                          {importResults.errors.length > 5 && (
                            <div className="error-item">
                              And {importResults.errors.length - 5} more errors...
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="import-actions">
                      <button onClick={handleClose} className="btn btn-primary">
                        Done
                      </button>
                      <button onClick={resetModal} className="btn btn-secondary">
                        Import Another File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .import-progress-steps {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 8px;
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          position: relative;
        }

        .progress-step:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 15px;
          right: -50%;
          width: 100%;
          height: 2px;
          background: #e5e7eb;
          z-index: 1;
        }

        .progress-step.completed:not(:last-child)::after {
          background: #22c55e;
        }

        .step-number {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #e5e7eb;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          z-index: 2;
          position: relative;
        }

        .progress-step.active .step-number {
          background: #3b82f6;
          color: white;
        }

        .progress-step.completed .step-number {
          background: #22c55e;
          color: white;
        }

        .progress-step span {
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
        }

        .progress-step.active span {
          color: #3b82f6;
        }

        .progress-step.completed span {
          color: #22c55e;
        }

        .import-step {
          min-height: 400px;
        }

        .upload-instructions {
          margin-bottom: 2rem;
        }

        .required-columns {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
        }

        .required-columns h5 {
          margin: 0 0 0.5rem 0;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .required-columns ul {
          margin: 0 0 1rem 0;
          padding-left: 1rem;
        }

        .required-columns li {
          margin-bottom: 0.25rem;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .required-columns code {
          background: #e5e7eb;
          padding: 0.125rem 0.25rem;
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.8rem;
        }

        .file-upload-area {
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
        }

        .upload-dropzone {
          display: block;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upload-dropzone:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }

        .upload-dropzone.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .upload-dropzone h4 {
          margin: 1rem 0 0.5rem 0;
          color: #374151;
        }

        .upload-dropzone p {
          margin: 0;
          color: #6b7280;
        }

        .selected-file {
          margin-top: 1rem;
          padding: 0.5rem;
          background: #dcfce7;
          border-radius: 4px;
          color: #166534;
          font-weight: 500;
        }

        .validation-progress, .import-progress {
          margin: 2rem 0;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }

        .progress-text {
          text-align: center;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .validation-stats {
          display: flex;
          gap: 2rem;
          margin: 1rem 0;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .stat-item.stat-success {
          color: #22c55e;
        }

        .stat-item.stat-error {
          color: #ef4444;
        }

        .validation-summary, .import-summary {
          margin-bottom: 2rem;
        }

        .summary-stats {
          display: flex;
          gap: 2rem;
          justify-content: center;
        }

        .summary-stat {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 2rem;
          border-radius: 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .summary-stat.stat-success {
          background: #dcfce7;
          border-color: #22c55e;
          color: #166534;
        }

        .summary-stat.stat-error {
          background: #fee2e2;
          border-color: #ef4444;
          color: #b91c1c;
        }

        .stat-number {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .stat-label {
          font-size: 0.875rem;
        }

        .validation-results-list {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .validation-result {
          padding: 1rem;
          border-bottom: 1px solid #f3f4f6;
        }

        .validation-result:last-child {
          border-bottom: none;
        }

        .validation-result.valid {
          background: #f0fdf4;
          border-left: 4px solid #22c55e;
        }

        .validation-result.invalid {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .result-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .result-user {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .result-errors, .result-warnings {
          margin-top: 0.5rem;
        }

        .error-item, .warning-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .error-item {
          color: #ef4444;
        }

        .warning-item {
          color: #f59e0b;
        }

        .results-more {
          text-align: center;
          padding: 1rem;
          color: #6b7280;
          font-style: italic;
        }

        .review-actions, .import-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .import-errors {
          margin-top: 1rem;
          padding: 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
        }

        .import-errors h5 {
          margin: 0 0 0.5rem 0;
          color: #b91c1c;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .error-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        @media (max-width: 768px) {
          .import-progress-steps {
            flex-direction: column;
            gap: 1rem;
          }

          .progress-step:not(:last-child)::after {
            display: none;
          }

          .summary-stats {
            flex-direction: column;
            gap: 1rem;
          }

          .review-actions, .import-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default PTOImportModal;