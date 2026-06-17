export const matterChoices = [
  { label: 'Registration of Tender & Proposal List', value: 1, code: 'RTP', channel: 'gcpc' },
  { label: 'Prospective Bidders List', value: 2, code: 'PBL', channel: 'gcpc' },
  { label: 'JV / Partnership', value: 3, code: 'JVP', channel: 'gcpc' },
  { label: 'Submission of Tender / Proposal', value: 4, code: 'ST/SP', channel: 'gcpc' },
  { label: 'Client - Acceptance of Award', value: 5, code: 'CAA', channel: 'gcpc' },
  { label: 'Project Cost Control Analysis', value: 6, code: 'PCCA', channel: 'gcpc' },
  { label: 'Procurement Plan', value: 7, code: 'PP', channel: 'gcpc' },
  { label: 'Vendor Appointment and Procurement', value: 8, code: 'VAP', channel: 'gcpc' },
  { label: 'Other Matters', value: 9, code: 'Others', channel: 'gcpc' },
  { label: 'Revised Project Cost Control Analysis', value: 10, code: 'R-PCCA', channel: 'gcp' },
  { label: 'Revised Procurement Plan (RPP)', value: 14, code: 'R-PP', channel: 'gcp' },
  { label: 'Contractual Issue', value: 11, code: 'CI', channel: 'gcp' },
  { label: 'Contract & Procurement Report', value: 12, code: 'CPR', channel: 'gcp' },
  { label: 'GCP - Others', value: 13, code: 'Others', channel: 'gcp' },
] as const;

export type MatterChoice = (typeof matterChoices)[number];

export function toFormCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findMatter(channel: string, formCode: string): MatterChoice | undefined {
  return matterChoices.find(
    (m) => m.channel === channel && toFormCode(m.code) === formCode
  );
}
