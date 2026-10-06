import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users as UsersIcon, KeyRound, Mail } from 'lucide-react';
import { ListPage } from '../components/ui/ListPage';
import { Table, type TableColumn } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ActionMenu } from '../components/ui/ActionMenu';
import { FoDialog } from '../components/ui/FoDialog';
import { TableSkeleton } from '../components/ui/TableSkeleton';
import { USERS_COLUMNS } from '../components/ui/PageSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { useSubmittedSearch } from '../lib/quickSearch';
import { EMPTY_CELL } from '../lib/format';
import { localSearchHints } from '../lib/searchHints';
import {
  listUsers,
  issueTempPassword,
  sendPasswordReset,
  type AdminUserRow,
} from '../lib/adminUsers';

const ROLE_TONE: Record<string, 'primary' | 'neutral'> = {
  admin: 'primary',
};

function fmtWhen(value: string | null): string {
  if (!value) return EMPTY_CELL;
  return new Date(value).toLocaleString();
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await listUsers();
    if (err) {
      setError(err);
      setUsers([]);
    } else {
      setError(null);
      setUsers(data?.users ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const searchHints = useMemo(
    () =>
      localSearchHints(
        '/users',
        users.map((u) => ({
          key: `user:${u.staffId}`,
          primary: u.fullName,
          meta: [u.email, u.role, u.title].filter(Boolean).join(' · '),
          text: [u.fullName, u.email, u.role, u.title ?? ''],
        })),
      ),
    [users],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.role, u.title ?? ''].some((v) => v.toLowerCase().includes(term)),
    );
  }, [users, search]);

  const tempPassword = async (user: AdminUserRow) => {
    setBusyId(user.staffId);
    setNotice(null);
    const { data, error: err } = await issueTempPassword(user.staffId);
    setBusyId(null);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setCopied(false);
    setIssued({ email: data?.email ?? user.email, password: data?.password ?? '' });
    void load();
  };

  const resetLink = async (user: AdminUserRow) => {
    setBusyId(user.staffId);
    setNotice(null);
    const { data, error: err } = await sendPasswordReset(
      user.staffId,
      `${window.location.origin}/login`,
    );
    setBusyId(null);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setNotice(`Password reset email sent to ${data?.email ?? user.email}.`);
  };

  const columns: TableColumn<AdminUserRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (u) => (
        <span className="sales-badges">
          {u.fullName}
          {!u.isActive && <Badge tone="neutral">Inactive</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <Badge tone={ROLE_TONE[u.role] ?? 'neutral'}>{u.role}</Badge>,
    },
    {
      key: 'title',
      header: 'Title',
      hideWhenEmpty: true,
      render: (u) => u.title ?? EMPTY_CELL,
    },
    {
      key: 'canSignIn',
      header: 'Sign-in',
      sortValue: (u) => (u.canSignIn ? '1' : '0'),
      render: (u) =>
        u.canSignIn ? (
          u.providers.length > 0 ? (
            u.providers.join(', ')
          ) : (
            'password'
          )
        ) : (
          <span className="text-secondary">no login</span>
        ),
    },
    {
      key: 'lastSignInAt',
      header: 'Last sign-in',
      render: (u) => fmtWhen(u.lastSignInAt),
    },
    {
      key: 'actions',
      header: '',
      align: 'center',
      render: (u) => (
        <ActionMenu
          label={`Actions for ${u.fullName}`}
          iconOnly
          items={[
            {
              label: busyId === u.staffId ? 'Working…' : 'Generate temporary password',
              onSelect: () => void tempPassword(u),
              disabled: busyId !== null || !u.email,
              title: u.email ? undefined : 'This staff row has no email address',
            },
            {
              label: 'Send password reset email',
              onSelect: () => void resetLink(u),
              disabled: busyId !== null || !u.email || !u.canSignIn,
              title: !u.canSignIn
                ? 'This person has no sign-in yet, so there is nothing to reset. Give them a temporary password instead'
                : undefined,
            },
          ]}
        />
      ),
    },
  ];

  const showSkeleton = useMinimumVisible(loading);

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Users' }]}
      title="Users"
      icon={<UsersIcon size={32} />}
      description="Everyone with a staff record, whether or not they can sign in yet. Issue a temporary password or send a reset when someone is locked out."
      flush
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchPlaceholder="Search name, email, role…"
      searchHints={searchHints}
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-secondary fo-bulk-notice" role="status">
          {notice}
        </p>
      )}

      {showSkeleton ? (
        <TableSkeleton columns={USERS_COLUMNS} label="Loading users" />
      ) : rows.length === 0 && !error ? (
        <EmptyState
          icon={<UsersIcon size={64} aria-hidden="true" />}
          title="No user matches that search"
          hint="Clear the search to see everyone with a staff record."
        />
      ) : (
        <Table
          pageSize={20}
          className="users-table"
          columns={columns}
          rows={rows}
          rowKey={(u) => u.staffId}
          busy={loading}
          emptyText="No users."
        />
      )}

      {issued && (
        <FoDialog
          title="Temporary password"
          onClose={() => setIssued(null)}
          footer={(close) => (
            <>
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(issued.password).then(() => setCopied(true));
                }}
              >
                {copied ? 'Copied' : 'Copy password'}
              </Button>
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            </>
          )}
        >
          <p>
            <strong>{issued.email}</strong> can now sign in with the password below.
          </p>
          <p className="user-temp-password">
            <KeyRound size={20} aria-hidden="true" />
            <code>{issued.password}</code>
          </p>
          <p className="text-secondary">
            This is shown once and is not stored anywhere you can read it back. Send it to them
            over a channel they already trust, and ask them to change it. Their previous password
            stopped working the moment this was generated.
          </p>
          <p className="text-secondary">
            <Mail size={20} aria-hidden="true" /> If you would rather they set their own, close
            this and use Send password reset email instead.
          </p>
        </FoDialog>
      )}
    </ListPage>
  );
}
