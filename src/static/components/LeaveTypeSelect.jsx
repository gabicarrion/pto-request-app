import React from 'react';
import { useState, useEffect } from 'react';
import Select from '@atlaskit/select';
import TextArea from '@atlaskit/textarea';
import Button from '@atlaskit/button';
import Modal, { ModalTransition } from '@atlaskit/modal-dialog';
import { LEAVE_TYPES } from './constants';

const LeaveTypeSelect = ({ onChange, value }) => {
  const [showNotification, setShowNotification] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [reason, setReason] = useState('');

  const leaveTypeOptions = Object.values(LEAVE_TYPES).map(type => ({
    label: type.label,
    value: type.id
  }));

  const handleLeaveTypeChange = (selectedOption) => {
    const selectedType = LEAVE_TYPES[selectedOption.value];

    if (selectedType.requiresNotification) {
      setShowNotification(true);
    }

    if (selectedType.requiresReason) {
      setShowReasonDialog(true);
    } else {
      onChange({ type: selectedType.id });
    }
  };

  const handleReasonSubmit = () => {
    onChange({ type: value, reason });
    setShowReasonDialog(false);
    setReason('');
  };

  return (
    <div>
      <Select
        value={value ? { label: LEAVE_TYPES[value].label, value } : null}
        onChange={handleLeaveTypeChange}
        options={leaveTypeOptions}
        placeholder="Select leave type"
      />

      <ModalTransition>
        {showNotification && (
          <Modal
            actions={[
              { text: 'I understand', onClick: () => setShowNotification(false) }
            ]}
            onClose={() => setShowNotification(false)}
            heading="Important Reminder"
          >
            <p>{LEAVE_TYPES[value]?.notificationMessage}</p>
          </Modal>
        )}

        {showReasonDialog && (
          <Modal
            actions={[
              { text: 'Cancel', onClick: () => setShowReasonDialog(false) },
              { text: 'Submit', onClick: handleReasonSubmit }
            ]}
            onClose={() => setShowReasonDialog(false)}
            heading="Additional Information Required"
          >
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={LEAVE_TYPES[value]?.reasonPrompt}
              minimumRows={3}
            />
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
};

export default LeaveTypeSelect;