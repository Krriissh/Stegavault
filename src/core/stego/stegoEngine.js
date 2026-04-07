/**
 * StegaVault – Steganography Engine  (v2.0)
 *
 * Algorithm: Sequential LSB (Least Significant Bit) substitution.
 *
 * Embedding format (big-endian):
 *   [4 bytes : payload length N]
 *   [N bytes : opaque payload  ]   ← JSON-serialized hybrid crypto payload
 *
 * Each bit occupies the LSB of one color channel (R/G/B) in pixel order
 * top-left → bottom-right.  Security derives entirely from the RSA+AES
 * encryption layer, not from pixel-order obfuscation.
 *
 * Output is always PNG (lossless) to preserve embedded bits exactly.
 *
 * Capacity: floor(width × height × 3 / 8) − 4  bytes.
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Maximum payload bytes that fit in an image.
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function getCapacity(width, height) {
  return Math.floor((width * height * 3) / 8) - 4;
}

/**
 * Embeds an opaque payload (any bytes) into raw ImageData using sequential LSB.
 *
 * @param {ImageData}  imageData
 * @param {Uint8Array} payloadBytes   Serialized hybrid crypto payload (JSON UTF-8)
 * @param {(pct:number)=>void} [onProgress]
 * @returns {{ stego: ImageData, bitsUsed: number, capacity: number, density: string }}
 */
export function embedData(imageData, payloadBytes, onProgress) {
  const { data, width, height } = imageData;
  const capacity = getCapacity(width, height);

  if (payloadBytes.length > capacity) {
    throw new Error(
      `Payload too large for this image. ` +
      `Required: ${payloadBytes.length} bytes, available: ${capacity} bytes. ` +
      `Use a larger cover image or a shorter message.`
    );
  }

  // Frame: [4-byte big-endian length][payload bytes]
  const frame = new Uint8Array(4 + payloadBytes.length);
  new DataView(frame.buffer).setUint32(0, payloadBytes.length, false);
  frame.set(payloadBytes, 4);

  const totalBits = frame.length * 8;
  const newData   = new Uint8ClampedArray(data); // copy – never mutate original

  for (let bitPos = 0; bitPos < totalBits; bitPos++) {
    // Sequential: 3 channel slots per pixel (R=0, G=1, B=2)
    const pixelIdx    = Math.floor(bitPos / 3);
    const channelIdx  = bitPos % 3;
    const byteOffset  = pixelIdx * 4;  // RGBA stride

    const byteIndex   = Math.floor(bitPos / 8);
    const bitInByte   = 7 - (bitPos % 8);  // MSB-first
    const bit         = (frame[byteIndex] >> bitInByte) & 1;

    newData[byteOffset + channelIdx] = (newData[byteOffset + channelIdx] & 0xfe) | bit;

    if (onProgress && bitPos % 50_000 === 0) {
      onProgress(Math.round((bitPos / totalBits) * 95));
    }
  }

  onProgress?.(100);

  return {
    stego:    new ImageData(newData, width, height),
    bitsUsed: totalBits,
    capacity: capacity * 8,
    density:  ((totalBits / ((width * height) * 3)) * 100).toFixed(2),
  };
}

/**
 * Extracts an embedded payload from a stego ImageData.
 * Reads the 4-byte length header first, then reads exactly that many payload bytes.
 *
 * @param {ImageData} imageData
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Uint8Array}  Raw payload bytes (caller is responsible for parsing)
 */
export function extractData(imageData, onProgress) {
  const { data, width, height } = imageData;
  const maxCapacity = getCapacity(width, height);

  // ── Step 1: read 32-bit length header (bits 0–31) ──
  const lengthBytes = new Uint8Array(4);
  for (let bitPos = 0; bitPos < 32; bitPos++) {
    const pixelIdx   = Math.floor(bitPos / 3);
    const channelIdx = bitPos % 3;
    const bit        = data[pixelIdx * 4 + channelIdx] & 1;
    const byteIndex  = Math.floor(bitPos / 8);
    const bitInByte  = 7 - (bitPos % 8);
    if (bit) lengthBytes[byteIndex] |= (1 << bitInByte);
  }

  const payloadLength = new DataView(lengthBytes.buffer).getUint32(0, false);

  // Sanity check: minimum payload is the smallest valid JSON structure (~50 bytes)
  if (payloadLength < 50 || payloadLength > maxCapacity) {
    throw new Error(
      'No valid hidden data found. Ensure this is a stego image created with StegaVault v2.'
    );
  }

  // ── Step 2: read payload bits (bits 32 … (4+payloadLength)*8 - 1) ──
  const payload    = new Uint8Array(payloadLength);
  const totalBits  = (4 + payloadLength) * 8;

  for (let bitPos = 32; bitPos < totalBits; bitPos++) {
    const pixelIdx   = Math.floor(bitPos / 3);
    const channelIdx = bitPos % 3;
    const bit        = data[pixelIdx * 4 + channelIdx] & 1;

    const relBit    = bitPos - 32;
    const byteIndex = Math.floor(relBit / 8);
    const bitInByte = 7 - (relBit % 8);
    if (bit) payload[byteIndex] |= (1 << bitInByte);

    if (onProgress && bitPos % 50_000 === 0) {
      onProgress(Math.round((bitPos / totalBits) * 95));
    }
  }

  onProgress?.(100);
  return payload;
}

// ─── Image I/O helpers ────────────────────────────────────────────────────────

/**
 * Loads an image File into an ImageData object via a canvas.
 * Always outputs RGBA pixel data regardless of source format.
 *
 * @param {File} file
 * @returns {Promise<{ imageData: ImageData, width: number, height: number, objectUrl: string }>}
 */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve({
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        width:     canvas.width,
        height:    canvas.height,
        objectUrl: url,
      });
    };
    img.onerror = () => reject(new Error('Failed to load image. Ensure the file is a valid image.'));
    img.src = url;
  });
}

/**
 * Converts an ImageData to a lossless PNG Blob.
 * PNG is required to preserve the LSBs exactly.
 *
 * @param {ImageData} imageData
 * @returns {Promise<Blob>}
 */
export function imageDataToPngBlob(imageData) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width  = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode output image as PNG'));
    }, 'image/png');
  });
}
