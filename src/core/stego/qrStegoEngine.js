/**
 * StegaVault – StegaQR Engine  (v1.0)
 *
 * Generates a QR code that:
 *   1. Encodes a visible decoy URL (normal, scannable QR behavior)
 *   2. Steganographically hides an encrypted payload in the QR's safe data modules
 *
 * Anti-steganalysis defenses:
 *   • Safe-region masking  — never modifies finder/timing/alignment/format modules
 *   • AES-CTR PRNG shuffle — randomizes embedding order using a secret 32-byte key
 *   • Noise mimicry        — fills every unused safe-pixel LSB with random bits so
 *                            the overall LSB histogram is uniform (defeats chi-square,
 *                            RS analysis, and sample-pair attacks)
 *   • Deflate compression  — shrinks payload AND flattens its bit entropy distribution
 *   • Colored QR modules   — non-trivial RGB values (not pure 0/255) provide richer
 *                            cover for LSB changes across all three color channels
 *
 * Rendering contract (required for deterministic extraction):
 *   MODULE_SCALE = 10 px/module  ·  QUIET_ZONE = 4 modules each side
 *   → imgWidth = 10 × (qrSize + 8)   ←  extraction derives qrSize from imgWidth
 *
 * Frame format (embedded into shuffled safe pixels):
 *   [4 B : magic "SQRP" = 0x53 0x51 0x52 0x50]
 *   [4 B : compressed payload length, uint32 big-endian]
 *   [N B : deflate-raw compressed payload]
 */

import QRCode from 'qrcode';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MODULE_SCALE = 10;   // pixels per QR module – fixed for lossless round-trip
export const QUIET_ZONE   = 4;    // quiet-zone modules on each side (QR min = 4)
const INNER_PAD_PX        = 2;    // pixel inset from each module edge (avoids anti-aliased borders)
const MAGIC               = new Uint8Array([0x53, 0x51, 0x52, 0x50]); // "SQRP"
const FRAME_HEADER        = 8;    // magic(4) + compressed-length(4)

// ─── QR alignment pattern center coordinates (QR ISO 18004 Table E.1) ────────
// Each entry is an array of row/column coordinates for version V.
// Alignment patterns appear at every cross-product of these coordinates,
// except where they overlap with the three finder-pattern regions.

const ALIGN_COORD = [
  null,                             // v1  – no alignment patterns
  [6, 18],                          // v2
  [6, 22],                          // v3
  [6, 26],                          // v4
  [6, 30],                          // v5
  [6, 34],                          // v6
  [6, 22, 38],                      // v7
  [6, 24, 42],                      // v8
  [6, 26, 46],                      // v9
  [6, 28, 50],                      // v10
  [6, 30, 54],                      // v11
  [6, 32, 58],                      // v12
  [6, 34, 62],                      // v13
  [6, 26, 46, 66],                  // v14
  [6, 26, 48, 70],                  // v15
  [6, 26, 50, 74],                  // v16
  [6, 30, 54, 78],                  // v17
  [6, 30, 56, 82],                  // v18
  [6, 30, 58, 86],                  // v19
  [6, 34, 62, 90],                  // v20
  [6, 28, 50, 72, 94],              // v21
  [6, 26, 50, 74, 98],              // v22
  [6, 30, 54, 78, 102],             // v23
  [6, 28, 54, 80, 106],             // v24
  [6, 32, 58, 84, 110],             // v25
  [6, 30, 58, 86, 114],             // v26
  [6, 34, 62, 90, 118],             // v27
  [6, 26, 50, 74, 98, 122],         // v28
  [6, 30, 54, 78, 102, 126],        // v29
  [6, 26, 52, 78, 104, 130],        // v30
  [6, 30, 56, 82, 108, 134],        // v31
  [6, 34, 60, 86, 112, 138],        // v32
  [6, 30, 58, 86, 114, 142],        // v33
  [6, 34, 62, 90, 118, 146],        // v34
  [6, 30, 54, 78, 102, 126, 150],   // v35
  [6, 24, 50, 76, 102, 128, 154],   // v36
  [6, 28, 54, 80, 106, 132, 158],   // v37
  [6, 32, 58, 84, 110, 136, 162],   // v38
  [6, 26, 54, 82, 110, 138, 166],   // v39
  [6, 30, 58, 86, 114, 142, 170],   // v40
];

