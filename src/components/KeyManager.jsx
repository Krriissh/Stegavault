import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Download, Upload, RefreshCw, CheckCircle, AlertCircle, Shield, Lock, X, ChevronDown } from 'lucide-react';

import {
  generateKeyPair,
  exportKeyToPEM,
  importAnyKey,
  keyFingerprint,
  ENCRYPTION_ALGOS,
  SIGNING_ALGOS,
} from '../core/crypto/cryptoEngine.js';
import { downloadBlob } from '../utils/helpers.js';

// ─── KeySlot: paste or upload any PEM ────────────────────────────────────────

/**
 * A labelled PEM text area.  Algorithm is auto-detected from the key bytes.
 *
 * Props:
 *   label        string
 *   usage        'encrypt' | 'decrypt' | 'sign' | 'verify'
 *   onKey        (CryptoKey|null, algoId:string|null) => void
 *   accentColor  'green' | 'blue' | 'yellow' | 'purple'
 *   optional     boolean
 */
function KeySlot({ label, usage, onKey, accentColor = 'green', optional = false }) {
  const [pemText, setPemText]         = useState('');
  const [status, setStatus]           = useState('idle');   // idle | loading | ok | error
  const [info, setInfo]               = useState('');       // fingerprint + algo label
  const [errorMsg, setErrorMsg]       = useState('');
  const fileRef = useRef(null);

  const colorText = `text-cyber-${accentColor}`;
  const isPrivate = usage === 'decrypt' || usage === 'sign';

  const parsePEM = async (pem) => {
    const trimmed = pem.trim();
    if (!trimmed) {
      setStatus('idle'); setInfo(''); setErrorMsg(''); onKey(null, null);
      return;
    }
    setStatus('loading'); setErrorMsg('');
    try {
      // Sanity-check public/private direction before trying algorithms
      const keyIsPrivate = trimmed.includes('PRIVATE KEY');
      if (!isPrivate && keyIsPrivate)  throw new Error('Expected a public key but got a private key.');
      if (isPrivate  && !keyIsPrivate) throw new Error('Expected a private key but got a public key.');

      const { key, algoId } = await importAnyKey(trimmed, usage);
      const fp = await keyFingerprint(key);
      setInfo(`${algoId}  ·  ${fp}`);
      setStatus('ok');
      onKey(key, algoId);
    } catch (err) {
      setStatus('error'); setErrorMsg(err.message); onKey(null, null);
    }
  };

  const handleChange = (e) => { setPemText(e.target.value); parsePEM(e.target.value); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPemText(text.trim());
    await parsePEM(text);
    e.target.value = '';
  };

  const clear = () => {
    setPemText(''); setStatus('idle'); setInfo(''); setErrorMsg(''); onKey(null, null);
  };

  const borderColor =
    status === 'ok'    ? 'border-cyber-green/50' :
    status === 'error' ? 'border-cyber-red/40'   :
    `border-cyber-border`;

  const placeholder = isPrivate
    ? `-----BEGIN PRIVATE KEY-----\n…paste any private key PEM, or use ↑ to load a file\n-----END PRIVATE KEY-----`
    : `-----BEGIN PUBLIC KEY-----\n…paste any public key PEM, or use ↑ to load a file\n-----END PUBLIC KEY-----`;

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-display tracking-wider uppercase ${colorText}`}>
          {label}
          {optional && <span className="text-cyber-muted ml-1">(optional)</span>}
        </p>
        <div className="flex items-center gap-2">
          {status === 'ok'    && <CheckCircle className="w-3.5 h-3.5 text-cyber-green" />}
          {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-cyber-red"   />}
          <button onClick={() => fileRef.current?.click()} title="Load from file"
            className="text-cyber-muted hover:text-cyber-text transition-colors">
            <Upload className="w-3.5 h-3.5" />
          </button>
          {pemText && (
            <button onClick={clear} title="Clear"
              className="text-cyber-muted hover:text-cyber-red transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PEM textarea */}
      <div className={`relative rounded-lg border ${borderColor} transition-colors bg-black/20`}>
        <textarea
          rows={4}
          spellCheck={false}
          className="w-full bg-transparent text-[9px] font-mono text-cyber-text placeholder:text-cyber-muted/30 px-3 py-2 resize-none outline-none leading-relaxed"
          placeholder={placeholder}
          value={pemText}
          onChange={handleChange}
        />
        {status === 'loading' && (
          <RefreshCw className="absolute right-2 top-2 w-3 h-3 text-cyber-muted animate-spin" />
        )}
      </div>

      {/* Status line */}
      {status === 'ok' && (
        <p className="text-[9px] font-mono text-cyber-green truncate">{info}</p>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-[9px] font-mono text-cyber-red leading-relaxed">{errorMsg}</p>
      )}

      <input ref={fileRef} type="file" accept=".pem,.key,.txt" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── KeyGeneratorPanel ────────────────────────────────────────────────────────

function KeyGeneratorPanel({ type, onClose }) {
  const algos  = type === 'encryption' ? ENCRYPTION_ALGOS : SIGNING_ALGOS;
  const color  = type === 'encryption' ? 'blue' : 'yellow';

  const [algoId, setAlgoId]   = useState(algos[0].id);
  const [status, setStatus]   = useState('idle');
  const [pubPEM, setPubPEM]   = useState('');
  const [privPEM, setPrivPEM] = useState('');
  const [error, setError]     = useState('');

  const generate = async () => {
    setStatus('generating'); setError('');
    try {
      const kp   = await generateKeyPair(algoId);
      const pub  = await exportKeyToPEM(kp.publicKey);
      const priv = await exportKeyToPEM(kp.privateKey);
      setPubPEM(pub); setPrivPEM(priv); setStatus('done');
    } catch (e) {
      setError(e.message); setStatus('idle');
    }
  };

  const dl = (pem, suffix) => {
    const blob = new Blob([pem], { type: 'application/x-pem-file' });
    downloadBlob(blob, `stegavault_${algoId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${suffix}.pem`);
  };

  const selectedAlgo = algos.find(a => a.id === algoId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-display font-bold text-cyber-${color} capitalize`}>
          Generate {type} Key Pair
        </p>
        <button onClick={onClose} className="text-cyber-muted hover:text-cyber-text text-[10px] font-mono">
          ✕ close
        </button>
      </div>

      {/* Algorithm selector */}
      <div className="relative">
        <select
          value={algoId}
          onChange={e => { setAlgoId(e.target.value); setStatus('idle'); setPubPEM(''); setPrivPEM(''); }}
          className="w-full bg-black/40 border border-cyber-border rounded-lg px-3 py-2 text-[11px] font-mono text-cyber-text outline-none appearance-none pr-8"
        >
          {algos.map(a => (
            <option key={a.id} value={a.id}>{a.label}  —  {a.note}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyber-muted pointer-events-none" />
      </div>

      {status !== 'done' ? (
        <button
          onClick={generate}
          disabled={status === 'generating'}
          className={`btn-secondary w-full py-2 text-[11px] flex items-center justify-center gap-2 text-cyber-${color} border-cyber-${color}/30 hover:bg-cyber-${color}/10`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status === 'generating' ? 'animate-spin' : ''}`} />
          {status === 'generating' ? 'Generating…' : `Generate ${selectedAlgo?.label ?? ''}`}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-lg border border-cyber-green/20 p-3 space-y-1">
            <p className="text-[9px] font-mono text-cyber-green uppercase tracking-widest">Key pair generated · {algoId}</p>
            <p className="text-[9px] font-mono text-cyber-muted">
              ⚠ Store the private key securely. Share only the public key.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => dl(pubPEM, 'public')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono py-2 rounded-lg border border-cyber-${color}/30 text-cyber-${color} hover:bg-cyber-${color}/10 transition-colors`}>
              <Download className="w-3 h-3" /> Public Key
            </button>
            <button onClick={() => dl(privPEM, 'private')}
              className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono py-2 rounded-lg border border-cyber-red/30 text-cyber-red hover:bg-cyber-red/10 transition-colors">
              <Download className="w-3 h-3" /> Private Key
            </button>
          </div>
          <button onClick={generate}
            className="w-full text-[9px] font-mono text-cyber-muted hover:text-cyber-text transition-colors">
            Regenerate
          </button>
        </div>
      )}
      {error && <p className="text-[10px] text-cyber-red font-mono">{error}</p>}
    </div>
  );
}

// ─── Main KeyManager ──────────────────────────────────────────────────────────

/**
 * Asymmetric key management panel.
 *
 * Props:
 *   mode    'encrypt' | 'decrypt'
 *   onKeys  ({ encPublicKey?, signPrivateKey?, decPrivateKey?, verifyPublicKey? }) => void
 *
 * Any supported algorithm can be pasted or loaded — RSA-OAEP, ECDH P-256
 * for encryption; RSA-PSS, ECDSA P-256 for signing. Algorithm is detected
 * automatically from the key bytes.
 */
export default function KeyManager({ mode = 'encrypt', onKeys }) {
  const [generator, setGenerator] = useState(null);  // null | 'encryption' | 'signing'
  const [keys, setKeys]           = useState({});

  const updateKey = (role, key) => {
    const updated = { ...keys, [role]: key };
    setKeys(updated);
    onKeys(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-cyber-green" />
          <p className="section-label mb-0">Asymmetric Key Management</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setGenerator(g => g === 'encryption' ? null : 'encryption')}
            className="text-[9px] font-mono text-cyber-blue hover:text-cyber-text transition-colors px-2 py-1 rounded border border-cyber-border hover:border-cyber-blue/30"
          >
            + Enc Key
          </button>
          <button
            onClick={() => setGenerator(g => g === 'signing' ? null : 'signing')}
            className="text-[9px] font-mono text-cyber-yellow hover:text-cyber-text transition-colors px-2 py-1 rounded border border-cyber-border hover:border-cyber-yellow/30"
          >
            + Sign Key
          </button>
        </div>
      </div>

      {/* Generator panel */}
      <AnimatePresence>
        {generator && (
          <motion.div
            key={generator}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-black/20 border border-cyber-border rounded-lg p-3">
              <KeyGeneratorPanel type={generator} onClose={() => setGenerator(null)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key slots — encrypt mode */}
      {mode === 'encrypt' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[9px] font-mono text-cyber-muted">
            <Lock className="w-3 h-3" />
            <span>Paste or load keys — any supported algorithm is accepted</span>
          </div>
          <KeySlot
            label="Recipient's Encryption Public Key"
            usage="encrypt"
            onKey={k => updateKey('encPublicKey', k)}
            accentColor="blue"
          />
          <KeySlot
            label="Your Signing Private Key"
            usage="sign"
            onKey={k => updateKey('signPrivateKey', k)}
            accentColor="yellow"
            optional
          />
        </div>
      )}

      {/* Key slots — decrypt mode */}
      {mode === 'decrypt' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[9px] font-mono text-cyber-muted">
            <Shield className="w-3 h-3" />
            <span>Paste or load keys — algorithm detected automatically</span>
          </div>
          <KeySlot
            label="Your Decryption Private Key"
            usage="decrypt"
            onKey={k => updateKey('decPrivateKey', k)}
            accentColor="green"
          />
          <KeySlot
            label="Sender's Verification Public Key"
            usage="verify"
            onKey={k => updateKey('verifyPublicKey', k)}
            accentColor="purple"
            optional
          />
        </div>
      )}

      {/* Info bar */}
      <div className="bg-black/20 rounded-lg border border-cyber-border p-3 space-y-1">
        <p className="text-[9px] font-mono text-cyber-muted">
          <span className="text-cyber-blue">Enc:</span> RSA-OAEP 2048 · ECDH P-256
        </p>
        <p className="text-[9px] font-mono text-cyber-muted">
          <span className="text-cyber-yellow">Sign:</span> RSA-PSS 2048 · ECDSA P-256
        </p>
        <p className="text-[9px] font-mono text-cyber-muted">
          Algorithm auto-detected · fingerprint shown · key never stored
        </p>
      </div>
    </div>
  );
}
