# StegaVault Lite+ — Hybrid Cryptographic Steganography System

---

**Project Title:** StegaVault Lite+ — Hybrid Cryptographic Steganography Dashboard
**Author:** Pranav
**Date:** April 2026
**Version:** 3.0 (Cryptography Engine) / 2.0 (Steganography & Steganalysis Engines)
**Technology Stack:** React 18 · Vite 5 · Web Crypto API · Tailwind CSS 3 · Framer Motion 11

---

## Abstract

StegaVault Lite+ is a fully client-side, zero-dependency cryptographic steganography dashboard built for secure covert communication. The system combines modern asymmetric key exchange (RSA-OAEP 2048 and ECDH P-256), symmetric encryption (AES-256-GCM), optional digital signatures (RSA-PSS and ECDSA P-256), and image steganography (sequential Least Significant Bit substitution) into a unified, browser-native pipeline.

All cryptographic operations are performed exclusively through the W3C Web Crypto API — meaning no third-party cryptographic library is required and no sensitive material ever leaves the user's device. The steganalysis module employs three independent statistical tests (chi-square pair equalization, LSB histogram uniformity, and LSB-plane entropy analysis) combined through majority voting to detect potential steganographic content in suspected carrier images.

The system produces a lossless PNG output image that is visually indistinguishable from the original, yet carries an encrypted, optionally signed payload embedded in the least significant bits of the image's RGB channels. The result is a two-layer security model: even if an adversary detects the presence of hidden data, they cannot decrypt it without the recipient's private key.

---

## 1. Introduction

### 1.1 Problem Statement

In an era of ubiquitous digital surveillance, metadata analysis, and deep-packet inspection, traditional encryption alone is insufficient for certain use cases. Encrypted traffic is conspicuous — its very presence signals that a sensitive communication is occurring, inviting scrutiny, throttling, or legal compulsion to surrender keys.

Steganography addresses the complementary need: concealing the *existence* of a communication, not merely its content. A message hidden inside an ordinary-looking photograph raises no suspicion on its own. However, naive steganography without encryption is equally insufficient: if an adversary identifies a stego image, the message is immediately readable.

The solution is to combine both techniques in a layered architecture — the message is first encrypted with strong, modern cryptographic algorithms, and only then embedded into a carrier image. This provides:

1. **Confidentiality** — AES-256-GCM ensures the payload is computationally infeasible to decrypt without the correct key.
2. **Key confidentiality** — RSA-OAEP or ECDH-based key agreement ensures only the intended recipient can obtain the AES key.
3. **Authenticity** — Optional RSA-PSS or ECDSA signatures bind the payload to the sender's identity, protecting against forgery or tampering.
4. **Plausible deniability** — The carrier image looks like an ordinary photograph with no visible modification.

### 1.2 Motivation and Innovation

StegaVault distinguishes itself from prior academic steganography tools in several ways:

- **Fully browser-native**: runs entirely in the user's browser using the Web Crypto API. No server, no backend, no network transmission of keys or plaintext.
- **Algorithm agility**: supports multiple asymmetric algorithms (RSA-OAEP, ECDH P-256 for encryption; RSA-PSS, ECDSA P-256 for signing) with automatic detection — the same interface works regardless of key type.
- **Integrated steganalysis**: the same dashboard that embeds messages can also attempt to detect steganographic content in arbitrary images, providing a real-world adversarial perspective.
- **Zero-knowledge architecture**: no key material, no plaintext, and no history metadata is ever transmitted to any server or stored in a recoverable form outside of the browser's local IndexedDB.

---

## 2. Objectives

The primary objectives of StegaVault Lite+ are:

- **O1**: Implement AES-256-GCM symmetric encryption for message confidentiality using a per-message randomly generated key.
- **O2**: Implement RSA-OAEP (2048-bit) and ECDH P-256 asymmetric key encapsulation to securely deliver the AES key to the intended recipient.
- **O3**: Implement RSA-PSS and ECDSA P-256 digital signature schemes so that the payload can optionally be authenticated against the sender's identity.
- **O4**: Implement sequential LSB steganography to embed the fully encrypted payload into the RGB channels of a lossless carrier image.
- **O5**: Produce a self-contained JSON payload format (version 3.0) that unambiguously encodes all cryptographic parameters needed for decryption.
- **O6**: Implement a steganalysis pipeline (chi-square, histogram uniformity, LSB entropy) with majority voting to detect potentially modified carrier images.
- **O7**: Provide an interactive, real-time browser dashboard with key generation, PEM import/export, operation history, and progress reporting — entirely client-side.
- **O8**: Ensure zero-knowledge operation: no plaintext, no private key material, and no decrypted content is ever stored on disk or transmitted over a network.

---

## 3. System Architecture

### 3.1 High-Level Pipeline

The full encryption-embedding pipeline can be described in five stages:

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

### 3.2 Decryption / Extraction Pipeline

The reverse pipeline mirrors the embedding stages:

```
[Stego PNG Image]
        │
        ▼
  Read LSBs → reconstruct framed bytes
        │
        ▼
  Parse 4-byte length header → extract JSON payload bytes
        │
        ▼
  Parse JSON → validate version field ("3.0")
        │
        ▼
  If signature present + verify key loaded:
    Reconstruct iv ‖ enc_data ‖ enc_aes_key → verify signature
    Fail immediately if signature invalid
        │
        ▼
  Unwrap AES key:
    RSA-OAEP: crypto.subtle.decrypt(RSA-OAEP, privateKey, enc_aes_key)
    ECDH: re-import ephemeral pubkey → re-derive HKDF → AES-GCM decrypt enc_aes_key
        │
        ▼
  AES-256-GCM decrypt enc_data with unwrapped key + IV
  (auth tag verified implicitly — decryption fails if tampered)
        │
        ▼
[Recovered Plaintext Message]
```

### 3.3 Module Architecture

```
src/
├── App.jsx                          Single-page shell; sidebar + module routing
├── core/
│   ├── crypto/cryptoEngine.js       All cryptographic operations (Web Crypto API)
│   ├── stego/stegoEngine.js         LSB embed / extract; image I/O
│   └── analysis/steganalysis.js     Chi-square, histogram, entropy, heatmap
├── modules/
│   ├── encrypt/EncryptModule.jsx    UI orchestration: encrypt + embed workflow
│   ├── decrypt/DecryptModule.jsx    UI orchestration: extract + decrypt workflow
│   ├── detect/DetectModule.jsx      UI orchestration: steganalysis + heatmap
│   └── history/HistoryModule.jsx    IndexedDB history viewer
├── components/
│   ├── KeyManager.jsx               PEM import, key generation, fingerprint display
│   ├── FileDropzone.jsx             Drag-and-drop image input component
│   ├── ProgressBar.jsx              Animated progress indicator
│   ├── MetadataCard.jsx             Tabular operation report
│   └── Sidebar.jsx                  Navigation sidebar
└── storage/
    └── indexedDB.js                 Local operation history persistence
```