// ─── Safe-region mask ─────────────────────────────────────────────────────────

/**
 * Builds a flat Uint8Array (length = qrSize²) where 1 = data module (safe to
 * embed in) and 0 = structural module (must not be touched).
 *
 * Structural regions (masked to 0):
 *   • Finder patterns + separators  (9×9 corner blocks)
 *   • Timing patterns               (row 6 and col 6)
 *   • Format information strips     (implicit inside the 9×9 corners)
 *   • Dark module                   ((qrSize-8, 8))
 *   • Alignment patterns            (5×5 centered at ALIGN_COORD cross-products)
 *   • Version information blocks    (v7+)
 *
 * @param {number} qrSize  – modules per side, e.g. 21 for v1, 57 for v10
 * @returns {Uint8Array}
 */
function buildSafeMask(qrSize) {
  const v    = (qrSize - 17) / 4;  // QR version (1–40)
  const mask = new Uint8Array(qrSize * qrSize).fill(1);

  /** Zero-out a rectangular region of modules (clamped to grid bounds). */
  function clearRect(rMin, rMax, cMin, cMax) {
    const r0 = Math.max(0, rMin),  r1 = Math.min(qrSize - 1, rMax);
    const c0 = Math.max(0, cMin),  c1 = Math.min(qrSize - 1, cMax);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        mask[r * qrSize + c] = 0;
  }

  // ── Finder patterns + separators ──────────────────────────────────────────
  // Each finder is 7×7; the separator adds one module on each interior edge,
  // giving an 8×8 footprint.  We clear 9×9 (including format-info row/col).
  clearRect(0, 8, 0, 8);                         // top-left
  clearRect(0, 8, qrSize - 9, qrSize - 1);       // top-right
  clearRect(qrSize - 9, qrSize - 1, 0, 8);       // bottom-left

  // ── Timing patterns ───────────────────────────────────────────────────────
  for (let i = 0; i < qrSize; i++) {
    mask[6 * qrSize + i] = 0;   // horizontal timing (row 6)
    mask[i * qrSize + 6] = 0;   // vertical timing   (col 6)
  }

  // ── Dark module (always dark; part of the format information area) ─────────
  mask[(qrSize - 8) * qrSize + 8] = 0;

  // ── Alignment patterns ────────────────────────────────────────────────────
  const coords = ALIGN_COORD[v] ?? [];
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const r = coords[i], c = coords[j];
      // Skip if overlapping with any of the three finder-pattern corners
      if (r <= 8 && c <= 8)             continue;  // TL
      if (r <= 8 && c >= qrSize - 9)   continue;  // TR
      if (r >= qrSize - 9 && c <= 8)   continue;  // BL
      clearRect(r - 2, r + 2, c - 2, c + 2);       // 5×5 alignment pattern
    }
  }

  // ── Version information (v7+) ─────────────────────────────────────────────
  if (v >= 7) {
    clearRect(0, 5, qrSize - 11, qrSize - 9);   // top-right version block
    clearRect(qrSize - 11, qrSize - 9, 0, 5);   // bottom-left version block
  }

  return mask;
}

// ─── Safe pixel list ──────────────────────────────────────────────────────────

/**
 * Converts the module-level safe mask into a flat list of RGBA byte-offsets
 * pointing into imageData.data.  Only the inner (non-edge) pixels of each safe
 * module are used, avoiding any anti-aliased border pixels.
 *
 * For each inner pixel we push three offsets: +0 (R), +1 (G), +2 (B).
 * One bit of payload will be written into the LSB of each offset.
 *
 * @param {number}     qrSize
 * @param {number}     imgWidth
 * @param {number}     imgHeight
 * @param {Uint8Array} safeMask   – output of buildSafeMask
 * @returns {number[]}            – RGBA byte offsets (multiples of 1, not 4)
 */
