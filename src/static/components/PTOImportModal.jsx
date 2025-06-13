import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

// Helper for progress bar
function ProgressBar({ value, max }) {
  return (
    <div className="progress-bar" style={{ width: '100%', background: '#e0e0e0', borderRadius: 6, margin: '10px 0' }}>
      <div
        style={{
          width: `${(value / max) * 100}%`,
          background: '#00b38f',
          height: 16,
          borderRadius: 6,
          transition: 'width 0.2s'
        }}
      />
    </div>
  );
}


const PTOImportModal = ({ isOpen, onClose, showNotification }) => {
  // Step 1: Upload
  const [step, setStep] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [parseError, setParseError] = useState(null);

  // Step 2: Validation
  const [isValidating, setIsValidating] = useState(false);
  const [validationSummary, setValidationSummary] = useState(null);
  const [validationOk, setValidationOk] = useState(false);

  // Step 3: Preparation and import
  const [isPreparing, setIsPreparing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ currentBatch: 0, totalBatches: 1 });
  const [importResult, setImportResult] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setImportFile(null);
      setImportData([]);
      setParseError(null);
      setIsValidating(false);
      setValidationSummary(null);
      setValidationOk(false);
      setIsPreparing(false);
      setIsImporting(false);
      setImportProgress({ currentBatch: 0, totalBatches: 1 });
      setImportResult(null);
      setConfirmReplace(false);
    }
  }, [isOpen]);

  // Step 1: File upload/parse
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setParseError('No file selected.');
      setImportData([]);
      setImportFile(null);
      return;
    }
    setImportFile(file);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const rows = csv.trim().split('\n');
        if (rows.length < 2) throw new Error('File must have a header and at least one data row.');
        const headers = rows[0].split(',').map(h => h.trim());
        const data = rows.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, i) => obj[h] = values[i] ?? '');
            return obj;
          });
        setImportData(data);
        setStep(2);
      } catch (err) {
        setParseError(err.message);
        setImportData([]);
      }
    };
    reader.onerror = () => setParseError('Could not read file.');
    reader.readAsText(file);
  };

  // Step 2: Validation (call backend for summary check)
  const handleValidate = async () => {
    setIsValidating(true);
    setValidationSummary(null);
    setValidationOk(false);
    try {
      const res = await invoke('preValidatePTOImportData', { importData });
      setValidationSummary(res.summary);
      setValidationOk(res.summary.missingRequesters.length === 0
        && res.summary.missingManagers.length === 0
        && res.summary.invalidLeaveTypes.length === 0
        && res.summary.invalidHours.length === 0
        && res.summary.invalidStatuses.length === 0);
      showNotification('Validation complete. Review the details below.');
    } catch (err) {
      setValidationSummary(null);
      showNotification('Validation failed: ' + (err.message || err.toString()), 'error');
    }
    setIsValidating(false);
  };

  // Step 3a: Preparation (enrich and save ready-to-import data in backend)
  const handlePrepare = async () => {
    setIsPreparing(true);
    setImportResult(null);
    try {
      const res = await invoke('preparePTOImportData', { importData });
      console.log('preparePTOImportData response:', res); // <-- Add this
      if (res.success && res.enrichedCount > 0) {
        setStep(3);
        showNotification('Data prepared. Ready for import.');
      } else {
        showNotification(res.message || 'Preparation failed.', 'error');
        // Optionally show res.errors in the modal
      }
    } catch (err) {
      showNotification('Preparation error: ' + (err.message || err.toString()), 'error');
    }
    setIsPreparing(false);
  };
  
  
  

  // Step 3b: Chunked import with progress
  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress({ currentBatch: 0, totalBatches: 1 });
    setImportResult(null);

    try {
      // Start the chunked import; backend will handle batches and progress
      let finished = false;
      let batchIdx = 0;
      let totalBatches = 1;
      let finalResult = null;

      while (!finished) {
        const res = await invoke('importPTODailySchedulesChunked', { batchIndex: batchIdx });
        if (res.progress) {
          // Update progress in UI
          setImportProgress({
            currentBatch: res.progress.currentBatch,
            totalBatches: res.progress.totalBatches
          });
          batchIdx = res.progress.currentBatch;
          totalBatches = res.progress.totalBatches;
        }
        if (res.finished) {
          finalResult = res.result;
          finished = true;
        }
        // Optionally, add delay here to avoid too-rapid polling
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setImportResult(finalResult);
      showNotification(finalResult.message, finalResult.success ? undefined : 'error');
      setIsImporting(false);
      setStep(4); // Done!
    } catch (err) {
      showNotification('Import failed: ' + (err.message || err.toString()), 'error');
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560, margin: 'auto' }}>
        <div className="modal-header">
          <h3>Import PTO Daily Schedules</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {step === 1 && (
            <>
              <h4>Step 1: Upload CSV File</h4>
              <input type="file" accept=".csv" onChange={handleFileSelect} disabled={isValidating || isPreparing || isImporting} />
              {parseError && <div style={{ color: 'red', marginTop: 10 }}>{parseError}</div>}
              {importData.length > 0 &&
                <div style={{ marginTop: 10 }}>
                  <div>Records loaded: <b>{importData.length}</b></div>
                  <button className="btn btn-primary" onClick={handleValidate}>Validate Data</button>
                </div>
              }
            </>
          )}

          {step === 2 && (
            <>
              <h4>Step 2: Validate Data</h4>
              <button className="btn btn-secondary" onClick={handleValidate} disabled={isValidating || isPreparing}>Run Validation</button>
              {isValidating && <div style={{ marginTop: 10 }}><span className="spinner" /> Validating...</div>}
              {validationSummary && (
                <div style={{ marginTop: 16 }}>
                  <div><b>Total records:</b> {validationSummary.totalRecords}</div>
                  <div><b>Unique requesters:</b> {validationSummary.uniqueRequesters} ({validationSummary.missingRequesters.length} missing)</div>
                  {validationSummary.missingRequesters.length > 0 &&
                    <div style={{ color: 'red' }}>Missing requesters: {validationSummary.missingRequesters.join(', ')}</div>}
                  <div><b>Unique managers:</b> {validationSummary.uniqueManagers} ({validationSummary.missingManagers.length} missing)</div>
                  {validationSummary.missingManagers.length > 0 &&
                    <div style={{ color: 'red' }}>Missing managers: {validationSummary.missingManagers.join(', ')}</div>}
                  {validationSummary.invalidLeaveTypes.length > 0 &&
                    <div style={{ color: 'red' }}>Invalid leave types: {validationSummary.invalidLeaveTypes.map(e => `row ${e.row}: ${e.value}`).join(', ')}</div>}
                  {validationSummary.invalidHours.length > 0 &&
                    <div style={{ color: 'red' }}>Invalid hours: {validationSummary.invalidHours.map(e => `row ${e.row}: ${e.value}`).join(', ')}</div>}
                  {validationSummary.invalidStatuses.length > 0 &&
                    <div style={{ color: 'red' }}>Invalid statuses: {validationSummary.invalidStatuses.map(e => `row ${e.row}: ${e.value}`).join(', ')}</div>}
                  {validationSummary.invalidDates.length > 0 &&
                    <div style={{ color: 'red' }}>Invalid dates: {validationSummary.invalidDates.map(e => `row ${e.row}: ${e.value}`).join(', ')}</div>}
                  {validationSummary.missingFields.length > 0 &&
                    <div style={{ color: 'red' }}>Missing fields: {validationSummary.missingFields.map(e => `row ${e.row}: ${e.fields.join(', ')}`).join('; ')}</div>}
                  {validationSummary.duplicateRecords.length > 0 &&
                    <div style={{ color: 'orange' }}>Duplicates: {validationSummary.duplicateRecords.map(e => `row ${e.row}`).join(', ')}</div>}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  disabled={!validationSummary || !validationOk || isPreparing}
                  onClick={handlePrepare}
                >Prepare Data for Import</button>
                <button className="btn" onClick={() => setStep(1)}>Back</button>
              </div>
            </>
          )}

            {importResult?.errors?.length > 0 && (
              <div className="alert alert-danger">
                <ul>
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{`Row ${err.row}: ${err.error} ${err.error2}`}</li>
                  ))}
                </ul>
              </div>
            )}

          {step === 3 && (
            <>
              <h4>Step 3: Confirm and Import</h4>
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <strong>Warning:</strong> This import will <b>REPLACE ALL</b> existing PTO daily schedules in the system!
              </div>
              <label style={{ display: 'block', margin: '10px 0' }}>
                <input type="checkbox" checked={confirmReplace} onChange={e => setConfirmReplace(e.target.checked)} />
                &nbsp;I understand this will delete all current PTO daily schedules and replace with my uploaded data.
              </label>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!confirmReplace || isImporting}
              >{isImporting ? 'Importing...' : 'Start Import'}</button>
              {isImporting &&
                <div style={{ marginTop: 16 }}>
                  <ProgressBar value={importProgress.currentBatch} max={importProgress.totalBatches} />
                  <div>
                    Importing batch {importProgress.currentBatch} of {importProgress.totalBatches}...
                  </div>
                </div>
              }
            </>
          )}

          {step === 4 && importResult && (
            <>
              <h4>Import Complete</h4>
              <div className={importResult.success ? "alert alert-success" : "alert alert-danger"}>
                {importResult.message}
              </div>
              <div>
                <div><b>Total records:</b> {importResult.data.totalRecords}</div>
                <div><b>Imported:</b> {importResult.data.importedRecords}</div>
                <div><b>Failed:</b> {importResult.data.failedRecords}</div>
                {importResult.data.errors && importResult.data.errors.length > 0 && (
                  <div>
                    <b>Errors:</b>
                    <ul>
                      {importResult.data.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>{e.record ? `Row ${e.record}` : ''} {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PTOImportModal;
