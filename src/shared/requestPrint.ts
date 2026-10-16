const signatureUnavailable = () => new Error(
  'A saved signature image is unavailable. Retry the signature history before printing.',
);

const waitForSignature = (image: HTMLImageElement): Promise<void> => {
  // Collapsed sections remain mounted; eager loading also covers images which
  // were previously outside the viewport when the user selected Print.
  image.loading = 'eager';
  if (image.complete) {
    return image.naturalWidth > 0 ? Promise.resolve() : Promise.reject(signatureUnavailable());
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      if (image.naturalWidth > 0) resolve();
      else reject(signatureUnavailable());
    };
    const onError = () => {
      cleanup();
      reject(signatureUnavailable());
    };
    const timeout = setTimeout(onError, 15_000);
    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    // A cached image can finish between the first check and listener setup.
    if (image.complete) onLoad();
  });
};

/** Print the same saved record only after every historical signature is ready. */
export const printRequestRecord = async (
  root: HTMLElement,
  print: () => void = () => window.print(),
): Promise<void> => {
  const requestId = root.dataset.requestId;
  if (!requestId?.trim() || root.dataset.printReady !== 'true') {
    throw new Error('The request is not ready to print. Wait for its saved information to load and retry.');
  }
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-request-signature]'));
  await Promise.all(images.map(waitForSignature));
  const currentImages = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-request-signature]'));
  const currentImageSet = new Set(currentImages);
  if (!root.isConnected || root.dataset.requestId !== requestId || root.dataset.printReady !== 'true' ||
      currentImages.length !== images.length || images.some((image) => !currentImageSet.has(image))) {
    throw new Error('The request changed while preparing to print. Open it again and retry.');
  }
  if (images.some((image) => !image.complete || image.naturalWidth === 0)) throw signatureUnavailable();
  print();
};
