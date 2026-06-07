import { useId } from 'react';
import Form from 'react-bootstrap/Form';
import {
  ArrowDown,
  ArrowUp,
  List,
  ListOrdered,
  Plus,
  Trash2,
  Type,
} from 'lucide-react';
import FormField from './FormField';
import type { BaseFieldProps } from './types';
import { emptyBlock } from './reviewComments';
import type {
  ReviewCommentBlock,
  ReviewCommentBlockType,
} from './reviewComments';

type ReviewCommentEditorProps = BaseFieldProps & {
  id?: string;
  /** Controlled list of comment blocks. */
  value: ReviewCommentBlock[];
  onChange: (blocks: ReviewCommentBlock[]) => void;
};

const ADD_BUTTONS: { type: ReviewCommentBlockType; label: string; Icon: typeof Type }[] = [
  { type: 'text', label: 'Text', Icon: Type },
  { type: 'bulleted-list', label: 'Bulleted list', Icon: List },
  { type: 'numbered-list', label: 'Numbered list', Icon: ListOrdered },
];

const BLOCK_TITLE: Record<ReviewCommentBlockType, string> = {
  text: 'Text',
  'bulleted-list': 'Bulleted list',
  'numbered-list': 'Numbered list',
};

/**
 * Block-based editor for reviewer comments. Reviewers compose an ordered list of
 * text / bulleted-list / numbered-list blocks; the parent serializes them to the
 * JSON stored in gcp_reviewercomments (see ./reviewComments).
 */
const ReviewCommentEditor = ({
  id,
  label,
  value,
  onChange,
  isRequired = false,
  isReadOnly = false,
  mode,
  error,
  helpText,
}: ReviewCommentEditorProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  void mode;

  const replaceBlock = (index: number, next: ReviewCommentBlock) =>
    onChange(value.map((b, i) => (i === index ? next : b)));

  const addBlock = (type: ReviewCommentBlockType) =>
    onChange([...value, emptyBlock(type)]);

  const removeBlock = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  // List-item helpers (bulleted / numbered blocks).
  const setItem = (block: ReviewCommentBlock, blockIndex: number, itemIndex: number, text: string) => {
    if (block.type === 'text') return;
    const items = block.items.map((it, i) => (i === itemIndex ? text : it));
    replaceBlock(blockIndex, { type: block.type, items });
  };
  const addItem = (block: ReviewCommentBlock, blockIndex: number) => {
    if (block.type === 'text') return;
    replaceBlock(blockIndex, { type: block.type, items: [...block.items, ''] });
  };
  const removeItem = (block: ReviewCommentBlock, blockIndex: number, itemIndex: number) => {
    if (block.type === 'text') return;
    const items = block.items.filter((_, i) => i !== itemIndex);
    replaceBlock(blockIndex, { type: block.type, items: items.length ? items : [''] });
  };

  return (
    <FormField
      controlId={fieldId}
      label={label}
      isRequired={isRequired}
      error={error}
      helpText={helpText}
    >
      <div className="rc-editor">
        {value.length === 0 ? (
          <p className="rc-empty">No comment blocks yet. Add one below.</p>
        ) : null}

        {value.map((block, blockIndex) => (
          <div className="rc-block" key={blockIndex}>
            <div className="rc-block-head">
              <span className="rc-block-kind">{BLOCK_TITLE[block.type]}</span>
              {!isReadOnly ? (
                <div className="rc-block-tools">
                  <button
                    type="button"
                    className="rc-icon-btn"
                    aria-label="Move block up"
                    disabled={blockIndex === 0}
                    onClick={() => moveBlock(blockIndex, -1)}
                  >
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="rc-icon-btn"
                    aria-label="Move block down"
                    disabled={blockIndex === value.length - 1}
                    onClick={() => moveBlock(blockIndex, 1)}
                  >
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="rc-icon-btn rc-icon-danger"
                    aria-label="Remove block"
                    onClick={() => removeBlock(blockIndex)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>

            {block.type === 'text' ? (
              <Form.Control
                as="textarea"
                rows={3}
                value={block.text}
                readOnly={isReadOnly}
                placeholder="Enter text…"
                aria-label="Text block"
                onChange={(e) =>
                  replaceBlock(blockIndex, { type: 'text', text: e.target.value })
                }
              />
            ) : (
              <div className="rc-list">
                {block.items.map((item, itemIndex) => (
                  <div className="rc-list-row" key={itemIndex}>
                    <span className="rc-list-marker" aria-hidden="true">
                      {block.type === 'numbered-list' ? `${itemIndex + 1}.` : '•'}
                    </span>
                    <Form.Control
                      value={item}
                      readOnly={isReadOnly}
                      placeholder={`Item ${itemIndex + 1}`}
                      aria-label={`${BLOCK_TITLE[block.type]} item ${itemIndex + 1}`}
                      onChange={(e) => setItem(block, blockIndex, itemIndex, e.target.value)}
                    />
                    {!isReadOnly ? (
                      <button
                        type="button"
                        className="rc-icon-btn rc-icon-danger"
                        aria-label={`Remove item ${itemIndex + 1}`}
                        onClick={() => removeItem(block, blockIndex, itemIndex)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {!isReadOnly ? (
                  <button
                    type="button"
                    className="rc-add-item"
                    onClick={() => addItem(block, blockIndex)}
                  >
                    <Plus size={15} aria-hidden="true" />
                    Add item
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {!isReadOnly ? (
          <div className="rc-toolbar">
            {ADD_BUTTONS.map(({ type, label: btnLabel, Icon }) => (
              <button
                key={type}
                type="button"
                className="rc-add-block"
                onClick={() => addBlock(type)}
              >
                <Icon size={16} aria-hidden="true" />
                {btnLabel}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </FormField>
  );
};

export default ReviewCommentEditor;
export { ReviewCommentEditor };
export type { ReviewCommentEditorProps };
