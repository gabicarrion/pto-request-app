import React from 'react';
import { X } from 'lucide-react';
import RequestForm from './RequestForm';
import './RequestModal.css';

/**
 * Request Modal for creating and editing PTO requests
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Object} props.currentUser - Current user information
 * @param {Array} props.teams - Array of teams
 * @param {Array} props.users - Array of users
 * @param {Function} props.onSubmit - Handler for form submission
 * @param {Object} props.editRequest - Request to edit (if editing)
 */
function RequestModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  teams = [], 
  users = [], 
  onSubmit,
  editRequest = null
}) {
  // Render nothing if the modal is closed
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="request-modal">
        <div className="request-modal-header">
          <h2>{editRequest ? 'Edit PTO Request' : 'New PTO Request'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="request-modal-content">
          <RequestForm
            currentUser={currentUser}
            teams={teams}
            users={users}
            initialValues={editRequest}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}

export default RequestModal;