/**
 * StegaVault – Hybrid Crypto Engine  (v3.0)
 *
 * Supports any of these asymmetric algorithms — selected automatically
 * from the pasted / loaded key, no hard-coded RSA requirement:
 *
 *  Encryption key exchange:
 *    • RSA-OAEP 2048  – direct AES key wrap
 *    • ECDH P-256     – ephemeral ECDH + HKDF → AES-GCM wrap
 *
 *  Digital signatures:
 *    • RSA-PSS 2048 (SHA-256)
 *    • ECDSA P-256  (SHA-256)
 *
 * All operations use the Web Crypto API. Zero external dependencies.
 */

// ─── Base64 helpers ───────────────────────────────────────────────────────────

function toB64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ─── Algorithm catalogue (exported for the UI) ────────────────────────────────

export const ENCRYPTION_ALGOS = [
  { id: 'ECDH-P-256', label: 'EC P-256  (ECDH)', note: 'Ephemeral key-agreement' },
  { id: 'RSA-OAEP',   label: 'RSA-2048  (OAEP)', note: 'Direct AES key wrap'     },
];

export const SIGNING_ALGOS = [
  { id: 'ECDSA-P-256', label: 'EC P-256  (ECDSA)', note: 'SHA-256' },
  { id: 'RSA-PSS',     label: 'RSA-2048  (PSS)',   note: 'SHA-256, saltLen=32' },
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Reads the algorithm identifier from a live CryptoKey object. */
function algoIdFromKey(key) {
  const { name, namedCurve } = key.algorithm;
  if (name === 'RSA-OAEP') return 'RSA-OAEP';
  if (name === 'RSA-PSS')  return 'RSA-PSS';
  return `${name}-${namedCurve}`;   // e.g. 'ECDH-P-256', 'ECDSA-P-384'
}

/** Returns the Web Crypto params for a signing operation. */
function signParams(key) {
  const name = key.algorithm.name;
  if (name === 'RSA-PSS')  return { name: 'RSA-PSS', saltLength: 32 };
  if (name === 'ECDSA') return { name: 'ECDSA', hash: 'SHA-256' };
  throw new Error(`Unsupported signing algorithm: ${name}`);
}

// ─── AES-256-GCM ─────────────────────────────────────────────────────────────

export async function generateAESKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function encryptMessage(message, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesKey, new TextEncoder().encode(message));
  return { iv, ciphertext: new Uint8Array(buf) };
}

export async function decryptMessage(ciphertext, iv, aesKey) {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesKey, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('AES-256-GCM decryption failed – wrong key or corrupted data');
  }
}

// ─── Key generation ───────────────────────────────────────────────────────────

/**
 * Generates a key pair for any supported algorithm id.
 * @param {'ECDH-P-256'|'RSA-OAEP'|'ECDSA-P-256'|'RSA-PSS'} algoId
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateKeyPair(algoId) {
  switch (algoId) {
    case 'ECDH-P-256':
      return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits', 'deriveKey']);
    case 'RSA-OAEP':
      return crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true, ['encrypt', 'decrypt']
      );
    case 'ECDSA-P-256':
      return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    case 'RSA-PSS':
      return crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true, ['sign', 'verify']
      );
    default:
      throw new Error(`Unknown algorithm id: ${algoId}`);
  }
}

// ─── PEM export ───────────────────────────────────────────────────────────────

/**
 * Exports any CryptoKey to a PEM string (PKCS#8 for private, SPKI for public).
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function exportKeyToPEM(key) {
  const isPrivate = key.type === 'private';
  const format    = isPrivate ? 'pkcs8' : 'spki';
  const label     = isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY';
  const buf       = await crypto.subtle.exportKey(format, key);
  const b64       = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
}

// ─── PEM auto-import ──────────────────────────────────────────────────────────

/**
 * Tries every algorithm compatible with the given usage until one succeeds.
 * Returns the CryptoKey and the detected algorithm id.
 *
 * @param {string}  pem
 * @param {'encrypt'|'decrypt'|'sign'|'verify'} usage
 * @returns {Promise<{ key: CryptoKey, algoId: string }>}
 */
