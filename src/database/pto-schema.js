// src/database/pto-schema.js
export const PTO_SCHEMA = {
  // Teams table - updated structure
  teams: {
    team_id: 'string',     
    team_name: 'string',     
    team_department: 'string',
    team_business_unit: 'string',     
    team_manager_name: 'string',  // jira user display name
    team_manager_id: 'string',    // jira_user_id
    team_manager_email: 'string',
    team_executive_manager_name: 'string',  // jira user display name
    team_executive_manager_id: 'string',    // jira_user_id
    team_executive_manager_email: 'string',
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // Users table - completely restructured
  users: {
    user_id: 'string',  // autocreated - in case user has jira account, we should use jira_account_id
    jira_account_id: 'string', // jira_user_id
    display_name: 'string', // jira user display name (or defined manually only in case user has no jira)
    email_address: 'string',
    team_memberships: 'json', // user can be "Manager" or "Member" or "Executive Manager" of more than one team
    employment_type: 'string', // 'full_time' (capacity 40h week) or 'part_time' (capacity 20h week)
    capacity: 'number', // dependent of employment type
    standard_availability: 'json', // the capacity breakdown in days of week
    isAdmin: 'boolean', // If is defined admin in our HR system
    isManager: 'json', // if is defined manager of any team in "Teams" table
    isExecutive_Manager: 'json', // if is defined executive manager of any team in "Teams" table
    pto_accountability_type: 'string', // 'work_year' or 'standard_year' - defines how HR will define period of accountability of PTOs
    pto_available_in_the_period: 'json', // standard is 20d for vacation, 10d for holiday, 1d for personal in the pto_accountability_type period
    hiring_date: 'date', // used when pto_accountability_type is work_year
    used_pto_days_in_period: 'json', // calculated considering each scheduled pto day by type and period
    remaining_pto_days_in_period: 'json', // pto_available_in_the_period - used_pto_days_in_period
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // PTO requests table - updated with executive manager fields
  pto_requests: {
    pto_request_id: 'string', // UUID
    // Requester info 
    requester_id: 'string',    // same as user_id (user database)
    requester_name: 'string',  // same from user database
    requester_email: 'string', // same from user database
    // Manager info
    manager_id: 'string',      // user_id of manager where the requester is part and where he is member
    manager_name: 'string',    // same logic of manager_id, but name
    manager_email: 'string',   // same logic of manager_id, but email
    // Executive Manager info
    executive_manager_id: 'string',    // user_id of executive_manager where the requester is part
    executive_manager_name: 'string',  // same logic of executive_manager_id, but name
    executive_manager_email: 'string', // same logic of executive_manager_id, but email
    leave_type: 'string', // vacation, sick, personal, holiday, other leave type
    reason: 'text',
    status: 'string', // pending, approved, declined
    daily_schedules: 'json', // Array of daily schedule objects
    total_days: 'number',
    total_hours: 'number',
    submitted_at: 'datetime',
    reviewed_at: 'datetime', // timestamp of approval or rejection
    reviewer_reason: 'string', // in case of rejection
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // PTO daily schedules - updated with executive manager fields
  pto_daily_schedules: {
    daily_schedule_id: 'string',
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
    // Executive Manager info
    executive_manager_id: 'string',
    executive_manager_name: 'string',
    executive_manager_email: 'string',
    created_at: 'datetime'
  }
};