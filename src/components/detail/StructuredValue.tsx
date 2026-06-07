// src/components/detail/StructuredValue.tsx
// Renders a JSON-serialised "repeatable list" / "dynamic table" column value
// (see valueFormat.parseStructured) as a clean read-only list or table.

import { parseStructured } from './valueFormat';

type StructuredValueProps = {
  /** Raw column value — typically a JSON string, but plain text is tolerated. */
  raw: unknown;
};

const StructuredValue = ({ raw }: StructuredValueProps) => {
  const data = parseStructured(raw);

  if (data.type === 'empty') {
    return <span className="rd-empty">Not provided</span>;
  }

  if (data.type === 'text') {
    return <p className="rd-multiline">{data.text}</p>;
  }

  if (data.type === 'list') {
    return (
      <ul className="rd-list">
        {data.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  // table
  return (
    <div className="rd-subtable-wrap">
      <table className="rd-subtable">
        <thead>
          <tr>
            <th className="rd-subtable-no">#</th>
            {data.columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              <td className="rd-subtable-no">{i + 1}</td>
              {data.columns.map((c) => (
                <td key={c.key}>{row[c.key]?.trim() ? row[c.key] : '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StructuredValue;
export { StructuredValue };
export type { StructuredValueProps };
