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
    leave_type: 'string', // vacation, sick, personal, holiday, other leave type
    reason: 'text',
    status: 'string', // pending, approved, declined
    daily_schedules: 'json', // Array of daily schedule objects
    total_days: 'number',
    total_hours: 'number',
    submitted_at: 'datetime',
    reviewed_at: 'datetime',
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // Daily schedule details
  pto_daily_schedules: {
    id: 'string',
    pto_request_id: 'string',
    date: 'date',
    schedule_type: 'string', // FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON
    leave_type: 'string', // vacation, sick, personal, holiday, other leave type
    hours: 'number', // 8, 4, etc.
    // Requester info
    requester_id: 'string',
    requester_name: 'string',
    requester_email: 'string',
    // Manager info
    manager_id: 'string',
    manager_name: 'string',
    manager_email: 'string',
    created_at: 'datetime'
  },

  // Team assignments for PTO management
  teams: {
    id: 'string',
    name: 'string',
    description: 'string',
    department: 'string',
    color: 'string',
    manager: 'string',
    created_at: 'datetime',
    updated_at: 'datetime',
    updated_by: 'string'
  },

  // PTO balance tracking
  pto_balances: {
    user_id: 'string',
    leave_type: 'string',
    allocated_days: 'number',
    used_days: 'number',
    remaining_days: 'number',
    year: 'number'
  },

  // Add user table schema (if not present) and add manager/executive_manager fields
  users: {
    id: 'string',
    jira_account_id: 'string',
    display_name: 'string',
    email_address: 'string',
    employment_type: 'string',
    hire_date: 'date',
    team_memberships: 'json',
    capacity: 'number',
    availability: 'json',
    isAdmin: 'boolean',
    manager: 'string',
    executive_manager: 'string',
    created_at: 'datetime',
    updated_at: 'datetime'
  }
};