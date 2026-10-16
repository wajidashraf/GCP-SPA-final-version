/** Deduplicate layout fields within each saved record, preserving every record. */
export const combineDetailRecordFields = <T extends { label: string }>(
  parentFields: readonly T[],
  recordFields: readonly (readonly T[])[],
  basicLabels: ReadonlySet<string>,
): T[] => {
  const fields = parentFields.filter((field) => !basicLabels.has(field.label));
  const parentLabels = new Set(fields.map((field) => field.label));
  recordFields.forEach((record, index) => {
    const seen = new Set(parentLabels);
    for (const field of record) {
      if (basicLabels.has(field.label) || seen.has(field.label)) continue;
      seen.add(field.label);
      fields.push(recordFields.length > 1 ? { ...field, label: `Record ${index + 1} · ${field.label}` } : field);
    }
  });
  return fields;
};