---

## 4. Technologies Used

### 4.1 React 18 & Vite 5

React 18 provides the component-based UI framework. Functional components with hooks (`useState`, `useRef`, `useEffect`) manage all local state. Vite 5 serves as the build tool and development server, offering sub-second hot-module replacement and production bundle optimization (331 KB JS, ~102 KB gzipped).

**Why React + Vite?** The application requires reactive state updates during long-running cryptographic operations (progress bars, key validation status, result display). React's unidirectional data flow makes this straightforward, and Vite's native ES module support aligns perfectly with the codebase's use of native browser APIs.

### 4.2 Web Crypto API (Built-in Browser API)

The `crypto.subtle` interface provides all cryptographic primitives used in the system:

| Operation | Web Crypto method |
|---|---|
| AES-256-GCM encrypt/decrypt | `crypto.subtle.encrypt` / `decrypt` |
| RSA-OAEP key pair generation | `crypto.subtle.generateKey` |
| ECDH P-256 key pair + derivation | `crypto.subtle.generateKey` + `deriveBits` |
| HKDF key derivation | `crypto.subtle.deriveKey` |
| RSA-PSS sign/verify | `crypto.subtle.sign` / `verify` |
| ECDSA P-256 sign/verify | `crypto.subtle.sign` / `verify` |
| SHA-256 hashing | `crypto.subtle.digest` |
| PEM export (PKCS#8/SPKI) | `crypto.subtle.exportKey` |
| PEM import | `crypto.subtle.importKey` |

**Why Web Crypto API?** It is hardware-accelerated on modern devices, standardized by W3C, audited by browser vendors, and eliminates all third-party cryptographic dependencies — removing an entire category of supply-chain risk.

### 4.3 Tailwind CSS 3 & Framer Motion 11

Tailwind provides utility-class-based styling with a custom cyber-themed color palette (`cyber.green`, `cyber.blue`, `cyber.red`, etc.). Framer Motion handles all page transitions and panel animations using spring-physics and keyframe-based motion primitives.

### 4.4 Lucide React

A tree-shakeable SVG icon library providing the iconography for the dashboard UI (lock icons, shield icons, key icons, etc.).

### 4.5 Browser IndexedDB

The native browser key-value database stores operation history (embed, extract, analyze records) locally. Schema:

- **Store:** `history` in `StegaVaultDB` v1
- **Fields:** `id` (auto-increment), `filename`, `operation`, `timestamp` (ISO-8601), `status`, `stegoBlob` (Blob, embed-only), `meta` (object)
- **Zero sensitive storage**: keys and plaintext are never written to IndexedDB. Only metadata (dimensions, payload size, algorithm names) and the output PNG blob are persisted.

---

## 5. Core Concepts

### 5.1 AES-256-GCM (Symmetric Encryption)

**Advanced Encryption Standard (AES)** is a symmetric block cipher standardized by NIST in 2001 (FIPS 197). It operates on 128-bit blocks using a key of 128, 192, or 256 bits. StegaVault uses AES-256, meaning a 256-bit key, which offers 2^256 possible key combinations — infeasible to brute-force with any known technology.

**GCM (Galois/Counter Mode)** is an authenticated encryption mode that combines AES in CTR (counter) mode with Galois field authentication:

1. **Counter mode** generates a keystream by encrypting successive counter values (IV concatenated with a counter), then XOR-ing the keystream with plaintext blocks.
2. **Authentication tag** is computed over the ciphertext using Galois field multiplication (GHASH), producing a 128-bit tag that guarantees both integrity and authenticity.

The combined operation is called **AEAD** (Authenticated Encryption with Associated Data). The decryption operation fails — throwing an exception — if the ciphertext has been tampered with or if the wrong key is used, because the auth tag will not match. This is a critical security property: a corrupted or forged payload is *detected* rather than silently decrypted into garbage.

In StegaVault:
- IV (Initialization Vector): 12 bytes (96 bits) — randomly generated via `crypto.getRandomValues()` for each message
- Key length: 256 bits
- Auth tag: 128 bits
- The IV and ciphertext (which includes the appended auth tag) are stored in the JSON payload.

```
generateAESKey():
  → crypto.subtle.generateKey({ name:'AES-GCM', length:256 }, true, ['encrypt','decrypt'])

encryptMessage(message, aesKey):
  iv = crypto.getRandomValues(new Uint8Array(12))   // 96-bit random IV
  buf = crypto.subtle.encrypt({ name:'AES-GCM', iv, tagLength:128 }, aesKey, UTF8(message))
  return { iv, ciphertext: Uint8Array(buf) }         // ciphertext includes appended 128-bit tag
```

### 5.2 RSA — Public/Private Key Cryptography

**RSA (Rivest–Shamir–Adleman, 1977)** is the foundational asymmetric cryptosystem based on the computational difficulty of factoring the product of two large primes.

Key pair: `(e, n)` public, `(d, n)` private, where `n = p × q` and `d ≡ e⁻¹ (mod λ(n))`.

- **Encryption**: `c = m^e mod n`
- **Decryption**: `m = c^d mod n`

StegaVault uses RSA with a 2048-bit modulus, which NIST recommends as secure until at least 2030.

**OAEP (Optimal Asymmetric Encryption Padding)** is a probabilistic padding scheme for RSA encryption that prevents several classical RSA attacks (including chosen-ciphertext and partial decryption attacks). In combination with SHA-256 as the hash function, RSA-OAEP 2048 with SHA-256 is the standard mode for secure key encapsulation.

**PSS (Probabilistic Signature Scheme)** is the analogous padding for RSA signatures. StegaVault uses RSA-PSS with SHA-256 and a salt length of 32 bytes. PSS is provably secure in the random oracle model, unlike the older PKCS#1 v1.5 signature scheme.

### 5.3 Hybrid Encryption

Pure asymmetric encryption (RSA) is computationally expensive and limited to short plaintexts (RSA-2048 with OAEP can encrypt at most ~190 bytes of plaintext directly). **Hybrid encryption** solves this:

1. Generate a fresh, random symmetric key (AES-256) for this specific message.
2. Encrypt the message with the fast symmetric cipher (AES-256-GCM).
3. Encrypt the small symmetric key with the recipient's slow asymmetric public key (RSA-OAEP or ECDH).
4. Transmit both the encrypted message and the encrypted symmetric key.

The recipient decrypts the symmetric key using their private key, then uses it to decrypt the message. This combines the key management convenience of public-key cryptography with the performance of symmetric cryptography — it is the pattern underlying TLS, PGP, and most real-world secure messaging protocols.

### 5.4 ECDH P-256 — Elliptic Curve Key Agreement

**Elliptic Curve Diffie-Hellman (ECDH)** is an alternative to RSA for key agreement, based on the Elliptic Curve Discrete Logarithm Problem (ECDLP). The P-256 curve (also called secp256r1 or prime256v1) is standardized by NIST and provides approximately 128 bits of security — equivalent to RSA-3072 — with much shorter key material (32 bytes vs 384 bytes).

StegaVault's ECDH implementation uses the **ephemeral** variant (ECDHE):

1. The sender generates a fresh ECDH key pair for this message only (the "ephemeral" key pair).
2. The sender performs ECDH using the ephemeral private key and the recipient's long-term public key, producing a shared secret.
3. **HKDF (HMAC-based Key Derivation Function)** with SHA-256 derives a 256-bit wrapping key from the shared secret and a random 32-byte salt. The info string `"StegaVault-v3-wrap"` domain-separates this derivation from any other use of the shared secret.
4. The wrapping key encrypts the AES session key using AES-256-GCM (separate IV).
5. The ephemeral public key, HKDF salt, and wrap IV are stored alongside the encrypted AES key in the payload, allowing the recipient to reproduce the entire key derivation.

The ephemeral nature provides **forward secrecy**: even if the recipient's long-term private key is later compromised, past messages remain protected because the ephemeral private key was never stored.

### 5.5 Digital Signatures

A **digital signature** is a cryptographic mechanism that binds a message to a signer's identity:

1. The signer computes a hash of the data.
2. The hash is encrypted with the signer's private key, producing the signature.
3. Any verifier uses the signer's public key to recover and compare the hash.

In StegaVault, the signed data is the concatenation of `iv ‖ enc_data ‖ enc_aes_key` bytes. This protects against:
- **Tampering**: any modification to the ciphertext, IV, or wrapped key will invalidate the signature.
- **Forgery**: only someone in possession of the sender's private signing key can produce a valid signature.

Two signature algorithms are supported:
- **RSA-PSS** (SHA-256, saltLength=32): classical, widely supported
- **ECDSA P-256** (SHA-256): more compact signatures (64 bytes vs 256 bytes), same security level

Signing is optional: a message can be embedded without a signature (e.g., for anonymous communication). The payload records `sign_algo: null` in that case, and the recipient is notified that authenticity is unconfirmed.

### 5.6 Steganography — LSB Substitution

**Steganography** is the practice of hiding information within a non-secret carrier medium such that the existence of the hidden information is not apparent.

**LSB (Least Significant Bit) substitution** is the simplest and most widely studied spatial-domain image steganography technique. For each pixel channel value (0–255 in 8-bit color), only the last bit (the LSB) is modified. A change of ±1 in a color channel value is visually imperceptible to the human eye.

**Algorithm:**

For each bit `b[i]` of the payload (in MSB-first order within each byte):
- Locate the target channel: `channelIdx = i mod 3` (R, G, B in sequence)
- Locate the target pixel: `pixelIdx = floor(i / 3)`
- Replace the LSB: `pixel[channelIdx] = (pixel[channelIdx] & 0xFE) | b[i]`

The AND with `0xFE` (binary `11111110`) clears the existing LSB; the OR with `b[i]` sets it to the desired bit.

**Capacity formula:**
```
capacity = floor(W × H × 3 / 8) − 4   bytes
```

For a 1920×1080 image: `floor(1920 × 1080 × 3 / 8) − 4 = 777,596 bytes` ≈ 759 KB — sufficient for a very long encrypted message.

**Why PNG output?** JPEG compression is lossy — it modifies pixel values as part of its compression algorithm, which would corrupt the embedded LSBs. StegaVault always outputs lossless PNG, regardless of input format, to guarantee bit-perfect preservation of the embedded payload.

---

## 6. Module-wise Explanation

### 6.1 Cryptography Engine (`src/core/crypto/cryptoEngine.js`)

**Purpose**: Provides all cryptographic primitives and orchestrates the hybrid encryption/decryption pipeline. This is the security-critical core of the system; all other modules are consumers of its API.

**Key Functions:**

| Function | Description |
|---|---|
| `generateAESKey()` | Creates an ephemeral 256-bit AES-GCM key via `crypto.subtle.generateKey` |
| `encryptMessage(msg, key)` | AES-256-GCM encrypt; returns `{ iv, ciphertext }` |
| `decryptMessage(ct, iv, key)` | AES-256-GCM decrypt; throws on auth tag failure |
| `generateKeyPair(algoId)` | Generates RSA-OAEP, RSA-PSS, ECDH P-256, or ECDSA P-256 key pair |
| `exportKeyToPEM(key)` | Exports to PKCS#8 (private) or SPKI (public) PEM string |
| `importAnyKey(pem, usage)` | Auto-detects algorithm from key bytes; tries all candidates for the given usage |
| `wrapAESKey(aesKey, pubKey)` | RSA-OAEP: direct encrypt. ECDH: ephemeral ECDH + HKDF + AES-GCM wrap |
| `unwrapAESKey(enc, algoId, privKey, ecdhParams)` | Reverse of `wrapAESKey` |
| `signData(data, privKey)` | RSA-PSS or ECDSA sign, dispatching on key algorithm |
| `verifyData(data, sig, pubKey)` | Verify signature; throws on failure |
| `keyFingerprint(key)` | SHA-256 of exported key bytes, first 8 bytes as hex — for display only |
| `buildHybridPayload(msg, encPub, signPriv)` | Full pipeline: AES encrypt → key wrap → optional sign → JSON serialize → UTF-8 bytes |
| `decryptHybridPayload(bytes, decPriv, verPub)` | Reverse: parse JSON → verify signature → unwrap AES key → AES decrypt |
| `sha256Hex(data)` | Utility: SHA-256 hex string |

**Algorithm auto-detection (`importAnyKey`)**: When a PEM key is pasted, the system cannot determine the algorithm from the PEM header alone (all RSA keys have identical headers regardless of use). `importAnyKey` solves this by attempting multiple `crypto.subtle.importKey` calls for each compatible algorithm in priority order, catching failures, and returning the first success. This means the same text field accepts RSA-OAEP, ECDH P-256, RSA-PSS, and ECDSA P-256 without any mode selection by the user.

**ECDH wrapping detail** (`wrapAESKey` for ECDH):
```
1. ephem = generateKey(ECDH-P256)                  // ephemeral key pair
2. sharedBits = deriveBits(ECDH, pubKey, ephem.priv, 256)
3. salt = getRandomValues(32 bytes)
4. wrapKey = deriveKey(HKDF-SHA256, salt, "StegaVault-v3-wrap", sharedBits) → AES-GCM-256
5. wrapIV = getRandomValues(12 bytes)
6. encAES = encrypt(AES-GCM, wrapKey, wrapIV, rawAESKeyBytes)
7. ephemPubRaw = exportKey("raw", ephem.publicKey)   // 65-byte uncompressed EC point
// Store in payload: encAES, ephemPubRaw, salt, wrapIV
```

### 6.2 Steganography Engine (`src/core/stego/stegoEngine.js`)

**Purpose**: Embeds arbitrary byte arrays into the RGB LSBs of an image and extracts them back. Handles image I/O through the browser Canvas API.

**Key Functions:**

| Function | Description |
|---|---|
| `getCapacity(w, h)` | Returns maximum embeddable bytes: `floor(w × h × 3 / 8) − 4` |
| `embedData(imageData, payloadBytes, onProgress)` | Sequential LSB write; returns `{ stego, bitsUsed, capacity, density }` |
| `extractData(imageData, onProgress)` | Sequential LSB read with length-header parsing; returns raw payload bytes |
| `loadImageFile(file)` | Loads a File via Canvas to an `ImageData` object |
| `imageDataToPngBlob(imageData)` | Converts `ImageData` to a lossless PNG Blob via Canvas |

**Embedding framing:**
```
[0:3]   4 bytes — uint32 big-endian payload length N
[4:N+3] N bytes — JSON-serialized hybrid crypto payload (UTF-8)
```

This framing allows `extractData` to read exactly the right number of bits from the LSBs — no end-of-payload sentinel is needed.

**Bit addressing within the pixel buffer:**
```
For bit position i:
  pixelIdx    = floor(i / 3)          // which pixel (0-indexed, row-major)
  channelIdx  = i mod 3               // R=0, G=1, B=2 (Alpha is skipped)
  byteOffset  = pixelIdx × 4          // RGBA stride in ImageData buffer

  byteIndex   = floor(i / 8)          // which byte of the frame
  bitInByte   = 7 − (i mod 8)         // MSB-first ordering within each byte
  bit         = (frame[byteIndex] >> bitInByte) & 1

  newData[byteOffset + channelIdx] = (original & 0xFE) | bit
```

**Density calculation:**
```
density = (bitsUsed / (W × H × 3)) × 100   %
```
A 100-byte message in a 1920×1080 image has a density of approximately 0.0013% — completely negligible.

### 6.3 Steganalysis Engine (`src/core/analysis/steganalysis.js`)

**Purpose**: Applies three independent statistical tests to detect signs of LSB steganography in an arbitrary image, then combines the results through majority voting to produce a final verdict.

#### Test 1: Chi-Square LSB Attack

**Theoretical basis (Westfeld & Pfitzmann, 2000):** In a natural image, the histogram count for pixel value `2k` and value `2k+1` typically differ because natural gradients produce non-uniform distributions. LSB substitution forces these pairs to equalize, since each bit is overwritten with a pseudo-random value from the encrypted payload.

**Implementation:**
```
For each channel R, G, B:
  For each value pair (2k, 2k+1), k ∈ [0, 127]:
    ratio = |hist[2k] - hist[2k+1]| / (hist[2k] + hist[2k+1])
    — low ratio → equalized pair → stego evidence

  channelScore = 1 − (mean ratio across active pairs)
  — score ≈ 1.0: full equalization (stego); ≈ 0.0: unequal (natural)

overallScore = average of 3 channel scores
flag = score > 0.72
```

#### Test 2: LSB Histogram Uniformity

**Theoretical basis:** In a natural image, the aggregate fraction of pixels with LSB=1 deviates noticeably from 50% (typically 40–47% or 53–60%). LSB substitution with encrypted (pseudo-random) data drives this fraction toward exactly 50%, since random bits are equally likely to be 0 or 1.

**Implementation:**
```
lsbRatio = (count of pixels with LSB=1) / (total RGB channel samples)
distFrom50 = |lsbRatio − 0.5|
score = exp(−distFrom50 × 25)   // exponential decay: 0.5 → score=1, |dev|≥0.08 → score<0.2
flag = score > 0.70
```

#### Test 3: LSB-Plane Entropy Analysis

**Theoretical basis:** The LSB plane of a natural image has moderate spatial coherence — adjacent pixel values tend to be similar, so their LSBs change relatively infrequently (transition rate ≈ 0.30–0.44). Embedding encrypted (effectively random) data makes the LSB plane resemble white noise, with a transition rate approaching 0.5.

**Implementation:**
```
For each adjacent horizontal pixel pair (x, x+1) in each row y:
  For each channel c ∈ {R, G, B}:
    if LSB(pixel[y][x+1][c]) ≠ LSB(pixel[y][x][c]): transitions++
    comparisons++

transitionRate = transitions / comparisons
score = sigmoid(−18 × (transitionRate − 0.47))
      // centred at 0.47: rates ≥ 0.5 → score → 1
flag = score > 0.65
```

#### Majority Voting and Final Verdict

```
voteScore = chiSquare.flag + histogram.flag + entropy.flag   // ∈ {0, 1, 2, 3}
verdict   = voteScore ≥ 2 ? "Likely Stego" : "Clean"

riskLevel:
  voteScore = 0 → LOW    (green)
  voteScore = 1 → MEDIUM (yellow)
  voteScore ≥ 2 → HIGH   (red)
```

The weighted probability for the gauge display (not used for the verdict decision):
```
combinedScore = 0.45 × chiSquare.score + 0.35 × histogram.score + 0.20 × entropy.score
probability   = round(combinedScore × 100)   %
```

#### Heatmap Generation

The image is divided into 16×16 pixel blocks. The chi-square score is computed independently for each block and stored in a `Float32Array` of dimensions `[blocksY × blocksX]`. The heatmap is rendered on a `<canvas>` as a color overlay:

```
color(s):
  r = s < 0.5 ? s × 2 × 255 : 255       // red increases above mid
  g = s < 0.5 ? 255 : (1−s) × 2 × 255   // green decreases above mid
  → green (clean) → yellow (moderate) → red (suspicious)
  opacity: 0.55
```

### 6.4 Key Manager (`src/components/KeyManager.jsx`)

**Purpose**: Provides the user interface for asymmetric key operations — generation, PEM import (paste or file upload), and fingerprint display. This component acts as the bridge between the raw PEM text the user provides and the live `CryptoKey` objects consumed by `buildHybridPayload` and `decryptHybridPayload`.

**Key features:**

- **KeySlot sub-component**: a PEM textarea that calls `importAnyKey` on every change event. Displays a green checkmark + algorithm ID + 8-byte hex fingerprint on success, or a red error message on failure.
- **Direction enforcement**: before attempting algorithm detection, `KeySlot` checks whether the PEM contains "PRIVATE KEY" and whether the usage requires a private or public key. This prevents the user from accidentally loading a private key where a public key is expected.
- **KeyGeneratorPanel sub-component**: allows in-browser generation of fresh key pairs. Algorithm is selectable from a dropdown (`ENCRYPTION_ALGOS` or `SIGNING_ALGOS` from `cryptoEngine.js`). After generation, both PEM strings are displayed and can be downloaded as `.pem` files.
- **Mode switching**: `mode="encrypt"` shows slots for the recipient's encryption public key and the sender's signing private key (optional). `mode="decrypt"` shows slots for the recipient's decryption private key and the sender's verification public key (optional).
- **Zero storage**: `CryptoKey` objects live only in React state for the current session. They are never serialized or persisted.

### 6.5 Storage Module (`src/storage/indexedDB.js`)

**Purpose**: Persists operation history in the browser's IndexedDB for review in the History module. No sensitive data is stored.

**API:**
- `saveHistory(entry)` — adds a record (filename, operation type, status, metadata, optional PNG blob)
- `getAllHistory()` — retrieves all records newest-first (via timestamp index)
- `deleteHistory(id)` — removes a single record
- `clearHistory()` — wipes all records
- `getHistoryEntry(id)` — fetches a single record by key

### 6.6 Utilities (`src/utils/helpers.js`)

Provides small, reusable functions:

| Function | Description |
|---|---|
| `formatBytes(n)` | Human-readable byte string (B / KB / MB) |
| `formatBits(n)` | Human-readable bit count (bits / Kbits / Mbits) |
| `formatTimestamp(iso)` | ISO-8601 → "Apr 07, 2026 · 14:33" |
| `downloadBlob(blob, name)` | Triggers browser download via temporary `<a>` element |
| `copyToClipboard(text)` | Writes to clipboard via `navigator.clipboard` |
| `stegoFilename(name)` | `"photo.jpg"` → `"photo_stego.png"` |
| `truncateFilename(name, max)` | Ellipsis-truncate for display |
| `clamp(val, min, max)` | Numeric clamp |
| `cx(...classes)` | Conditional classname concatenation |

---

## 7. Implementation Details

### 7.1 Encryption and Payload Construction (`buildHybridPayload`)

```javascript
async function buildHybridPayload(message, encPublicKey, signPrivateKey) {
  // Step 1: Generate a fresh AES-256-GCM key for this message
  const aesKey = await generateAESKey();

  // Step 2: Encrypt the message with AES-256-GCM
  const { iv, ciphertext } = await encryptMessage(message, aesKey);
  //   iv = 12 random bytes (96-bit)
  //   ciphertext = UTF-8(message) encrypted + 16-byte GCM auth tag appended

  // Step 3: Wrap the AES key with the recipient's public key
  const { encAESKey, ecdh } = await wrapAESKey(aesKey, encPublicKey);
  // For RSA-OAEP:  encAESKey = RSA-OAEP-encrypt(rawAESKeyBytes, recipientPubKey)
  // For ECDH P-256: encAESKey = AES-GCM-encrypt(rawAESKeyBytes, HKDF-derived-key)
  //                 ecdh = { ephemPub, salt, wrapIV }

  // Step 4 (optional): Sign iv ‖ ciphertext ‖ encAESKey
  let signature = null, signAlgoId = null;
  if (signPrivateKey) {
    const toSign = concat(iv, ciphertext, encAESKey);
    signature  = base64(await signData(toSign, signPrivateKey));
    signAlgoId = algoIdFromKey(signPrivateKey);
  }

  // Step 5: Serialize to JSON → UTF-8 bytes
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

### 7.2 Steganography Embedding (`embedData`)

```javascript
function embedData(imageData, payloadBytes, onProgress) {
  // Frame: [4-byte big-endian length][payload bytes]
  const frame = new Uint8Array(4 + payloadBytes.length);
  new DataView(frame.buffer).setUint32(0, payloadBytes.length, false); // big-endian
  frame.set(payloadBytes, 4);

  const newData = new Uint8ClampedArray(imageData.data); // copy — never mutate original

  for (let bitPos = 0; bitPos < frame.length * 8; bitPos++) {
    const pixelIdx   = Math.floor(bitPos / 3);
    const channelIdx = bitPos % 3;                     // R=0, G=1, B=2
    const byteOffset = pixelIdx * 4;                   // RGBA stride

    const byteIndex  = Math.floor(bitPos / 8);
    const bitInByte  = 7 - (bitPos % 8);               // MSB-first
    const bit        = (frame[byteIndex] >> bitInByte) & 1;

    newData[byteOffset + channelIdx] = (newData[byteOffset + channelIdx] & 0xFE) | bit;
    //                                    ↑ clear LSB                          ↑ set LSB
  }

  return new ImageData(newData, imageData.width, imageData.height);
}
```

### 7.3 Extraction (`extractData`)

```javascript
function extractData(imageData) {
  // Step 1: Read 32 bits = 4-byte length header
  const lengthBytes = new Uint8Array(4);
  for (let bitPos = 0; bitPos < 32; bitPos++) {
    const bit       = data[Math.floor(bitPos/3)*4 + (bitPos%3)] & 1;
    const byteIndex = Math.floor(bitPos / 8);
    const bitInByte = 7 - (bitPos % 8);
    if (bit) lengthBytes[byteIndex] |= (1 << bitInByte);
  }
  const payloadLength = new DataView(lengthBytes.buffer).getUint32(0, false);

  // Sanity check: reject clearly invalid lengths
  if (payloadLength < 50 || payloadLength > maxCapacity)
    throw new Error("No valid hidden data found.");

  // Step 2: Read exactly payloadLength bytes starting at bit 32
  const payload   = new Uint8Array(payloadLength);
  const totalBits = (4 + payloadLength) * 8;
  for (let bitPos = 32; bitPos < totalBits; bitPos++) {
    const bit       = data[Math.floor(bitPos/3)*4 + (bitPos%3)] & 1;
    const relBit    = bitPos - 32;
    const byteIndex = Math.floor(relBit / 8);
    const bitInByte = 7 - (relBit % 8);
    if (bit) payload[byteIndex] |= (1 << bitInByte);
  }
  return payload;
}
```

### 7.4 Decryption and Verification (`decryptHybridPayload`)

```javascript
async function decryptHybridPayload(payloadBytes, decPrivateKey, verifyPublicKey) {
  const p = JSON.parse(UTF8.decode(payloadBytes));
  if (p.version !== "3.0") throw new Error("Unsupported payload version");

  const iv        = fromBase64(p.iv);
  const encData   = fromBase64(p.enc_data);
  const encAESKey = fromBase64(p.enc_aes_key);

  // 1. Verify signature BEFORE decrypting (fail fast on tampered payload)
  let signed = false;
  if (p.signature && verifyPublicKey) {
    const toVerify = concat(iv, encData, encAESKey);
    await verifyData(toVerify, fromBase64(p.signature), verifyPublicKey);
    // throws if invalid
    signed = true;
  }

  // 2. Reconstruct ECDH params if applicable
  const ecdhParams = p.ecdh_ephem ? {
    ephemPub: fromBase64(p.ecdh_ephem),
    salt:     fromBase64(p.ecdh_salt),
    wrapIV:   fromBase64(p.ecdh_iv),
  } : null;

  // 3. Unwrap AES key (RSA-OAEP or ECDH)
  const aesKey = await unwrapAESKey(encAESKey, p.enc_algo, decPrivateKey, ecdhParams);

  // 4. AES-256-GCM decrypt (auth tag verified implicitly)
  const message = await decryptMessage(encData, iv, aesKey);

  return { message, signed, encAlgo: p.enc_algo, signAlgo: p.sign_algo };
}
```

---

## 8. Payload Structure (v3.0)

The payload is a JSON object serialized to UTF-8 and embedded in the image's LSBs (after the 4-byte length header). Every field is base64-encoded where bytes are involved.

```json
{
  "version":     "3.0",
  "enc_algo":    "RSA-OAEP" | "ECDH-P-256",
  "sign_algo":   "RSA-PSS"  | "ECDSA-P-256" | null,
  "iv":          "<base64 — 12 bytes, AES-GCM initialization vector>",
  "enc_data":    "<base64 — AES-256-GCM ciphertext + 16-byte GCM auth tag>",
  "enc_aes_key": "<base64 — RSA-OAEP: 256-byte encrypted AES key>
                           | ECDH: AES-GCM-encrypted (32+16 bytes) AES key>",
  "ecdh_ephem":  "<base64 — 65-byte uncompressed P-256 EC point> | null",
  "ecdh_salt":   "<base64 — 32-byte HKDF salt> | null",
  "ecdh_iv":     "<base64 — 12-byte AES-GCM wrap IV> | null",
  "signature":   "<base64 — RSA-PSS: 256 bytes | ECDSA-P-256: 64 bytes> | null"
}
```

**Field descriptions:**

| Field | Bytes (RSA) | Bytes (ECDH) | Purpose |
|---|---|---|---|
| `version` | — | — | Payload format version; guards against format drift |
| `enc_algo` | — | — | Algorithm identifier for key unwrapping |
| `sign_algo` | — | — | Algorithm identifier for signature verification (null = unsigned) |
| `iv` | 12 | 12 | AES-GCM IV for message decryption |
| `enc_data` | msg+16 | msg+16 | AES-256-GCM ciphertext (GCM auth tag appended by Web Crypto) |
| `enc_aes_key` | 256 | 48 | The AES key, wrapped with the recipient's asymmetric key |
| `ecdh_ephem` | null | 65 | Ephemeral EC public key (uncompressed); null for RSA |
| `ecdh_salt` | null | 32 | HKDF salt for key derivation; null for RSA |
| `ecdh_iv` | null | 12 | AES-GCM IV for AES key wrapping; null for RSA |
| `signature` | 256 | 64 | Digital signature over `iv ‖ enc_data ‖ enc_aes_key`; null if unsigned |

**Size overhead:** For a short 50-character message with RSA-OAEP signing, the JSON payload is approximately 1,200–1,400 bytes (primarily dominated by the base64-encoded RSA key and signature). This requires an image of at least 300×300 pixels (≈34 KB) to embed.

---

## 9. Key Management System

### 9.1 Key Generation

The `generateKeyPair(algoId)` function maps algorithm identifiers to Web Crypto parameter objects:

```
"ECDH-P-256"  → { name:"ECDH",    namedCurve:"P-256" }, usages:["deriveBits","deriveKey"]
"RSA-OAEP"    → { name:"RSA-OAEP", modulusLength:2048, publicExponent:[1,0,1], hash:"SHA-256" }
"ECDSA-P-256" → { name:"ECDSA",   namedCurve:"P-256" }, usages:["sign","verify"]
"RSA-PSS"     → { name:"RSA-PSS",  modulusLength:2048, publicExponent:[1,0,1], hash:"SHA-256" }
```

The public exponent `[1, 0, 1]` = 65537 (0x10001) is the standard RSA public exponent — a Fermat prime chosen for efficient modular exponentiation and favorable security properties.

### 9.2 PEM Export

All keys are exported in standard formats:
- **Private keys**: PKCS#8 (DER, then base64-wrapped in `-----BEGIN PRIVATE KEY-----`)
- **Public keys**: SubjectPublicKeyInfo/SPKI (DER, then base64-wrapped in `-----BEGIN PUBLIC KEY-----`)

```javascript
async function exportKeyToPEM(key) {
  const isPrivate = key.type === 'private';
  const format    = isPrivate ? 'pkcs8' : 'spki';
  const label     = isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY';
  const buf       = await crypto.subtle.exportKey(format, key);
  const b64       = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
}
```

### 9.3 Key Fingerprint

Key fingerprints prevent accidental key confusion. They are computed as the first 8 bytes of the SHA-256 hash of the exported key material:

```javascript
async function keyFingerprint(key) {
  const raw  = await crypto.subtle.exportKey(key.type === 'private' ? 'pkcs8' : 'spki', key);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
  // Example: "3a:f1:7c:09:be:41:d5:8c"
}
```

Fingerprints are displayed next to each loaded key in the KeySlot component, enabling the user to verify they have loaded the correct key by comparing fingerprints out-of-band.

### 9.4 Key Distribution Model

StegaVault follows the standard asymmetric key distribution model:

1. **Recipient** generates an encryption key pair (RSA-OAEP or ECDH P-256) and shares their **public key** with the sender.
2. **Sender** optionally generates a signing key pair (RSA-PSS or ECDSA P-256) and shares their **signing public key** with the recipient.
3. **Sender** pastes/loads the recipient's encryption public key and (optionally) their own signing private key, then embeds the message.
4. **Recipient** pastes/loads their decryption private key and (optionally) the sender's signing public key, then extracts the message.

No key server, no PKI, no certificate authority is required. Key exchange is assumed to occur through a separate secure or trusted channel.

---

## 10. Steganalysis — Detection Module

### 10.1 Methodology

The detection module implements the statistical steganalysis approach described by Westfeld and Pfitzmann (2000) and extended with a spatial transition analysis. The three tests operate independently on the raw RGBA pixel buffer, and their boolean votes are combined through majority voting.

This multi-test design avoids the false-positive rate of single-test detection:
- Naturally high-entropy images (e.g., photographs with film grain, QR codes, already-compressed JPEGs) may trip one test but rarely all three.
- A genuine stego image will trip all three simultaneously.

### 10.2 Test Characteristics and Thresholds

| Test | Score range | Flag threshold | Sensitivity | Limitation |
|---|---|---|---|---|
| Chi-square pair | 0.0 – 1.0 | > 0.72 | High for >20% fill | May flag JPEG-recompressed images |
| Histogram uniformity | 0.0 – 1.0 | > 0.70 | Very high when message fills >30% of capacity | Low sensitivity at very low fill rates |
| LSB entropy | 0.0 – 1.0 | > 0.65 | Good for random-looking payloads | Natural noise images (film grain) may score high |

### 10.3 Combined Score Weighting

The weighted probability (display only, not used for verdict):
```
P = 0.45 × χ² score + 0.35 × histogram score + 0.20 × entropy score
```

The chi-square test carries the highest weight (0.45) because it is the most theoretically grounded test for LSB substitution and has the lowest false-positive rate on natural photographic content.

### 10.4 Heatmap Visualization

The chi-square score is computed per 16×16 pixel block, giving a spatial map of suspicious regions. This is particularly informative because sequential LSB substitution fills the image from top-left to bottom-right — so for a partially filled image, the top portion of the heatmap will appear red/yellow while the bottom remains green, creating a characteristic "filled region" visual signature.

---

## 11. Results and Output

### 11.1 Embed Workflow — Step by Step

1. User drags a cover image (PNG, JPEG, WebP, or BMP) onto the FileDropzone.
2. System displays image dimensions and maximum payload capacity (e.g., "Max 759 KB payload" for a 1920×1080 image).
3. User types or pastes the secret message.
4. User loads the recipient's encryption public key (paste PEM or upload `.pem` file). System shows algorithm ID and fingerprint.
5. (Optional) User loads their signing private key.
6. User clicks "Encrypt & Embed". A progress bar tracks: Loading image (5%) → AES encrypt (15%) → Key wrap (25%) → Sign (30%) → LSB embed (35–85%) → PNG encode (88%) → Save history (95%) → Done (100%).
7. System displays an "Embedding Successful" card with the output filename, file size, and whether the payload was signed.
8. A metadata report shows: image dimensions, bits used, total capacity, payload density (%), message byte count, total payload bytes, and signing status.
9. User clicks "Download PNG" to save the stego image.

### 11.2 Decrypt Workflow — Step by Step

1. User uploads the stego PNG.
2. User loads their decryption private key.
3. (Optional) User loads the sender's signing public key.
4. User clicks "Extract & Decrypt". Progress tracks: Load image → Extract payload → Verify signature → Unwrap AES key → AES decrypt.
5. System displays:
   - "Extraction Successful" with "AES-256-GCM auth tag verified · RSA-OAEP key unwrapped"
   - Signature status card: green "Signature Verified" with algorithm name, or yellow "Signature Not Verified" with a note that authenticity is unconfirmed
   - The decrypted plaintext in a monospace textarea with a Copy button
   - Extraction metadata: image dimensions, message length, encryption algorithm, signing algorithm

### 11.3 Detect Workflow — Step by Step

1. User uploads any image.
2. System runs all three steganalysis tests and generates the block-level heatmap.
3. Results panel shows:
   - A semicircular gauge showing overall stego probability (0–100%)
   - Three test result bars (Chi-square, Histogram, Entropy) with score and flag indicator
   - A color-coded verdict chip: "CLEAN" (green) / "LIKELY STEGO" (red/orange)
   - A heatmap canvas overlay on the image (green=clean, yellow=moderate, red=suspicious blocks)
4. Operation is logged to history with metadata (probability, verdict, image dimensions).

---

## 12. Advantages

### 12.1 Security Strength

- **Two-layer protection**: encryption ensures confidentiality even if the image is identified as a carrier; steganography ensures the communication is not flagged in transit.
- **Authenticated encryption**: AES-256-GCM's authentication tag provides integrity guarantees — any bit-flip in the ciphertext is detected, not silently accepted.
- **Forward secrecy** (ECDH mode): ephemeral ECDH key pairs ensure that compromise of long-term keys does not expose past messages.
- **Non-repudiation** (when signed): RSA-PSS and ECDSA signatures provide cryptographic proof of origin.
- **No key storage**: private keys never touch persistent storage — they exist only as `CryptoKey` objects in browser memory for the duration of the session.

### 12.2 Modularity and Maintainability

The three core engines (`cryptoEngine.js`, `stegoEngine.js`, `steganalysis.js`) are completely independent modules with no cross-dependencies. Each exports a clean functional API consumed by the UI modules. This makes each component independently testable and replaceable.

### 12.3 Hybrid Encryption Strength

The hybrid model (AES-256-GCM + RSA-OAEP or ECDH) is the same pattern used in TLS 1.3, Signal Protocol, and PGP/GPG. It combines:
- AES-256-GCM: constant-time, hardware-accelerated, unlimited message length
- RSA-OAEP 2048 / ECDH P-256: standardized, peer-reviewed, quantum-resistant work in progress

### 12.4 Zero External Dependencies (Cryptographic)

All cryptographic operations use the browser's native `crypto.subtle` interface, which:
- Is implemented in native code within the browser engine (V8/SpiderMonkey)
- Is hardware-accelerated via AES-NI on modern CPUs
- Is audited by browser security teams at Google, Mozilla, and Apple
- Cannot be compromised by a supply-chain attack on an npm dependency

### 12.5 Algorithm Agility

Supporting both RSA and ECDH/ECDSA means users can choose between the widely deployed RSA infrastructure and the more modern elliptic-curve approach, or upgrade from one to the other without changes to the UI or payload format.

---

## 13. Limitations

### 13.1 Payload Size Constraints

The maximum embeddable payload is determined by the cover image dimensions:

```
capacity = floor(W × H × 3 / 8) − 4   bytes
```

For a 500×500 pixel image, capacity is only ~93 KB — sufficient for most text messages, but insufficient for binary files or very long documents. Users with small cover images may encounter "Payload too large" errors.

The minimum practical cover image for the RSA-OAEP payload format (≈1,200 bytes overhead) is approximately 80×80 pixels.

### 13.2 JPEG Input Limitation

While the system accepts JPEG and WebP input files, these are immediately decoded to raw pixel data via the Canvas API and re-encoded as PNG on output. This means:
- The output is always PNG (larger than a JPEG of the same image)
- JPEG artifacts in the original image do not affect the embedded payload
- However, if a recipient attempts to re-save or re-compress the output PNG as a JPEG before distribution, the embedded payload will be permanently destroyed

The system warns: *"Output saved as lossless PNG to preserve embedded bits. Share securely."*

### 13.3 Detection by Advanced Steganalysis

Sequential LSB substitution is well-studied and detectable by the statistical tests implemented in the detection module itself, particularly at high fill densities. A sophisticated adversary using more advanced steganalysis tools (e.g., SRM — Spatial Rich Model, or deep learning detectors) could achieve higher detection accuracy than the built-in tests.

### 13.4 Browser Memory Limits

Very large images (e.g., 8000×6000 pixels ≈ 192 MB of raw RGBA pixel data) may cause browser memory pressure or tab crashes on low-memory devices, since the pixel buffer must be manipulated in RAM.

### 13.5 No Symmetric-Key Mode

The system requires asymmetric key exchange and does not support password-based symmetric encryption. While this provides stronger security properties, it also means that two parties must exchange PEM keys before they can communicate, which may be impractical in some use cases.

---

## 14. Future Enhancements

### 14.1 Advanced Steganography Algorithms

- **DCT-domain steganography (F5 or OutGuess)**: embed data in JPEG DCT coefficients rather than spatial LSBs. This is significantly more resistant to statistical detection and allows JPEG output without payload destruction.
- **DWT-domain steganography**: embed in discrete wavelet transform coefficients for even higher imperceptibility in photographic content.
- **Adaptive LSB**: prioritize embedding in high-texture regions (edges, noise) where LSB changes are less statistically anomalous, reducing detectability.

### 14.2 Video and Audio Steganography

Extend the engine to support:
- **WAV audio**: LSB substitution in audio samples (imperceptible at low fill rates given 16-bit sample depth)
- **MP4 frames**: embed in individual video frames, with the payload distributed across frames to reduce per-frame density

### 14.3 Improved Steganalysis

- **Machine learning detector**: train a convolutional neural network on pairs of clean/stego images to replace or supplement the statistical tests.
- **WS (Weighted Stego) detector**: a more sophisticated spatial-domain detector that estimates the embedding rate rather than producing a binary flag.
- **Calibration**: implement the JPEG calibration technique for more accurate chi-square results on JPEG-derived images.

### 14.4 File Payloads

Support embedding arbitrary binary files (PDFs, images, archives) rather than only text messages, by treating the file bytes as the raw payload and encoding them directly before the JSON wrapper.

### 14.5 Network-Independent Key Exchange

A QR-code-based key exchange mechanism would allow two parties to exchange public keys by scanning a QR code in person, eliminating the need for any digital channel for the initial key establishment.

### 14.6 Post-Quantum Cryptography

NIST finalized its first post-quantum cryptography standards (CRYSTALS-Kyber for key encapsulation, CRYSTALS-Dilithium for signatures) in 2024. Replacing RSA-OAEP and ECDH with these algorithms would protect against future large-scale quantum computers. Currently the Web Crypto API does not expose these algorithms; a WebAssembly port of liboqs would be required.

### 14.7 Server-Side Mode (Optional)

An optional server-side processing mode could handle very large images without browser memory constraints, using Node.js with the `node:crypto` module (which exposes the same Web Crypto API). All key material would remain client-side; only the pixel data would be sent for processing.

---

## 15. Conclusion

StegaVault Lite+ demonstrates that production-quality hybrid cryptographic steganography is achievable entirely within the browser, using only W3C-standardized APIs and without any external cryptographic dependencies. The system delivers:

- **Strong confidentiality**: AES-256-GCM with a per-message random key ensures that even if a stego image is detected, the payload remains computationally infeasible to decrypt.
- **Flexible key exchange**: support for both RSA-OAEP (direct key wrap) and ECDH P-256 (forward-secret key agreement) addresses different threat models and key infrastructure realities.
- **Optional authenticity**: RSA-PSS and ECDSA signatures provide non-repudiable sender authentication.
- **Real-world imperceptibility**: sequential LSB substitution with MSB-first bit ordering produces no visible artifacts in the cover image.
- **Adversarial awareness**: the integrated steganalysis module, grounded in the same statistical theory that real detection tools use, gives the system designer a realistic view of its own detectability.

The clean modular architecture, the zero-dependency cryptographic layer, and the zero-knowledge storage model collectively make StegaVault a technically sound, practical, and educationally instructive demonstration of the intersection between modern cryptography and information hiding.

---

## 16. References

1. **Westfeld, A. & Pfitzmann, A.** (2000). *Attacks on Steganographic Systems*. International Workshop on Information Hiding, Springer. (Foundation of the chi-square and histogram steganalysis tests implemented in this project.)

2. **NIST FIPS 197** (2001). *Advanced Encryption Standard (AES)*. National Institute of Standards and Technology. https://doi.org/10.6028/NIST.FIPS.197

3. **NIST SP 800-38D** (2007). *Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC*. National Institute of Standards and Technology.

4. **NIST SP 800-56A Rev.3** (2018). *Recommendation for Pair-Wise Key-Establishment Schemes Using Discrete Logarithm Cryptography (ECDH)*. National Institute of Standards and Technology.

5. **NIST FIPS 186-5** (2023). *Digital Signature Standard (DSS)* — covers RSA-PSS and ECDSA. National Institute of Standards and Technology.

6. **RFC 8017** (2016). *PKCS #1: RSA Cryptography Specifications Version 2.2* — RSA-OAEP and RSA-PSS specifications. IETF.

7. **RFC 5869** (2010). *HMAC-based Extract-and-Expand Key Derivation Function (HKDF)*. IETF.

8. **W3C Web Cryptography API** (2017). *W3C Recommendation*. https://www.w3.org/TR/WebCryptoAPI/ — The normative specification for all `crypto.subtle` operations used in this project.

9. **Kerckhoffs's Principle** (1883). *La cryptographie militaire*. Journal des Sciences Militaires. (The principle that security must derive from key secrecy, not algorithm obscurity — followed throughout this design.)

10. **Provos, N. & Honeyman, P.** (2003). *Hide and Seek: An Introduction to Steganography*. IEEE Security & Privacy, 1(3), 32–44.

11. **Fridrich, J., Goljan, M. & Du, R.** (2001). *Reliable Detection of LSB Steganography in Color and Grayscale Images*. Proceedings of the ACM Workshop on Multimedia and Security.

12. **React 18 Documentation**. https://react.dev/ — Component model and hooks API used throughout the dashboard.

13. **Vite 5 Documentation**. https://vitejs.dev/ — Build tool and development server.

14. **Tailwind CSS v3 Documentation**. https://tailwindcss.com/ — Utility-first CSS framework used for the UI.

---

*This report was generated from the StegaVault v3.0 source code. All code snippets are derived directly from the production implementation. April 2026.*
