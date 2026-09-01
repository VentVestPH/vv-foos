import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db as supabase } from '../db';
import { useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { RecordPage } from '../../../components/ui/RecordPage';
import { HandshakeIcon } from '../../../shell/icons';
import { useStaffList } from '../hooks';
import type { CompanyType } from '../../../lib/database.types';

const ALL_TYPES: CompanyType[] = ['client', 'employer', 'prospect'];

const INITIAL_TYPES: CompanyType[] = ['prospect'];

export function CompanyNewPage() {
  const navigate = useNavigate();
  const { staff } = useSession();
  const { staffOptions } = useStaffList();

  const [name, setName] = useState('');
  const [types, setTypes] = useState<CompanyType[]>(INITIAL_TYPES);
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [ownerId, setOwnerId] = useState<string>(staff?.id ?? '');
  const [isTest, setIsTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Real Reset — restores the blank-draft defaults without touching the
  // database (redesign prompt section 8.2's Reset requirement, applied
  // here to the Accounts new-record archetype).
  const resetForm = () => {
    setName('');
    setTypes(INITIAL_TYPES);
    setWebsite('');
    setPhone('');
    setCity('');
    setState('');
    setCountry('');
    setOwnerId(staff?.id ?? '');
    setIsTest(false);
    setError(null);
  };

  const toggleType = (t: CompanyType) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('companies')
      .insert({
        name: name.trim(),
        types,
        website: website.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        country: country.trim() || null,
        owner_id: ownerId || staff?.id || null,
        is_test: isTest,
      })
      .select('*')
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'Insert failed.');
      return;
    }
    navigate(`/sales/companies/${data.id}`);
  };

  return (
    <RecordPage title="Accounts: New Account" icon={<HandshakeIcon size={40} />}>
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
          <div className="field sales-span-2">
            <span className="field-label">Types</span>
            <div className="sales-badges">
              {ALL_TYPES.map((t) => (
                <label key={t} className="sales-checkbox">
                  <input
                    type="checkbox"
                    checked={types.includes(t)}
                    onChange={() => toggleType(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <Input
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label="State / region"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
          <Input
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Select
            label="Owner"
            options={staffOptions}
            placeholder="Unassigned"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
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
          <Button onClick={() => navigate('/sales/companies')}>Cancel</Button>
          <Button onClick={resetForm}>Reset</Button>
        </div>
      </form>
    </RecordPage>
  );
}
