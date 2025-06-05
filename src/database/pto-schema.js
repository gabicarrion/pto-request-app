// src/database/pto-schema.js
export const PTO_SCHEMA = {
  // Main PTO requests table
  pto_requests: {
    id: 'string', // UUID
    requester_id: 'string', // Jira account ID
    requester_name: 'string',
    requester_email: 'string',
    manager_id: 'string', // Jira account ID  
    manager_name: 'string',
    manager_email: 'string',
    start_date: 'date',
    end_date: 'date',
    leave_type: 'string', // vacation, sick, personal, holiday
    reason: 'text',
    status: 'string', // pending, approved, declined
    daily_schedules: 'json', // Array of daily schedule objects
    total_days: 'number',
    total_hours: 'number',
    submitted_at: 'datetime',
    reviewed_at: 'datetime',
    reviewer_comments: 'text',
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // Daily schedule details
  pto_daily_schedules: {
    id: 'string',
    pto_request_id: 'string',
    date: 'date',
    schedule_type: 'string', // FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON
    hours: 'number', // 8, 4, etc.
    created_at: 'datetime'
  },

  // Team assignments for PTO management
  pto_teams: {
    id: 'string',
    name: 'string',
    description: 'text',
    manager_id: 'string',
    department: 'string',
    members: 'json', // Array of user objects
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // PTO balance tracking
  pto_balances: {
    id: 'string',
    user_id: 'string',
    leave_type: 'string',
    allocated_days: 'number',
    used_days: 'number',
    remaining_days: 'number',
    year: 'number',
    created_at: 'datetime',
    updated_at: 'datetime'
  }
};