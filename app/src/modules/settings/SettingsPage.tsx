import './settings.css';
import { RecordPage, RecordSection } from '../../components/ui/RecordPage';
import { TaleoPlaceholderAction } from '../../shell/TaleoPlaceholder';
import { Settings as GearIcon } from 'lucide-react';
import { GoogleIntegrationCard } from './GoogleIntegrationCard';

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
          <TaleoPlaceholderAction label="General Configuration" size="sm" />
          <TaleoPlaceholderAction label="Career Section" size="sm" />
          <TaleoPlaceholderAction label="User Accounts" size="sm" />
        </div>
      </RecordSection>
    </RecordPage>
  );
}
