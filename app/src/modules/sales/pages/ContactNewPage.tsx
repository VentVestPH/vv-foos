import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { RecordPage } from '../../../components/ui/RecordPage';
import { ErrorSummary, type FieldError } from '../../../components/ui/ErrorSummary';
import { Contact as ContactCardIcon } from 'lucide-react';
import { useCompanyOptions } from '../hooks';
import { normalizeEmail, personName, todayISO, type Person } from '../lib';
import { validateContactPerson } from '../../../lib/personValidation';

interface DedupMatch {
  person: Person;
  hasContactProfile: boolean;
}

export function ContactNewPage() {
  const navigate = useNavigate();
  const { staff } = useSession();
  const { companyOptions } = useCompanyOptions();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [sinceDate, setSinceDate] = useState(todayISO());
  const [isTest, setIsTest] = useState(false);

  const [matches, setMatches] = useState<DedupMatch[]>([]);
  const [checkedEmail, setCheckedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setTitle('');
    setCompanyId('');
    setIsPrimary(false);
    setSinceDate(todayISO());
    setIsTest(false);
    setMatches([]);
    setCheckedEmail('');
    setError(null);
  };

  const checkDuplicates = async () => {
    const normalized = normalizeEmail(email);
    if (!normalized || normalized === checkedEmail) return;
    setCheckedEmail(normalized);

    const { data: people } = await supabase
      .from('people')
      .select('*')
      .filter('emails', 'cs', JSON.stringify([{ address: normalized }]));
    if (!people || people.length === 0) {
      setMatches([]);
      return;
    }
    const { data: profiles } = await supabase
      .from('contact_profiles')
      .select('person_id')
      .in(
        'person_id',
        people.map((p) => p.id),
      );
    const withProfile = new Set((profiles ?? []).map((p) => p.person_id));
    setMatches(
      people.map((person) => ({
        person,
        hasContactProfile: withProfile.has(person.id),
      })),
    );
  };

  const profileFields = () => ({
    company_id: companyId || null,
    title: title.trim() || null,
    is_primary: isPrimary,
    since_date: sinceDate || null,
  });

  const linkExisting = async (m: DedupMatch) => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('contact_profiles')
      .insert({ person_id: m.person.id, ...profileFields() });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    navigate(`/sales/contacts/${m.person.id}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateContactPerson(firstName, lastName, email, phone);
    if (invalid) {
      const field = invalid.startsWith('Phone')
        ? 'contact-phone'
        : invalid.startsWith('Enter a valid email')
          ? 'contact-email'
          : 'contact-first-name';
      setProblems([{ field, message: invalid }]);
      return;
    }
    setProblems([]);
    setSaving(true);
    setError(null);
    const normalized = normalizeEmail(email);
    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        emails: normalized ? [{ type: 'work', address: normalized }] : [],
        phones: phone.trim() ? [{ type: 'work', number: phone.trim() }] : [],
        is_test: isTest,
        created_by: staff?.id ?? null,
      })
      .select('*')
      .single();
    if (personError || !person) {
      setSaving(false);
      setError(personError?.message ?? 'Could not create the person.');
      return;
    }
    const { error: profileError } = await supabase
      .from('contact_profiles')
      .insert({ person_id: person.id, ...profileFields() });
    setSaving(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    navigate(`/sales/contacts/${person.id}`);
  };

  return (
    <RecordPage
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Contacts', to: '/sales/contacts' },
        { label: 'New contact' },
      ]}
      title="Contacts: New Contact"
      icon={<ContactCardIcon size={32} />}
    >
      <form className="sales-form" noValidate onSubmit={submit}>
        <div className="sales-form-grid">
          <Input
            id="contact-first-name"
            label="First name"
            value={firstName}
            error={problems.find((p) => p.field === 'contact-first-name')?.message}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <span className="field-hint sales-span-2">
            Give at least a first or a last name.
          </span>
          <Input
            id="contact-email"
            label="Email"
            type="email"
            value={email}
            error={problems.find((p) => p.field === 'contact-email')?.message}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={checkDuplicates}
          />
          <Input
            id="contact-phone"
            label="Phone"
            type="tel"
            value={phone}
            error={problems.find((p) => p.field === 'contact-phone')?.message}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select
            label="Company"
            options={companyOptions}
            placeholder="No company"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          />
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <DateField
            label="Contact since"
            value={sinceDate}
            onChange={(e) => setSinceDate(e.target.value)}
          />
          <div className="field">
            <label className="sales-checkbox">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Primary contact for the company
            </label>
            <label className="sales-checkbox">
              <input
                type="checkbox"
                checked={isTest}
                onChange={(e) => setIsTest(e.target.checked)}
              />
              Test record
            </label>
            <span className="field-hint">Test records are left out of CSV exports.</span>
          </div>
        </div>

        {matches.length > 0 && (
          <div className="sales-dedup" role="alert">
            <span className="sales-dedup-title">
              Possible duplicate — a person with this email already exists
            </span>
            {matches.map((m) => (
              <div key={m.person.id} className="sales-dedup-row">
                <span>{personName(m.person)}</span>
                {m.hasContactProfile ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/sales/contacts/${m.person.id}`)
                    }
                  >
                    Open existing contact
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={saving}
                    onClick={() => linkExisting(m)}
                  >
                    Link contact profile to this person
                  </Button>
                )}
              </div>
            ))}
            <div className="sales-panel-note">
              Linking keeps one identity per person — no people row is
              duplicated.
            </div>
          </div>
        )}

        <ErrorSummary errors={problems} />
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="sales-form-actions">
          <Button variant="primary" type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={() => navigate('/sales/contacts')}>Cancel</Button>
          <Button onClick={resetForm}>Reset</Button>
        </div>
      </form>
    </RecordPage>
  );
}
