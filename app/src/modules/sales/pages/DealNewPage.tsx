import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { RecordPage } from '../../../components/ui/RecordPage';
import { Briefcase as BriefcaseIcon } from 'lucide-react';
import { useCompanyOptions, useStaffList } from '../hooks';
import {
  personName,
  CURRENCIES,
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
    if (!name.trim()) {
      setError('Deal name is required.');
      return;
    }
    if (!companyId) {
      setError('Company is required.');
      return;
    }
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
    <RecordPage title="Deals: New Deal" icon={<BriefcaseIcon size={40} />}>
      <form className="sales-form" onSubmit={submit}>
        <div className="sales-form-grid">
          <div className="sales-span-2">
            <Input
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Select
            label="Company"
            required
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
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
          />
          <Input
            label="Expected close"
            type="date"
            value={expectedClose}
            onChange={(e) => setExpectedClose(e.target.value)}
          />
          <label className="sales-checkbox sales-span-2">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
            />
            Test record (excluded from CSV exports)
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="sales-form-actions">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={() => navigate('/sales/deals')}>Cancel</Button>
          <Button onClick={resetForm}>Reset</Button>
        </div>
      </form>
    </RecordPage>
  );
}