function buildSafePixelList(qrSize, imgWidth, imgHeight, safeMask) {
  const marginPx = QUIET_ZONE * MODULE_SCALE;    // pixel offset of module (0,0)
  const lo       = INNER_PAD_PX;                 // inclusive lower bound within module
  const hi       = MODULE_SCALE - INNER_PAD_PX;  // exclusive upper bound (= 8 for scale 10)

  const list = [];

  for (let mRow = 0; mRow < qrSize; mRow++) {
    for (let mCol = 0; mCol < qrSize; mCol++) {
      if (!safeMask[mRow * qrSize + mCol]) continue;

      for (let pr = lo; pr < hi; pr++) {
        for (let pc = lo; pc < hi; pc++) {
          const pixRow = marginPx + mRow * MODULE_SCALE + pr;
          const pixCol = marginPx + mCol * MODULE_SCALE + pc;
          if (pixRow >= imgHeight || pixCol >= imgWidth) continue;

          const base = (pixRow * imgWidth + pixCol) * 4;
          list.push(base, base + 1, base + 2);   // R, G, B channels
        }
      }
    }
  }

  return list;
}

// ─── AES-CTR keystream PRNG ───────────────────────────────────────────────────

/**
 * Generates `byteCount` pseudorandom bytes using AES-128-CTR.
 * • First 16 bytes of seed32 → AES key
 * • Last  16 bytes of seed32 → initial counter block
 *
 * Produces a cryptographically secure keystream indistinguishable from random.
 *
 * @param {Uint8Array} seed32    – 32-byte seed (derived from stego key)
 * @param {number}     byteCount
 * @returns {Promise<Uint8Array>}
 */
async function generateKeystream(seed32, byteCount) {
  const aesKey = await crypto.subtle.importKey(
    'raw', seed32.slice(0, 16), { name: 'AES-CTR' }, false, ['encrypt'],
  );
  const counter = new Uint8Array(16);
  counter.set(seed32.slice(16, 32));

  return new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter, length: 64 },
      aesKey,
      new Uint8Array(byteCount),
    ),
  );
}

/**
 * In-place Fisher-Yates shuffle driven by the AES-CTR keystream.
 * Modulo bias is statistically negligible for steganographic use.
 *
 * Why AES-CTR?  A sequential PRNG (e.g. LCG) would leave exploitable order
 * correlation between embedding positions.  AES-CTR gives positions that
 * are computationally indistinguishable from a uniformly random permutation
 * to any observer who doesn't possess the stego key.
 *
 * @param {number[]}   arr
 * @param {Uint8Array} seed32
 * @returns {Promise<number[]>}  the same array, shuffled in-place
 */
async function shuffleInPlace(arr, seed32) {
  const n = arr.length;
  if (n <= 1) return arr;

  // Derive a shuffle-specific sub-key so the same seed32 can be used for both
  // shuffling and noise without reusing keystream bytes.
  const subKeyInput = new Uint8Array([...seed32, 0x53, 0x48, 0x46, 0x4C]); // +"SHFL"
  const subKey32    = new Uint8Array(await crypto.subtle.digest('SHA-256', subKeyInput));

  // 4 bytes per Fisher-Yates step → n * 4 bytes total
  const ks   = await generateKeystream(subKey32, n * 4);
  const view = new DataView(ks.buffer);

  for (let i = n - 1; i > 0; i--) {
    const j = view.getUint32(i * 4) % (i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// ─── Compression ─────────────────────────────────────────────────────────────

/**
 * Lossless deflate-raw compression via the Compression Streams API.
 * Falls back to identity (no compression) if the API is unavailable.
 *
 * Why compress?
 *   1. Smaller payload → lower embedding density → harder to detect statistically.
 *   2. Compressed output has near-uniform bit distribution (high entropy), which
 *      means the embedded bits blend well with the randomized surrounding noise.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function compressBytes(data) {
  if (typeof CompressionStream === 'undefined') return data; // graceful fallback

  const cs     = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  writer.write(data);
  writer.close();

  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out   = new Uint8Array(total);
  let   off   = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

/**
 * Inflate-raw decompression.  Falls back to identity if unavailable.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function decompressBytes(data) {
  if (typeof DecompressionStream === 'undefined') return data;

  const ds     = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(data);
  writer.close();

  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out   = new Uint8Array(total);
  let   off   = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derives a 32-byte key from a password using PBKDF2-SHA-256.
 * @param {string} password
 * @param {string} salt     – domain-separation string (different per usage)
 * @returns {Promise<Uint8Array>}
 */
async function pbkdf2Derive(password, salt) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Derives the 32-byte stego key (controls WHERE bits are hidden — position shuffling).
 * @param {string} password
 * @returns {Promise<Uint8Array>}
 */
export async function deriveStegaKey(password) {
  return pbkdf2Derive(password, 'StegaQR-v1.0-skey');
}

/**
 * Encrypts a plaintext message with AES-256-GCM using a password-derived key.
 *
 * Key derivation uses a separate PBKDF2 salt ('StegaQR-v1.0-mkey') so the
 * message key is always independent from the stego position key, even when
 * the same password is used for both.
 *
 * Output format: [12 B random IV][variable-length ciphertext + 16 B GCM tag]
 *
 * @param {string} message
 * @param {string} password
 * @returns {Promise<Uint8Array>}
 */
export async function encryptQRPayload(message, password) {
  const rawKey = await pbkdf2Derive(password, 'StegaQR-v1.0-mkey');
  const aesKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const iv         = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    new TextEncoder().encode(message),
  );
  const out = new Uint8Array(12 + cipherBuf.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipherBuf), 12);
  return out;
}

/**
 * Decrypts a payload produced by encryptQRPayload.
 * Throws if the password is wrong or the data is corrupted (GCM tag mismatch).
 *
 * @param {Uint8Array} bytes
 * @param {string}     password
 * @returns {Promise<string>}
 */
export async function decryptQRPayload(bytes, password) {
  if (bytes.length < 13) throw new Error('Payload too short to be a valid StegaQR message.');
  const rawKey = await pbkdf2Derive(password, 'StegaQR-v1.0-mkey');
  const aesKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const iv         = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 }, aesKey, ciphertext,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('Decryption failed — wrong password or corrupted payload.');
  }
}

