// Hired → contact promotion receiver (cross-module contract 1). Reached
// from the application.hired prompt with ?personId=…&companyId=…&since=….
// Accepting adds a contact_profiles row to the SAME person — no new people
// row, nothing copied. If a contact_profile already exists, the page offers
// to update company/title instead of inserting.
//
// Note on RLS: the suggested company comes in via query params (from the
// event payload / the ATS side), so BD never queries requisitions here. A
// BD user may also be unable to read the people row until the profile
// exists — the page handles a hidden person gracefully.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db as supabase } from '../db';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { useCanEditCrm, useCompanyOptions } from '../hooks';
import {
  personName,
  todayISO,
  type ContactProfile,
  type Person,
} from '../lib';

export function PromoteContactPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const canEdit = useCanEditCrm();
  const { companyName, companyOptions } = useCompanyOptions();

  const personId = params.get('personId');
  const suggestedCompanyId = params.get('companyId') ?? '';
  const suggestedSince = params.get('since');
  const suggestedTitle = params.get('title') ?? '';

  const [person, setPerson] = useState<Person | null>(null);
  const [existing, setExisting] = useState<ContactProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [companyId, setCompanyId] = useState(suggestedCompanyId);
  const [title, setTitle] = useState(suggestedTitle);
  const [sinceDate, setSinceDate] = useState(
    suggestedSince ? suggestedSince.slice(0, 10) : todayISO(),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!personId) {
      setLoaded(true);
      return;
    }
    const [personRes, profileRes] = await Promise.all([
      supabase.from('people').select('*').eq('id', personId).maybeSingle(),
      supabase
        .from('contact_profiles')
        .select('*')
        .eq('person_id', personId)
        .maybeSingle(),
    ]);
    setPerson(personRes.data ?? null);
    const profile = profileRes.data ?? null;
    setExisting(profile);
    if (profile) {
      setCompanyId(profile.company_id ?? suggestedCompanyId);
      setTitle(profile.title ?? suggestedTitle);
      if (profile.since_date) setSinceDate(profile.since_date);
    }
    setLoaded(true);
  }, [personId, suggestedCompanyId, suggestedTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!personId) {
    return (
      <div className="stub-panel">
        <h1>Nothing to promote</h1>
        <p>
          This page expects a personId from an application.hired event, e.g.
          /sales/promote?personId=…&companyId=….
        </p>
      </div>
    );
  }
  if (!loaded) return null;

  const accept = async () => {
    setSaving(true);
    setError(null);
    const fields = {
      company_id: companyId || null,
      title: title.trim() || null,
      since_date: sinceDate || null,
    };
    // Existing profile → update, never a second row. One person, one identity.
    const { error: writeError } = existing
      ? await supabase
          .from('contact_profiles')
          .update(fields)
          .eq('person_id', personId)
      : await supabase
          .from('contact_profiles')
          .insert({ person_id: personId, ...fields });
    setSaving(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    navigate(`/sales/contacts/${personId}`);
  };

  const displayName = person
    ? personName(person)
    : 'Hired candidate (name visible once promoted)';

  return (
    <RecordPage title="Promote hired candidate to contact">
      <RecordSection title="Promotion">
        <p>
          <strong>{displayName}</strong> was hired
          {suggestedCompanyId
            ? ` at ${companyName(suggestedCompanyId)}`
            : ''}
          . {existing
            ? 'They already have a contact profile — accepting updates its company and title.'
            : 'Accepting adds a contact profile to the same person record; no duplicate is created.'}
        </p>
        <div className="sales-form-grid">
          <Select
            label="Company"
            options={companyOptions}
            placeholder="No company"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={!canEdit}
          />
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
          />
          <Input
            label="Contact since (hire date)"
            type="date"
            value={sinceDate}
            onChange={(e) => setSinceDate(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="sales-form-actions">
          <Button onClick={() => navigate('/sales/contacts')}>
            Not now
          </Button>
          {canEdit && (
            <Button variant="primary" onClick={accept} disabled={saving}>
              {saving
                ? 'Saving…'
                : existing
                  ? 'Update contact profile'
                  : 'Add as contact'}
            </Button>
          )}
        </div>
      </RecordSection>
    </RecordPage>
  );
}
