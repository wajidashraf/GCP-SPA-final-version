// src/components/detail/fields.tsx
// Declarative field/section model for the read-only Request Detail page.
//
// A child request type is described as a list of SectionDef<T>; each field
// knows how to pull its value off the domain record and how to format it.
// This keeps the page data-driven — adding a request type is config, not JSX.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { DataverseChoice } from '../../data/types';
import { getChoiceLabel } from '../../data/types';
import {
  EMPTY,
  cleanText,
  formatBoolean,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from './valueFormat';
import StructuredValue from './StructuredValue';

type FieldKind =
  | 'text'
  | 'multiline'
  | 'date'
  | 'datetime'
  | 'currency'
  | 'number'
  | 'percent'
  | 'boolean'
  | 'choice'
  | 'structured';

type FieldDef<T> = {
  label: string;
  get: (row: T) => unknown;
  /** How to format the value. Defaults to `'text'`. */
  kind?: FieldKind;
  /** Required when `kind === 'choice'`. */
  choices?: readonly DataverseChoice[];
  /** Span the full width of the section grid (multiline / structured / tables). */
  full?: boolean;
};

type SectionDef<T> = {
  title: string;
  icon?: LucideIcon;
  fields: FieldDef<T>[];
};

/** A field resolved against a concrete record, ready to render. */
type RenderedField = {
  label: string;
  value: ReactNode;
  full: boolean;
  /** True when the underlying value is blank — lets the page de-emphasise it. */
  empty: boolean;
};

const renderValue = <T,>(field: FieldDef<T>, row: T): { node: ReactNode; empty: boolean } => {
  const raw = field.get(row);
  const kind = field.kind ?? 'text';

  switch (kind) {
    case 'structured':
      return { node: <StructuredValue raw={raw} />, empty: cleanText(raw) === null };

    case 'multiline': {
      const t = cleanText(raw);
      return {
        node: t ? <p className="rd-multiline">{t}</p> : <span className="rd-empty">{EMPTY}</span>,
        empty: t === null,
      };
    }

    case 'choice': {
      if (raw === null || raw === undefined || raw === '') {
        return { node: <span className="rd-empty">{EMPTY}</span>, empty: true };
      }
      const label = field.choices
        ? getChoiceLabel(field.choices, raw as string | number)
        : undefined;
      return { node: <>{label ?? String(raw)}</>, empty: false };
    }

    case 'date':
    case 'datetime': {
      const empty = cleanText(raw) === null;
      const text = kind === 'date' ? formatDate(raw as string) : formatDateTime(raw as string);
      return { node: <>{text}</>, empty };
    }

    case 'currency':
    case 'number':
    case 'percent': {
      const empty = raw === null || raw === undefined || Number.isNaN(raw as number);
      const text =
        kind === 'currency'
          ? formatCurrency(raw as number)
          : kind === 'percent'
            ? formatPercent(raw as number)
            : formatNumber(raw as number);
      return { node: <>{text}</>, empty };
    }

    case 'boolean': {
      const empty = raw === null || raw === undefined;
      return { node: <>{formatBoolean(raw as boolean)}</>, empty };
    }

    case 'text':
    default: {
      const t = cleanText(raw);
      return {
        node: t ? <>{t}</> : <span className="rd-empty">{EMPTY}</span>,
        empty: t === null,
      };
    }
  }
};

/** Resolve every field in a section against a record. */
const buildFields = <T,>(fields: FieldDef<T>[], row: T): RenderedField[] =>
  fields.map((f) => {
    const { node, empty } = renderValue(f, row);
    const isWide = f.full ?? (f.kind === 'structured' || f.kind === 'multiline');
    return { label: f.label, value: node, full: isWide, empty };
  });

export { renderValue, buildFields };
export type { FieldDef, SectionDef, FieldKind, RenderedField };
