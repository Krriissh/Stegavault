# StegaVault

A secure steganography dashboard that hides encrypted messages inside images using hybrid cryptography and LSB steganography — all in the browser, zero server, zero data retention.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss) ![Web Crypto](https://img.shields.io/badge/WebCrypto-AES--256--GCM-green)

---

## What it does

1. **Encrypt & Embed** — Type a secret message, load the recipient's public key, and StegaVault encrypts it and hides it inside a PNG image. The output looks like a normal image.
2. **Extract & Decrypt** — Load a stego image and your private key to recover the original message.
3. **Detect** — Run steganalysis on any image to check if it likely contains hidden data.
4. **History** — Browse past operations stored locally in IndexedDB.

---

## Cryptography

| Layer | Algorithm | Details |
|---|---|---|
| Symmetric encryption | AES-256-GCM | Random 96-bit IV + 128-bit auth tag per message |
| Key wrap (RSA) | RSA-OAEP 2048 | Direct AES key wrap |
| Key wrap (EC) | ECDH P-256 | Ephemeral key pair + HKDF-SHA-256 → AES-GCM wrap |
| Digital signature | RSA-PSS 2048 | Optional; signs `iv ‖ enc_data ‖ enc_aes_key` |
| Digital signature | ECDSA P-256 | Optional; SHA-256 |

All operations use the browser's native **Web Crypto API**. No external crypto libraries.

---

## Steganography

- **Algorithm**: LSB (Least Significant Bit) substitution — RGB channels, PNG output
- **Adaptive mode**: Pixels sorted by local luma variance; edges and textures used first, reducing statistical detectability
- **2-bit mode**: 2 bits per channel (doubles capacity, max ±3 value change per channel)
- **Frame format v3**: `[0x53 magic][flags][4B length][payload][4B CRC-32]` — 10 bytes overhead
- **Capacity**: ~37 KB per megapixel (1-bit mode)

---

## Steganalysis

Three independent tests with majority voting (≥ 2/3 → "Likely Stego"):

| Test | What it measures |
|---|---|
| Chi-square | Pair equalization in LSB channel pairs |
| Histogram uniformity | LSB-1 ratio deviation from 50% |
| LSB-plane entropy | Horizontal LSB transition rate |

---

## Stack

- React 18 + Vite 5
- Tailwind CSS 3 (custom cyber theme)
- Framer Motion 11
- Lucide React
- IndexedDB (local history, no server)

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build → dist/
```

---

## Key formats

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

## Security notes

- Keys are never stored — loaded into memory for the operation only
- All crypto runs client-side; nothing leaves the browser
- Output is always lossless PNG to preserve embedded bits exactly
- Signing is optional at embed time; the recipient is warned if the payload is unsigned

---

## License

MIT
