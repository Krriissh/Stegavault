# StegaVault

A secure steganography dashboard that hides encrypted messages inside images and QR codes — all in the browser, zero server, zero data retention.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss) ![Web Crypto](https://img.shields.io/badge/WebCrypto-AES--256--GCM-green) ![QR](https://img.shields.io/badge/StegaQR-v1.0-purple)

---

## Modules

### 1. Encrypt & Embed
Encrypt a secret message with hybrid cryptography (AES-256-GCM + RSA-OAEP or ECDH P-256) and hide it inside any PNG/JPG/WEBP cover image using LSB steganography. Output is always a lossless PNG.

### 2. Decrypt & Extract
Load a stego PNG, supply your private decryption key (and optionally the sender's signing public key), and recover the original message.

### 3. StegaQR
Generate a QR code that encodes a visible decoy URL and secretly hides an AES-256-GCM encrypted message in the QR's safe data modules. The QR is fully scannable — standard QR readers see only the decoy URL.

**How it works:**
- Payload is AES-256-GCM encrypted with a password-derived key (PBKDF2-SHA-256, 100k iterations)
- A separate PBKDF2 derivation produces the stego key that controls embedding positions
- An AES-CTR PRNG shuffles embedding positions — an observer without the password cannot determine where bits are hidden
- Every unused safe-pixel LSB is filled with cryptographically random noise, making the LSB histogram uniform (defeats chi-square, RS analysis, and sample-pair attacks)
- Structural QR regions (finder patterns, timing patterns, alignment patterns, format/version information) are never modified

### 4. Steganalysis
Run three independent statistical tests against any image to estimate whether it contains hidden data:
- **Chi-square** — LSB pair equalization
- **Histogram uniformity** — LSB=1 ratio deviation from 50%
- **LSB-plane entropy** — horizontal LSB transition rate

Results combined by majority voting (≥ 2/3 → "Likely Stego"). Includes a per-block chi-square heatmap overlay.

### 5. History
Browse all past operations stored locally in IndexedDB. Download saved stego output blobs. No sensitive data (keys, plaintext) is ever stored.

---

## Cryptography

| Layer | Algorithm | Details |
|---|---|---|
| Symmetric encryption | AES-256-GCM | Random 96-bit IV + 128-bit auth tag per message |
| Key wrap (RSA) | RSA-OAEP 2048 | Direct AES key wrap |
| Key wrap (EC) | ECDH P-256 | Ephemeral ECDH + HKDF-SHA-256 → AES-GCM wrap |
| Digital signature | RSA-PSS 2048 | Optional; signs `iv ‖ enc_data ‖ enc_aes_key` |
| Digital signature | ECDSA P-256 | Optional; SHA-256 |
| StegaQR encryption | AES-256-GCM | Password → PBKDF2 → AES key (salt: `StegaQR-v1.0-mkey`) |
| StegaQR position shuffle | AES-128-CTR | Password → PBKDF2 → stego key (salt: `StegaQR-v1.0-skey`) |

All operations use the browser's native **Web Crypto API**. No external crypto libraries.

---

## Steganography

### Image LSB (Encrypt & Embed module)
- **Algorithm**: Sequential LSB substitution — RGB channels, PNG output
- **Frame format**: `[4B big-endian length][JSON payload bytes]`
- **Capacity**: `floor(W × H × 3 / 8) − 4` bytes (~759 KB per 1080p image)

### QR Steganography (StegaQR module)
- **Safe-region masking**: finder patterns, timing patterns, alignment patterns, format/version info blocks are never touched
- **Rendering contract**: `MODULE_SCALE = 10 px/module`, `QUIET_ZONE = 4 modules` — fixed constants baked into both embed and extract. The output image width encodes the QR version; extraction is self-describing from dimensions alone
- **Frame format**: `[4B magic "SQRP"][4B compressed length][deflate-raw compressed payload]`
- **Compression**: deflate-raw via Compression Streams API before embedding (smaller payload + uniform bit entropy)
- **Noise mimicry**: all unused safe-pixel LSBs randomized after embedding

---

## Steganalysis

Three independent tests, majority voting:

| Test | What it measures | Flag threshold |
|---|---|---|
| Chi-square | LSB pair equalization across R/G/B histograms | score > 0.72 |
| Histogram uniformity | LSB=1 ratio deviation from 50% | score > 0.70 |
| LSB-plane entropy | Horizontal LSB transition rate | score > 0.65 |

---

## Stack

- React 18 + Vite 5
- Tailwind CSS 3 (custom cyber theme)
- Framer Motion 11
- Lucide React
- `qrcode` v1.5.4 (QR generation)
- IndexedDB (local history, no server)

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build → dist/
```

---

## Key formats (Encrypt & Embed / Decrypt & Extract)

StegaVault accepts standard PEM keys. Generate them in-app (Key Manager panel) or use OpenSSL:

```bash
# RSA-OAEP 2048
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -in private.pem -pubout -out public.pem

# ECDH / ECDSA P-256
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out ec_private.pem
openssl ec -in ec_private.pem -pubout -out ec_public.pem
```

Algorithm is auto-detected from the key bytes — no manual selection needed.

---

## StegaQR password notes

- One password drives both encryption and position shuffle (via two independent PBKDF2 derivations with different salts)
- Share the password out-of-band (voice, Signal, in person)
- **Do not resize or re-encode the output PNG** — the image dimensions encode the QR version and must be preserved exactly

---

## Security model

| Scenario | Result |
|---|---|
| Adversary sees the QR image | Scans decoy URL; no indication of hidden payload |
| Adversary runs steganalysis | LSB histogram is uniform (noise mimicry); no statistical signal |
| Adversary knows the stego password | Knows where bits are hidden; payload content still protected by AES-256-GCM |
| Adversary knows both the password and the image | Can extract and decrypt the message |

Zero-knowledge: no keys, no plaintext, no session data ever leaves the browser.

---

## License

MIT
