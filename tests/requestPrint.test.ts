import assert from 'node:assert/strict';
import test from 'node:test';
import { printRequestRecord } from '../src/shared/requestPrint.ts';

class SignatureImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  loading = 'lazy';
  alt = 'Stored signature';
}

const rootWith = (images: SignatureImage[]) => ({
  isConnected: true,
  dataset: { requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', printReady: 'true' },
  querySelectorAll: (selector: string) => {
    assert.equal(selector, 'img[data-request-signature]');
    return images;
  },
}) as unknown as HTMLElement;

test('waits for all historical images before opening print, including collapsed-section images', async () => {
  const first = new SignatureImage();
  const second = new SignatureImage();
  first.complete = true;
  first.naturalWidth = 240;
  let printed = false;
  const pending = printRequestRecord(rootWith([first, second]), () => { printed = true; });
  await Promise.resolve();
  assert.equal(printed, false);
  second.complete = true;
  second.naturalWidth = 200;
  second.dispatchEvent(new Event('load'));
  await pending;
  assert.equal(printed, true);
  assert.equal(second.loading, 'eager');
});

test('rejects a previously failed image and never opens an incomplete print', async () => {
  const image = new SignatureImage();
  image.complete = true;
  let printed = false;
  await assert.rejects(printRequestRecord(rootWith([image]), () => { printed = true; }), /signature.*unavailable/i);
  assert.equal(printed, false);
});

test('rejects a loading image that errors and allows retry with a newly loaded image', async () => {
  const image = new SignatureImage();
  let count = 0;
  const pending = printRequestRecord(rootWith([image]), () => { count += 1; });
  image.complete = true;
  image.dispatchEvent(new Event('error'));
  await assert.rejects(pending, /signature.*unavailable/i);
  assert.equal(count, 0);
  image.naturalWidth = 200;
  await printRequestRecord(rootWith([image]), () => { count += 1; });
  assert.equal(count, 1);
});

test('does not print another page when the request root is removed during image loading', async () => {
  const image = new SignatureImage();
  const root = rootWith([image]);
  let printed = false;
  const pending = printRequestRecord(root, () => { printed = true; });
  Object.assign(root, { isConnected: false });
  image.naturalWidth = 200;
  image.complete = true;
  image.dispatchEvent(new Event('load'));
  await assert.rejects(pending, /request.*changed/i);
  assert.equal(printed, false);
});

test('prints a record with no historical signature images', async () => {
  let printed = false;
  await printRequestRecord(rootWith([]), () => { printed = true; });
  assert.equal(printed, true);
});

for (const [label, requestId, printReady] of [
  ['missing request identity', undefined, 'true'],
  ['empty request identity', '', 'true'],
  ['loading record', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'false'],
]) {
  test(`rejects ${label} before preparing a print`, async () => {
    const root = rootWith([]);
    Object.assign(root.dataset, { requestId, printReady });
    let printed = false;
    await assert.rejects(printRequestRecord(root, () => { printed = true; }), /request.*ready/i);
    assert.equal(printed, false);
  });
}

test('rejects a connected root reused for another request while awaiting a signature', async () => {
  const image = new SignatureImage();
  const root = rootWith([image]);
  let printed = false;
  const pending = printRequestRecord(root, () => { printed = true; });
  root.dataset.requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  image.complete = true;
  image.naturalWidth = 200;
  image.dispatchEvent(new Event('load'));
  await assert.rejects(pending, /request.*changed/i);
  assert.equal(printed, false);
});

test('rejects the same request when related data becomes unready while awaiting a signature', async () => {
  const image = new SignatureImage();
  const root = rootWith([image]);
  let printed = false;
  const pending = printRequestRecord(root, () => { printed = true; });
  root.dataset.printReady = 'false';
  image.complete = true;
  image.naturalWidth = 200;
  image.dispatchEvent(new Event('load'));
  await assert.rejects(pending, /request.*changed/i);
  assert.equal(printed, false);
});

for (const [label, mutate] of [
  ['added', (images: SignatureImage[]) => { images.push(new SignatureImage()); }],
  ['replaced', (images: SignatureImage[]) => { images[0] = new SignatureImage(); }],
  ['removed', (images: SignatureImage[]) => { images.length = 0; }],
]) {
  test(`rejects historical image nodes ${label} while preparing the print`, async () => {
    const original = new SignatureImage();
    const images = [original];
    const root = rootWith(images);
    let printed = false;
    const pending = printRequestRecord(root, () => { printed = true; });
    mutate(images);
    original.complete = true;
    original.naturalWidth = 200;
    original.dispatchEvent(new Event('load'));
    await assert.rejects(pending, /request.*changed/i);
    assert.equal(printed, false);
  });
}

test('rejects a marked image that becomes unready immediately before printing', async () => {
  const image = new SignatureImage();
  image.complete = true;
  image.naturalWidth = 200;
  let printed = false;
  const pending = printRequestRecord(rootWith([image]), () => { printed = true; });
  image.complete = false;
  image.naturalWidth = 0;
  await assert.rejects(pending, /signature.*unavailable/i);
  assert.equal(printed, false);
});
