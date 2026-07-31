const toSharePointDownloadUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase().endsWith('.sharepoint.com')) {
      url.searchParams.set('download', '1');
      return url.toString();
    }
  } catch {
    // Relative, data, and blob URLs should be returned unchanged.
  }
  return value;
};

export { toSharePointDownloadUrl };