export async function importAnyKey(pem, usage) {
  const isPrivate = pem.includes('PRIVATE KEY');
  const label     = isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY';
  const b64       = pem
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s+/g, '');

  let bytes;
  try {
    bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  } catch {
    throw new Error('Invalid PEM – base64 decode failed');
  }

  const format = isPrivate ? 'pkcs8' : 'spki';

  // Candidate algorithms ordered by preference for each usage
  const candidates = {
    encrypt: [
      { algo: { name: 'RSA-OAEP', hash: 'SHA-256' }, usages: ['encrypt'] },
      { algo: { name: 'ECDH', namedCurve: 'P-256' }, usages: [] },
    ],
    decrypt: [
      { algo: { name: 'RSA-OAEP', hash: 'SHA-256' }, usages: ['decrypt'] },
      { algo: { name: 'ECDH', namedCurve: 'P-256' }, usages: ['deriveBits', 'deriveKey'] },
    ],
    sign: [
      { algo: { name: 'RSA-PSS',  hash: 'SHA-256' }, usages: ['sign'] },
      { algo: { name: 'ECDSA', namedCurve: 'P-256' }, usages: ['sign'] },
    ],
    verify: [
      { algo: { name: 'RSA-PSS',  hash: 'SHA-256' }, usages: ['verify'] },
      { algo: { name: 'ECDSA', namedCurve: 'P-256' }, usages: ['verify'] },
    ],
  }[usage];

  if (!candidates) throw new Error(`Unknown usage: "${usage}"`);

  for (const { algo, usages } of candidates) {
    try {
      const key = await crypto.subtle.importKey(format, bytes.buffer, algo, true, usages);
      return { key, algoId: algoIdFromKey(key) };
    } catch { /* try next */ }
  }

  throw new Error(
    `Could not import key for "${usage}". ` +
    `Supported: ${usage === 'encrypt' || usage === 'decrypt' ? 'RSA-OAEP, ECDH P-256' : 'RSA-PSS, ECDSA P-256'}.`
  );
}

// ─── Key fingerprint ──────────────────────────────────────────────────────────

/**
 * Returns a short SHA-256 fingerprint (first 8 bytes as hex) of a CryptoKey.
 * Safe to display – never exposes key material.
 */
export async function keyFingerprint(key) {
  const format = key.type === 'private' ? 'pkcs8' : 'spki';
  const raw    = await crypto.subtle.exportKey(format, key);
  const hash   = await crypto.subtle.digest('SHA-256', raw);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(':');
}

// ─── AES key wrapping ─────────────────────────────────────────────────────────

/**
 * Wraps (encrypts) a raw AES key using the recipient's public key.
 * Handles both RSA-OAEP (direct) and ECDH (ephemeral key-agreement + HKDF).
 *
 * @param {CryptoKey} aesKey
 * @param {CryptoKey} publicKey
 * @returns {Promise<{ encAESKey: Uint8Array, ecdh: object|null }>}
 */
