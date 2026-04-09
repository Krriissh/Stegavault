# StegaVault Lite+ — Hybrid Cryptographic Steganography System

---

**Project Title:** StegaVault Lite+ — Hybrid Cryptographic Steganography Dashboard
**Author:** Pranav
**Date:** April 2026
**Version:** 3.0 (Cryptography Engine) / 2.0 (Image Stego Engine) / 1.0 (StegaQR Engine)
**Technology Stack:** React 18 · Vite 5 · Web Crypto API · Tailwind CSS 3 · Framer Motion 11 · qrcode 1.5.4

---

## Abstract

StegaVault Lite+ is a fully client-side, zero-dependency cryptographic steganography dashboard built for secure covert communication. The system provides two steganographic channels:

1. **Image LSB steganography** — combines modern asymmetric key exchange (RSA-OAEP 2048 and ECDH P-256), symmetric encryption (AES-256-GCM), optional digital signatures (RSA-PSS and ECDSA P-256), and sequential LSB image steganography into a unified browser-native pipeline.

2. **StegaQR** — generates scannable QR codes that encode a visible decoy URL for standard QR readers while concealing an AES-256-GCM encrypted payload in the QR's safe data modules using an AES-CTR PRNG shuffled embedding scheme with full noise mimicry.

All cryptographic operations are performed exclusively through the W3C Web Crypto API — no third-party cryptographic library is required and no sensitive material ever leaves the user's device. The steganalysis module employs three independent statistical tests (chi-square pair equalization, LSB histogram uniformity, and LSB-plane entropy analysis) combined through majority voting to detect potential steganographic content in suspected carrier images.

---

## 1. Introduction

### 1.1 Problem Statement

In an era of ubiquitous digital surveillance, metadata analysis, and deep-packet inspection, traditional encryption alone is insufficient for certain use cases. Encrypted traffic is conspicuous — its very presence signals that a sensitive communication is occurring, inviting scrutiny, throttling, or legal compulsion to surrender keys.

Steganography addresses the complementary need: concealing the *existence* of a communication, not merely its content. A message hidden inside an ordinary-looking photograph, or inside a scannable QR code pointing to a legitimate URL, raises no suspicion. However, naive steganography without encryption is equally insufficient: if an adversary identifies a stego carrier, the message is immediately readable.

The solution is to combine both techniques — the message is first encrypted with strong, modern cryptographic algorithms, and only then embedded into a carrier medium. This provides:

1. **Confidentiality** — AES-256-GCM ensures the payload is computationally infeasible to decrypt without the correct key.
2. **Key confidentiality** — RSA-OAEP or ECDH-based key agreement (image mode) or PBKDF2 (QR mode) ensures only the intended recipient can obtain the AES key.
3. **Authenticity** — Optional RSA-PSS or ECDSA signatures (image mode) bind the payload to the sender's identity.
4. **Plausible deniability** — The carrier image looks like an ordinary photograph; the QR code scans as an ordinary URL.

### 1.2 Motivation and Innovation

StegaVault distinguishes itself from prior steganography tools in several ways:

- **Fully browser-native**: runs entirely in the user's browser. No server, no backend, no network transmission of keys or plaintext.
- **Dual steganographic channels**: image LSB for high-capacity messaging, StegaQR for lightweight, shareable QR-based covert communication.
- **Anti-steganalysis StegaQR design**: an AES-CTR PRNG controls embedding positions; noise mimicry fills unused pixels with random bits, equalizing the LSB histogram and defeating all standard statistical tests.
- **Algorithm agility**: supports RSA-OAEP, ECDH P-256, RSA-PSS, ECDSA P-256 with automatic key detection.
- **Integrated steganalysis**: the same dashboard that embeds messages can also attempt to detect steganographic content in arbitrary images.
- **Zero-knowledge architecture**: no key material, no plaintext, and no session data is ever transmitted to any server.

---

## 2. Objectives

- **O1**: Implement AES-256-GCM symmetric encryption using a per-message randomly generated key.
- **O2**: Implement RSA-OAEP (2048-bit) and ECDH P-256 asymmetric key encapsulation for the image steganography pipeline.
- **O3**: Implement RSA-PSS and ECDSA P-256 digital signatures for optional payload authentication.
- **O4**: Implement sequential LSB steganography to embed encrypted payloads into PNG carrier images.
- **O5**: Implement StegaQR: a scannable QR code with a hidden AES-256-GCM encrypted payload using randomized, noise-mimicking LSB steganography in the QR image.
- **O6**: Implement a structured payload format (version 3.0) encoding all cryptographic parameters needed for decryption.
- **O7**: Implement a steganalysis pipeline (chi-square, histogram uniformity, LSB entropy) with majority voting and heatmap visualization.
- **O8**: Provide an interactive browser dashboard with key generation, PEM import/export, and operation history — entirely client-side.
- **O9**: Ensure zero-knowledge operation: no plaintext, no private key material, and no decrypted content is ever stored or transmitted.

---

## 3. System Architecture

### 3.1 Image Steganography Pipeline

```
[Plaintext Message]
        │
        ▼
┌─────────────────────────────┐
│  Stage 1: AES-256-GCM       │  Generate random 256-bit AES key + 96-bit IV
│  Symmetric Encryption       │  Produces: ciphertext + 128-bit auth tag
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 2: Asymmetric Key    │  RSA-OAEP: encrypt raw AES key bytes
│  Encapsulation              │  ECDH P-256: ephemeral ECDH + HKDF → wrapping key
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 3: Digital Signature │  (Optional) RSA-PSS or ECDSA sign:
│  (Optional)                 │  covers iv ‖ ciphertext ‖ enc_aes_key bytes
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 4: Payload Framing   │  JSON-serialize all fields → UTF-8 bytes
│                             │  Prepend 4-byte big-endian length header
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 5: LSB Steganography │  Embed framed payload into RGB LSBs
│                             │  Write lossless PNG output
└─────────────────────────────┘
        │
        ▼
[Stego PNG Image — visually identical to original]
```

