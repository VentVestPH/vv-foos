import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Bold, Code2, Indent, Italic, Link2, List, ListOrdered, Outdent, Paperclip, Quote, Strikethrough, Underline } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { escapeHtml, pendingImageMarkup, validTicketUrl, type PendingFile } from './ticketContent';

export interface RichTextHandle {
  html: () => string;
  isEmpty: () => boolean;
  clear: () => void;
  focus: () => void;
  removePending: (pendingId: string) => void;
}

interface RichTextProps {
  id: string;
  label: string;
  className: string;
  initialHtml?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEmptyChange?: (empty: boolean) => void;
  onFiles?: (files: File[], inline: boolean) => PendingFile[];
}

const FORMAT_COMMANDS: { command: string; label: string; icon: ReactNode }[] = [
  { command: 'bold', label: 'Bold', icon: <Bold size={20} aria-hidden="true" /> },
  { command: 'italic', label: 'Italic', icon: <Italic size={20} aria-hidden="true" /> },
  { command: 'underline', label: 'Underline', icon: <Underline size={20} aria-hidden="true" /> },
  { command: 'strikeThrough', label: 'Strikethrough', icon: <Strikethrough size={20} aria-hidden="true" /> },
  { command: 'insertUnorderedList', label: 'Bulleted list', icon: <List size={20} aria-hidden="true" /> },
  { command: 'insertOrderedList', label: 'Numbered list', icon: <ListOrdered size={20} aria-hidden="true" /> },
  { command: 'indent', label: 'Indent', icon: <Indent size={20} aria-hidden="true" /> },
  { command: 'outdent', label: 'Outdent', icon: <Outdent size={20} aria-hidden="true" /> },
  { command: 'formatBlock:blockquote', label: 'Quote', icon: <Quote size={20} aria-hidden="true" /> },
  { command: 'formatBlock:pre', label: 'Code block', icon: <Code2 size={20} aria-hidden="true" /> },
];

function editorIsEmpty(editor: HTMLElement): boolean {
  return !editor.textContent?.trim() && !editor.querySelector('img');
}

function attachImageResize(editor: HTMLElement, image: HTMLImageElement, onChange: () => void): () => void {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'sales-ticket-image-resize-handle';
  handle.setAttribute('aria-label', 'Resize image');
  handle.title = 'Drag to resize image';
  document.body.append(handle);

  const position = () => {
    if (!image.isConnected) return;
    const rect = image.getBoundingClientRect();
    Object.assign(handle.style, { left: `${rect.right - 9}px`, top: `${rect.bottom - 9}px` });
  };
  position();

  let resizing = false;
  let originX = 0;
  let originY = 0;
  let originWidth = 0;
  let originHeight = 0;
  let ratio = 1;

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = image.getBoundingClientRect();
    resizing = true;
    originX = event.clientX;
    originY = event.clientY;
    originWidth = rect.width;
    originHeight = rect.height;
    ratio = image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalWidth / image.naturalHeight
      : rect.width / Math.max(1, rect.height);
    handle.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!resizing) return;
    const scaleX = (originWidth + event.clientX - originX) / Math.max(1, originWidth);
    const scaleY = (originHeight + event.clientY - originY) / Math.max(1, originHeight);
    const scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;
    const minScale = Math.max(80 / Math.max(1, originWidth), 48 / Math.max(1, originHeight));
    const maxScale = Math.min(editor.clientWidth / Math.max(1, originWidth), 1600 / Math.max(1, originHeight));
    const width = Math.round(originWidth * Math.max(minScale, Math.min(maxScale, scale)));
    const height = Math.round(width / ratio);
    Object.assign(image.style, { width: `${width}px`, height: `${height}px`, maxWidth: '100%', maxHeight: 'none' });
    image.setAttribute('width', String(width));
    image.setAttribute('height', String(height));
    position();
  };
  const onPointerUp = () => {
    if (!resizing) return;
    resizing = false;
    onChange();
  };
  const onOutside = (event: PointerEvent) => {
    if (event.target !== handle && event.target !== image) cleanup();
  };
  const cleanup = () => {
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('scroll', position, true);
    window.removeEventListener('resize', position);
    handle.remove();
  };
  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
  return cleanup;
}

