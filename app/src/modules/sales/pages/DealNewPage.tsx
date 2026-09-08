import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { CURRENCIES } from '../../../lib/format';
import { useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { RecordPage } from '../../../components/ui/RecordPage';
import { ErrorSummary, type FieldError } from '../../../components/ui/ErrorSummary';
import { Briefcase as BriefcaseIcon } from 'lucide-react';
import { useCompanyOptions, useStaffList } from '../hooks';
import {
  personName,
  type ContactProfile,
  type Person,
} from '../lib';

export function DealNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { staff } = useSession();
  const { staffOptions } = useStaffList();
  const { companyOptions } = useCompanyOptions();

  const initialCompanyId = params.get('companyId') ?? '';

  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [contactId, setContactId] = useState('');
  const [ownerId, setOwnerId] = useState(staff?.id ?? '');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [probability, setProbability] = useState('');
  const [expectedClose, setExpectedClose] = useState('');
  const [isTest, setIsTest] = useState(false);
  const [contactOptions, setContactOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setCompanyId(initialCompanyId);
    setContactId('');
    setOwnerId(staff?.id ?? '');
    setValue('');
    setCurrency('PHP');
    setProbability('');
    setExpectedClose('');
    setIsTest(false);
    setError(null);
  };

  useEffect(() => {
    if (staff && !ownerId) setOwnerId(staff.id);
  }, [staff, ownerId]);

  useEffect(() => {
    if (!companyId) {
      setContactOptions([]);
      return;
    }
    let cancelled = false;
    async function loadContacts(cid: string) {
      const { data: profiles } = await supabase
        .from('contact_profiles')
        .select('*')
        .eq('company_id', cid);
      const list: ContactProfile[] = profiles ?? [];
      if (list.length === 0) {
        if (!cancelled) setContactOptions([]);
        return;
      }
      const { data: people } = await supabase
        .from('people')
        .select('*')
        .in(
          'id',
          list.map((p) => p.person_id),
        );
      if (cancelled) return;
      const byId = new Map((people ?? []).map((p: Person) => [p.id, p]));
      setContactOptions(
        list.map((p) => ({
          value: p.person_id,
          label: personName(byId.get(p.person_id)),
        })),
      );
    }
    void loadContacts(companyId);
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldError[] = [];
    if (!name.trim()) found.push({ field: 'deal-name', message: 'Deal name is required.' });
    if (!companyId) found.push({ field: 'deal-company', message: 'Company is required.' });
    setProblems(found);
    if (found.length > 0) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('deals')
      .insert({
        name: name.trim(),
        company_id: companyId,
        primary_contact_id: contactId || null,
        owner_id: ownerId || staff?.id || null,

        value: value === '' ? null : Number(value),
        currency: currency || null,
        probability: probability === '' ? null : Number(probability),
        expected_close: expectedClose || null,
        is_test: isTest,
      })
      .select('*')
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'Insert failed.');
      return;
    }
    navigate(`/sales/deals/${data.id}`);
  };

  return (
    <RecordPage title="Deals: New Deal" icon={<BriefcaseIcon size={32} />}>
      <form className="sales-form" noValidate onSubmit={submit}>
        <div className="sales-form-grid">
          <div className="sales-span-2">
            <Input
              id="deal-name"
              label="Name"
              required
              value={name}
              error={problems.find((p) => p.field === 'deal-name')?.message}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Select
            id="deal-company"
            label="Company"
            required
            error={problems.find((p) => p.field === 'deal-company')?.message}
            options={companyOptions}
            placeholder="Pick a company"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setContactId('');
            }}
          />
          <Select
            label="Primary contact"
            options={contactOptions}
            placeholder={
              companyId ? 'No primary contact' : 'Pick a company first'
            }
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            disabled={!companyId}
            title={companyId ? undefined : 'Pick a company first'}
          />
          <Select
            label="Owner"
            options={staffOptions}
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          />
          <Input
            label="Value"
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Select
            label="Currency"
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
          <Input
            label="Probability (%)"
            type="number"
            min="0"
            max="100"
            step="1"
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
          />
          <DateField
            label="Expected close"
            value={expectedClose}
            onChange={(e) => setExpectedClose(e.target.value)}
          />
          <label className="sales-checkbox sales-span-2">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
            />
            Test record
          </label>
          <span className="field-hint">Test records are left out of CSV exports.</span>
        </div>
        <ErrorSummary errors={problems} />
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="sales-form-actions">
          <Button variant="primary" type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={() => navigate('/sales/deals')}>Cancel</Button>
          <Button onClick={resetForm}>Reset</Button>
        </div>
      </form>
    </RecordPage>
  );
}