export async function wrapAESKey(aesKey, publicKey) {
  const algoName = publicKey.algorithm.name;

  if (algoName === 'RSA-OAEP') {
    const raw = await crypto.subtle.exportKey('raw', aesKey);
    const enc = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw);
    return { encAESKey: new Uint8Array(enc), ecdh: null };
  }

  if (algoName === 'ECDH') {
    const curve = publicKey.algorithm.namedCurve;  // 'P-256'
    const bits  = 256;

    // Ephemeral key pair
    const ephem = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: curve }, true, ['deriveBits']);

    // Shared secret via ECDH
    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, ephem.privateKey, bits);

    // HKDF → 256-bit wrapping key
    const salt    = crypto.getRandomValues(new Uint8Array(32));
    const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const wrapKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('StegaVault-v3-wrap') },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt']
    );

    // AES-GCM encrypt the raw AES key
    const wrapIV = crypto.getRandomValues(new Uint8Array(12));
    const rawAES = await crypto.subtle.exportKey('raw', aesKey);
    const encAES = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIV }, wrapKey, rawAES));

    // Export ephemeral public key (raw EC point)
    const ephemPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephem.publicKey));

    return {
      encAESKey: encAES,
      ecdh: { ephemPub: ephemPubRaw, salt, wrapIV },
    };
  }

  throw new Error(`Unsupported encryption key algorithm: ${algoName}`);
}

/**
 * Unwraps a previously wrapped AES key.
 *
 * @param {Uint8Array}    encAESKey
 * @param {string}        algoId      e.g. 'RSA-OAEP' | 'ECDH-P-256'
 * @param {CryptoKey}     privateKey
 * @param {object|null}   ecdhParams  { ephemPub, salt, wrapIV } — required for ECDH
 * @returns {Promise<CryptoKey>}
 */
export async function unwrapAESKey(encAESKey, algoId, privateKey, ecdhParams) {
  if (algoId === 'RSA-OAEP') {
    try {
      const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encAESKey);
      return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    } catch {
      throw new Error('RSA-OAEP AES key unwrap failed – wrong private key or corrupted payload');
    }
  }

  if (algoId.startsWith('ECDH-')) {
    const curve = algoId.slice(5);   // 'P-256'
    const bits  = 256;
    const { ephemPub, salt, wrapIV } = ecdhParams;

    // Re-import ephemeral public key
    const ephemKey = await crypto.subtle.importKey('raw', ephemPub, { name: 'ECDH', namedCurve: curve }, false, []);

    // Reconstruct shared secret
    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemKey }, privateKey, bits);

    // Reconstruct wrapping key via HKDF
    const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const wrapKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('StegaVault-v3-wrap') },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false, ['decrypt']
    );

    try {
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrapIV }, wrapKey, encAESKey);
      return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    } catch {
      throw new Error('ECDH AES key unwrap failed – wrong private key or corrupted payload');
    }
  }

  throw new Error(`Cannot unwrap AES key: unknown algorithm "${algoId}"`);
}

// ─── Signatures ───────────────────────────────────────────────────────────────

/**
 * Signs data with any supported private key (RSA-PSS or ECDSA).
 * @param {Uint8Array} data
 * @param {CryptoKey}  privateKey
 * @returns {Promise<Uint8Array>}
 */
export async function signData(data, privateKey) {
  const sig = await crypto.subtle.sign(signParams(privateKey), privateKey, data);
  return new Uint8Array(sig);
}

/**
 * Verifies a signature with any supported public key.
 * Throws if invalid (tampered payload).
 * @param {Uint8Array} data
 * @param {Uint8Array} signature
 * @param {CryptoKey}  publicKey
 * @returns {Promise<true>}
 */
export async function verifyData(data, signature, publicKey) {
  const valid = await crypto.subtle.verify(signParams(publicKey), publicKey, signature, data);
  if (!valid) throw new Error('Signature verification FAILED – payload may be tampered or wrong sender key');
  return true;
}

// ─── Structured payload ───────────────────────────────────────────────────────

/**
 * Builds the full hybrid encrypted payload as JSON UTF-8 bytes.
 *
 * Payload format:
 * {
 *   version:     "3.0",
 *   enc_algo:    "RSA-OAEP" | "ECDH-P-256",
 *   sign_algo:   "RSA-PSS"  | "ECDSA-P-256" | null,
 *   iv:          <b64 12B>,
 *   enc_data:    <b64 ciphertext+tag>,
 *   enc_aes_key: <b64>,
 *   ecdh_ephem:  <b64 raw EC point> | null,
 *   ecdh_salt:   <b64 32B>           | null,
 *   ecdh_iv:     <b64 12B>           | null,
 *   signature:   <b64>               | null
 * }
 *
 * Signature covers: iv ‖ enc_data ‖ enc_aes_key bytes.
 *
 * @param {string}         message
 * @param {CryptoKey}      encPublicKey      Any supported encryption public key
 * @param {CryptoKey|null} signPrivateKey    Any supported signing private key (optional)
 * @returns {Promise<Uint8Array>}
 */