### 3.2 StegaQR Pipeline

```
[Plaintext Message]
        │
        ▼
┌─────────────────────────────┐
│  Stage 1: PBKDF2            │  password → 32-byte AES key  (salt: "StegaQR-v1.0-mkey")
│  Key Derivation             │  password → 32-byte stego key (salt: "StegaQR-v1.0-skey")
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 2: AES-256-GCM       │  [12B random IV][ciphertext + 16B GCM tag]
│  Encrypt Payload            │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 3: Deflate-raw       │  Compression Streams API
│  Compression                │  Reduces payload size, flattens bit entropy
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 4: QR Rendering      │  qrcode.toCanvas(decoyUrl)
│  + Safe Mask                │  MODULE_SCALE=10, QUIET_ZONE=4
│                             │  buildSafeMask → exclude structural regions
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Stage 5: PRNG Shuffle      │  AES-128-CTR keystream from stego key
│  + Embed + Noise Mimicry    │  Fisher-Yates shuffle of safe pixel positions
│                             │  Embed frame bits into shuffled LSBs
│                             │  Fill remaining LSBs with getRandomValues()
└─────────────────────────────┘
        │
        ▼
[StegaQR PNG — scans as decoy URL · hides encrypted payload]
```

### 3.3 Module Architecture

```
src/
├── App.jsx                              Single-page shell; sidebar + module routing
├── core/
│   ├── crypto/cryptoEngine.js           All cryptographic operations (Web Crypto API)
│   ├── stego/stegoEngine.js             Sequential LSB embed / extract; image I/O
│   ├── stego/qrStegoEngine.js           StegaQR engine: QR render, safe mask, PRNG shuffle
│   └── analysis/steganalysis.js         Chi-square, histogram, entropy, heatmap
├── modules/
│   ├── encrypt/EncryptModule.jsx        UI: asymmetric encrypt + LSB embed workflow
│   ├── decrypt/DecryptModule.jsx        UI: LSB extract + asymmetric decrypt workflow
│   ├── stegaqr/StegaQRModule.jsx        UI: StegaQR generate + decode workflow
│   ├── detect/DetectModule.jsx          UI: steganalysis + heatmap display
│   └── history/HistoryModule.jsx        IndexedDB history viewer
├── components/
│   ├── KeyManager.jsx                   PEM import, key generation, fingerprint display
│   ├── FileDropzone.jsx                 Drag-and-drop image input
│   ├── ProgressBar.jsx                  Animated progress indicator
│   ├── MetadataCard.jsx                 Tabular operation report
│   └── Sidebar.jsx                      Navigation sidebar
└── storage/
    └── indexedDB.js                     Local operation history persistence
```

---

## 4. Technologies Used

### 4.1 React 18 & Vite 5

React 18 provides the component-based UI framework. Functional components with hooks manage all local state. Vite 5 serves as the build tool and development server, producing a 382 KB JS bundle (~119 KB gzipped).

### 4.2 Web Crypto API

The `crypto.subtle` interface provides all cryptographic primitives:

