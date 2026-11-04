import { RecordEditDialog } from '../../../components/ui/RecordEditDialog';
import { useStaffList } from '../hooks';
import type { Company } from '../lib';
import { companyEditFields, companyEditValues, saveCompany } from './companyEdit';

export interface CompanyEditDialogProps {
  company: Company;
  onClose: () => void;
  onSaved: () => void;
}

export function CompanyEditDialog({ company, onClose, onSaved }: CompanyEditDialogProps) {
  const { staffOptions } = useStaffList();

  const save = async (draft: Parameters<typeof saveCompany>[1]) => {
    await saveCompany(company, draft);
    onSaved();
  };

  return (
    <RecordEditDialog
      title="Edit account"
      fields={companyEditFields(company, staffOptions)}
      values={companyEditValues(company)}
      required={['name']}
      onClose={onClose}
      onSave={save}
    />
  );
}
