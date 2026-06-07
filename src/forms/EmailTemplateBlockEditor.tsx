import { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Heading,
  Layers,
  Link as LinkIcon,
  Minus,
  Pilcrow,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';
import TextField from './TextField';
import TextAreaField from './TextAreaField';
import type { EmailBlock, EmailBlockType } from '../types/emailTemplate';
import type { Placeholder } from '../data/emailTemplateEvents';

// Visual builder for an email template: a subject line plus an ordered list of
// content blocks. Admins add/remove/reorder blocks and insert {{placeholders}} from
// a shared palette into whichever text field is focused. The output is the structured
// EmailBlock[] persisted as JSON in gcp_bodyblocks (rendered by renderTemplate.ts).

type EmailTemplateBlockEditorProps = {
  subject: string;
  onSubjectChange: (subject: string) => void;
  blocks: EmailBlock[];
  onBlocksChange: (blocks: EmailBlock[]) => void;
  placeholders: readonly Placeholder[];
};

// Identifies the text field that last had focus, so the palette knows where to insert.
type Target =
  | { kind: 'subject' }
  | { kind: 'heading' | 'paragraph'; index: number }
  | { kind: 'fieldLabel' | 'fieldValue'; index: number; row: number }
  | { kind: 'buttonLabel' | 'buttonHref'; index: number };

const newBlock = (type: EmailBlockType): EmailBlock => {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: 'Heading text' };
    case 'paragraph':
      return { type: 'paragraph', text: 'Paragraph text' };
    case 'fields':
      return { type: 'fields', rows: [{ label: 'Label', value: '{{requestName}}' }] };
    case 'button':
      return { type: 'button', label: 'View Request', href: '{{viewLink}}' };
    case 'divider':
      return { type: 'divider' };
  }
};

const blockTypeMeta: { type: EmailBlockType; label: string; Icon: typeof Heading }[] = [
  { type: 'heading', label: 'Heading', Icon: Heading },
  { type: 'paragraph', label: 'Paragraph', Icon: Pilcrow },
  { type: 'fields', label: 'Info Rows', Icon: Layers },
  { type: 'button', label: 'Button', Icon: LinkIcon },
  { type: 'divider', label: 'Divider', Icon: Minus },
];

const blockTypeLabels: Record<EmailBlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  fields: 'Info Rows',
  button: 'Button',
  divider: 'Divider',
};