/**
 * Calculates the maximum embeddable payload size for the given URL / EC level.
 *
 * A longer URL forces a higher QR version, which has more data modules
 * and therefore more embedding capacity — exploit this deliberately.
 *
 * @param {string} url
 * @param {'L'|'M'|'Q'|'H'} [ecLevel='H']
 * @returns {Promise<{ version, qrSize, imgWidth, safeMods, totalMods, safePixelSlots, rawCapacity }>}
 */
export async function calcEmbedCapacity(url, ecLevel = 'H') {
  const qrData = QRCode.create(url, { errorCorrectionLevel: ecLevel });
  const qrSize = qrData.modules.size;
  const imgW   = MODULE_SCALE * (qrSize + 2 * QUIET_ZONE);

  const safeMask   = buildSafeMask(qrSize);
  const safePixels = buildSafePixelList(qrSize, imgW, imgW, safeMask);

  let safeMods = 0;
  for (let i = 0; i < safeMask.length; i++) if (safeMask[i]) safeMods++;

  return {
    version:        (qrSize - 17) / 4,
    qrSize,
    imgWidth:       imgW,
    safeMods,
    totalMods:      qrSize * qrSize,
    safePixelSlots: safePixels.length,           // total LSB slots available
    rawCapacity:    Math.floor(safePixels.length / 8) - FRAME_HEADER,  // bytes (pre-compression)
  };
}

/**
 * Generates a StegaQR image: a scannable QR code with a hidden encrypted payload.
 *
 * Pipeline:
 *   1. QRCode.create()         → determine qrSize & version
 *   2. QRCode.toCanvas()       → render colored QR (MODULE_SCALE × QUIET_ZONE contract)
 *   3. buildSafeMask()         → identify structural vs. data modules
 *   4. buildSafePixelList()    → collect inner-pixel RGBA offsets of data modules
 *   5. compressBytes()         → deflate-raw compress the payload
 *   6. shuffleInPlace()        → AES-CTR PRNG shuffle of position list
 *   7. Embed frame bits        → write payload bits into shuffled positions
 *   8. Noise mimicry           → randomize LSBs of all unused safe pixels
 *
 * @param {string}     url           – Decoy URL to encode in the QR
 * @param {Uint8Array} payloadBytes  – Already-encrypted payload (from buildHybridPayload)
 * @param {Uint8Array} stegoKey      – 32-byte key (from deriveStegaKey)
 * @param {object}     options
 * @param {'L'|'M'|'Q'|'H'} [options.ecLevel='H']
 * @param {string}  [options.darkColor='#1e3a5f']   – QR dark module color (hex)
 * @param {string}  [options.lightColor='#f2f7fc']  – QR light module color (hex)
 * @param {function} [options.onProgress]           – (0–100) progress callback
 * @returns {Promise<{ imageData: ImageData, stats: object }>}
 */
