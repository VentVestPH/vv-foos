export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffRole = 'admin' | 'recruiter' | 'sourcer' | 'bd';

export type RequisitionStatus =
  | 'draft'
  | 'waiting_approval'
  | 'open'
  | 'on_hold'
  | 'filled'
  | 'closed';

export type ApplicationStage =
  | 'received'
  | 'screening'
  | 'phone_screen'
  | 'submitted'
  | 'client_interview'
  | 'offer'
  | 'hired'
  | 'rejected';

export type DealStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';

export type IntakeChannel =
  | 'linkedin_url'
  | 'email'
  | 'sheet_import'
  | 'careers_form'
  | 'manual';

export type IntakeTargetType = 'candidate' | 'contact';

export type IntakeStatus =
  | 'pending'
  | 'parsed'
  | 'graded'
  | 'imported'
  | 'rejected';

export type ReminderStatus = 'pending' | 'fired' | 'dismissed';

export type ActivityKind =
  | 'email'
  | 'call'
  | 'meeting'
  | 'inmail'
  | 'note'
  | 'status_change'
  | 'system';

export type AttachmentKind = 'resume' | 'cover' | 'contract' | 'offer' | 'other';

export type ApproverType = 'requisition' | 'offer';

export type CompanyType = 'client' | 'employer' | 'prospect';

export interface PersonEmail {
  type: string;
  address: string;
}

export interface PersonPhone {
  type: string;
  number: string;
}

export interface PersonEducation {
  university: string | null;
  bachelor_discipline: string | null;
  year: string | null;
  higher_degrees: string | null;
  other_degrees: string | null;
}

export type PersonExperience = Record<string, Json | undefined>;

