import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { AlertCircle, Check, ExternalLink, FileText, Link2, MessageSquare, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DateField } from '../../../components/ui/DateField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SearchBox } from '../../../components/ui/SearchBox';
import { useSession } from '../../../auth/SessionProvider';
import { supabase } from '../../../lib/supabase';
import { ticketSearchHints, type SearchHint } from '../../../lib/searchHints';
import type { Tables, TicketStatus } from '../../../lib/database.types';
import { useCanEditCrm, useCompanyOptions, useContactOptions, useStaffList } from '../hooks';
import { TicketRichText, type RichTextHandle } from './TicketRichText';
import {
  TICKET_COMMENT_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  dueIso,
  htmlForStorage,
  htmlToText,
  inlineImagePaths,
  localDueParts,
  preparePendingFiles,
  referencedPendingIds,
  releasePreviews,
  removeTicketFiles,
  sanitizeTicketHtml,
  signedUrls,
  uploadTicketFiles,
  validTicketUrl,
  type InlineImage,
  type PendingFile,
} from './ticketContent';

type Ticket = Tables<'tickets'>;
type Comment = Tables<'ticket_comments'>;
type HistoryEntry = Tables<'ticket_history'>;
type TicketLink = Tables<'ticket_links'>;
type ExternalLinkRow = Tables<'ticket_external_links'>;
type TicketOption = { id: string; display_code: string; subject: string; status: TicketStatus };
type AttachmentRow = { id: string; storage_path: string; description: string | null; file_size_bytes: number | null };
type ImageLink = { comment_id: string; attachment_id: string };
type ActivityTab = 'all' | 'comments' | 'history';
type SidebarField = 'status' | 'priority' | 'assignee' | 'company' | 'contact' | 'due';

const ACTIVITY_TABS: { key: ActivityTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'comments', label: 'Comments' },
  { key: 'history', label: 'History' },
];

const FIELD_LABEL: Record<string, string> = {
  subject: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  assignee_id: 'assignee',
  company_id: 'account',
  person_id: 'contact',
  sla_due_at: 'due date',
  resolved_at: 'resolved',
  tags: 'tags',
};

const LINK_RELATIONSHIPS = [
  { value: 'relates_to', label: 'Relates to' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'blocked_by', label: 'Is blocked by' },
];

function changesOf(entry: HistoryEntry): Record<string, unknown> {
  return entry.changes && typeof entry.changes === 'object' && !Array.isArray(entry.changes)
    ? (entry.changes as Record<string, unknown>)
    : {};
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageName(name: string | null): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(name ?? '');
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2);
}

