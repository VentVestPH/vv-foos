import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Dialog } from '../components/Dialog';
import { type Person, personEmails } from '../lib';
import type { CandidateOutreach } from './useCandidateOutreach';

export interface CandidateOutreachDialogsProps {
  outreach: CandidateOutreach;
  person: Person;
}

export function CandidateOutreachDialogs({ outreach, person }: CandidateOutreachDialogsProps) {
  return (
    <>
      {outreach.showSendEmail && (
        <Dialog
          title="Send email"
          onClose={() => outreach.closeSendEmail()}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
              <Button variant="primary" onClick={() => void outreach.submitSendEmail()} disabled={outreach.emailBusy}>
                {outreach.emailBusy ? 'Sending…' : 'Send'}
              </Button>
            </>
          )}
        >
          {outreach.templates.length > 0 && (
            <Select
              label="Template"
              placeholder="Start from scratch"
              options={outreach.templates.map((template) => ({
                value: template.id,
                label: template.name,
              }))}
              value=""
              onChange={(e) => outreach.applyTemplateToDraft(e.target.value)}
            />
          )}
          <Input label="To" value={outreach.emailTo} onChange={(e) => outreach.setEmailTo(e.target.value)} />
          <Input
            label="Subject"
            value={outreach.emailSubject}
            onChange={(e) => outreach.setEmailSubject(e.target.value)}
            autoFocus
          />
          <div className="field">
            <label className="field-label" htmlFor="outreach-email-body">
              Message
            </label>
            <textarea
              id="outreach-email-body"
              className="rq-textarea"
              rows={6}
              value={outreach.emailBody}
              onChange={(e) => outreach.setEmailBody(e.target.value)}
            />
          </div>
          <p className="text-secondary">
            Sends through your own connected Gmail account — appears in your Sent folder.
          </p>
          {outreach.emailError && <span className="field-error-text" role="alert">{outreach.emailError}</span>}
        </Dialog>
      )}

      {outreach.showSchedule && (
        <Dialog
          title="Schedule meeting"
          onClose={() => outreach.closeSchedule()}
          footer={(dismiss) => (
            !outreach.meetingLink ? (
              <>
                <Button onClick={dismiss}>Cancel</Button>
                <Button variant="primary" onClick={() => void outreach.submitSchedule()} disabled={outreach.meetingBusy}>
                  {outreach.meetingBusy ? 'Creating…' : 'Create meeting'}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={dismiss}>
                Done
              </Button>
            )
          )}
        >
          {outreach.meetingLink ? (
            <p>
              Meeting created.{' '}
              <a href={outreach.meetingLink} target="_blank" rel="noreferrer">
                Join with Google Meet
              </a>
            </p>
          ) : (
            <>
              <Input
                label="Subject"
                value={outreach.meetingSubject}
                onChange={(e) => outreach.setMeetingSubject(e.target.value)}
                autoFocus
              />
              <Input
                label="Date and time"
                type="datetime-local"
                value={outreach.meetingWhen}
                onChange={(e) => outreach.setMeetingWhen(e.target.value)}
              />
              <Input
                label="Duration (minutes)"
                type="number"
                value={outreach.meetingDuration}
                onChange={(e) => outreach.setMeetingDuration(e.target.value)}
              />
              <p className="text-secondary">
                Creates a real Calendar event with a Google Meet link, inviting{' '}
                {personEmails(person)[0]?.address ?? 'this person'}.
              </p>
              {outreach.meetingError && <span className="field-error-text" role="alert">{outreach.meetingError}</span>}
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
