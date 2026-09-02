import { useCallback, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { StaffRole } from '../../../lib/database.types';
import type { CandidateProfile, StaffRow } from '../lib';

export interface ProfileDraft {
  status_id: string;
  star_grade: number | null;
  grade_comment: string;
  current_title: string;
  current_employer: string;
  tenure_note: string;
  salary_flag: string;
  expected_salary: string;
  current_salary: string;
  salary_currency: string;
  initial_date: string;
  source_id: string;
  referred_by: string;
  sourcer_id: string;
  do_not_contact: boolean;
}

export function toDraft(p: CandidateProfile): ProfileDraft {
  return {
    status_id: p.status_id ?? '',
    star_grade: p.star_grade,
    grade_comment: p.grade_comment ?? '',
    current_title: p.current_title ?? '',
    current_employer: p.current_employer ?? '',
    tenure_note: p.tenure_note ?? '',
    salary_flag: p.salary_flag ?? '',
    expected_salary: p.expected_salary != null ? String(p.expected_salary) : '',
    current_salary: p.current_salary != null ? String(p.current_salary) : '',
    salary_currency: p.salary_currency ?? '',
    initial_date: p.initial_date ?? '',
    source_id: p.source_id ?? '',
    referred_by: p.referred_by ?? '',
    sourcer_id: p.sourcer_id ?? '',
    do_not_contact: p.do_not_contact,
  };
}

export interface CandidateProfileDraft {
  draft: ProfileDraft | null;
  setDraft: (next: ProfileDraft | null) => void;
  canEditProfile: boolean;
  canGrade: boolean;
  saved: boolean;
  saveProfile: () => Promise<void>;
}

export interface CandidateProfileDraftInput {
  profile: CandidateProfile | null;
  role: StaffRole | null;
  staff: StaffRow | null;
  mobile: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string | null) => void;
}

export function useCandidateProfileDraft({
  profile,
  role,
  staff,
  mobile,
  onSaved,
  onError,
}: CandidateProfileDraftInput): CandidateProfileDraft {
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saved, setSaved] = useState(false);

  const canEditProfile =
    !mobile && (role === 'admin' || role === 'recruiter');
  const canGrade =
    !mobile &&
    (role === 'admin' ||
      role === 'recruiter' ||
      (role === 'sourcer' && staff != null && profile?.sourcer_id === staff.id));

  const saveProfile = useCallback(async () => {
    if (!profile || !draft) return;

    const patch = canEditProfile
      ? {
          status_id: draft.status_id || null,
          star_grade: draft.star_grade,
          grade_comment: draft.grade_comment.trim() || null,
          current_title: draft.current_title.trim() || null,
          current_employer: draft.current_employer.trim() || null,
          tenure_note: draft.tenure_note.trim() || null,
          salary_flag: draft.salary_flag.trim() || null,
          expected_salary: draft.expected_salary.trim()
            ? Number(draft.expected_salary)
            : null,
          current_salary: draft.current_salary.trim()
            ? Number(draft.current_salary)
            : null,
          salary_currency: draft.salary_currency.trim() || null,
          initial_date: draft.initial_date || null,
          source_id: draft.source_id || null,
          referred_by: draft.referred_by.trim() || null,
          sourcer_id: draft.sourcer_id || null,
          do_not_contact: draft.do_not_contact,
        }
      : {
          star_grade: draft.star_grade,
          grade_comment: draft.grade_comment.trim() || null,
        };
    const { error: err } = await supabase
      .from('candidate_profiles')
      .update(patch)
      .eq('person_id', profile.person_id);
    if (err) {
      onError(err.message);
    } else {
      onError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      await onSaved();
    }
  }, [profile, draft, canEditProfile, onSaved, onError]);

  return { draft, setDraft, canEditProfile, canGrade, saved, saveProfile };
}
