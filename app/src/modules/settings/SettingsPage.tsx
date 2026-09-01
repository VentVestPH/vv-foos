import './settings.css';
import { RecordPage, RecordSection } from '../../components/ui/RecordPage';
import { TaleoPlaceholderAction } from '../../shell/TaleoPlaceholder';
import { GearIcon } from '../../shell/icons';
import { GoogleIntegrationCard } from './GoogleIntegrationCard';

/**
 * Administration: Settings (prompt section 8.9). Reached from the
 * utility-header gear and Administration dropdown (already wired in the
 * shell — not touched here). The real Google Integration card keeps its
 * connect/sync/disconnect logic completely unchanged; only its surrounding
 * chrome is restyled to the Taleo section/card look via settings.css.
 */
export function SettingsPage() {
  return (
    <RecordPage title="Administration: Settings" icon={<GearIcon size={40} />}>
      <RecordSection title="Google Integration:">
        <GoogleIntegrationCard />
      </RecordSection>

      <RecordSection title="Other Administration Areas:" defaultOpen={false}>
        <p className="text-secondary">
          Other Administration areas are not part of the FOOS MVP. The items below are reachable from the
          utility header's Administration menu and open the same "not available in the current FOOS MVP"
          message as there.
        </p>
        <div className="settings-other-admin-actions">
          {/* FOOS-TBD: no General Configuration module exists yet. */}
          <TaleoPlaceholderAction label="General Configuration" size="sm" />
          {/* FOOS-TBD: no Career Section admin module exists yet. */}
          <TaleoPlaceholderAction label="Career Section" size="sm" />
          {/* FOOS-TBD: no User Accounts admin module exists yet (staff are managed directly in the database today). */}
          <TaleoPlaceholderAction label="User Accounts" size="sm" />
        </div>
      </RecordSection>
    </RecordPage>
  );
}