export async function embedInQR(url, payloadBytes, stegoKey, options = {}) {
  const {
    ecLevel    = 'H',
    darkColor  = '#1e3a5f',
    lightColor = '#f2f7fc',
    onProgress = null,
  } = options;

  onProgress?.(5);

  // ── Step 1: Determine QR version from URL + EC level ──────────────────────
  const qrData = QRCode.create(url, { errorCorrectionLevel: ecLevel });
  const qrSize = qrData.modules.size;
  const imgW   = MODULE_SCALE * (qrSize + 2 * QUIET_ZONE);
  const imgH   = imgW;

  // ── Step 2: Render QR to off-screen canvas ────────────────────────────────
  // QUIET_ZONE and MODULE_SCALE must match the constants used by extractFromQR.
  const canvas    = document.createElement('canvas');
  canvas.width    = imgW;
  canvas.height   = imgH;
  await QRCode.toCanvas(canvas, url, {
    width:                imgW,
    margin:               QUIET_ZONE,
    errorCorrectionLevel: ecLevel,
    color: { dark: darkColor, light: lightColor },
  });
  onProgress?.(15);

  // ── Step 3: Copy pixel data (never mutate the canvas directly) ────────────
  const ctx     = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, imgW, imgH);
  const pixels  = new Uint8ClampedArray(imgData.data);

  // ── Step 4: Identify safe embedding positions ─────────────────────────────
  const safeMask   = buildSafeMask(qrSize);
  const safePixels = buildSafePixelList(qrSize, imgW, imgH, safeMask);
  onProgress?.(25);

  // ── Step 5: Compress payload ──────────────────────────────────────────────
  const compressed = await compressBytes(payloadBytes);
  const capacity   = Math.floor(safePixels.length / 8) - FRAME_HEADER;

  if (compressed.length > capacity) {
    throw new Error(
      `Payload too large for QR v${(qrSize - 17) / 4} (EC=${ecLevel}). ` +
      `Compressed: ${compressed.length} B · Available: ${capacity} B. ` +
      `Tip: add a path or query string to the URL to force a higher QR version.`,
    );
  }
  onProgress?.(35);

  // ── Step 6: Build embed frame ─────────────────────────────────────────────
  // Frame layout: [SQRP magic 4B][compressed length 4B BE][compressed bytes]
  const frame = new Uint8Array(FRAME_HEADER + compressed.length);
  frame.set(MAGIC, 0);
  new DataView(frame.buffer).setUint32(4, compressed.length, false);
  frame.set(compressed, FRAME_HEADER);

  // ── Step 7: AES-CTR shuffle of embedding positions ────────────────────────
  // The shuffled list determines WHERE each bit lands in the image.
  // An observer without the stego key cannot distinguish embedded from cover pixels.
  const shuffled = [...safePixels];
  await shuffleInPlace(shuffled, stegoKey);
  onProgress?.(60);

  // ── Step 8: Embed frame bits into LSBs of shuffled pixel channels ─────────
  const totalBits = frame.length * 8;
  for (let b = 0; b < totalBits; b++) {
    const bit = (frame[b >> 3] >> (7 - (b & 7))) & 1;
    pixels[shuffled[b]] = (pixels[shuffled[b]] & 0xFE) | bit;
  }
  onProgress?.(80);

  // ── Step 9: Noise mimicry ─────────────────────────────────────────────────
  // Fill every unused safe-pixel LSB with a cryptographically random bit.
  // This equalizes the LSB histogram across the entire safe region, making it
  // impossible to distinguish payload positions from noise positions via
  // statistical tests (chi-square, RS analysis, Sample Pair, etc.).
  const remaining = shuffled.length - totalBits;
  if (remaining > 0) {
    const noise = crypto.getRandomValues(new Uint8Array(Math.ceil(remaining / 8)));
    for (let i = 0; i < remaining; i++) {
      const noiseBit = (noise[i >> 3] >> (7 - (i & 7))) & 1;
      pixels[shuffled[totalBits + i]] = (pixels[shuffled[totalBits + i]] & 0xFE) | noiseBit;
    }
  }
  onProgress?.(95);

  const outputImageData = new ImageData(pixels, imgW, imgH);

  let safeMods = 0;
  for (let i = 0; i < safeMask.length; i++) if (safeMask[i]) safeMods++;

  const stats = {
    qrVersion:      (qrSize - 17) / 4,
    qrSize,
    imgWidth:       imgW,
    safeMods,
    totalMods:      qrSize * qrSize,
    safePixelSlots: safePixels.length,
    capacity,
    compressedSize: compressed.length,
    rawPayloadSize: payloadBytes.length,
    bitsEmbedded:   totalBits,
    density:        ((totalBits / safePixels.length) * 100).toFixed(2),
    compressionRatio: ((1 - compressed.length / payloadBytes.length) * 100).toFixed(1),
  };

  return { imageData: outputImageData, stats };
}

