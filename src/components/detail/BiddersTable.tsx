// src/components/detail/BiddersTable.tsx
// Read-only table of prospective bidders for a PBL request. Bidders are a
// one-to-many child of the PBL request, so they render as a table rather than
// a field grid. Falls back to an empty-state note when none are recorded.

import { Users } from 'lucide-react';
import type { GcpPblBidder } from '../../types/pblBidder';
import { getChoiceLabel } from '../../data/types';
import { sectorChoices } from '../../data/projectChoices';

type BiddersTableProps = {
  bidders: GcpPblBidder[];
};

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

const BiddersTable = ({ bidders }: BiddersTableProps) => {
  if (!bidders.length) {
    return (
      <div className="rd-bidders-empty">
        <Users size={18} aria-hidden="true" />
        <span>No bidders recorded for this request.</span>
      </div>
    );
  }

  // A justification is captured once and mirrored onto every bidder row, so show
  // it once below the table rather than as a repeated column.
  const justification = bidders
    .map((b) => b.justificationForLt3Bidders)
    .find((j) => j && j.trim());

  return (
    <>
      <div className="rd-bidders-wrap">
        <table className="rd-bidders">
          <thead>
            <tr>
              <th className="rd-bidders-no">#</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Location</th>
              <th>Person In Charge</th>
              <th>Contact No.</th>
              <th>Recommended By</th>
              <th>Sources From</th>
            </tr>
          </thead>
          <tbody>
            {bidders.map((b, i) => (
              <tr key={b.id || i}>
                <td className="rd-bidders-no">{i + 1}</td>
                <td className="rd-bidders-company">
                  {dash(b.companyName ?? b.company ?? b.bidderName)}
                </td>
                <td>{b.sector != null ? getChoiceLabel(sectorChoices, b.sector) ?? '—' : '—'}</td>
                <td>{dash(b.location)}</td>
                <td>{dash(b.personInCharge)}</td>
                <td>{dash(b.picContactNumber)}</td>
                <td>{dash(b.recommendedBy)}</td>
                <td>{dash(b.sourcesFrom)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {justification ? (
        <div className="rd-bidders-note">
          <span className="rd-field-label">Justification (fewer than 3 bidders)</span>
          <p className="rd-multiline">{justification}</p>
        </div>
      ) : null}
    </>
  );
};

export default BiddersTable;
export { BiddersTable };
export type { BiddersTableProps };
