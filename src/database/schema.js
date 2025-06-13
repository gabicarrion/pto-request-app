// src/database/schema.js
export const SCHEMA = {
  // Main PTO requests table
  pto_requests: {
    pto_request_id: 'string',              // UUID
    // Requester info
    requester_id: 'string',                // Same as user_id (user database)
    requester_name: 'string',              // Same from user database
    requester_email: 'string',             // Same from user database
    // Manager info
    manager_id: 'string',                  // User's manager
    manager_name: 'string',                // User's manager name
    manager_email: 'string',               // User's manager email
    // Executive Manager info
    executive_manager_id: 'string',        // User's executive manager
    executive_manager_name: 'string',      // User's executive manager name
    executive_manager_email: 'string',     // User's executive manager email
    leave_type: 'string',                  // vacation, sick, personal, holiday, other
    reason: 'text',
    status: 'string',                      // pending, approved, declined
    daily_schedules: 'json',               // Array of daily schedule objects
    total_days: 'number',
    total_hours: 'number',
    submitted_at: 'datetime',
    reviewed_at: 'datetime',               // Timestamp of approval or rejection
    reviewer_reason: 'string',             // In case of rejection
    created_at: 'datetime',
    updated_at: 'datetime'
  },

  // Daily schedule details
  pto_daily_schedules: {
    daily_schedule_id: 'string',
    pto_request_id: 'string',
    date: 'date',
    schedule_type: 'string',              // FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON
    leave_type: 'string',                 // vacation, sick, personal, holiday, other
    hours: 'number',                      // 8, 4, etc.
    created_at: 'datetime',
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
    executive_manager_email: 'string'
  },

  // Team assignments for PTO management
  teams: {
    team_id: 'string',
    team_name: 'string',
    team_department: 'string',
    team_business_unit: 'string',
    team_manager_name: 'string',       // jira user display name
    team_manager_id: 'string',         // jira_user_id
    team_manager_email: 'string',
    team_executive_manager_name: 'string',  // jira user display name
    team_executive_manager_id: 'string',    // jira_user_id
    team_executive_manager_email: 'string'
    },


  // Add user table schema (if not present) and add manager/executive_manager fields
  users: {
    user_id: 'string',                     // autocreated - using jira_account_id if available
    jira_account_id: 'string',             // jira_user_id
    display_name: 'string',                // jira user display name (or defined manually)
    email_address: 'string',
    team_memberships: 'json',              // User can be "Manager" or "Member" or "Executive Manager" of multiple teams
    employment_type: 'string',             // "full_time" (40h) or "part_time" (20h)
    capacity: 'number',                    // Dependent on employment type
    standard_availability: 'json',         // Capacity breakdown in days of week
    isAdmin: 'boolean',                    // If defined as admin in HR system
    isManager: 'json',                     // If defined as manager of any team
    isExecutive_Manager: 'json',           // If defined as executive manager of any team
    pto_accountability_type: 'string',     // "work_year" or "standard_year" - defines PTO accounting period
    pto_available_in_the_period: 'json',   // Default: 20d vacation, 10d holiday, 1d personal
    hiring_date: 'date',                   // Used when pto_accountability_type is work_year
    created_at: 'datetime',
    updated_at: 'datetime',
    used_pto_days_in_period: 'json',       // Calculated based on scheduled PTOs
    remaining_pto_days_in_period: 'json'   // pto_available_in_the_period - used_pto_days_in_period
  }
};