export const TicketRichText = forwardRef<RichTextHandle, RichTextProps>(function TicketRichText(
  { id, label, className, initialHtml = '', placeholder, autoFocus = false, onEmptyChange, onFiles },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selection = useRef<Range | null>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);
  const emptyRef = useRef<boolean | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const reportEmpty = () => {
    const editor = editorRef.current;
    if (!editor || !onEmptyChange) return;
    const empty = editorIsEmpty(editor);
    if (empty !== emptyRef.current) {
      emptyRef.current = empty;
      onEmptyChange(empty);
    }
  };

  const mountState = useRef({ initialHtml, autoFocus, reportEmpty });
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const { initialHtml: html, autoFocus: focus, reportEmpty: report } = mountState.current;
    editor.innerHTML = html;
    if (focus) editor.focus();
    report();
  }, []);

  useEffect(() => () => resizeCleanup.current?.(), []);

  useImperativeHandle(ref, () => ({
    html: () => editorRef.current?.innerHTML ?? '',
    isEmpty: () => (editorRef.current ? editorIsEmpty(editorRef.current) : true),
    clear: () => {
      if (editorRef.current) editorRef.current.innerHTML = '';
      reportEmpty();
    },
    focus: () => editorRef.current?.focus(),
    removePending: (pendingId) => {
      editorRef.current?.querySelector(`img[data-pending-id="${CSS.escape(pendingId)}"]`)?.remove();
      reportEmpty();
    },
  }));

  const insertHtml = (html: string) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    reportEmpty();
  };

  const addFiles = (files: File[], inline: boolean) => {
    if (!onFiles || !files.length) return;
    const added = onFiles(files, inline);
    const markup = pendingImageMarkup(added);
    if (markup) insertHtml(markup);
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (!files.length) return;
    event.preventDefault();
    addFiles(files, true);
  };

  const openLink = () => {
    editorRef.current?.focus();
    const current = window.getSelection();
    selection.current = current?.rangeCount ? current.getRangeAt(0).cloneRange() : null;
    setLinkError(null);
    setLinkOpen(true);
  };

  const closeLink = () => {
    setLinkOpen(false);
    setLinkUrl('');
    setLinkLabel('');
    setLinkError(null);
  };

  const insertLink = () => {
    const result = validTicketUrl(linkUrl, true);
    if ('error' in result) {
      setLinkError(result.error);
      return;
    }
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      const current = window.getSelection();
      if (current && selection.current) {
        current.removeAllRanges();
        current.addRange(selection.current);
      }
      if (current?.rangeCount && !current.getRangeAt(0).collapsed) {
        document.execCommand('createLink', false, result.url);
      } else {
        document.execCommand('insertHTML', false, `<a href="${escapeHtml(result.url)}">${escapeHtml(linkLabel.trim() || linkUrl.trim())}</a>`);
      }
      reportEmpty();
    }
    closeLink();
  };

  const onLinkKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      insertLink();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeLink();
    }
  };

  return (
    <>
      <div className="sales-ticket-description-tools" role="toolbar" aria-label={`${label} formatting`}>
        {FORMAT_COMMANDS.map(({ command, label: commandLabel, icon }) => (
          <button
            type="button"
            className="sales-ticket-description-tool"
            key={command}
            aria-label={commandLabel}
            title={commandLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              if (command.startsWith('formatBlock:')) document.execCommand('formatBlock', false, command.split(':')[1]);
              else document.execCommand(command);
              reportEmpty();
            }}
          >
            {icon}
          </button>
        ))}
        <button
          type="button"
          className="sales-ticket-description-tool"
          aria-label="Hyperlink"
          title="Hyperlink"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLink}
        >
          <Link2 size={20} aria-hidden="true" />
        </button>
        {onFiles && (
          <label className="sales-ticket-description-tool sales-ticket-file-button" title="Attach files">
            <Paperclip size={20} aria-hidden="true" />
            <span className="visually-hidden">Attach files</span>
            <input
              type="file"
              multiple
              onChange={(event) => {
                if (event.currentTarget.files) addFiles(Array.from(event.currentTarget.files), false);
                event.currentTarget.value = '';
              }}
            />
          </label>
        )}
      </div>
      <div
        id={id}
        ref={editorRef}
        className={className}
        contentEditable
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={reportEmpty}
        onPaste={onPaste}
        onClick={(event) => {
          if (!(event.target instanceof HTMLImageElement) || !editorRef.current) return;
          resizeCleanup.current?.();
          resizeCleanup.current = attachImageResize(editorRef.current, event.target, reportEmpty);
        }}
        onDragStart={(event) => {
          if (event.target instanceof HTMLImageElement) event.preventDefault();
        }}
      />
      {linkOpen && (
        <div className="sales-ticket-link-composer" role="group" aria-label="Insert link" onKeyDown={onLinkKeyDown}>
          <Input aria-label="Link text" value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Link text (optional)" maxLength={160} />
          <Input aria-label="Web address" type="text" inputMode="url" autoComplete="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" autoFocus />
          <div className="sales-ticket-link-composer-actions">
            <Button type="button" size="sm" onClick={closeLink}>Cancel</Button>
            <Button type="button" size="sm" variant="primary" onClick={insertLink}>
              <Link2 size={20} aria-hidden="true" /> Insert link
            </Button>
          </div>
          {linkError && <p className="field-error-text" role="alert">{linkError}</p>}
        </div>
      )}
    </>
  );
});