export async function buildHybridPayload(message, encPublicKey, signPrivateKey) {
  const aesKey = await generateAESKey();
  const { iv, ciphertext } = await encryptMessage(message, aesKey);

  const { encAESKey, ecdh } = await wrapAESKey(aesKey, encPublicKey);
  const encAlgoId = algoIdFromKey(encPublicKey);

  let signature  = null;
  let signAlgoId = null;
  if (signPrivateKey) {
    const toSign = new Uint8Array(iv.length + ciphertext.length + encAESKey.length);
    toSign.set(iv, 0);
    toSign.set(ciphertext, iv.length);
    toSign.set(encAESKey, iv.length + ciphertext.length);
    signature  = toB64(await signData(toSign, signPrivateKey));
    signAlgoId = algoIdFromKey(signPrivateKey);
  }

  const payload = {
    version:     '3.0',
    enc_algo:    encAlgoId,
    sign_algo:   signAlgoId,
    iv:          toB64(iv),
    enc_data:    toB64(ciphertext),
    enc_aes_key: toB64(encAESKey),
    ecdh_ephem:  ecdh ? toB64(ecdh.ephemPub) : null,
    ecdh_salt:   ecdh ? toB64(ecdh.salt)     : null,
    ecdh_iv:     ecdh ? toB64(ecdh.wrapIV)   : null,
    signature,
  };

  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Parses, verifies, and decrypts a hybrid payload.
 *
 * @param {Uint8Array}     payloadBytes
 * @param {CryptoKey}      decPrivateKey     Matching encryption private key
 * @param {CryptoKey|null} verifyPublicKey   Sender's signing public key (optional)
 * @returns {Promise<{ message: string, signed: boolean, encAlgo: string, signAlgo: string|null }>}
 */
export async function decryptHybridPayload(payloadBytes, decPrivateKey, verifyPublicKey) {
  let p;
  try {
    p = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    throw new Error('Payload is not valid JSON – wrong image or corrupted data');
  }

  if (p.version !== '3.0') {
    throw new Error(`Unsupported payload version "${p.version}". Re-embed using the current version.`);
  }

  const iv        = fromB64(p.iv);
  const encData   = fromB64(p.enc_data);
  const encAESKey = fromB64(p.enc_aes_key);

  // Verify signature before decrypting (fail-fast on tamper)
  let signed = false;
  if (p.signature && verifyPublicKey) {
    const toVerify = new Uint8Array(iv.length + encData.length + encAESKey.length);
    toVerify.set(iv, 0);
    toVerify.set(encData, iv.length);
    toVerify.set(encAESKey, iv.length + encData.length);
    await verifyData(toVerify, fromB64(p.signature), verifyPublicKey);
    signed = true;
  }

  // Unwrap AES key
  const ecdhParams = p.ecdh_ephem ? {
    ephemPub: fromB64(p.ecdh_ephem),
    salt:     fromB64(p.ecdh_salt),
    wrapIV:   fromB64(p.ecdh_iv),
  } : null;

  const aesKey = await unwrapAESKey(encAESKey, p.enc_algo, decPrivateKey, ecdhParams);
  const message = await decryptMessage(encData, iv, aesKey);

  return { message, signed, encAlgo: p.enc_algo, signAlgo: p.sign_algo };
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

export async function sha256Hex(data) {
  const buf  = data instanceof Uint8Array ? data.buffer : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
