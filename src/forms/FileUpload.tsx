import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { Check, FileText, Pencil, Trash2, Upload } from 'lucide-react';

type UploadedFile = {
  id: string;
  file: File;
  progress: number; // 0–100
  preview?: string; // data URL for images
  error?: string;
  /** SharePoint web URL once the upload completes (only when an uploader is used). */
  url?: string;
  /** SharePoint drive-item id once the upload completes. */
  remoteId?: string;
};

/**
 * Pushes a file to a backend and reports progress (0–100). Resolves with the
 * stored file's location. Provide this to perform REAL uploads (e.g. the
 * SharePoint uploader from shared/uploadApi); omit it for the simulated demo
 * behaviour.
 */
type Uploader = (
  file: File,
  onProgress: (percent: number) => void
) => Promise<{ webUrl: string; id: string }>;

interface FileUploadProps {
  maxFileSize?: number; // bytes, default 10_485_760 (10 MB)
  maxFiles?: number; // default 10
  accept?: string[]; // mime types
  value?: UploadedFile[]; // controlled
  onChange?: (files: UploadedFile[]) => void;
  onUpload?: (files: File[]) => void; // called with valid new files
  /** When provided, files are uploaded for real via this function. */
  uploader?: Uploader;
  label?: string; // field label above input
  disabled?: boolean;
}

const ACCENT = '#6366F1';
const ACCENT_DEEP = '#2D3A8C';
const BORDER = '#E2E8F0';
const MUTED = '#64748B';
const DANGER = '#DC2626';
const SUCCESS = '#16A34A';

const EXT_COLORS: Record<string, string> = {
  pdf: '#DC2626',
  doc: '#2563EB',
  docx: '#2563EB',
  xls: '#16A34A',
  xlsx: '#16A34A',
};

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `f_${Date.now().toString(36)}_${Math.round(Math.random() * 1e9).toString(36)}`;

const getExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

const isImage = (file: File): boolean => file.type.startsWith('image/');

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CHIP_WIDTH = 92;

const styles: Record<string, CSSProperties> = {
  label: {
    display: 'block',
    fontWeight: 600,
    fontSize: 14,
    color: ACCENT_DEEP,
    marginBottom: 6,
  },
  dropzone: {
    display: 'flex',
    alignItems: 'stretch',
    width: '100%',
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  },
  chooseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRight: `1px solid ${BORDER}`,
    background: '#EEF0FF',
    color: ACCENT_DEEP,
    fontWeight: 600,
    fontSize: 13,
    padding: '10px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    padding: '0 14px',
    fontSize: 13,
    color: MUTED,
    userSelect: 'none',
  },
  hint: {
    margin: '6px 2px 0',
    fontSize: 12,
    color: MUTED,
  },
  banner: {
    marginTop: 8,
    padding: '6px 10px',
    fontSize: 12,
    color: ACCENT_DEEP,
    background: '#EEF0FF',
    border: `1px solid ${ACCENT}33`,
    borderRadius: 8,
  },
  strip: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 10,
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '12px 2px 6px',
  },
  chip: {
    position: 'relative',
    flex: `0 0 ${CHIP_WIDTH}px`,
    width: CHIP_WIDTH,
  },
  media: {
    position: 'relative',
    width: CHIP_WIDTH,
    height: 64,
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8FAFC',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  extLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  fileName: {
    marginTop: 4,
    fontSize: 11,
    color: '#334155',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badgeTick: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: SUCCESS,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 2px #fff',
  },
  badgeError: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    right: 3,
    background: DANGER,
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    textAlign: 'center',
    borderRadius: 5,
    padding: '1px 0',
  },
  hoverActions: {
    position: 'absolute',
    top: 3,
    right: 3,
    display: 'flex',
    gap: 4,
  },
  iconBtn: {
    width: 18,
    height: 18,
    borderRadius: 5,
    border: 'none',
    background: 'rgba(255,255,255,0.92)',
    color: ACCENT_DEEP,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
  },
  progressOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(248,250,252,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

/** Circular SVG progress ring with a centered percentage label. */
const ProgressRing = ({ progress }: { progress: number }) => {
  const size = 34;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, progress)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`${ACCENT}33`}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ACCENT}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={ACCENT_DEEP}
      >
        {Math.round(progress)}%
      </text>
    </svg>
  );
};

