// src/components/detail/DetailSection.tsx
// A collapsible, labelled card that lays out resolved fields in a responsive
// definition grid. Used for the Basic Information block and every child section.

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RenderedField } from './fields';

type DetailSectionProps = {
  title: string;
  icon?: LucideIcon;
  /** Small text shown next to the title (e.g. record code / count). */
  eyebrow?: string;
  fields?: RenderedField[];
  /** Arbitrary content rendered below the field grid (e.g. a bidders table). */
  children?: ReactNode;
  defaultOpen?: boolean;
};

const DetailSection = ({
  title,
  icon: Icon,
  eyebrow,
  fields = [],
  children,
  defaultOpen = true,
}: DetailSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `rd-sec-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  return (
    <section className={`rd-section ${open ? 'is-open' : 'is-closed'}`}>
      <button
        type="button"
        className="rd-section-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="rd-section-title">
          {Icon ? (
            <span className="rd-section-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
          ) : null}
          {title}
          {eyebrow ? <span className="rd-section-eyebrow">{eyebrow}</span> : null}
        </span>
        <ChevronDown size={18} className="rd-section-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="rd-section-body" id={bodyId}>
          {fields.length > 0 ? (
            <dl className="rd-grid">
              {fields.map((f, i) => (
                <div
                  key={`${f.label}-${i}`}
                  className={`rd-field${f.full ? ' rd-field--full' : ''}${
                    f.empty ? ' rd-field--empty' : ''
                  }`}
                >
                  <dt className="rd-field-label">{f.label}</dt>
                  <dd className="rd-field-value">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
};

export default DetailSection;
export { DetailSection };
export type { DetailSectionProps };
