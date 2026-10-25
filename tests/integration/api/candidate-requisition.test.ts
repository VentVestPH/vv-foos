import { afterEach, describe, expect, it } from 'vitest';
import { clientAs } from '../../support/env';

const REQUISITION_ONE = 'd0000000-0000-4000-8000-000000000001';
const REQUISITION_TWO = 'd0000000-0000-4000-8000-000000000002';

let personId = '';

async function cleanup() {
  if (!personId) return;
  const admin = await clientAs('admin');
  const { data: applications } = await admin
    .from('applications')
    .select('id')
    .eq('person_id', personId);
  const applicationIds = (applications ?? []).map((application) => application.id);
  const relatedIds = [personId, ...applicationIds];
  await admin.from('tasks').delete().in('related_id', relatedIds);
  await admin.from('reminders').delete().in('related_id', relatedIds);
  await admin.from('attachments').delete().in('parent_id', relatedIds);
  await admin.from('candidate_profiles').delete().eq('person_id', personId);
  await admin.from('people').delete().eq('id', personId);
  personId = '';
}

describe('candidate requisition associations', () => {
  afterEach(cleanup);

  it('removes one requisition association while preserving candidate history and related records', async () => {
    const admin = await clientAs('admin');
    const tag = `QA requisition ${Date.now()}`;
    const { data: person, error: personError } = await admin
      .from('people')
      .insert({
        first_name: 'QA',
        last_name: `Candidate ${Date.now()}`,
        emails: [{ type: 'work', address: `${Date.now()}@example.test` }],
        is_test: true,
      })
      .select('id')
      .single();
    expect(personError).toBeNull();
    personId = person!.id;
    const { error: profileError } = await admin
      .from('candidate_profiles')
      .insert({ person_id: personId });
    expect(profileError).toBeNull();

    const { data: applications, error: applicationsError } = await admin
      .from('applications')
      .insert([
        { person_id: personId, requisition_id: REQUISITION_ONE },
        { person_id: personId, requisition_id: REQUISITION_TWO },
      ])
      .select('id, requisition_id');
    expect(applicationsError).toBeNull();
    const removed = applications!.find((application) => application.requisition_id === REQUISITION_ONE)!;

    const { data: activity, error: activityError } = await admin
      .from('activities')
      .insert({ kind: 'note', subject: tag, application_id: removed.id })
      .select('id')
      .single();
    expect(activityError).toBeNull();
    const { data: task, error: taskError } = await admin
      .from('tasks')
      .insert({ subject: tag, related_type: 'application', related_id: removed.id })
      .select('id')
      .single();
    expect(taskError).toBeNull();
    const { data: reminder, error: reminderError } = await admin
      .from('reminders')
      .insert({
        staff_id: 'a0000000-0000-4000-8000-000000000005',
        subject: tag,
        remind_at: new Date(Date.now() + 86400000).toISOString(),
        related_type: 'application',
        related_id: removed.id,
      })
      .select('id')
      .single();
    expect(reminderError).toBeNull();
    const { data: attachment, error: attachmentError } = await admin
      .from('attachments')
      .insert({
        storage_path: `qa/${personId}/${Date.now()}.pdf`,
        parent_type: 'application',
        parent_id: removed.id,
        kind: 'resume',
        description: tag,
      })
      .select('id')
      .single();
    expect(attachmentError).toBeNull();

    const { error: removeError } = await admin.rpc('remove_candidate_from_requisition', {
      p_application_id: removed.id,
    });
    expect(removeError).toBeNull();

    const { data: remaining } = await admin
      .from('applications')
      .select('requisition_id')
      .eq('person_id', personId);
    expect(remaining).toEqual([{ requisition_id: REQUISITION_TWO }]);

    const { data: savedActivity } = await admin
      .from('activities')
      .select('person_id, application_id')
      .eq('id', activity!.id)
      .single();
    expect(savedActivity).toEqual({ person_id: personId, application_id: null });

    const { data: savedTask } = await admin
      .from('tasks')
      .select('related_type, related_id')
      .eq('id', task!.id)
      .single();
    expect(savedTask).toEqual({ related_type: 'person', related_id: personId });

    const { data: savedReminder } = await admin
      .from('reminders')
      .select('related_type, related_id')
      .eq('id', reminder!.id)
      .single();
    expect(savedReminder).toEqual({ related_type: 'person', related_id: personId });

    const { data: savedAttachment } = await admin
      .from('attachments')
      .select('parent_type, parent_id')
      .eq('id', attachment!.id)
      .single();
    expect(savedAttachment).toEqual({ parent_type: 'person', parent_id: personId });
  });

  async function personWithApplication(stage: string) {
    const admin = await clientAs('admin');
    const { data: person, error: personError } = await admin
      .from('people')
      .insert({ first_name: 'QA', last_name: `Guard ${Date.now()}`, is_test: true })
      .select('id')
      .single();
    expect(personError).toBeNull();
    personId = person!.id;
    await admin.from('candidate_profiles').insert({ person_id: personId });
    const { data: application, error } = await admin
      .from('applications')
      .insert({ person_id: personId, requisition_id: REQUISITION_ONE, stage })
      .select('id')
      .single();
    expect(error).toBeNull();
    return application!.id as string;
  }

  it('records the removal in audit_log', async () => {
    const applicationId = await personWithApplication('screening');
    const admin = await clientAs('admin');
    const { error } = await admin.rpc('remove_candidate_from_requisition', { p_application_id: applicationId });
    expect(error).toBeNull();
    const { data: audit } = await admin
      .from('audit_log')
      .select('action, table_name')
      .eq('record_id', applicationId)
      .eq('action', 'delete');
    expect(audit).toEqual([{ action: 'delete', table_name: 'applications' }]);
  });

  it('refuses to remove an application at offer, which is placement history', async () => {
    const applicationId = await personWithApplication('offer');
    const admin = await clientAs('admin');
    const { error } = await admin.rpc('remove_candidate_from_requisition', { p_application_id: applicationId });
    expect(error?.message).toMatch(/offer or hired cannot be removed/);
    const { data: still } = await admin.from('applications').select('id').eq('id', applicationId);
    expect(still).toHaveLength(1);
  });

  it('refuses a sourcer, whatever the stage', async () => {
    const applicationId = await personWithApplication('screening');
    const sourcer = await clientAs('sourcer');
    const { error } = await sourcer.rpc('remove_candidate_from_requisition', { p_application_id: applicationId });
    expect(error?.message).toMatch(/only an admin or recruiter/);
  });
});