const FileUpload = ({
  maxFileSize = 10_485_760,
  maxFiles = 10,
  accept,
  value,
  onChange,
  onUpload,
  uploader,
  label,
  disabled = false,
}: FileUploadProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);

  const isControlled = value !== undefined && onChange !== undefined;
  const [internal, setInternal] = useState<UploadedFile[]>(value ?? []);
  // Source of truth, also readable from async upload timers.
  const filesRef = useRef<UploadedFile[]>(value ?? []);
  const files = isControlled ? value : internal;
  filesRef.current = files;

  // Re-sync internal state when an external controlled value replaces ours.
  const emittedRef = useRef<UploadedFile[] | undefined>(value);
  useEffect(() => {
    if (isControlled && value !== emittedRef.current) {
      setInternal(value);
    }
  }, [isControlled, value]);

  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const setFiles = (next: UploadedFile[]) => {
    filesRef.current = next;
    emittedRef.current = next;
    setInternal(next);
    onChange?.(next);
  };

  const atLimit = files.length >= maxFiles;

  // Patch a single tracked file by id, guarding against races with removal.
  const patchFile = (id: string, patch: Partial<UploadedFile>) => {
    setFiles(filesRef.current.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  // Real upload via the injected `uploader`: reports live progress and records
  // the returned SharePoint url/id, or surfaces an error on the chip.
  const runUpload = (id: string, file: File) => {
    if (!uploader) return;
    void uploader(file, (percent) => {
      const current = filesRef.current.find((f) => f.id === id);
      if (!current || current.error) return; // removed or invalidated
      patchFile(id, { progress: Math.min(99, percent) }); // 100 reserved for done
    })
      .then(({ webUrl, id: remoteId }) => {
        if (!filesRef.current.some((f) => f.id === id)) return; // removed mid-flight
        patchFile(id, { progress: 100, url: webUrl, remoteId, error: undefined });
      })
      .catch((err: unknown) => {
        if (!filesRef.current.some((f) => f.id === id)) return;
        patchFile(id, {
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      });
  };

  // Simulated upload progress — used only when no `uploader` is supplied.
  const simulateUpload = (id: string) => {
    const tick = () => {
      const current = filesRef.current.find((f) => f.id === id);
      if (!current || current.error) return; // removed or invalid
      const nextProgress = Math.min(100, current.progress + 20);
      setFiles(
        filesRef.current.map((f) =>
          f.id === id ? { ...f, progress: nextProgress } : f
        )
      );
      if (nextProgress < 100) window.setTimeout(tick, 220);
    };
    window.setTimeout(tick, 220);
  };

  // Kick off the right upload strategy for a freshly-added/replaced file.
  const startUpload = (id: string, file: File) => {
    if (uploader) runUpload(id, file);
    else simulateUpload(id);
  };

  const buildPreview = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setFiles(
        filesRef.current.map((f) =>
          f.id === id ? { ...f, preview: String(reader.result) } : f
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const validate = (file: File): string | undefined => {
    if (file.size > maxFileSize) return 'Too large';
    if (accept && accept.length > 0 && !accept.includes(file.type))
      return 'Type';
    return undefined;
  };

  const ingest = (incoming: File[]) => {
    if (disabled || incoming.length === 0) return;
    const remaining = maxFiles - files.length;
    const accepted = incoming.slice(0, Math.max(0, remaining));

    const entries: UploadedFile[] = accepted.map((file) => ({
      id: genId(),
      file,
      progress: 0,
      error: validate(file),
    }));

    setFiles([...filesRef.current, ...entries]);

    const valid = entries.filter((e) => !e.error);
    entries.forEach((e) => {
      if (e.error) return;
      if (isImage(e.file)) buildPreview(e.id, e.file);
      startUpload(e.id, e.file);
    });
    if (valid.length > 0) onUpload?.(valid.map((e) => e.file));
  };

  const handleInputChange = (fileList: FileList | null) => {
    if (!fileList) return;
    const list = Array.from(fileList);
    const replacingId = replaceIdRef.current;

    if (replacingId) {
      replaceIdRef.current = null;
      const file = list[0];
      if (!file) return;
      const error = validate(file);
      setFiles(
        filesRef.current.map((f) =>
          f.id === replacingId
            ? { ...f, file, progress: 0, preview: undefined, url: undefined, remoteId: undefined, error }
            : f
        )
      );
      if (!error) {
        if (isImage(file)) buildPreview(replacingId, file);
        startUpload(replacingId, file);
        onUpload?.([file]);
      }
      return;
    }

    ingest(list);
  };

  const openPicker = (replaceId?: string) => {
    if (disabled) return;
    replaceIdRef.current = replaceId ?? null;
    inputRef.current?.click();
  };

  const handleRemove = (id: string) => {
    setFiles(filesRef.current.filter((f) => f.id !== id));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    ingest(Array.from(e.dataTransfer.files));
  };

  const placeholderText =
    files.length === 0 ? 'No file chosen' : `${files.length} files selected`;

  const ringVisible = (f: UploadedFile) => !f.error && f.progress < 100;

  return (
    <div style={{ width: '100%', opacity: disabled ? 0.65 : 1 }}>
      {label ? (
        <label htmlFor={inputId} style={styles.label}>
          {label}
        </label>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={accept?.join(',')}
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleInputChange(e.target.files);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />

      <div
        style={{
          ...styles.dropzone,
          borderColor: dragOver || focused ? ACCENT : BORDER,
          boxShadow:
            dragOver || focused ? `0 0 0 3px ${ACCENT}33` : 'none',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          style={{
            ...styles.chooseBtn,
            cursor: disabled || atLimit ? 'not-allowed' : 'pointer',
            opacity: disabled || atLimit ? 0.6 : 1,
          }}
          onClick={() => openPicker()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled || atLimit}
        >
          <Upload size={15} aria-hidden="true" />
          Choose file
        </button>
        <span style={styles.placeholder}>{placeholderText}</span>
      </div>

      <p style={styles.hint}>
        Allowed: PDF, Word, Excel, JPG, PNG. Max size:{' '}
        {formatBytes(maxFileSize)}.
      </p>

      {atLimit ? (
        <div style={styles.banner}>
          File limit reached ({maxFiles}). Remove a file to add another.
        </div>
      ) : null}

      {files.length > 0 ? (
        <div style={styles.strip}>
          {files.map((f) => {
            const ext = getExt(f.file.name);
            const extColor = EXT_COLORS[ext] ?? MUTED;
            const showActions = hovered === f.id && !disabled;
            return (
              <div
                key={f.id}
                style={styles.chip}
                onMouseEnter={() => setHovered(f.id)}
                onMouseLeave={() => setHovered((h) => (h === f.id ? null : h))}
              >
                <div style={styles.media}>
                  {f.preview ? (
                    <img src={f.preview} alt={f.file.name} style={styles.thumb} />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        color: extColor,
                      }}
                    >
                      <FileText size={24} aria-hidden="true" />
                      <span style={{ ...styles.extLabel, color: extColor }}>
                        {ext ? ext.toUpperCase() : 'FILE'}
                      </span>
                    </div>
                  )}

                  {ringVisible(f) ? (
                    <div style={styles.progressOverlay}>
                      <ProgressRing progress={f.progress} />
                    </div>
                  ) : null}

                  {!f.error && f.progress >= 100 ? (
                    <span style={styles.badgeTick} aria-label="Uploaded">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}

                  {f.error === 'Too large' ? (
                    <span style={styles.badgeError}>Too large</span>
                  ) : f.error ? (
                    <span style={styles.badgeError}>Invalid</span>
                  ) : null}

                  {showActions ? (
                    <div style={styles.hoverActions}>
                      <button
                        type="button"
                        style={styles.iconBtn}
                        onClick={() => openPicker(f.id)}
                        aria-label={`Replace ${f.file.name}`}
                        title="Replace file"
                      >
                        <Pencil size={11} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        style={{ ...styles.iconBtn, color: DANGER }}
                        onClick={() => handleRemove(f.id)}
                        aria-label={`Remove ${f.file.name}`}
                        title="Remove file"
                      >
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div style={styles.fileName} title={f.file.name}>
                  {f.file.name}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default FileUpload;
export { FileUpload };
export type { FileUploadProps, UploadedFile, Uploader };