const EmailTemplateBlockEditor = ({
  subject,
  onSubjectChange,
  blocks,
  onBlocksChange,
  placeholders,
}: EmailTemplateBlockEditorProps) => {
  const activeTarget = useRef<Target | null>(null);
  // Bump to force the palette buttons to reflect whether a field is focused.
  const [, setActiveTick] = useState(0);

  const setActive = (t: Target) => {
    activeTarget.current = t;
    setActiveTick((n) => n + 1);
  };
  const clearActive = (t: Target) => {
    // Only clear if the blur is from the field that is currently active.
    if (JSON.stringify(activeTarget.current) === JSON.stringify(t)) {
      activeTarget.current = null;
      setActiveTick((n) => n + 1);
    }
  };

  const replaceBlock = (index: number, block: EmailBlock) => {
    const next = blocks.slice();
    next[index] = block;
    onBlocksChange(next);
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= blocks.length) return;
    const next = blocks.slice();
    [next[index], next[to]] = [next[to], next[index]];
    onBlocksChange(next);
  };

  const removeBlock = (index: number) => {
    onBlocksChange(blocks.filter((_, i) => i !== index));
  };

  const addBlock = (type: EmailBlockType) => {
    onBlocksChange([...blocks, newBlock(type)]);
  };

  // Append a {{token}} to the currently-focused field (separated by a space).
  const insertToken = (token: string) => {
    const target = activeTarget.current;
    const tok = `{{${token}}}`;
    const join = (cur: string) => (cur && !cur.endsWith(' ') ? `${cur} ${tok}` : `${cur}${tok}`);
    if (!target) return;
    if (target.kind === 'subject') {
      onSubjectChange(join(subject));
      return;
    }
    const block = blocks[target.index];
    if (!block) return;
    if (target.kind === 'heading' && block.type === 'heading') {
      replaceBlock(target.index, { ...block, text: join(block.text) });
    } else if (target.kind === 'paragraph' && block.type === 'paragraph') {
      replaceBlock(target.index, { ...block, text: join(block.text) });
    } else if (block.type === 'fields' && (target.kind === 'fieldLabel' || target.kind === 'fieldValue')) {
      const rows = block.rows.map((r, i) =>
        i === target.row
          ? target.kind === 'fieldValue'
            ? { ...r, value: join(r.value) }
            : { ...r, label: join(r.label) }
          : r
      );
      replaceBlock(target.index, { ...block, rows });
    } else if (block.type === 'button' && (target.kind === 'buttonLabel' || target.kind === 'buttonHref')) {
      replaceBlock(
        target.index,
        target.kind === 'buttonHref'
          ? { ...block, href: join(block.href) }
          : { ...block, label: join(block.label) }
      );
    }
  };

  const renderBlockBody = (block: EmailBlock, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <TextField
            label="Heading text"
            value={block.text}
            onChange={(e) => replaceBlock(index, { ...block, text: e.target.value })}
            onFocus={() => setActive({ kind: 'heading', index })}
            onBlur={() => clearActive({ kind: 'heading', index })}
          />
        );
      case 'paragraph':
        return (
          <TextAreaField
            label="Paragraph text"
            rows={3}
            value={block.text}
            onChange={(e) => replaceBlock(index, { ...block, text: e.target.value })}
            onFocus={() => setActive({ kind: 'paragraph', index })}
            onBlur={() => clearActive({ kind: 'paragraph', index })}
          />
        );
      case 'fields':
        return (
          <div className="et-inforows">
            <p className="et-inforows-desc">
              Each row appears as a table row in the email: left column = label, right column =
              value. Use <span className="et-inforows-code">{'{{placeholders}}'}</span> in the
              value field to insert dynamic request data.
            </p>
            {block.rows.map((row, ri) => (
              <div className="et-inforow" key={ri}>
                <TextField
                  label="Row Label"
                  value={row.label}
                  onChange={(e) => {
                    const rows = block.rows.map((r, i) =>
                      i === ri ? { ...r, label: e.target.value } : r
                    );
                    replaceBlock(index, { ...block, rows });
                  }}
                  onFocus={() => setActive({ kind: 'fieldLabel', index, row: ri })}
                  onBlur={() => clearActive({ kind: 'fieldLabel', index, row: ri })}
                />
                <TextField
                  label="Row Value"
                  helpText="Supports {{placeholders}}"
                  value={row.value}
                  onChange={(e) => {
                    const rows = block.rows.map((r, i) =>
                      i === ri ? { ...r, value: e.target.value } : r
                    );
                    replaceBlock(index, { ...block, rows });
                  }}
                  onFocus={() => setActive({ kind: 'fieldValue', index, row: ri })}
                  onBlur={() => clearActive({ kind: 'fieldValue', index, row: ri })}
                />
                <button
                  type="button"
                  className="et-icon-btn et-icon-btn-danger"
                  aria-label="Remove row"
                  onClick={() =>
                    replaceBlock(index, {
                      ...block,
                      rows: block.rows.filter((_, i) => i !== ri),
                    })
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="et-add-row"
              onClick={() =>
                replaceBlock(index, {
                  ...block,
                  rows: [...block.rows, { label: 'Label', value: '' }],
                })
              }
            >
              <Plus size={14} aria-hidden="true" /> Add row
            </button>
          </div>
        );
      case 'button':
        return (
          <div className="et-fieldrow">
            <TextField
              label="Button label"
              value={block.label}
              onChange={(e) => replaceBlock(index, { ...block, label: e.target.value })}
              onFocus={() => setActive({ kind: 'buttonLabel', index })}
              onBlur={() => clearActive({ kind: 'buttonLabel', index })}
            />
            <TextField
              label="Link (URL)"
              value={block.href}
              onChange={(e) => replaceBlock(index, { ...block, href: e.target.value })}
              onFocus={() => setActive({ kind: 'buttonHref', index })}
              onBlur={() => clearActive({ kind: 'buttonHref', index })}
              helpText="Only http(s) links are sent."
            />
          </div>
        );
      case 'divider':
        return <p className="et-divider-note">Horizontal divider line — no configuration needed.</p>;
    }
  };

  const hasActiveField = activeTarget.current !== null;

  return (
    <div className="et-editor">
      {/* Subject */}
      <TextField
        label="Subject"
        isRequired
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        onFocus={() => setActive({ kind: 'subject' })}
        onBlur={() => clearActive({ kind: 'subject' })}
      />

      {/* Placeholder palette */}
      <div className={`et-palette${hasActiveField ? ' is-active' : ''}`} aria-label="Insert placeholder">
        <span className="et-palette-label">
          <Tag size={13} aria-hidden="true" /> Placeholder Palette
        </span>
        <div className="et-palette-chips">
          {placeholders.map((p) => (
            <button
              type="button"
              key={p.token}
              className="et-chip"
              // onMouseDown fires before the field's blur, preserving the active target.
              onMouseDown={(e) => {
                e.preventDefault();
                insertToken(p.token);
              }}
              disabled={!hasActiveField}
              title={`{{${p.token}}}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="et-palette-hint">
          {hasActiveField
            ? 'Click a placeholder to insert it into the focused field.'
            : 'Focus a text field above, then click a placeholder to insert it.'}
        </p>
      </div>

      {/* Blocks */}
      <div className="et-blocks">
        {blocks.length === 0 && (
          <p className="et-empty">No content blocks yet — add one below.</p>
        )}
        {blocks.map((block, index) => (
          <div className="et-block" key={index}>
            <div className="et-block-head">
              <span className="et-block-type">{blockTypeLabels[block.type]}</span>
              <div className="et-block-actions">
                <button
                  type="button"
                  className="et-icon-btn"
                  aria-label="Move up"
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                >
                  <ChevronUp size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="et-icon-btn"
                  aria-label="Move down"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === blocks.length - 1}
                >
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="et-icon-btn et-icon-btn-danger"
                  aria-label="Remove block"
                  onClick={() => removeBlock(index)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="et-block-body">{renderBlockBody(block, index)}</div>
          </div>
        ))}
      </div>

      {/* Add-block bar */}
      <div className="et-addbar">
        <span className="et-addbar-label">Add block:</span>
        {blockTypeMeta.map(({ type, label, Icon }) => (
          <button type="button" key={type} className="et-add-btn" onClick={() => addBlock(type)}>
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmailTemplateBlockEditor;
export { EmailTemplateBlockEditor };
export type { EmailTemplateBlockEditorProps };