export function TicketDetailView({ ticket: initialTicket, onSaved }: { ticket: Ticket; onSaved: (ticket: Ticket) => void }) {
  const { staff: me } = useSession();
  const { staff: staffRows, staffOptions } = useStaffList();
  const { companies, companyOptions } = useCompanyOptions();
  const contacts = useContactOptions();
  const canEdit = useCanEditCrm();

  const [ticket, setTicket] = useState(initialTicket);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [links, setLinks] = useState<TicketLink[]>([]);
  const [linkTickets, setLinkTickets] = useState<Map<string, TicketOption>>(new Map());
  const [externalLinks, setExternalLinks] = useState<ExternalLinkRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [imageLinks, setImageLinks] = useState<ImageLink[]>([]);
  const [urlByPath, setUrlByPath] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ActivityTab>('comments');
  const loadSeq = useRef(0);

  const initialDue = localDueParts(initialTicket.sla_due_at);
  const [editingContent, setEditingContent] = useState<'title' | 'description' | null>(null);
  const [editingField, setEditingField] = useState<SidebarField | null>(null);
  const [subject, setSubject] = useState(initialTicket.subject);
  const [companyId, setCompanyId] = useState(initialTicket.company_id ?? '');
  const [personId, setPersonId] = useState(initialTicket.person_id ?? '');
  const [status, setStatus] = useState<string>(initialTicket.status);
  const [priority, setPriority] = useState(initialTicket.priority ?? 'normal');
  const [assigneeId, setAssigneeId] = useState(initialTicket.assignee_id ?? '');
  const [slaDate, setSlaDate] = useState(initialDue.date);
  const [slaTime, setSlaTime] = useState(initialDue.time);
  const [savingTicket, setSavingTicket] = useState(false);
  const descriptionEditor = useRef<RichTextHandle | null>(null);
  const [descriptionFiles, setDescriptionFiles] = useState<PendingFile[]>([]);

  const commentEditor = useRef<RichTextHandle | null>(null);
  const [commentEmpty, setCommentEmpty] = useState(true);
  const [commentFiles, setCommentFiles] = useState<PendingFile[]>([]);
  const [posting, setPosting] = useState(false);
  const editCommentEditor = useRef<RichTextHandle | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [selectedLinkedTicket, setSelectedLinkedTicket] = useState<{ id: string; label: string } | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('relates_to');

  const editing = canEdit && (editingContent !== null || editingField !== null);

  const staffById = useMemo(() => new Map(staffRows.map((row) => [row.id, row.full_name])), [staffRows]);
  const companyById = useMemo(() => new Map(companies.map((row) => [row.id, row.name])), [companies]);
  const contactById = useMemo(() => new Map(contacts.map((row) => [row.value, row.label])), [contacts]);
  const staffName = useCallback((id: string | null | undefined) => (id ? staffById.get(id) ?? 'Former staff member' : 'Unassigned'), [staffById]);

  const loadActivity = useCallback(async () => {
    const seq = ++loadSeq.current;
    const [commentResult, historyResult, linkResult, externalResult, fileResult] = await Promise.all([
      supabase.from('ticket_comments').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
      supabase.from('ticket_history').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: false }).order('id'),
      supabase.from('ticket_links').select('*').or(`ticket_id.eq.${ticket.id},linked_ticket_id.eq.${ticket.id}`).order('created_at', { ascending: false }),
      supabase.from('ticket_external_links').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: false }),
      supabase.from('attachments').select('id, storage_path, description, file_size_bytes').eq('parent_type', 'ticket').eq('parent_id', ticket.id).order('uploaded_at', { ascending: false }),
    ]);
    const failure = commentResult.error ?? historyResult.error ?? linkResult.error ?? externalResult.error ?? fileResult.error;
    const nextComments = commentResult.data ?? [];
    const nextHistory = historyResult.data ?? [];
    const nextLinks = linkResult.data ?? [];
    const nextFiles = fileResult.data ?? [];
    const relatedIds = new Set(nextLinks.map((link) => (link.ticket_id === ticket.id ? link.linked_ticket_id : link.ticket_id)));
    for (const entry of nextHistory) {
      const linked = changesOf(entry).linked_ticket_id;
      if (typeof linked === 'string') relatedIds.add(linked);
    }
    const commentIds = nextComments.map((comment) => comment.id);
    const [imageResult, relatedResult, urls] = await Promise.all([
      commentIds.length
        ? supabase.from('ticket_comment_images').select('comment_id, attachment_id').in('comment_id', commentIds)
        : Promise.resolve({ data: [] as ImageLink[], error: null }),
      relatedIds.size
        ? supabase.from('ticket_list').select('id, display_code, subject, status').in('id', [...relatedIds])
        : Promise.resolve({ data: [] as TicketOption[], error: null }),
      signedUrls(nextFiles.map((file) => file.storage_path)),
    ]);
    if (seq !== loadSeq.current) return;
    setError(failure?.message ?? imageResult.error?.message ?? relatedResult.error?.message ?? null);
    setComments(nextComments);
    setHistory(nextHistory);
    setLinks(nextLinks);
    setExternalLinks(externalResult.data ?? []);
    setAttachments(nextFiles);
    setImageLinks(imageResult.data ?? []);
    setLinkTickets(new Map((relatedResult.data ?? []).map((item) => [item.id, item])));
    setUrlByPath(urls);
    setLoaded(true);
  }, [ticket.id]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const descriptionFilesRef = useRef(descriptionFiles);
  const commentFilesRef = useRef(commentFiles);
  descriptionFilesRef.current = descriptionFiles;
  commentFilesRef.current = commentFiles;
  useEffect(() => () => {
    releasePreviews(descriptionFilesRef.current);
    releasePreviews(commentFilesRef.current);
  }, []);

  const inlineImages = useMemo<InlineImage[]>(
    () => attachments.flatMap((file) => {
      const url = urlByPath.get(file.storage_path);
      return url ? [{ storage_path: file.storage_path, url, name: file.description ?? 'Ticket file' }] : [];
    }),
    [attachments, urlByPath],
  );

  const imagesByComment = useMemo(() => {
    const byAttachment = new Map(attachments.map((file) => [file.id, file]));
    const grouped = new Map<string, (InlineImage & { attachment_id: string })[]>();
    for (const link of imageLinks) {
      const file = byAttachment.get(link.attachment_id);
      const url = file && urlByPath.get(file.storage_path);
      if (!file || !url) continue;
      const list = grouped.get(link.comment_id) ?? [];
      list.push({ attachment_id: file.id, storage_path: file.storage_path, url, name: file.description ?? 'Comment image' });
      grouped.set(link.comment_id, list);
    }
    return grouped;
  }, [attachments, imageLinks, urlByPath]);

  const renderedComments = useMemo(() => new Map(comments.map((comment) => {
    const images = imagesByComment.get(comment.id) ?? [];
    return [comment.id, {
      html: sanitizeTicketHtml(comment.body, images, 'Comment image'),
      files: images.filter((image) => !comment.body.includes(image.storage_path)),
    }];
  })), [comments, imagesByComment]);

  const displayedDescription = useMemo(
    () => sanitizeTicketHtml(ticket.description, inlineImages, 'Ticket description image'),
    [ticket.description, inlineImages],
  );
  const downloadableFiles = useMemo(() => {
    const inline = inlineImagePaths(ticket.description);
    const commentAttachmentIds = new Set(imageLinks.map((link) => link.attachment_id));
    return attachments.filter((file) => !inline.has(file.storage_path) && !commentAttachmentIds.has(file.id));
  }, [attachments, imageLinks, ticket.description]);

  const describeValue = useCallback((field: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'assignee_id') return staffName(String(value));
    if (field === 'company_id') return companyById.get(String(value)) ?? 'Former account';
    if (field === 'person_id') return contactById.get(String(value)) ?? 'Linked person';
    if (field === 'sla_due_at' || field === 'resolved_at') return new Date(String(value)).toLocaleString();
    if (field === 'description') return truncate(htmlToText(String(value)), 160) || '—';
    if (Array.isArray(value)) return value.join(', ') || '—';
    return String(value);
  }, [companyById, contactById, staffName]);

  const historyView = useMemo(() => history.map((entry) => {
    const actor = entry.actor_id ? staffName(entry.actor_id) : 'System';
    const changes = changesOf(entry);
    const linked = typeof changes.linked_ticket_id === 'string' ? linkTickets.get(changes.linked_ticket_id) : undefined;
    const linkedLabel = linked ? `${linked.display_code} · ${linked.subject}` : 'another ticket';
    let label: string;
    let detail = '';
    switch (entry.event_type) {
      case 'ticket_created':
        label = `${actor} created this ticket`;
        break;
      case 'ticket_updated': {
        const keys = Object.keys(changes);
        label = `${actor} updated ${keys.map((key) => FIELD_LABEL[key] ?? key.replace(/_/g, ' ')).join(', ') || 'the ticket'}`;
        detail = keys.map((key) => {
          const pair = changes[key] as { from?: unknown; to?: unknown };
          return `${FIELD_LABEL[key] ?? key.replace(/_/g, ' ')}: ${describeValue(key, pair.from)} → ${describeValue(key, pair.to)}`;
        }).join(' · ');
        break;
      }
      case 'comment_added':
        label = `${actor} added a comment`;
        break;
      case 'comment_edited':
        label = `${actor} edited a comment`;
        detail = changes.to ? `“${truncate(htmlToText(String(changes.to)), 160)}”` : '';
        break;
      case 'comment_deleted':
        label = `${actor} deleted a comment`;
        break;
      case 'ticket_linked':
        label = `${actor} linked ${linkedLabel}`;
        detail = String(changes.relationship ?? '').replace(/_/g, ' ');
        break;
      case 'ticket_unlinked':
        label = `${actor} removed the link to ${linkedLabel}`;
        break;
      case 'resource_linked':
        label = `${actor} added a link`;
        detail = String(changes.label ?? changes.url ?? '');
        break;
      case 'resource_unlinked':
        label = `${actor} removed a link`;
        detail = String(changes.label ?? changes.url ?? '');
        break;
      default:
        label = `${actor} updated this ticket`;
    }
    return { entry, label, detail };
  }), [describeValue, history, linkTickets, staffName]);

  const linkedRows = useMemo(() => links.map((link) => ({
    row: link,
    otherId: link.ticket_id === ticket.id ? link.linked_ticket_id : link.ticket_id,
    relationship: link.relationship === 'relates_to' ? 'relates to' : link.ticket_id === ticket.id ? 'blocks' : 'is blocked by',
  })), [links, ticket.id]);

  const allActivity = useMemo(() => [
    ...comments.map((comment) => ({ kind: 'comment' as const, key: `comment-${comment.id}`, created_at: comment.created_at, comment })),
    ...historyView.filter((item) => item.entry.event_type !== 'comment_added' && item.entry.event_type !== 'ticket_linked' && item.entry.event_type !== 'resource_linked')
      .map((item) => ({ kind: 'history' as const, key: item.entry.id, created_at: item.entry.created_at, item })),
    ...linkedRows.map((linked) => ({ kind: 'link' as const, key: `link-${linked.row.id}`, created_at: linked.row.created_at, linked })),
    ...externalLinks.map((link) => ({ kind: 'external' as const, key: `external-${link.id}`, created_at: link.created_at, link })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)), [comments, externalLinks, historyView, linkedRows]);

  const newestComments = useMemo(() => [...comments].reverse(), [comments]);
  const commentCount = useMemo(() => comments.filter((comment) => !comment.deleted_at).length, [comments]);
  const contactChoices = useMemo(
    () => contacts.filter((contact) => !companyId || contact.companyId === companyId || contact.value === personId),
    [companyId, contacts, personId],
  );

  const resetDrafts = useCallback(() => {
    const due = localDueParts(ticket.sla_due_at);
    setSubject(ticket.subject);
    setCompanyId(ticket.company_id ?? '');
    setPersonId(ticket.person_id ?? '');
    setStatus(ticket.status);
    setPriority(ticket.priority ?? 'normal');
    setAssigneeId(ticket.assignee_id ?? '');
    setSlaDate(due.date);
    setSlaTime(due.time);
  }, [ticket]);

  const cancelEdit = useCallback(() => {
    resetDrafts();
    setDescriptionFiles((current) => {
      releasePreviews(current);
      return [];
    });
    setEditingContent(null);
    setEditingField(null);
    setError(null);
  }, [resetDrafts]);

  useEffect(() => {
    if (!editing) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (editingField && target.closest(`[data-ticket-sidebar-field="${editingField}"]`)) return;
      if (editingField && target.closest('.sales-ticket-sidebar')) {
        cancelEdit();
        return;
      }
      if (target.closest('.sales-ticket-edit-form, .sales-ticket-save-row, .field-select-menu, .date-dialog, .sales-ticket-image-resize-handle')) return;
      cancelEdit();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [cancelEdit, editing, editingField]);

  const fetchTicketHints = useCallback((term: string) => ticketSearchHints(term, ticket.id), [ticket.id]);

  const startEditing = (target: 'title' | 'description') => {
    if (canEdit) setEditingContent(target);
  };
  const startField = (field: SidebarField) => {
    if (canEdit) setEditingField(field);
  };
  const ignoreLinkClicks = (event: MouseEvent<HTMLElement>, action: () => void) => {
    if (event.target instanceof Element && event.target.closest('a')) return;
    action();
  };

  async function saveTicket() {
    if (!subject.trim()) {
      setError('Ticket title cannot be empty.');
      return;
    }
    const editor = editingContent === 'description' ? descriptionEditor.current : null;
    const rawDescription = editor?.html() ?? '';
    if (editor && htmlToText(rawDescription).length > TICKET_DESCRIPTION_MAX) {
      setError(`Description must be ${TICKET_DESCRIPTION_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    setSavingTicket(true);
    setError(null);
    const referenced = referencedPendingIds(rawDescription);
    const toUpload = editor ? descriptionFiles.filter((file) => !file.inline || referenced.has(file.id)) : [];
    const { uploaded, errors } = await uploadTicketFiles(ticket.id, 'description', toUpload, me?.id ?? null);
    if (errors.length) {
      await removeTicketFiles(uploaded);
      setSavingTicket(false);
      setError(`Files could not be uploaded: ${errors.join('; ')}`);
      return;
    }
    const { data, error: saveError } = await supabase.from('tickets').update({
      subject: subject.trim(),
      ...(editor ? { description: htmlForStorage(rawDescription, uploaded, inlineImages) || null } : {}),
      company_id: companyId || null,
      person_id: personId || null,
      status: status as Ticket['status'],
      priority: priority || null,
      assignee_id: assigneeId || null,
      sla_due_at: dueIso(slaDate, slaTime),
    }).eq('id', ticket.id).select('*').single();
    if (saveError || !data) {
      await removeTicketFiles(uploaded);
      setSavingTicket(false);
      setError(saveError?.message ?? 'Ticket could not be updated.');
      return;
    }
    releasePreviews(descriptionFiles);
    setDescriptionFiles([]);
    setTicket(data);
    onSaved(data);
    setEditingContent(null);
    setEditingField(null);
    setSavingTicket(false);
    void loadActivity();
  }

  const addDescriptionFiles = (files: File[], inline: boolean) => {
    const { added, error: fileError } = preparePendingFiles(files, descriptionFiles.length, inline);
    if (fileError) setError(fileError);
    setDescriptionFiles((current) => [...current, ...added]);
    return added;
  };

  const addCommentFiles = (files: File[], inline: boolean) => {
    const { added, error: fileError } = preparePendingFiles(files, commentFiles.length, inline);
    if (fileError) setError(fileError);
    setCommentFiles((current) => [...current, ...added]);
    return added;
  };

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editor = commentEditor.current;
    if (!editor || !me) return;
    const html = editor.html();
    if (editor.isEmpty() && !commentFiles.length) {
      setError('Add a comment or attach a file before posting.');
      return;
    }
    if (htmlToText(html).length > TICKET_COMMENT_MAX) {
      setError(`A comment must be ${TICKET_COMMENT_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    setPosting(true);
    setError(null);
    const commentId = crypto.randomUUID();
    const referenced = referencedPendingIds(html);
    const toUpload = commentFiles.filter((file) => !file.inline || referenced.has(file.id));
    const { uploaded, errors } = await uploadTicketFiles(ticket.id, `comments/${commentId}`, toUpload, me.id);
    if (errors.length) {
      await removeTicketFiles(uploaded);
      setPosting(false);
      setError(`Files could not be uploaded: ${errors.join('; ')}`);
      return;
    }
    const { error: insertError } = await supabase.from('ticket_comments').insert({
      id: commentId,
      ticket_id: ticket.id,
      author_id: me.id,
      body: htmlForStorage(html, uploaded, []),
    });
    if (insertError) {
      await removeTicketFiles(uploaded);
      setPosting(false);
      setError(insertError.message);
      return;
    }
    if (uploaded.length) {
      const { error: linkError } = await supabase.from('ticket_comment_images')
        .insert(uploaded.map((file) => ({ comment_id: commentId, attachment_id: file.attachmentId })));
      if (linkError) setError(`Comment posted, but its files could not be linked: ${linkError.message}`);
    }
    releasePreviews(commentFiles);
    setCommentFiles([]);
    editor.clear();
    setPosting(false);
    void loadActivity();
  }

  async function saveCommentEdit(comment: Comment) {
    const editor = editCommentEditor.current;
    if (!editor || !me) return;
    if (editor.isEmpty()) {
      setError('A comment cannot be empty.');
      return;
    }
    const body = htmlForStorage(editor.html(), [], imagesByComment.get(comment.id) ?? []);
    if (htmlToText(body).length > TICKET_COMMENT_MAX) {
      setError(`A comment must be ${TICKET_COMMENT_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    const { error: updateError } = await supabase.from('ticket_comments').update({ body })
      .eq('id', comment.id).eq('author_id', me.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingCommentId(null);
    void loadActivity();
  }

  async function deleteComment(comment: Comment) {
    if (!me) return;
    const { error: deleteError } = await supabase.from('ticket_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', comment.id).eq('author_id', me.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    void loadActivity();
  }

  async function addTicketLink() {
    if (!me) return;
    if (!selectedLinkedTicket) {
      setError('Search for and choose a ticket to link.');
      return;
    }
    setError(null);
    const blockedBy = linkRelationship === 'blocked_by';
    const { error: linkError } = await supabase.from('ticket_links').insert({
      ticket_id: blockedBy ? selectedLinkedTicket.id : ticket.id,
      linked_ticket_id: blockedBy ? ticket.id : selectedLinkedTicket.id,
      relationship: linkRelationship === 'relates_to' ? 'relates_to' : 'blocks',
      created_by: me.id,
    });
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setLinkRelationship('relates_to');
    setSelectedLinkedTicket(null);
    setTicketSearch('');
    setTab('all');
    void loadActivity();
  }

  async function addExternalLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = validTicketUrl(String(data.get('url') ?? ''), false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError(null);
    const label = String(data.get('label') ?? '').trim() || new URL(result.url).hostname;
    const { error: insertError } = await supabase.from('ticket_external_links')
      .insert({ ticket_id: ticket.id, url: result.url, label, created_by: me.id });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    form.reset();
    setTab('all');
    void loadActivity();
  }

  async function removeRow(table: 'ticket_links' | 'ticket_external_links', id: string) {
    const { error: removeError } = await supabase.from(table).delete().eq('id', id);
    if (removeError) setError(removeError.message);
    else void loadActivity();
  }

  async function removeAttachment(file: AttachmentRow) {
    if (!canEdit || deletingFileId) return;
    setDeletingFileId(file.id);
    setError(null);
    const failure = await removeTicketFiles([{ attachmentId: file.id, path: file.storage_path }]);
    setDeletingFileId(null);
    if (failure) {
      setError(`File could not be deleted: ${failure}`);
      return;
    }
    void loadActivity();
  }

  const renderComment = (comment: Comment) => {
    const rendered = renderedComments.get(comment.id);
    if (comment.deleted_at) {
      return <p className="sales-ticket-comment-tombstone">{staffName(comment.deleted_by)} deleted this comment.</p>;
    }
    if (editingCommentId === comment.id) {
      return (
        <form className="sales-ticket-comment-edit" onSubmit={(event) => { event.preventDefault(); void saveCommentEdit(comment); }}>
          <TicketRichText
            ref={editCommentEditor}
            id={`ticket-comment-edit-${comment.id}`}
            label="Edit comment"
            className="sales-textarea sales-ticket-comment-editor"
            initialHtml={rendered?.html ?? ''}
            autoFocus
          />
          <div className="sales-ticket-comment-actions-row">
            <Button size="sm" type="button" onClick={() => setEditingCommentId(null)}>Cancel</Button>
            <Button size="sm" variant="primary" type="submit"><Check size={20} aria-hidden="true" /> Save</Button>
          </div>
        </form>
      );
    }
    return (
      <>
        {rendered?.html && <div className="sales-ticket-rich-content" dangerouslySetInnerHTML={{ __html: rendered.html }} />}
        {comment.edited_at && <small className="sales-ticket-comment-edited">Edited by {staffName(comment.edited_by)} · {new Date(comment.edited_at).toLocaleString()}</small>}
        {rendered?.files.map((image) => (
          <a className="sales-ticket-comment-file" key={image.attachment_id} href={image.url} target="_blank" rel="noreferrer">{image.name}</a>
        ))}
      </>
    );
  };

  const historyItem = (item: (typeof historyView)[number]) => (
    <article className="sales-ticket-history-item" key={item.entry.id}>
      <span className="sales-ticket-history-dot" aria-hidden="true" />
      <div>
        <header><strong>{item.label}</strong><time dateTime={item.entry.created_at}>{new Date(item.entry.created_at).toLocaleString()}</time></header>
        {item.detail && <p>{item.detail}</p>}
      </div>
    </article>
  );

  const sidebarValue = (field: SidebarField, label: string, value: string) => (
    canEdit
      ? <button type="button" className="sales-ticket-field-value" aria-label={`Edit ${label}: ${value}`} onClick={() => startField(field)}>{value}</button>
      : <strong>{value}</strong>
  );

  return (
    <div
      className="sales-ticket-workitem"
      onKeyDown={(event) => {
        if (editing && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          cancelEdit();
        }
      }}
    >
      <div className="sales-ticket-content">
        {editingContent ? (
          <div className="sales-ticket-edit-form">
            {editingContent === 'title' ? (
              <input
                className="sales-ticket-title-input"
                aria-label="Title"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveTicket();
                  }
                }}
                maxLength={240}
                autoFocus
              />
            ) : (
              <h1 className="sales-ticket-workitem-title">{ticket.subject}</h1>
            )}
            {editingContent === 'description' ? (
              <div className="field">
                <span className="field-label sales-ticket-description-label"><FileText size={20} aria-hidden="true" /> Description:</span>
                <TicketRichText
                  ref={descriptionEditor}
                  id="ticket-detail-description"
                  label="Description"
                  className="sales-ticket-description-body sales-ticket-description-input"
                  initialHtml={displayedDescription}
                  autoFocus
                  onFiles={addDescriptionFiles}
                />
                <span className="field-hint">Paste screenshots here or attach files. They upload when you save.</span>
                {descriptionFiles.some((file) => !file.inline) && (
                  <div className="sales-ticket-image-drafts" aria-label="Files waiting to upload with the ticket">
                    {descriptionFiles.filter((file) => !file.inline).map((file) => (
                      <figure key={file.id}>
                        {file.preview ? <img src={file.preview} alt={`Pending ${file.file.name}`} /> : <FileText size={32} aria-hidden="true" />}
                        <figcaption title={file.file.name}>{file.file.name}</figcaption>
                        <button type="button" aria-label={`Remove ${file.file.name}`} onClick={() => {
                          releasePreviews([file]);
                          setDescriptionFiles((current) => current.filter((item) => item.id !== file.id));
                        }}><X size={20} aria-hidden="true" /></button>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <section className="sales-ticket-description">
                <span className="field-label sales-ticket-description-label"><FileText size={20} aria-hidden="true" /> Description:</span>
                <div className="sales-ticket-description-body" dangerouslySetInnerHTML={{ __html: displayedDescription || '<p>No description added.</p>' }} />
              </section>
            )}
          </div>
        ) : (
          <>
            <div className="sales-ticket-title-row">
              <h1 className="sales-ticket-workitem-title" onClick={() => startEditing('title')}>{ticket.subject}</h1>
              {canEdit && <button type="button" className="fo-icon-btn" aria-label="Edit title" title="Edit title" onClick={() => startEditing('title')}><Pencil size={20} aria-hidden="true" /></button>}
            </div>
            <section className="sales-ticket-description" onClick={(event) => ignoreLinkClicks(event, () => startEditing('description'))}>
              <span className="field-label sales-ticket-description-label">
                <FileText size={20} aria-hidden="true" /> Description:
                {canEdit && <button type="button" className="fo-icon-btn" aria-label="Edit description" title="Edit description" onClick={(event) => { event.stopPropagation(); startEditing('description'); }}><Pencil size={20} aria-hidden="true" /></button>}
              </span>
              <div className="sales-ticket-description-body" dangerouslySetInnerHTML={{ __html: displayedDescription || '<p>No description added.</p>' }} />
            </section>
          </>
        )}

        {!editingContent && downloadableFiles.length > 0 && (
          <section className="sales-ticket-file-list" aria-label="Ticket files">
            <h3>Files</h3>
            {downloadableFiles.map((file) => {
              const url = urlByPath.get(file.storage_path);
              return (
                <div className="sales-ticket-file-item" key={file.id}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {isImageName(file.description) && url ? <img className="sales-ticket-file-thumb" src={url} alt="" /> : <FileText size={20} aria-hidden="true" />}
                    <span>{file.description ?? 'Download file'}<small>{formatFileSize(file.file_size_bytes)}</small></span>
                    <ExternalLink size={20} aria-hidden="true" />
                  </a>
                  {canEdit && (
                    <button type="button" className="sales-ticket-file-delete" aria-label={`Delete file ${file.description ?? 'attachment'}`} title="Delete file" disabled={deletingFileId === file.id} onClick={() => void removeAttachment(file)}>
                      <X size={20} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {error && <p className="form-error" role="alert"><AlertCircle size={20} aria-hidden="true" /> {error}</p>}

        {canEdit && (
          <div className="sales-ticket-related-work" aria-label="Link tickets and resources">
            <div className="sales-ticket-add-link">
              <Select className="sales-ticket-relationship-select" fitMenuContent aria-label="Link relationship" value={linkRelationship} onChange={(event) => setLinkRelationship(event.target.value)} options={LINK_RELATIONSHIPS} />
              <SearchBox
                className="sales-ticket-link-search"
                value={selectedLinkedTicket?.label ?? ticketSearch}
                onValueChange={(value) => {
                  setSelectedLinkedTicket(null);
                  setTicketSearch(value);
                }}
                onSubmitTerm={() => undefined}
                onClear={() => {
                  setSelectedLinkedTicket(null);
                  setTicketSearch('');
                }}
                ariaLabel="Search tickets to link"
                placeholder="Search tickets to link…"
                fetchHints={fetchTicketHints}
                hideAllButton
                onHintSelect={(hint: SearchHint) => {
                  setSelectedLinkedTicket({ id: hint.key.slice('ticket:'.length), label: hint.primary });
                  setTicketSearch('');
                }}
              />
              <Button type="button" size="sm" variant="primary" onClick={() => void addTicketLink()}><Plus size={20} aria-hidden="true" /> Add ticket link</Button>
            </div>
            <form className="sales-ticket-add-link sales-ticket-external-link-form" onSubmit={(event) => void addExternalLink(event)} noValidate>
              <Input name="label" aria-label="Link label" placeholder="Link label" maxLength={160} />
              <Input name="url" aria-label="Link URL" placeholder="https://…" type="text" inputMode="url" autoComplete="url" />
              <Button type="submit" size="sm"><Link2 size={20} aria-hidden="true" /> Add link</Button>
            </form>
          </div>
        )}

        <section className="sales-ticket-activity" aria-label="Ticket activity">
          <div className="sales-ticket-activity-heading">
            <h2><MessageSquare size={20} aria-hidden="true" /> Activity <span>{commentCount}</span></h2>
            <div className="sales-ticket-activity-tabs" role="tablist" aria-label="Ticket activity view">
              {ACTIVITY_TABS.map(({ key, label }) => (
                <button
                  type="button"
                  role="tab"
                  id={`ticket-activity-tab-${key}`}
                  aria-controls={`ticket-activity-panel-${key}`}
                  aria-selected={tab === key}
                  key={key}
                  onClick={() => setTab(key)}
                >
                  {key === 'comments' && commentCount ? `${label} (${commentCount})` : label}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel" id={`ticket-activity-panel-${tab}`} aria-labelledby={`ticket-activity-tab-${tab}`}>
            {!loaded ? (
              <div className="sales-ticket-tab-skeleton" role="status" aria-label="Loading ticket activity">
                {Array.from({ length: 3 }, (_, index) => <div key={index}><span /><span /><span /></div>)}
              </div>
            ) : tab === 'all' ? (
              <div className="sales-ticket-history-list">
                {allActivity.map((item) => {
                  if (item.kind === 'history') return historyItem(item.item);
                  if (item.kind === 'comment') {
                    const comment = item.comment;
                    return (
                      <article className="sales-ticket-history-item" key={item.key}>
                        <span className="sales-ticket-history-dot" aria-hidden="true" />
                        <div>
                          <header>
                            <strong>{comment.deleted_at ? `${staffName(comment.deleted_by)} deleted ${staffName(comment.author_id)}’s comment` : `${staffName(comment.author_id)} commented`}</strong>
                            <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
                          </header>
                          {!comment.deleted_at && <div className="sales-ticket-all-comment">{renderComment(comment)}</div>}
                        </div>
                      </article>
                    );
                  }
                  if (item.kind === 'link') {
                    const other = linkTickets.get(item.linked.otherId);
                    return (
                      <article className="sales-ticket-history-item" key={item.key}>
                        <span className="sales-ticket-history-dot" aria-hidden="true" />
                        <div>
                          <header><strong>{staffName(item.linked.row.created_by)} linked a ticket · {item.linked.relationship}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></header>
                          <p>{other ? `${other.display_code} · ${other.subject}` : 'A ticket you cannot view'}</p>
                          {item.linked.row.created_by === me?.id && (
                            <button type="button" className="sales-ticket-activity-delete" onClick={() => void removeRow('ticket_links', item.linked.row.id)}><X size={20} aria-hidden="true" /> Remove link</button>
                          )}
                        </div>
                      </article>
                    );
                  }
                  return (
                    <article className="sales-ticket-history-item" key={item.key}>
                      <span className="sales-ticket-history-dot" aria-hidden="true" />
                      <div>
                        <header><strong>{staffName(item.link.created_by)} added a link</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></header>
                        <p><a href={item.link.url} target="_blank" rel="noreferrer">{item.link.label}</a></p>
                        {item.link.created_by === me?.id && (
                          <button type="button" className="sales-ticket-activity-delete" onClick={() => void removeRow('ticket_external_links', item.link.id)}><X size={20} aria-hidden="true" /> Remove link</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : tab === 'comments' ? (
              <ol className="sales-ticket-comment-list">
                {newestComments.map((comment) => {
                  const author = staffName(comment.author_id);
                  const own = comment.author_id === me?.id && !comment.deleted_at;
                  return (
                    <li key={comment.id} className={comment.deleted_at ? 'is-deleted' : undefined}>
                      <span className="sales-ticket-comment-avatar" aria-hidden="true">{initials(author)}</span>
                      <div className="sales-ticket-comment-body">
                        <header>
                          <strong>{author}</strong>
                          <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
                          {own && editingCommentId !== comment.id && (
                            <span className="sales-ticket-comment-actions">
                              <button type="button" onClick={() => setEditingCommentId(comment.id)} aria-label="Edit my comment"><Pencil size={20} aria-hidden="true" /></button>
                              <button type="button" onClick={() => void deleteComment(comment)} aria-label="Delete my comment"><Trash2 size={20} aria-hidden="true" /></button>
                            </span>
                          )}
                        </header>
                        {renderComment(comment)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="sales-ticket-history-list">{historyView.map(historyItem)}</div>
            )}
          </div>

          {(tab === 'comments' || tab === 'all') && canEdit && (
            <form className="sales-ticket-comment-form" onSubmit={(event) => void postComment(event)}>
              <span className="field-label" id="ticket-comment-label">Add a comment</span>
              <TicketRichText
                ref={commentEditor}
                id="ticket-comment"
                label="Comment"
                className="sales-textarea sales-ticket-comment-editor"
                placeholder="Share an update or ask a follow-up…"
                onEmptyChange={setCommentEmpty}
                onFiles={addCommentFiles}
              />
              {commentFiles.some((file) => !file.inline) && (
                <div className="sales-ticket-pending-files" aria-label="Files waiting to post">
                  {commentFiles.filter((file) => !file.inline).map((file) => (
                    <span key={file.id}>
                      {file.preview ? <img src={file.preview} alt="" /> : <FileText size={20} aria-hidden="true" />}
                      {file.file.name}
                      <button type="button" aria-label={`Remove ${file.file.name}`} onClick={() => {
                        releasePreviews([file]);
                        setCommentFiles((current) => current.filter((item) => item.id !== file.id));
                      }}><X size={20} aria-hidden="true" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="sales-ticket-comment-actions-row">
                <Button type="submit" variant="primary" size="sm" loading={posting} disabled={(commentEmpty && !commentFiles.length) || posting}>
                  <Send size={20} aria-hidden="true" /> Post comment
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      <aside className="sales-ticket-sidebar" aria-label="Ticket fields">
        <div className="sales-ticket-sidebar-title"><span>FIELDS</span><span>{ticket.display_code}</span></div>
        <div className="sales-ticket-read-field" data-ticket-sidebar-field="status" onClick={() => { if (editingField !== 'status') startField('status'); }}>
          <span>Status</span>
          {editingField === 'status'
            ? <Select aria-label="Status" value={status} options={TICKET_STATUS_OPTIONS} onChange={(event) => setStatus(event.target.value)} />
            : canEdit
              ? <button type="button" className={`sales-ticket-field-value sales-ticket-status sales-ticket-status-${ticket.status}`} aria-label={`Edit status: ${ticket.status}`} onClick={() => startField('status')}>{ticket.status}</button>
              : <strong className={`sales-ticket-status sales-ticket-status-${ticket.status}`}>{ticket.status}</strong>}
        </div>
        <div className="sales-ticket-read-field" data-ticket-sidebar-field="priority" onClick={() => { if (editingField !== 'priority') startField('priority'); }}>
          <span>Priority</span>
          {editingField === 'priority'
            ? <Select aria-label="Priority" value={priority} options={TICKET_PRIORITY_OPTIONS} onChange={(event) => setPriority(event.target.value)} />
            : sidebarValue('priority', 'priority', ticket.priority ?? 'Not set')}
        </div>
        <div className="sales-ticket-read-field" data-ticket-sidebar-field="assignee" onClick={() => { if (editingField !== 'assignee') startField('assignee'); }}>
          <span>Assignee</span>
          {editingField === 'assignee'
            ? <Select aria-label="Assignee" value={assigneeId} placeholder="Unassigned" options={staffOptions} onChange={(event) => setAssigneeId(event.target.value)} />
            : sidebarValue('assignee', 'assignee', staffName(ticket.assignee_id))}
        </div>
        <div className="sales-ticket-read-field" data-ticket-sidebar-field="company" onClick={() => { if (editingField !== 'company') startField('company'); }}>
          <span>Account</span>
          {editingField === 'company'
            ? <Select aria-label="Account" value={companyId} placeholder="No account" options={companyOptions} onChange={(event) => {
              const next = event.target.value;
              setCompanyId(next);
              if (personId && contacts.find((contact) => contact.value === personId)?.companyId !== next) setPersonId('');
            }} />
            : sidebarValue('company', 'account', (ticket.company_id && companyById.get(ticket.company_id)) || 'No account')}
        </div>
        <div className="sales-ticket-read-field" data-ticket-sidebar-field="contact" onClick={() => { if (editingField !== 'contact') startField('contact'); }}>
          <span>Contact</span>
          {editingField === 'contact'
            ? <Select aria-label="Contact" value={personId} placeholder="No contact" options={contactChoices} onChange={(event) => setPersonId(event.target.value)} />
            : sidebarValue('contact', 'contact', ticket.person_id ? contactById.get(ticket.person_id) ?? 'Linked person' : 'No contact')}
        </div>
        <div className="sales-ticket-read-field" data-ticket-sidebar-field="due" onClick={() => { if (editingField !== 'due') startField('due'); }}>
          <span>Due date</span>
          {editingField === 'due' ? (
            <div className="sales-ticket-inline-due">
              <DateField aria-label="Due date" value={slaDate} onChange={(event) => setSlaDate(event.target.value)} />
              <input type="time" className="input sales-ticket-time-input" aria-label="Due time" value={slaTime} step={60} onChange={(event) => setSlaTime(event.target.value)} />
            </div>
          ) : sidebarValue('due', 'due date', ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : 'Not set')}
        </div>
      </aside>
      {editing && (
        <div className="sales-ticket-save-row">
          <Button type="button" onClick={cancelEdit} disabled={savingTicket}>Cancel</Button>
          <Button type="button" variant="primary" loading={savingTicket} disabled={savingTicket} onClick={() => void saveTicket()}>
            <Check size={20} aria-hidden="true" /> Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
