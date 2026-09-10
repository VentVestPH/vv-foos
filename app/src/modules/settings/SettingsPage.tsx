import './settings.css';
import { RecordPage, RecordSection } from '../../components/ui/RecordPage';
import { PlaceholderAction } from '../../shell/Placeholder';
import { Settings as GearIcon } from 'lucide-react';
import { EmailTemplatesCard } from './EmailTemplatesCard';
import { GoogleIntegrationCard } from './GoogleIntegrationCard';
import { DataExportCard } from './DataExportCard';

export function SettingsPage() {
  return (
    <RecordPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Settings' }]}
      title="Administration: Settings"
      icon={<GearIcon size={32} />}
    >
      <RecordSection title="Google Integration:">
        <GoogleIntegrationCard />
        <EmailTemplatesCard />
      </RecordSection>

      <RecordSection title="Data Export:">
        <DataExportCard />
      </RecordSection>

      <RecordSection title="Other administration areas" defaultOpen={false}>
        <p className="text-secondary">These areas are not available yet.</p>
        <div className="settings-other-admin-actions">
          <PlaceholderAction label="General Configuration" size="sm" />
          <PlaceholderAction label="Career Section" size="sm" />
          <PlaceholderAction label="User Accounts" size="sm" />
        </div>
      </RecordSection>
    </RecordPage>
  );
}