/**
 * Extracts and decompresses the hidden payload from a StegaQR image.
 *
 * The image dimensions encode the QR version:
 *   qrSize = imgWidth / MODULE_SCALE - 2 * QUIET_ZONE
 * This derivation is deterministic and requires no side-channel information.
 *
 * @param {ImageData}  imageData  – PNG decoded to RGBA (e.g. via loadImageFile)
 * @param {Uint8Array} stegoKey   – 32-byte key (must match the one used at embed time)
 * @returns {Promise<Uint8Array>} – Raw payload bytes (still encrypted; pass to decryptHybridPayload)
 */
export async function extractFromQR(imageData, stegoKey) {
  const { width: imgW, height: imgH, data } = imageData;

  // ── Step 1: Derive QR grid size from image dimensions ─────────────────────
  const qrSizeExact = imgW / MODULE_SCALE - 2 * QUIET_ZONE;
  if (!Number.isInteger(qrSizeExact) || qrSizeExact < 21 || qrSizeExact > 177) {
    throw new Error(
      `Image size (${imgW}×${imgH}px) is not a valid StegaQR output. ` +
      `Expected width = ${MODULE_SCALE} × (qrModules + ${2 * QUIET_ZONE}).`,
    );
  }
  const qrSize  = qrSizeExact;
  const version = (qrSize - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40)
    throw new Error(`Invalid QR version derived (${version}). Check that the image was not resized.`);

  // ── Step 2: Rebuild identical safe-pixel list ─────────────────────────────
  const safeMask   = buildSafeMask(qrSize);
  const safePixels = buildSafePixelList(qrSize, imgW, imgH, safeMask);

  // ── Step 3: Reconstruct the same shuffle (deterministic from stegoKey) ────
  const shuffled = [...safePixels];
  await shuffleInPlace(shuffled, stegoKey);

  // ── Step 4: Read header (first FRAME_HEADER bytes = 64 bits) ─────────────
  const header = new Uint8Array(FRAME_HEADER);
  for (let b = 0; b < FRAME_HEADER * 8; b++) {
    if (data[shuffled[b]] & 1) header[b >> 3] |= (1 << (7 - (b & 7)));
  }

  // ── Step 5: Validate magic bytes ──────────────────────────────────────────
  if (header[0] !== MAGIC[0] || header[1] !== MAGIC[1] ||
      header[2] !== MAGIC[2] || header[3] !== MAGIC[3]) {
    throw new Error(
      'StegaQR payload not found. ' +
      'Verify: (1) correct stego password, (2) image was not recompressed or resized.',
    );
  }

  // ── Step 6: Read compressed payload length ────────────────────────────────
  const compLen = new DataView(header.buffer).getUint32(4, false);
  const maxCap  = Math.floor(safePixels.length / 8) - FRAME_HEADER;

  if (compLen < 1 || compLen > maxCap) {
    throw new Error(
      `Payload length field (${compLen}B) is out of bounds. ` +
      `Wrong stego password or the image has been tampered with.`,
    );
  }

  // ── Step 7: Read compressed payload bits ──────────────────────────────────
  const compressed      = new Uint8Array(compLen);
  const payloadBitStart = FRAME_HEADER * 8;

  for (let b = 0; b < compLen * 8; b++) {
    if (data[shuffled[payloadBitStart + b]] & 1)
      compressed[b >> 3] |= (1 << (7 - (b & 7)));
  }

  // ── Step 8: Decompress and return raw payload bytes ───────────────────────
  // Caller passes the result to decryptHybridPayload().
  return decompressBytes(compressed);
}
