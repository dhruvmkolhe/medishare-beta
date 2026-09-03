const fs = require('fs');
const zlib = require('zlib');

const width = 1200;
const height = 630;

const bytesPerPixel = 3;
const scanlineLength = width * bytesPerPixel + 1;
const rawData = Buffer.alloc(scanlineLength * height);

for (let y = 0; y < height; y++) {
  const rowOffset = y * scanlineLength;
  rawData[rowOffset] = 0; // Filter: None
  for (let x = 0; x < width; x++) {
    const pxOffset = rowOffset + 1 + x * bytesPerPixel;
    // Dark slate gradient
    const t = (x + y) / (width + height);
    let r = Math.round(15 + t * 15);
    let g = Math.round(23 + t * 18);
    let b = Math.round(42 + t * 17);

    // Green top and bottom border
    if (y < 8 || y >= height - 8) {
      r = 34; g = 197; b = 94;
    }

    // Cross emblem
    const cx = 220, cy = 315;
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    if ((dx <= 20 && dy <= 90) || (dx <= 90 && dy <= 20)) {
      r = 34; g = 197; b = 94;
    }
    if (dx <= 14 && dy <= 14) {
      r = 15; g = 23; b = 42;
    }
    if ((dx <= 4 && dy <= 8) || (dx <= 8 && dy <= 4)) {
      r = 34; g = 197; b = 94;
    }

    rawData[pxOffset] = r;
    rawData[pxOffset + 1] = g;
    rawData[pxOffset + 2] = b;
  }
}

const compressed = zlib.deflateSync(rawData);

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c >>> 0;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 2; // RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const ihdrChunk = makeChunk('IHDR', ihdr);
const idatChunk = makeChunk('IDAT', compressed);
const iendChunk = makeChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
fs.writeFileSync('public/og-image.png', png);
console.log('Successfully generated public/og-image.png (' + png.length + ' bytes)');
