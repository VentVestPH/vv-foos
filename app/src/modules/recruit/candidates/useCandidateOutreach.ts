import { useState } from 'react';
import { scheduleMeeting, sendEmail } from '../../../lib/googleActions';
import { type Person, personEmails, personName } from '../lib';

export interface CandidateOutreach {
  showSendEmail: boolean;
  closeSendEmail: () => void;
  emailTo: string;
  setEmailTo: (value: string) => void;
  emailSubject: string;
  setEmailSubject: (value: string) => void;
  emailBody: string;
  setEmailBody: (value: string) => void;
  emailBusy: boolean;
  emailError: string | null;
  openSendEmail: () => void;
  submitSendEmail: () => Promise<void>;
  showSchedule: boolean;
  closeSchedule: () => void;
  meetingSubject: string;
  setMeetingSubject: (value: string) => void;
  meetingWhen: string;
  setMeetingWhen: (value: string) => void;
  meetingDuration: string;
  setMeetingDuration: (value: string) => void;
  meetingBusy: boolean;
  meetingError: string | null;
  meetingLink: string | null;
  openSchedule: () => void;
  submitSchedule: () => Promise<void>;
}

export function useCandidateOutreach(
  personId: string,
  person: Person | null,
  onSent: () => Promise<void>,
): CandidateOutreach {
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [showSchedule, setShowSchedule] = useState(false);
  const [meetingSubject, setMeetingSubject] = useState('');
  const [meetingWhen, setMeetingWhen] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('30');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  const openSendEmail = () => {
    const primary = personEmails(person as Person)[0]?.address ?? '';
    setEmailTo(primary);
    setEmailSubject('');
    setEmailBody('');
    setEmailError(null);
    setShowSendEmail(true);
  };

  const submitSendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) {
      setEmailError('To, subject, and message are all required.');
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    const { error: err } = await sendEmail({
      personId,
      to: emailTo.trim(),
      subject: emailSubject.trim(),
      bodyText: emailBody.trim(),
    });
    setEmailBusy(false);
    if (err) {
      setEmailError(err);
      return;
    }
    setShowSendEmail(false);
    await onSent();
  };

  const openSchedule = () => {
    setMeetingSubject(`Screen: ${personName(person as Person)}`);
    setMeetingWhen('');
    setMeetingDuration('30');
    setMeetingError(null);
    setMeetingLink(null);
    setShowSchedule(true);
  };

  const submitSchedule = async () => {
    const attendee = personEmails(person as Person)[0]?.address;
    if (!attendee) {
      setMeetingError('This person has no email on file to invite.');
      return;
    }
    if (!meetingSubject.trim() || !meetingWhen) {
      setMeetingError('Subject and date/time are required.');
      return;
    }
    setMeetingBusy(true);
    setMeetingError(null);
    const { data, error: err } = await scheduleMeeting({
      personId,
      attendeeEmails: [attendee],
      subject: meetingSubject.trim(),
      startIso: new Date(meetingWhen).toISOString(),
      durationMinutes: Number(meetingDuration) || 30,
    });
    setMeetingBusy(false);
    if (err) {
      setMeetingError(err);
      return;
    }
    setMeetingLink(data?.meetLink ?? null);
    await onSent();
  };

  return {
    showSendEmail,
    closeSendEmail: () => setShowSendEmail(false),
    emailTo,
    setEmailTo,
    emailSubject,
    setEmailSubject,
    emailBody,
    setEmailBody,
    emailBusy,
    emailError,
    openSendEmail,
    submitSendEmail,
    showSchedule,
    closeSchedule: () => setShowSchedule(false),
    meetingSubject,
    setMeetingSubject,
    meetingWhen,
    setMeetingWhen,
    meetingDuration,
    setMeetingDuration,
    meetingBusy,
    meetingError,
    meetingLink,
    openSchedule,
    submitSchedule,
  };
}