export interface Database {
  public: {
    Tables: {
      staff: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: StaffRole;
          title: string | null;
          manager_id: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          role: StaffRole;
          title?: string | null;
          manager_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          first_name: string | null;
          middle_name: string | null;
          last_name: string | null;
          headline: string | null;
          emails: Json;
          phones: Json;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          linkedin_public_url: string | null;
          linkedin_recruiter_url: string | null;
          online_resume_url: string | null;
          other_urls: Json;
          education: Json;
          is_test: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          street: string | null;
          experience: Json;
        };
        Insert: {
          id?: string;
          first_name?: string | null;
          middle_name?: string | null;
          last_name?: string | null;
          headline?: string | null;
          emails?: Json;
          phones?: Json;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          linkedin_public_url?: string | null;
          linkedin_recruiter_url?: string | null;
          online_resume_url?: string | null;
          other_urls?: Json;
          education?: Json;
          is_test?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          street?: string | null;
          experience?: Json;
        };
        Update: Partial<Database['public']['Tables']['people']['Insert']>;
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          types: CompanyType[];
          website: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          phone: string | null;
          owner_id: string | null;
          is_test: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          types?: CompanyType[];
          website?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          phone?: string | null;
          owner_id?: string | null;
          is_test?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['sources']['Insert']>;
        Relationships: [];
      };
      candidate_statuses: {
        Row: {
          id: string;
          label: string;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          label: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<
          Database['public']['Tables']['candidate_statuses']['Insert']
        >;
        Relationships: [];
      };
      erasure_log: {
        Row: {
          id: string;
          person_id: string;
          erased_by: string;
          erased_at: string;
          reason: string | null;
          counts: Json;
        };
        Insert: {
          id?: string;
          person_id: string;
          erased_by: string;
          erased_at?: string;
          reason?: string | null;
          counts?: Json;
        };
        Update: Partial<Database['public']['Tables']['erasure_log']['Insert']>;
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          name: string;
          subject: string;
          body: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subject: string;
          body: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['email_templates']['Insert']>;
        Relationships: [];
      };
      client_errors: {
        Row: {
          id: string;
          staff_id: string;
          occurred_at: string;
          route: string | null;
          origin: string;
          message: string;
          stack: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          staff_id?: string;
          occurred_at?: string;
          route?: string | null;
          origin: string;
          message: string;
          stack?: string | null;
          user_agent?: string | null;
        };
        Update: Partial<Database['public']['Tables']['client_errors']['Insert']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          table_name: string;
          record_id: string | null;
          action: 'insert' | 'update' | 'delete';
          actor_id: string | null;
          diff: Json | null;
          at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id?: string | null;
          action: 'insert' | 'update' | 'delete';
          actor_id?: string | null;
          diff?: Json | null;
          at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
      };
      events_outbox: {
        Row: {
          id: string;
          event_name: string;
          aggregate_id: string | null;
          payload: Json;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          event_name: string;
          aggregate_id?: string | null;
          payload?: Json;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<
          Database['public']['Tables']['events_outbox']['Insert']
        >;
        Relationships: [];
      };

      candidate_profiles: {
        Row: {
          person_id: string;
          status_id: string | null;
          star_grade: number | null;
          grade_comment: string | null;
          current_title: string | null;
          current_employer: string | null;
          tenure_note: string | null;
          salary_flag: string | null;
          initial_date: string | null;
          source_id: string | null;
          referred_by: string | null;
          sourcer_id: string | null;
          do_not_contact: boolean;
          expected_salary: number | null;
          current_salary: number | null;
          salary_currency: string | null;
          assessment_scores: Json;
        };
        Insert: {
          person_id: string;
          status_id?: string | null;
          star_grade?: number | null;
          grade_comment?: string | null;
          current_title?: string | null;
          current_employer?: string | null;
          tenure_note?: string | null;
          salary_flag?: string | null;
          initial_date?: string | null;
          source_id?: string | null;
          referred_by?: string | null;
          sourcer_id?: string | null;
          do_not_contact?: boolean;
          expected_salary?: number | null;
          current_salary?: number | null;
          salary_currency?: string | null;
          assessment_scores?: Json;
        };
        Update: Partial<
          Database['public']['Tables']['candidate_profiles']['Insert']
        >;
        Relationships: [];
      };
      requisitions: {
        Row: {
          id: string;
          display_code: string;
          job_code: string | null;
          title: string;
          description: string | null;
          status: RequisitionStatus;
          company_id: string | null;
          location: string | null;
          employment_type: string | null;
          num_openings: number;
          budget_status: string | null;
          reason_for_opening: string | null;
          replacement_for: string | null;
          pay_min: number | null;
          pay_max: number | null;
          pay_currency: string | null;
          pay_notes: string | null;
          opened_date: string | null;
          filled_date: string | null;
          is_published: boolean;
          is_test: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_code?: string;
          job_code?: string | null;
          title: string;
          description?: string | null;
          status?: RequisitionStatus;
          company_id?: string | null;
          location?: string | null;
          employment_type?: string | null;
          num_openings?: number;
          budget_status?: string | null;
          reason_for_opening?: string | null;
          replacement_for?: string | null;
          pay_min?: number | null;
          pay_max?: number | null;
          pay_currency?: string | null;
          pay_notes?: string | null;
          opened_date?: string | null;
          filled_date?: string | null;
          is_published?: boolean;
          is_test?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['requisitions']['Insert']
        >;
        Relationships: [];
      };
      requisition_owners: {
        Row: {
          requisition_id: string;
          staff_id: string;
        };
        Insert: {
          requisition_id: string;
          staff_id: string;
        };
        Update: Partial<
          Database['public']['Tables']['requisition_owners']['Insert']
        >;
        Relationships: [];
      };
      requisition_approvers: {
        Row: {
          requisition_id: string;
          staff_id: string;
          approver_type: ApproverType;
          decided_at: string | null;
          decision: string | null;
        };
        Insert: {
          requisition_id: string;
          staff_id: string;
          approver_type: ApproverType;
          decided_at?: string | null;
          decision?: string | null;
        };
        Update: Partial<
          Database['public']['Tables']['requisition_approvers']['Insert']
        >;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          display_code: string;
          requisition_id: string;
          person_id: string;
          stage: ApplicationStage;
          next_step: string | null;
          rejection_reason: string | null;
          is_shortlisted: boolean;
          rank: number | null;
          source_id: string | null;
          answers: Json;
          applied_at: string;
          hired_at: string | null;
          stage_changed_at: string;
          status_token: string;
        };
        Insert: {
          id?: string;
          display_code?: string;
          requisition_id: string;
          person_id: string;
          stage?: ApplicationStage;
          next_step?: string | null;
          rejection_reason?: string | null;
          is_shortlisted?: boolean;
          rank?: number | null;
          source_id?: string | null;
          answers?: Json;
          applied_at?: string;
          hired_at?: string | null;
          stage_changed_at?: string;
          status_token?: string;
        };
        Update: Partial<
          Database['public']['Tables']['applications']['Insert']
        >;
        Relationships: [];
      };
      application_views: {
        Row: {
          application_id: string;
          staff_id: string;
          last_viewed_at: string;
        };
        Insert: {
          application_id: string;
          staff_id: string;
          last_viewed_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['application_views']['Insert']
        >;
        Relationships: [];
      };
      intake_items: {
        Row: {
          id: string;
          channel: IntakeChannel;
          target_type: IntakeTargetType;
          raw_payload: Json;
          parsed: Json;
          full_name: string | null;
          linkedin_url: string | null;
          batch_label: string | null;
          submitted_by: string | null;
          star_grade: number | null;
          grade_comment: string | null;
          status: IntakeStatus;
          duplicate_of: string | null;
          person_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel: IntakeChannel;
          target_type: IntakeTargetType;
          raw_payload?: Json;
          parsed?: Json;
          full_name?: string | null;
          linkedin_url?: string | null;
          batch_label?: string | null;
          submitted_by?: string | null;
          star_grade?: number | null;
          grade_comment?: string | null;
          status?: IntakeStatus;
          duplicate_of?: string | null;
          person_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['intake_items']['Insert']
        >;
        Relationships: [];
      };

      contact_profiles: {
        Row: {
          person_id: string;
          company_id: string | null;
          title: string | null;
          is_primary: boolean;
          since_date: string | null;
        };
        Insert: {
          person_id: string;
          company_id?: string | null;
          title?: string | null;
          is_primary?: boolean;
          since_date?: string | null;
        };
        Update: Partial<
          Database['public']['Tables']['contact_profiles']['Insert']
        >;
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          display_code: string;
          name: string;
          company_id: string | null;
          primary_contact_id: string | null;
          owner_id: string | null;
          stage: DealStage;
          value: number | null;
          currency: string | null;
          probability: number | null;
          expected_close: string | null;
          lost_reason: string | null;
          is_test: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_code?: string;
          name: string;
          company_id?: string | null;
          primary_contact_id?: string | null;
          owner_id?: string | null;
          stage?: DealStage;
          value?: number | null;
          currency?: string | null;
          probability?: number | null;
          expected_close?: string | null;
          lost_reason?: string | null;
          is_test?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['deals']['Insert']>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          display_code: string;
          subject: string;
          company_id: string | null;
          person_id: string | null;
          status: TicketStatus;
          priority: string | null;
          sla_due_at: string | null;
          resolved_at: string | null;
          assignee_id: string | null;
        };
        Insert: {
          id?: string;
          display_code?: string;
          subject: string;
          company_id?: string | null;
          person_id?: string | null;
          status?: TicketStatus;
          priority?: string | null;
          sla_due_at?: string | null;
          resolved_at?: string | null;
          assignee_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>;
        Relationships: [];
      };

      activities: {
        Row: {
          id: string;
          kind: ActivityKind;
          subject: string | null;
          body: string | null;
          occurred_at: string;
          person_id: string | null;
          company_id: string | null;
          deal_id: string | null;
          application_id: string | null;
          requisition_id: string | null;
          gmail_message_id: string | null;
          gcal_event_id: string | null;
          attendees: Json | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          kind: ActivityKind;
          subject?: string | null;
          body?: string | null;
          occurred_at?: string;
          person_id?: string | null;
          company_id?: string | null;
          deal_id?: string | null;
          application_id?: string | null;
          requisition_id?: string | null;
          gmail_message_id?: string | null;
          gcal_event_id?: string | null;
          attendees?: Json | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['activities']['Insert']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          subject: string;
          due_date: string | null;
          priority: string | null;
          status: string;
          assignee_id: string | null;
          related_type: string | null;
          related_id: string | null;
        };
        Insert: {
          id?: string;
          subject: string;
          due_date?: string | null;
          priority?: string | null;
          status?: string;
          assignee_id?: string | null;
          related_type?: string | null;
          related_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          staff_id: string;
          subject: string;
          remind_at: string;
          related_type: string | null;
          related_id: string | null;
          status: ReminderStatus;
        };
        Insert: {
          id?: string;
          staff_id: string;
          subject: string;
          remind_at: string;
          related_type?: string | null;
          related_id?: string | null;
          status?: ReminderStatus;
        };
        Update: Partial<Database['public']['Tables']['reminders']['Insert']>;
        Relationships: [];
      };
      attachment_deletion_queue: {
        Row: {
          id: string;
          storage_path: string;
          parent_type: string | null;
          parent_id: string | null;
          queued_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          storage_path: string;
          parent_type?: string | null;
          parent_id?: string | null;
          queued_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['attachment_deletion_queue']['Insert']>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          storage_path: string;
          parent_type: string;
          parent_id: string;
          kind: AttachmentKind;
          description: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
          file_size_bytes: number | null;
        };
        Insert: {
          id?: string;
          storage_path: string;
          parent_type: string;
          parent_id: string;
          kind?: AttachmentKind;
          description?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          file_size_bytes?: number | null;
        };
        Update: Partial<
          Database['public']['Tables']['attachments']['Insert']
        >;
        Relationships: [];
      };

      ats_saved_views: {
        Row: {
          id: string;
          staff_id: string;
          entity: string;
          name: string;
          filters: Json;
          columns: Json;
          sort: Json;
          is_shared: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          entity: string;
          name: string;
          filters?: Json;
          columns?: Json;
          sort?: Json;
          is_shared?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['ats_saved_views']['Insert']
        >;
        Relationships: [];
      };
      intake_mapping_templates: {
        Row: {
          id: string;
          name: string;
          source_hint: string | null;
          column_map: Json;
          target_type: IntakeTargetType;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          source_hint?: string | null;
          column_map?: Json;
          target_type: IntakeTargetType;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['intake_mapping_templates']['Insert']
        >;
        Relationships: [];
      };
      integration_settings: {
        Row: {
          id: string;
          staff_id: string | null;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id?: string | null;
          key: string;
          value?: Json;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['integration_settings']['Insert']
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_display_code: {
        Args: { prefix: string };
        Returns: string;
      };

      find_person_by_email: {
        Args: { p_email: string };
        Returns: string | null;
      };
      find_person_by_linkedin: {
        Args: { p_url: string };
        Returns: string | null;
      };

      import_intake_item: {
        Args: {
          p_intake_id: string;
          p_mode?: 'new' | 'merge';
          p_merge_person_id?: string | null;
          p_company_id?: string | null;
          p_new_company_name?: string | null;
        };
        Returns: Json;
      };
      reject_intake_item: {
        Args: { p_intake_id: string; p_reason: string };
        Returns: void;
      };
      get_my_google_status: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      disconnect_my_google: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      fn_erase_person: {
        Args: { p_person: string; p_reason?: string | null };
        Returns: {
          person_id: string;
          applications: number;
          activities: number;
          attachments_queued: number;
          tasks: number;
          reminders: number;
          files_still_to_purge: number;
        };
      };
      fn_merge_candidates: {
        Args: { p_survivor: string; p_duplicate: string };
        Returns: {
          survivor: string;
          duplicate: string;
          applications_moved: number;
          applications_dropped: number;
          activities_moved: number;
          tasks_moved: number;
          reminders_moved: number;
          attachments_moved: number;
        };
      };
    };
    Enums: {
      staff_role: StaffRole;
      requisition_status: RequisitionStatus;
      application_stage: ApplicationStage;
      deal_stage: DealStage;
      ticket_status: TicketStatus;
      intake_channel: IntakeChannel;
      intake_target_type: IntakeTargetType;
      intake_status: IntakeStatus;
      reminder_status: ReminderStatus;
      activity_kind: ActivityKind;
      attachment_kind: AttachmentKind;
      approver_type: ApproverType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export const REQUISITION_STATUSES: RequisitionStatus[] = [
  'draft',
  'waiting_approval',
  'open',
  'on_hold',
  'filled',
  'closed',
];

export const APPLICATION_STAGES: ApplicationStage[] = [
  'received',
  'screening',
  'phone_screen',
  'submitted',
  'client_interview',
  'offer',
  'hired',
  'rejected',
];

export const DEAL_STAGES: DealStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export const TICKET_STATUSES: TicketStatus[] = [
  'new',
  'open',
  'pending',
  'resolved',
  'closed',
];