| Operation | Web Crypto method |
|---|---|
| AES-256-GCM encrypt/decrypt | `crypto.subtle.encrypt` / `decrypt` |
| AES-128-CTR keystream (StegaQR PRNG) | `crypto.subtle.encrypt` |
| RSA-OAEP key pair generation | `crypto.subtle.generateKey` |
| ECDH P-256 key pair + derivation | `crypto.subtle.generateKey` + `deriveBits` |
| HKDF key derivation | `crypto.subtle.deriveKey` |
| PBKDF2 key derivation (StegaQR) | `crypto.subtle.deriveBits` |
| RSA-PSS sign/verify | `crypto.subtle.sign` / `verify` |
| ECDSA P-256 sign/verify | `crypto.subtle.sign` / `verify` |
| SHA-256 hashing | `crypto.subtle.digest` |
| PEM export (PKCS#8/SPKI) | `crypto.subtle.exportKey` |
| PEM import | `crypto.subtle.importKey` |

### 4.3 qrcode (npm, v1.5.4)

The only non-cryptographic npm dependency. Used exclusively for QR code generation in the StegaQR module (`QRCode.create()` for capacity planning, `QRCode.toCanvas()` for rendering). No other QR capabilities are used.

### 4.4 Compression Streams API

The browser-native `CompressionStream` / `DecompressionStream` API (deflate-raw mode) is used by `qrStegoEngine.js` to compress payloads before embedding. Falls back to identity (no compression) if unavailable. No external library required.

### 4.5 Tailwind CSS 3 & Framer Motion 11

Custom cyber-themed color palette (`cyber.green`, `cyber.blue`, `cyber.purple`, etc.). Framer Motion handles page transitions and panel animations.

### 4.6 Browser IndexedDB

Stores operation history locally. Schema: `history` store in `StegaVaultDB` v1. Fields: `id` (auto-increment), `filename`, `operation`, `timestamp`, `status`, `stegoBlob` (Blob, embed-only), `meta` (object). No sensitive data is ever written.

---

## 5. Core Concepts

### 5.1 AES-256-GCM (Symmetric Encryption)

AES-256-GCM (Galois/Counter Mode) is an AEAD (Authenticated Encryption with Associated Data) construction that provides both confidentiality and integrity in a single pass.

- **Counter mode** generates a keystream by encrypting successive counter values (IV ‖ counter), then XOR-ing with plaintext.
- **GCM authentication tag** (128 bits) is computed over the ciphertext using Galois field multiplication (GHASH), providing integrity guarantees.

In StegaVault:
- IV: 12 bytes (96 bits), randomly generated via `crypto.getRandomValues()` per message
- Key: 256 bits
- Auth tag: 128 bits
- Decryption throws an exception on tag mismatch — tampered payloads are detected, not silently decrypted.

Used by both the image mode (`buildHybridPayload`) and StegaQR (`encryptQRPayload`).

### 5.2 RSA-OAEP (Asymmetric Key Encapsulation)

RSA-OAEP 2048 with SHA-256 is used in the image mode to encrypt the ephemeral AES key directly. The OAEP (Optimal Asymmetric Encryption Padding) scheme is probabilistic and resistant to chosen-ciphertext attacks.

RSA-2048 provides 112 bits of security, recommended by NIST for use until at least 2030.

### 5.3 ECDH P-256 with HKDF (Forward-Secret Key Agreement)

The ephemeral ECDH (ECDHE) variant is used as an alternative to RSA-OAEP:

1. Sender generates a fresh ECDH key pair (ephemeral) per message.
2. Shared secret = ECDH(ephem_priv, recipient_pub).
3. HKDF-SHA-256 derives a 256-bit wrapping key from the shared secret + 32-byte random salt.
4. Wrapping key encrypts the AES session key via AES-256-GCM.
5. Ephemeral public key, HKDF salt, and wrap IV are stored in the payload.

Ephemeral keys provide **forward secrecy**: compromise of long-term private keys does not expose past messages.

### 5.4 Digital Signatures (RSA-PSS / ECDSA P-256)

Optional in the image mode. The signed data is `iv ‖ enc_data ‖ enc_aes_key`. Protects against tampering and provides non-repudiation. Signature is verified before decryption (fail-fast on tampered payloads).

### 5.5 PBKDF2 for StegaQR

Password-Based Key Derivation Function 2 (RFC 2898) derives deterministic keys from a human-readable password:

- 100,000 iterations of HMAC-SHA-256
- Two independent derivations with different domain-separation salts:
  - `StegaQR-v1.0-mkey` → 32-byte AES encryption key
  - `StegaQR-v1.0-skey` → 32-byte stego position key
- 100k iterations adds ~1 second deliberate delay, making offline dictionary attacks expensive

This means a single password drives both content security and position security, but the two keys are always computationally independent.

### 5.6 Image LSB Steganography

**LSB (Least Significant Bit) substitution** — for each payload bit, only the last bit of one color channel is modified. A change of ±1 in a channel value (0–255) is visually imperceptible.

For bit position `i`:
```
pixelIdx    = floor(i / 3)
channelIdx  = i mod 3            (R=0, G=1, B=2)
byteOffset  = pixelIdx × 4       (RGBA stride)
bit         = (frame[i/8] >> (7 − i%8)) & 1
newData[byteOffset + channelIdx] = (original & 0xFE) | bit
```

Capacity: `floor(W × H × 3 / 8) − 4` bytes. ~759 KB for a 1920×1080 image.

### 5.7 StegaQR — Advanced Anti-Steganalysis Steganography

StegaQR combines three anti-detection techniques not present in the image LSB module:

#### 5.7.1 Safe-Region Masking

The QR code is divided into structural modules (never modified) and data modules (safe to embed in). Structural regions excluded:

- **Finder patterns** — three 7×7 squares + 1-module separators = 9×9 blocks at TL, TR, BL corners
- **Timing patterns** — entire row 6 and column 6
- **Format information** — implicit in the 9×9 corner blocks
- **Dark module** — `(qrSize-8, 8)`, always dark
- **Alignment patterns** — 5×5 patterns at ALIGN_COORD cross-products (ISO 18004 Table E.1, v1–v40), skipping finder overlaps
- **Version information** — 6×3 blocks at TR/BL for versions 7+

Only inner pixels of each safe module are used (2px inset from module edges), avoiding anti-aliased borders.

#### 5.7.2 AES-128-CTR PRNG Position Shuffle

```
subKey = SHA-256(stegoKey ‖ "SHFL")       // domain separation
keystream = AES-128-CTR(subKey[0:16], counter=subKey[16:32])
Fisher-Yates shuffle of safe pixel position list using keystream
```

An observer without the stego key cannot determine where bits are hidden — the embedding positions are computationally indistinguishable from a uniform random permutation.

#### 5.7.3 Noise Mimicry

After embedding, every unused safe-pixel LSB is overwritten with `crypto.getRandomValues()` output. This makes the entire safe-region LSB histogram exactly 50/50, defeating:
- Chi-square pair equalization attack
- RS (Regular-Singular) analysis
- Sample-pair (SP) analysis
- LSB histogram uniformity test

#### 5.7.4 Deflate Compression

Payloads are compressed with deflate-raw before embedding. This:
1. Reduces payload size → lower embedding density → harder to detect
2. Produces near-uniform bit entropy, which blends with the surrounding random noise fill

#### 5.7.5 Rendering Contract

```
MODULE_SCALE = 10 px/module   (fixed)
QUIET_ZONE   = 4 modules      (fixed)
imgWidth     = MODULE_SCALE × (qrSize + 2 × QUIET_ZONE)

QR version is derivable from image dimensions:
qrSize   = imgWidth / MODULE_SCALE − 2 × QUIET_ZONE
version  = (qrSize − 17) / 4
```

This is self-describing — extraction requires only the image and the password. No metadata, no side-channel.

---

## 6. Module-wise Explanation

### 6.1 Cryptography Engine (`src/core/crypto/cryptoEngine.js`)

All cryptographic operations. Security-critical core; all other modules are consumers.

| Function | Description |
|---|---|
| `generateAESKey()` | 256-bit AES-GCM key |
| `encryptMessage(msg, key)` | AES-256-GCM; returns `{iv, ciphertext}` |
| `decryptMessage(ct, iv, key)` | AES-256-GCM; throws on auth tag failure |
| `generateKeyPair(algoId)` | RSA-OAEP, RSA-PSS, ECDH P-256, ECDSA P-256 |
| `exportKeyToPEM(key)` | PKCS#8 (private) or SPKI (public) PEM |
| `importAnyKey(pem, usage)` | Auto-detects algorithm; tries all candidates |
| `wrapAESKey(aesKey, pubKey)` | RSA-OAEP: direct encrypt. ECDH: ECDHE + HKDF + AES-GCM |
| `unwrapAESKey(enc, algoId, privKey, ecdhParams)` | Reverse of `wrapAESKey` |
| `signData(data, privKey)` | RSA-PSS or ECDSA |
| `verifyData(data, sig, pubKey)` | Throws on failure |
| `keyFingerprint(key)` | First 8 bytes of SHA-256(exported key) as hex |
| `buildHybridPayload(msg, encPub, signPriv)` | Full image-mode pipeline |
| `decryptHybridPayload(bytes, decPriv, verPub)` | Full image-mode decrypt pipeline |
| `sha256Hex(data)` | Utility |

**Algorithm auto-detection (`importAnyKey`)**: Tries `crypto.subtle.importKey` for each compatible algorithm in priority order, catching failures silently. The same text field accepts RSA-OAEP, ECDH P-256, RSA-PSS, and ECDSA P-256 without user mode selection.

### 6.2 Image Steganography Engine (`src/core/stego/stegoEngine.js`)

Sequential LSB embed/extract. Handles image I/O via the Canvas API.

| Function | Description |
|---|---|
| `getCapacity(w, h)` | `floor(w × h × 3 / 8) − 4` bytes |
| `embedData(imageData, payloadBytes, onProgress)` | Sequential LSB write |
| `extractData(imageData, onProgress)` | Sequential LSB read with length-header |
| `loadImageFile(file)` | File → ImageData via Canvas |
| `imageDataToPngBlob(imageData)` | ImageData → lossless PNG Blob |

### 6.3 StegaQR Engine (`src/core/stego/qrStegoEngine.js`)

All StegaQR operations. New in this version.

| Function | Description |
|---|---|
| `deriveStegaKey(password)` | PBKDF2 → 32-byte stego key (position shuffle) |
| `encryptQRPayload(message, password)` | PBKDF2 → AES-256-GCM encrypt → `[12B IV][ciphertext]` |
| `decryptQRPayload(bytes, password)` | Reverse; throws on wrong password |
| `calcEmbedCapacity(url, ecLevel)` | QR version, safe module count, byte capacity |
| `embedInQR(url, payloadBytes, stegoKey, options)` | Full embed pipeline; returns `{imageData, stats}` |
| `extractFromQR(imageData, stegoKey)` | Reconstruct shuffle, extract, decompress |
| `buildSafeMask(qrSize)` | Uint8Array: 1=safe, 0=structural |
| `buildSafePixelList(qrSize, imgW, imgH, mask)` | RGBA byte offsets of inner safe pixels |
| `generateKeystream(seed32, byteCount)` | AES-128-CTR pseudorandom bytes |
| `shuffleInPlace(arr, seed32)` | Fisher-Yates with AES-CTR keystream |
| `compressBytes(data)` | deflate-raw via Compression Streams API |
| `decompressBytes(data)` | inflate-raw |

**Internal constants:**
- `MODULE_SCALE = 10` — pixels per QR module
- `QUIET_ZONE = 4` — quiet-zone modules per side
- `INNER_PAD_PX = 2` — pixel inset within each module (avoids anti-aliased edges)
- `MAGIC = [0x53, 0x51, 0x52, 0x50]` — frame magic "SQRP"
- `FRAME_HEADER = 8` — magic(4) + compressed-length(4) bytes

### 6.4 Steganalysis Engine (`src/core/analysis/steganalysis.js`)

Three independent statistical tests with majority voting.

#### Chi-Square LSB Attack (Westfeld & Pfitzmann, 2000)

For each value pair (2k, 2k+1), k ∈ [0, 127] in each R/G/B channel:
```
ratio = |hist[2k] − hist[2k+1]| / (hist[2k] + hist[2k+1])
channelScore = 1 − mean(ratio)    (low ratio → pairs equalized → stego evidence)
overallScore = avg(3 channel scores)
flag = score > 0.72
```

#### LSB Histogram Uniformity

```
lsbRatio = (pixels with LSB=1) / (total RGB samples)
score = exp(−|lsbRatio − 0.5| × 25)
flag = score > 0.70
```

#### LSB-Plane Entropy

```
transitionRate = (horizontal LSB changes) / (total adjacent comparisons)
score = sigmoid(−18 × (transitionRate − 0.47))
flag = score > 0.65
```

#### Majority Voting

```
voteScore = sum of flags ∈ {0, 1, 2, 3}
verdict   = voteScore ≥ 2 ? "Likely Stego" : "Clean"
P_display = 0.45 × χ²score + 0.35 × histScore + 0.20 × entropyScore
```

#### Heatmap

16×16 pixel blocks, chi-square score per block, rendered as a color overlay on canvas:
- Green: clean (score < 0.5) → Yellow: moderate → Red: suspicious (score → 1.0)

### 6.5 Key Manager (`src/components/KeyManager.jsx`)

PEM import (paste or file), key generation (RSA-OAEP, ECDH P-256, RSA-PSS, ECDSA P-256), fingerprint display. Used only by the image Encrypt/Decrypt modules; StegaQR uses password-based keys instead.

### 6.6 StegaQR UI (`src/modules/stegaqr/StegaQRModule.jsx`)

Two-tab interface:

**Generate tab**: decoy URL input → live capacity display → secret message → EC level selector → password input → Generate button → preview + stats + download.

**Decode tab**: PNG file drop → preview → password input → Extract & Decrypt button → decrypted message display.

Password hint text makes the dual-derivation security model explicit to the user.

### 6.7 Storage (`src/storage/indexedDB.js`)

`saveHistory`, `getAllHistory`, `deleteHistory`, `clearHistory`, `getHistoryEntry`. No sensitive data stored — only filenames, operation types, timestamps, status, metadata objects, and output PNG blobs.

---

## 7. Implementation Details

### 7.1 Image Hybrid Payload Construction (`buildHybridPayload`)

```javascript
async function buildHybridPayload(message, encPublicKey, signPrivateKey) {
  const aesKey = await generateAESKey();
  const { iv, ciphertext } = await encryptMessage(message, aesKey);
  const { encAESKey, ecdh } = await wrapAESKey(aesKey, encPublicKey);

  let signature = null, signAlgoId = null;
  if (signPrivateKey) {
    const toSign = concat(iv, ciphertext, encAESKey);
    signature  = base64(await signData(toSign, signPrivateKey));
    signAlgoId = algoIdFromKey(signPrivateKey);
  }

  const payload = {
    version: "3.0", enc_algo, sign_algo,
    iv:          base64(iv),
    enc_data:    base64(ciphertext),
    enc_aes_key: base64(encAESKey),
    ecdh_ephem:  ecdh ? base64(ecdh.ephemPub) : null,
    ecdh_salt:   ecdh ? base64(ecdh.salt)     : null,
    ecdh_iv:     ecdh ? base64(ecdh.wrapIV)   : null,
    signature,
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}
```

### 7.2 StegaQR Encryption (`encryptQRPayload`)

```javascript
async function encryptQRPayload(message, password) {
  const rawKey = await pbkdf2Derive(password, 'StegaQR-v1.0-mkey');
  const aesKey = await crypto.subtle.importKey('raw', rawKey,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 }, aesKey,
    new TextEncoder().encode(message));
  // Output: [12B IV][ciphertext + 16B tag]
  const out = new Uint8Array(12 + cipherBuf.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipherBuf), 12);
  return out;
}
```

### 7.3 AES-CTR PRNG Shuffle (`shuffleInPlace`)

```javascript
async function shuffleInPlace(arr, seed32) {
  const subKey32 = SHA256(seed32 ‖ "SHFL");
  const ks   = await AES_128_CTR(subKey32[0:16], counter=subKey32[16:32], byteCount=n*4);
  const view = new DataView(ks.buffer);
  for (let i = n - 1; i > 0; i--) {
    const j = view.getUint32(i * 4) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
```

The sub-key derivation (`SHA-256(seed32 ‖ "SHFL")`) domain-separates the shuffle keystream from any other use of the stego key, even when the same password is used.

### 7.4 StegaQR Embedding (`embedInQR`)

```javascript
async function embedInQR(url, payloadBytes, stegoKey, options) {
  // 1. Render QR to canvas (MODULE_SCALE × QUIET_ZONE contract)
  const qrData = QRCode.create(url, { errorCorrectionLevel: ecLevel });
  await QRCode.toCanvas(canvas, url, { width: imgW, margin: QUIET_ZONE, ... });

  // 2. Build structural mask + safe pixel list
  const safeMask   = buildSafeMask(qrSize);
  const safePixels = buildSafePixelList(qrSize, imgW, imgH, safeMask);

  // 3. Compress payload
  const compressed = await compressBytes(payloadBytes);

  // 4. Build frame: [SQRP magic 4B][compressed length 4B BE][compressed bytes]
  const frame = buildFrame(compressed);

  // 5. Shuffle embedding positions with stego key
  const shuffled = await shuffleInPlace([...safePixels], stegoKey);

  // 6. Embed frame bits into LSBs at shuffled positions
  for (let b = 0; b < frame.length * 8; b++) {
    const bit = (frame[b >> 3] >> (7 − (b & 7))) & 1;
    pixels[shuffled[b]] = (pixels[shuffled[b]] & 0xFE) | bit;
  }

  // 7. Noise mimicry: randomize all remaining safe-pixel LSBs
  const noise = crypto.getRandomValues(new Uint8Array(Math.ceil(remaining / 8)));
  for (let i = 0; i < remaining; i++) {
    pixels[shuffled[frame.length*8 + i]] = (pixels[...] & 0xFE) | noiseBit;
  }
}
```

### 7.5 Image LSB Embedding (`embedData`)

```javascript
function embedData(imageData, payloadBytes, onProgress) {
  const frame = new Uint8Array(4 + payloadBytes.length);
  new DataView(frame.buffer).setUint32(0, payloadBytes.length, false);
  frame.set(payloadBytes, 4);

  const newData = new Uint8ClampedArray(imageData.data); // copy

  for (let bitPos = 0; bitPos < frame.length * 8; bitPos++) {
    const pixelIdx   = Math.floor(bitPos / 3);
    const channelIdx = bitPos % 3;          // R=0, G=1, B=2
    const byteOffset = pixelIdx * 4;        // RGBA stride
    const bit        = (frame[bitPos >> 3] >> (7 − bitPos % 8)) & 1;
    newData[byteOffset + channelIdx] = (newData[byteOffset + channelIdx] & 0xFE) | bit;
  }
  return new ImageData(newData, imageData.width, imageData.height);
}
```

### 7.6 Decryption and Verification (`decryptHybridPayload`)

```javascript
async function decryptHybridPayload(payloadBytes, decPrivateKey, verifyPublicKey) {
  const p = JSON.parse(UTF8.decode(payloadBytes));
  if (p.version !== "3.0") throw new Error("Unsupported payload version");

  // 1. Verify signature BEFORE decrypting (fail fast on tampered payload)
  if (p.signature && verifyPublicKey) {
    await verifyData(concat(iv, encData, encAESKey), fromB64(p.signature), verifyPublicKey);
  }
  // 2. Unwrap AES key
  const aesKey = await unwrapAESKey(encAESKey, p.enc_algo, decPrivateKey, ecdhParams);
  // 3. AES-256-GCM decrypt (auth tag verified implicitly)
  return await decryptMessage(encData, iv, aesKey);
}
```

---

## 8. Payload Structures

### 8.1 Image Mode Payload (v3.0)

JSON object serialized to UTF-8 bytes, prefixed with a 4-byte big-endian length header.

```json
{
  "version":     "3.0",
  "enc_algo":    "RSA-OAEP" | "ECDH-P-256",
  "sign_algo":   "RSA-PSS"  | "ECDSA-P-256" | null,
  "iv":          "<base64 — 12 bytes>",
  "enc_data":    "<base64 — ciphertext + 16B GCM tag>",
  "enc_aes_key": "<base64 — 256B (RSA) or 48B (ECDH)>",
  "ecdh_ephem":  "<base64 — 65B EC point> | null",
  "ecdh_salt":   "<base64 — 32B HKDF salt> | null",
  "ecdh_iv":     "<base64 — 12B wrap IV> | null",
  "signature":   "<base64 — 256B RSA-PSS or 64B ECDSA> | null"
}
```

| Field | RSA bytes | ECDH bytes | Purpose |
|---|---|---|---|
| `iv` | 12 | 12 | AES-GCM IV for message decryption |
| `enc_data` | msg+16 | msg+16 | Ciphertext + auth tag |
| `enc_aes_key` | 256 | 48 | Wrapped AES session key |
| `ecdh_ephem` | null | 65 | Uncompressed ephemeral EC point |
| `ecdh_salt` | null | 32 | HKDF salt |
| `ecdh_iv` | null | 12 | AES-GCM wrap IV |
| `signature` | 256 | 64 | Over `iv ‖ enc_data ‖ enc_aes_key` |

### 8.2 StegaQR Frame Format

Bytes embedded in shuffled safe-pixel LSBs (after deflate compression):

```
Offset  Length  Description
─────────────────────────────────────────────
0       4       Magic bytes: 0x53 0x51 0x52 0x50 ("SQRP")
4       4       Compressed payload length N (uint32 big-endian)
8       N       deflate-raw compressed AES-256-GCM payload
                  └─ [12B IV][ciphertext + 16B GCM tag]
```

Total frame overhead: 8 bytes (header) + 12 bytes (IV) + 16 bytes (GCM tag) = 36 bytes minimum.

---

## 9. Key Management

### 9.1 Image Mode — Asymmetric Key Pairs

`generateKeyPair(algoId)` supports:

```
"ECDH-P-256"  → ECDH, namedCurve:"P-256", usages:["deriveBits","deriveKey"]
"RSA-OAEP"    → RSA-OAEP, 2048-bit, SHA-256, usages:["encrypt","decrypt"]
"ECDSA-P-256" → ECDSA, namedCurve:"P-256", usages:["sign","verify"]
"RSA-PSS"     → RSA-PSS, 2048-bit, SHA-256, usages:["sign","verify"]
```

All keys exported as standard PEM (PKCS#8 private / SPKI public). Fingerprints shown as `sha256(exported)[0:8]` in hex.

**Distribution model**: recipient shares public encryption key with sender; sender optionally shares signing public key with recipient. No PKI, no certificate authority.

### 9.2 StegaQR Mode — Password-Based Keys

```
password
  ├─ PBKDF2(salt="StegaQR-v1.0-mkey", iters=100_000) → 32B AES key  (content security)
  └─ PBKDF2(salt="StegaQR-v1.0-skey", iters=100_000) → 32B stego key (position security)
```

Both keys are computationally independent. Disclosing the stego key reveals where bits are hidden but not what they say (content remains AES-256-GCM protected). Disclosing the AES key reveals the content but not the positions (an attacker without the stego key cannot even find the payload).

---

## 10. Steganalysis — Detection Module

### 10.1 Test Characteristics

| Test | Flag threshold | Sensitivity | Limitation |
|---|---|---|---|
| Chi-square pair | > 0.72 | High for fill > 20% | May flag JPEG-recompressed images |
| Histogram uniformity | > 0.70 | High for fill > 30% | Low sensitivity at very low fill |
| LSB entropy | > 0.65 | Good for random payloads | Film-grain images may score high |

### 10.2 StegaQR vs. Steganalysis

The StegaQR noise mimicry technique directly targets all three tests:

- **Chi-square**: unused pixels are randomized → pairs equalized → test yields high score on both payload AND noise regions → cannot distinguish them
- **Histogram uniformity**: overall LSB ratio = 50% (payload bits + random noise bits = uniform) → test cannot flag
- **LSB entropy**: transition rate → 0.5 across the entire safe region → appears as white noise

A steganalysis tool will likely produce "Likely Stego" on a StegaQR image (because the safe region is filled with uniform LSBs), but this is **indistinguishable from a naturally noisy image** — it cannot confirm or locate the payload.

### 10.3 Combined Score Weighting

```
P = 0.45 × χ²score + 0.35 × histScore + 0.20 × entropyScore
```

Chi-square carries the highest weight (0.45) — lowest false-positive rate on natural photographic content.

---

## 11. Results and Workflows

### 11.1 Encrypt & Embed — Step by Step

1. Drag cover image → displays dimensions and max capacity.
2. Type secret message.
3. Load recipient's encryption public key (auto-detected algorithm + fingerprint shown).
4. Optionally load signing private key.
5. Click "Encrypt & Embed". Progress: load image → AES encrypt → key wrap → sign → LSB embed → PNG encode → save history.
6. Download stego PNG + view metadata card (dimensions, payload size, density, signing status).

### 11.2 StegaQR Generate — Step by Step

1. Enter decoy URL → live capacity indicator shows QR version and available bytes.
2. Type secret message.
3. Select error correction level (L/M/Q/H).
4. Enter shared password.
5. Click "Generate StegaQR". Progress: derive keys (PBKDF2) → AES-256-GCM encrypt → render QR → build safe mask → AES-CTR shuffle → embed + noise fill → encode PNG.
6. Preview QR image in-browser → download PNG → view embedding stats card.

### 11.3 StegaQR Decode — Step by Step

1. Drop StegaQR PNG.
2. Enter the same shared password.
3. Click "Extract & Decrypt". Progress: derive stego key → load image → reconstruct shuffle → extract bits → decompress → AES-256-GCM decrypt.
4. Decrypted message shown in monospace panel with "AES-256-GCM" tag.

### 11.4 Decrypt & Extract — Step by Step

1. Upload stego PNG.
2. Load decryption private key; optionally load sender's signing public key.
3. Click "Extract & Decrypt".
4. Signature status, decrypted message, and algorithm metadata displayed.

### 11.5 Steganalysis — Step by Step

1. Upload any image.
2. System runs all three tests + generates block-level heatmap.
3. Gauge (0–100%), three test bars, verdict chip, heatmap overlay displayed.
4. Operation logged to history.

---

## 12. Security Analysis

### 12.1 Two-Layer Protection (Both Modules)

Both modules provide the same two-layer model:
1. **Steganography** hides the existence of communication.
2. **Encryption** protects content if the carrier is discovered.

Neither layer alone is sufficient; together they address fundamentally different adversary capabilities.

### 12.2 StegaQR Threat Model

| Adversary capability | Outcome |
|---|---|
| Sees QR image, scans it | Reads decoy URL only |
| Runs statistical steganalysis | LSB histogram is uniform; cannot distinguish payload from noise |
| Knows the stego password | Knows embedding positions; AES-256-GCM still protects content |
| Knows both password and image | Can extract and decrypt the message |
| Knows only the AES key | Cannot locate payload bits without the stego key |

### 12.3 AES-256-GCM Authenticated Encryption

The GCM authentication tag provides integrity — any modification to ciphertext, IV, or (in image mode) the wrapped key is detected at decryption time. There is no silent corruption.

### 12.4 Forward Secrecy (ECDH image mode)

Ephemeral key pairs ensure past messages are not exposed if long-term private keys are later compromised.

### 12.5 PBKDF2 Brute-Force Resistance (StegaQR)

100,000 iterations of HMAC-SHA-256 adds ~1 second of computation per password attempt. An attacker trying a 100,000-word dictionary would need ~27 hours on a single core. Strong passwords (≥ 12 characters, mixed) are effectively infeasible to brute-force.

### 12.6 Zero-Knowledge Storage

Private keys exist only as non-extractable `CryptoKey` objects in browser memory (session only). No sensitive data is written to IndexedDB, localStorage, or any persistent store.

---

## 13. Limitations

### 13.1 Image Payload Size

```
capacity = floor(W × H × 3 / 8) − 4   bytes
```

Minimum practical image for image mode (RSA-OAEP, ~1,200 bytes payload): ~80×80 px.

### 13.2 StegaQR Payload Size

StegaQR capacity depends on QR version (URL length) and EC level. Higher EC level = more safe modules but also more total capacity. A medium-length URL at EC=H (v10) provides approximately 4–6 KB of capacity after compression — sufficient for typical short messages but not for large data.

Tip: append a query string or path to the decoy URL to force a higher QR version and more capacity.

### 13.3 JPEG Destructibility

PNG output must not be re-encoded to JPEG. JPEG compression destroys all embedded LSB data. The output should be distributed as-is.

### 13.4 Statistical Detectability of Image Mode

Sequential LSB is detectable by the built-in steganalysis tools at fill densities above ~15–20%. Advanced tools (SRM, CNN detectors) can achieve higher accuracy. For high-security use cases, low fill density (<5%) reduces detectability.

StegaQR is resistant to all three built-in tests by design (noise mimicry). However, the presence of a uniform-LSB region in a QR image may still be a distinguishing feature to a sufficiently sophisticated detector.

### 13.5 Browser Memory

Very large images (>6000×6000 px) may cause memory pressure, as raw RGBA pixel buffers must be manipulated in RAM (~144 MB for 6000×6000).

### 13.6 QR Image Integrity

The StegaQR PNG must not be resized, cropped, or re-encoded. The image width encodes the QR version; any dimension change makes extraction impossible.

---

## 14. Future Enhancements

### 14.1 DCT-Domain / Frequency-Domain Steganography

Embedding in JPEG DCT coefficients (F5 or OutGuess) or DWT coefficients would survive JPEG re-encoding and be significantly more resistant to statistical detection. Currently blocked by the requirement for lossless PNG output.

### 14.2 Adaptive Embedding

Prioritize high-texture image regions (edges, film grain) where LSB changes are statistically less anomalous, reducing chi-square and entropy scores without noise mimicry.

### 14.3 Video and Audio Steganography

LSB substitution in WAV audio samples or per-frame in video (payload distributed across frames to reduce per-frame density).

### 14.4 Post-Quantum Cryptography

NIST's 2024 PQC standards (CRYSTALS-Kyber for KEM, CRYSTALS-Dilithium for signatures) would replace RSA-OAEP and ECDH. Currently the Web Crypto API does not expose these algorithms — a WebAssembly port of liboqs would be required.

### 14.5 Machine Learning Steganalysis

A CNN trained on clean/stego image pairs (e.g., SRM feature extraction + binary classifier) would provide more accurate detection than statistical tests, particularly at low fill densities and against randomized embeddings.

### 14.6 File Payloads

Support embedding arbitrary binary files (PDFs, images, archives) rather than only text, by treating file bytes as the raw payload before the JSON or AES wrapper.

### 14.7 StegaQR Multi-Layer Obfuscation

Additional future layer: encode the StegaQR payload URL as itself a StegaQR, creating nested decoy chains. Or spread the payload across multiple QR codes (threshold secret sharing).

---

## 15. Conclusion

StegaVault Lite+ demonstrates that production-quality hybrid cryptographic steganography is achievable entirely within the browser using only W3C-standardized APIs. The system delivers:

- **Two steganographic channels**: high-capacity image LSB for large payloads, StegaQR for lightweight, shareable covert communication via ordinary-looking QR codes.
- **Strong confidentiality**: AES-256-GCM with PBKDF2 (StegaQR) or RSA/ECDH hybrid encryption (image mode) — computationally infeasible to break.
- **Active anti-steganalysis** (StegaQR): AES-CTR PRNG position shuffle + noise mimicry defeats all three implemented statistical detection tests.
- **Optional authenticity** (image mode): RSA-PSS and ECDSA signatures provide non-repudiable sender authentication.
- **Zero-knowledge storage**: no plaintext, no key material, no session data ever leaves the browser or is written to persistent storage.
- **Adversarial awareness**: the integrated steganalysis module gives the user a realistic view of their own detectability under standard statistical attacks.

The clean modular architecture — independent `cryptoEngine.js`, `stegoEngine.js`, `qrStegoEngine.js`, and `steganalysis.js` with no cross-dependencies — makes each component independently testable, upgradeable, and replaceable.

---

## 16. References

1. **Westfeld, A. & Pfitzmann, A.** (2000). *Attacks on Steganographic Systems*. International Workshop on Information Hiding, Springer. (Chi-square and histogram tests.)

2. **NIST FIPS 197** (2001). *Advanced Encryption Standard (AES)*. https://doi.org/10.6028/NIST.FIPS.197

3. **NIST SP 800-38D** (2007). *Recommendation for Block Cipher Modes of Operation: GCM and GMAC*.

4. **NIST SP 800-56A Rev.3** (2018). *Recommendation for Pair-Wise Key-Establishment Schemes Using ECDH*.

5. **NIST FIPS 186-5** (2023). *Digital Signature Standard (DSS)* — RSA-PSS and ECDSA.

6. **RFC 8017** (2016). *PKCS #1: RSA Cryptography Specifications v2.2* — RSA-OAEP and RSA-PSS.

7. **RFC 5869** (2010). *HMAC-based Key Derivation Function (HKDF)*.

8. **RFC 2898** (2000). *PKCS #5: Password-Based Cryptography Specification v2.0* — PBKDF2.

9. **W3C Web Cryptography API** (2017). https://www.w3.org/TR/WebCryptoAPI/

10. **Kerckhoffs's Principle** (1883). *La cryptographie militaire*. (Security derives from key secrecy, not algorithm obscurity.)

11. **Provos, N. & Honeyman, P.** (2003). *Hide and Seek: An Introduction to Steganography*. IEEE Security & Privacy, 1(3), 32–44.

12. **Fridrich, J., Goljan, M. & Du, R.** (2001). *Reliable Detection of LSB Steganography in Color and Grayscale Images*. ACM Workshop on Multimedia and Security.

13. **ISO/IEC 18004:2015** — *QR Code bar code symbology specification*. (Structural region definitions, alignment pattern coordinates.)

14. **React 18 Documentation**. https://react.dev/

15. **Vite 5 Documentation**. https://vitejs.dev/

16. **qrcode npm package** (v1.5.4). https://github.com/soldair/node-qrcode — QR generation used in StegaQR module.

---

*StegaVault Lite+ v3.0 / StegaQR v1.0 · April 2026*
