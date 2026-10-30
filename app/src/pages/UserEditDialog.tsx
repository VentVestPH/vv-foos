import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { FoDialog } from '../components/ui/FoDialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import {
  createUser,
  updateUser,
  type AdminUserRow,
  type StaffChangeInput,
} from '../lib/adminUsers';
import type { StaffRole } from '../lib/database.types';

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'sourcer', label: 'Sourcer' },
  { value: 'bd', label: 'Business development' },
];

const ROLE_LABEL = new Map<string, string>(ROLE_OPTIONS.map((o) => [o.value, o.label]));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserEditDialogProps {
  user: AdminUserRow | null;
  currentStaffId: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function isStaffRole(value: string): value is StaffRole {
  return ROLE_LABEL.has(value);
}

export function UserEditDialog({ user, currentStaffId, onClose, onSaved }: UserEditDialogProps) {
  const isNew = user === null;
  const isSelf = user !== null && user.staffId === currentStaffId;

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [title, setTitle] = useState(user?.title ?? '');
  const [role, setRole] = useState<string>(user?.role ?? '');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(
    () => ({
      fullName: fullName.trim().length === 0 ? 'Enter a name' : undefined,
      email: EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address',
      role: isStaffRole(role) ? undefined : 'Choose a role',
    }),
    [fullName, email, role],
  );
  const invalid = Boolean(errors.fullName ?? errors.email ?? errors.role);

  const change = useMemo<StaffChangeInput>(() => {
    if (user === null) return {};
    const next: StaffChangeInput = {};
    if (fullName.trim() !== user.fullName) next.fullName = fullName.trim();
    if (email.trim().toLowerCase() !== user.email.toLowerCase()) next.email = email.trim();
    const nextTitle = title.trim().length === 0 ? null : title.trim();
    if (nextTitle !== (user.title ?? null)) next.title = nextTitle;
    if (role !== user.role && isStaffRole(role)) next.role = role;
    if (isActive !== user.isActive) next.isActive = isActive;
    return next;
  }, [user, fullName, email, title, role, isActive]);

  const nothingChanged = !isNew && Object.keys(change).length === 0;
  const needsConfirm = change.role !== undefined || change.isActive !== undefined;

  const save = async () => {
    if (!isStaffRole(role)) return;
    setBusy(true);
    setError(null);
    if (user === null) {
      const { error: err } = await createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        title: title.trim().length === 0 ? null : title.trim(),
        role,
      });
      setBusy(false);
      if (err) {
        setError(err);
        return;
      }
      onSaved(
        `${fullName.trim()} was added. They can sign in with Google as ${email.trim().toLowerCase()}, or you can generate a temporary password from their row.`,
      );
      return;
    }
    const { error: err } = await updateUser(user.staffId, change);
    setBusy(false);
    if (err) {
      setError(err);
      setConfirming(false);
      return;
    }
    onSaved(`Saved changes to ${change.fullName ?? user.fullName}.`);
  };

  const submit = () => {
    setAttempted(true);
    if (invalid || nothingChanged) return;
    if (needsConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    void save();
  };

  const heading = isNew ? 'Add user' : confirming ? 'Confirm changes' : 'Edit user';

  return (
    <FoDialog
      title={heading}
      onClose={onClose}
      footer={(close) =>
        confirming ? (
          <>
            <Button disabled={busy} onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button variant="primary" loading={busy} onClick={submit}>
              Confirm and save
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={nothingChanged}
              title={nothingChanged ? 'Nothing has changed yet' : undefined}
              onClick={submit}
            >
              {isNew ? 'Add user' : needsConfirm ? 'Review changes' : 'Save changes'}
            </Button>
          </>
        )
      }
    >
      {confirming && user !== null ? (
        <>
          <p>
            <strong>{user.fullName}</strong> ({user.email})
          </p>
          {change.role !== undefined && (
            <p>
              Role changes from {ROLE_LABEL.get(user.role) ?? user.role} to{' '}
              {ROLE_LABEL.get(change.role) ?? change.role}. What they can open and edit changes
              the next time their page loads.
            </p>
          )}
          {change.isActive === false && (
            <p>
              This turns their access off. They stay on the list, but the app shows them
              &ldquo;Account not provisioned&rdquo; until you turn it back on.
            </p>
          )}
          {change.isActive === true && <p>This turns their access back on.</p>}
        </>
      ) : (
        <>
          <div className="fo-form-grid">
            <Input
              label="Full name"
              required
              value={fullName}
              maxLength={120}
              error={attempted ? errors.fullName : undefined}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              maxLength={254}
              error={attempted ? errors.email : undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Select
              label="Role"
              required
              {...(isNew ? { placeholder: 'Choose a role' } : {})}
              options={ROLE_OPTIONS}
              value={role}
              disabled={isSelf}
              title={isSelf ? "You can't change your own role" : undefined}
              error={attempted ? errors.role : undefined}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          {!isNew && (
            <label className="checkline">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isSelf}
                title={isSelf ? "You can't deactivate your own account" : undefined}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active (can use the app)
            </label>
          )}
          <p className="text-secondary">
            {isNew
              ? 'This creates the staff record and a sign-in for the same email, so they can use Google sign-in straight away.'
              : 'Changing the email also changes the address they sign in with.'}
          </p>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </FoDialog>
  );
}
