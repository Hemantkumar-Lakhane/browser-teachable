import { setStatus } from '../utils.js';
import { captureModelFilesForDeployment } from './persistence.js';

const ZIP_VERSION = 20;

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeText(text) {
  return new TextEncoder().encode(text);
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function normalizeFileData(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return encodeText(String(data));
}

function createZip(files) {
  const now = new Date();
  const { time, date } = dosDateTime(now);
  const parts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(file => {
    const nameBytes = encodeText(file.path);
    const dataBytes = normalizeFileData(file.data);
    const crc = crc32(dataBytes);

    const local = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(local);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, ZIP_VERSION);
    writeU16(localView, 6, 0x0800);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, time);
    writeU16(localView, 12, date);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, dataBytes.length);
    writeU32(localView, 22, dataBytes.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    new Uint8Array(local, 30).set(nameBytes);

    parts.push(local, dataBytes);

    const central = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(central);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, ZIP_VERSION);
    writeU16(centralView, 6, ZIP_VERSION);
    writeU16(centralView, 8, 0x0800);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, time);
    writeU16(centralView, 14, date);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, dataBytes.length);
    writeU32(centralView, 24, dataBytes.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    new Uint8Array(central, 46).set(nameBytes);
    centralParts.push(central);

    offset += local.byteLength + dataBytes.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, files.length);
  writeU16(endView, 10, files.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, centralOffset);
  writeU16(endView, 20, 0);

  return new Blob([...parts, ...centralParts, end], { type: 'application/zip' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchCustomerPage() {
  const response = await fetch('./customer-link.html', { cache: 'no-store' });
  if (!response.ok) throw new Error(`customer-link.html could not be loaded (${response.status}).`);
  return response.text();
}

function buildDeployReadme() {
  return `# ModelForge Deployment Package

This folder is ready to host as a static website.

## Files
- customer-link.html: public inference page
- model/model.json: TensorFlow.js classifier topology
- model/model.weights.bin: classifier weights
- model/metadata.json: class names, backbone, and training configuration

## Deploy
Upload the extracted folder to GitHub Pages, Netlify, Vercel, Firebase Hosting, or any static hosting provider.

Open customer-link.html from the hosted URL and allow camera permissions.

## Notes
- The page uses TensorFlow.js and backbone models from public CDNs, so the hosted page needs internet access.
- Camera access requires HTTPS on real devices. Localhost is allowed for testing.
- If the model was trained with ResNet50 or EfficientNet, first load can be slower because the feature extractor is larger.
`;
}

export async function prepareDeploymentPackage() {
  setStatus('Preparing deployable customer site...', 'ready');
  const [modelFiles, customerPage] = await Promise.all([
    captureModelFilesForDeployment(),
    fetchCustomerPage()
  ]);

  const zip = createZip([
    { path: 'customer-link.html', data: customerPage },
    { path: 'model/model.json', data: modelFiles.modelJson },
    { path: 'model/model.weights.bin', data: modelFiles.weights },
    { path: 'model/metadata.json', data: modelFiles.metadataJson },
    { path: 'README_DEPLOY.md', data: buildDeployReadme() }
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(zip, `modelforge-deploy-${stamp}.zip`);
  setStatus('Deployment ZIP ready. Upload it to any static host.', 'ready');
}
