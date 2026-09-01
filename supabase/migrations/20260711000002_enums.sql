-- Enums. Exact values from architecture section 2 and the intake/engagement constraint lists.
create type staff_role as enum ('admin', 'recruiter', 'sourcer', 'bd');

create type requisition_status as enum ('draft', 'waiting_approval', 'open', 'on_hold', 'filled', 'closed');

create type application_stage as enum ('received', 'screening', 'phone_screen', 'submitted', 'client_interview', 'offer', 'hired', 'rejected');

create type deal_stage as enum ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

create type ticket_status as enum ('new', 'open', 'pending', 'resolved', 'closed');

create type intake_channel as enum ('linkedin_url', 'email', 'sheet_import', 'careers_form', 'manual');

create type intake_target_type as enum ('candidate', 'contact');

create type intake_status as enum ('pending', 'parsed', 'graded', 'imported', 'rejected');

create type reminder_status as enum ('pending', 'fired', 'dismissed');

create type activity_kind as enum ('email', 'call', 'meeting', 'inmail', 'note', 'status_change', 'system');

create type attachment_kind as enum ('resume', 'cover', 'contract', 'other');

create type approver_type as enum ('requisition', 'offer');
