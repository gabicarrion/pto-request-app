// Leave Type Configuration and Utilities

export const LEAVE_TYPES = {
  vacation: {
    id: 'vacation',
    label: '🏖️ Vacation',
    emoji: '🏖️',
    color: 'bg-blue-100 text-blue-800'
  },
  sick: {
    id: 'sick',
    label: '🤒 Sick Leave',
    emoji: '🤒',
    color: 'bg-red-100 text-red-800'
  },
  personal: {
    id: 'personal',
    label: '👤 Personal Day',
    emoji: '👤',
    color: 'bg-purple-100 text-purple-800'
  },
  holiday: {
    id: 'holiday',
    label: '🎉 Holiday',
    emoji: '🎉',
    color: 'bg-green-100 text-green-800'
  },
  'other leave type': {
    id: 'other leave type',
    label: '📝 Other Leave Type',
    emoji: '📝',
    color: 'bg-gray-100 text-gray-800'
  }
};

export const getLeaveTypeEmoji = (type) => {
  return LEAVE_TYPES[type?.toLowerCase()]?.emoji || '📅';
};

export const getLeaveTypeLabel = (type) => {
  return LEAVE_TYPES[type?.toLowerCase()]?.label || type;
};

export const getLeaveTypeColor = (type) => {
  return LEAVE_TYPES[type?.toLowerCase()]?.color || 'bg-gray-100 text-gray-800';
};

export const getLeaveTypesArray = () => {
  return Object.values(LEAVE_TYPES);
};