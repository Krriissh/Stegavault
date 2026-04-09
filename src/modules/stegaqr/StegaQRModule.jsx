import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Download, Eye, EyeOff, AlertCircle, CheckCircle,
  Lock, Unlock, RefreshCw, Info, ChevronDown,
} from 'lucide-react';

import ProgressBar  from '../../components/ProgressBar.jsx';
import MetadataCard from '../../components/MetadataCard.jsx';
import FileDropzone from '../../components/FileDropzone.jsx';

import { loadImageFile, imageDataToPngBlob } from '../../core/stego/stegoEngine.js';
import {
  deriveStegaKey, calcEmbedCapacity, embedInQR, extractFromQR,
  encryptQRPayload, decryptQRPayload,
} from '../../core/stego/qrStegoEngine.js';
import { downloadBlob, formatBytes } from '../../utils/helpers.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const EC_LEVELS = [
  { id: 'L', label: 'L – Low (7%)',       note: 'Max capacity, lower redundancy' },
  { id: 'M', label: 'M – Medium (15%)',   note: 'Good balance'                  },
  { id: 'Q', label: 'Q – Quartile (25%)', note: 'Recommended for printing'      },
  { id: 'H', label: 'H – High (30%)',     note: 'Maximum redundancy (default)'  },
];

const STATUS = { idle: 'idle', deriving: 'deriving', processing: 'processing', done: 'done', error: 'error' };

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 p-3 rounded-lg border bg-cyber-red/10 border-cyber-red/30 text-cyber-red text-[11px] font-mono leading-relaxed"
    >
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}

function PasswordInput({ label, value, onChange, placeholder, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display tracking-wider uppercase text-cyber-purple">{label}</p>
        <button type="button" onClick={() => setShow(s => !s)} className="text-cyber-muted hover:text-cyber-text transition-colors">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Enter password…'}
        className="input-cyber w-full text-[11px] font-mono"
        autoComplete="off"
        spellCheck={false}
      />
      {hint && <p className="text-[9px] font-mono text-cyber-muted">{hint}</p>}
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const [decoyUrl,      setDecoyUrl]      = useState('');
  const [message,       setMessage]       = useState('');
  const [ecLevel,       setEcLevel]       = useState('H');
  const [password,      setPassword]      = useState('');
  const [status,        setStatus]        = useState(STATUS.idle);
  const [progress,      setProgress]      = useState(0);
  const [progressMsg,   setProgressMsg]   = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [result,        setResult]        = useState(null);
  const [capacityInfo,  setCapacityInfo]  = useState(null);
  const [showCapacity,  setShowCapacity]  = useState(false);
  const previewUrlRef = useRef(null);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);

  useEffect(() => {
    if (!decoyUrl.trim()) { setCapacityInfo(null); return; }
    let cancelled = false;
    calcEmbedCapacity(decoyUrl, ecLevel)
      .then(info => { if (!cancelled) setCapacityInfo(info); })
      .catch(() => { if (!cancelled) setCapacityInfo(null); });
    return () => { cancelled = true; };
  }, [decoyUrl, ecLevel]);

  const handleGenerate = async () => {
    setErrorMsg(''); setResult(null);
    if (!decoyUrl.trim()) return setErrorMsg('Decoy URL is required.');
    if (!message.trim())  return setErrorMsg('Secret message is required.');
    if (!password.trim()) return setErrorMsg('Password is required (min 8 chars recommended).');

    setStatus(STATUS.deriving); setProgress(3);

    try {
      // 1. Derive both keys in parallel (same PBKDF2 cost, different salts)
      setProgressMsg('Deriving keys (PBKDF2-SHA-256, 100k rounds)…');
      const [stegoKey, payloadBytes] = await Promise.all([
        deriveStegaKey(password),
        encryptQRPayload(message, password),
      ]);
      setProgress(20);

      // 2. Embed into QR
      setStatus(STATUS.processing);
      setProgressMsg('Rendering QR · building safe mask · shuffling positions…');
      const { imageData, stats } = await embedInQR(decoyUrl, payloadBytes, stegoKey, {
        ecLevel,
        onProgress: pct => setProgress(20 + Math.round(pct * 0.75)),
      });
      setProgress(96);

      // 3. Encode PNG
      setProgressMsg('Encoding PNG…');
      const blob = await imageDataToPngBlob(imageData);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;

      setResult({ blob, stats, previewUrl });
      setProgress(100); setStatus(STATUS.done); setProgressMsg('');
    } catch (err) {
      setErrorMsg(err.message); setStatus(STATUS.error); setProgress(0); setProgressMsg('');
    }
  };

  const handleDownload = () => {
    if (!result?.blob) return;
    const name = decoyUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 24);
    downloadBlob(result.blob, `stegaqr_${name}.png`);
  };

  const isProcessing = status === STATUS.processing || status === STATUS.deriving;

  return (
    <div className="max-w-2xl mx-auto space-y-5 overflow-y-auto h-full pb-6">

      {/* Decoy URL */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-display tracking-wider uppercase text-cyber-green">
            Decoy URL <span className="text-cyber-muted">(scanned by QR readers)</span>
          </p>
          {capacityInfo && (
            <button
              onClick={() => setShowCapacity(s => !s)}
              className="flex items-center gap-1 text-[9px] font-mono text-cyber-blue hover:text-cyber-text transition-colors"
            >
              <Info className="w-3 h-3" />
              v{capacityInfo.version} · {formatBytes(capacityInfo.rawCapacity)} cap.
            </button>
          )}
        </div>
        <input
          type="url"
          value={decoyUrl}
          onChange={e => setDecoyUrl(e.target.value)}
          placeholder="https://example.com/anything-you-want"
          className="input-cyber w-full font-mono text-[11px]"
          autoComplete="off"
        />

        <AnimatePresence>
          {showCapacity && capacityInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-black/20 border border-cyber-border rounded-lg p-3 grid grid-cols-3 gap-2 mt-1">
                {[
                  { label: 'QR Version', value: `v${capacityInfo.version}`,                           color: 'blue'   },
                  { label: 'Grid',       value: `${capacityInfo.qrSize}×${capacityInfo.qrSize}`,       color: 'muted'  },
                  { label: 'Safe Mods',  value: `${capacityInfo.safeMods} / ${capacityInfo.totalMods}`,color: 'purple' },
                  { label: 'LSB Slots',  value: capacityInfo.safePixelSlots.toLocaleString(),          color: 'yellow' },
                  { label: 'Capacity',   value: formatBytes(capacityInfo.rawCapacity),                 color: 'green'  },
                  { label: 'Image',      value: `${capacityInfo.imgWidth}px`,                          color: 'muted'  },
                ].map((item, i) => (
                  <div key={i} className="bg-black/30 rounded px-2 py-1.5">
                    <p className="text-[8px] font-mono text-cyber-muted uppercase tracking-widest">{item.label}</p>
                    <p className={`text-[11px] font-mono font-bold text-cyber-${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[9px] font-mono text-cyber-muted">
          Tip: a longer URL forces a higher QR version → more embedding capacity.
        </p>
      </div>

      {/* Secret Message */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-display tracking-wider uppercase text-cyber-green">Secret Message</p>
        <textarea
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter the message to encrypt and hide…"
          className="input-cyber w-full text-[11px] font-mono resize-none leading-relaxed"
          spellCheck={false}
        />
        <p className="text-[9px] font-mono text-cyber-muted text-right">{message.length} chars</p>
      </div>

      {/* EC Level */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-display tracking-wider uppercase text-cyber-yellow">Error Correction Level</p>
        <div className="relative">
          <select
            value={ecLevel}
            onChange={e => setEcLevel(e.target.value)}
            className="w-full bg-black/40 border border-cyber-border rounded-lg px-3 py-2 text-[11px] font-mono text-cyber-text outline-none appearance-none pr-8"
          >
            {EC_LEVELS.map(l => (
              <option key={l.id} value={l.id}>{l.label}  —  {l.note}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyber-muted pointer-events-none" />
        </div>
      </div>

      {/* Password */}
      <PasswordInput
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="Shared secret — encrypts message and randomizes embedding…"
        hint="One password drives both AES-256-GCM encryption and the embedding position shuffle (via separate PBKDF2 derivations). Share it out-of-band."
      />

      <ErrorBanner message={errorMsg} />

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isProcessing}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-[12px]"
      >
        {isProcessing
          ? <><RefreshCw className="w-4 h-4 animate-spin" />{status === STATUS.deriving ? 'Deriving keys…' : 'Generating…'}</>
          : <><QrCode className="w-4 h-4" />Generate StegaQR</>
        }
      </button>

      {isProcessing && <ProgressBar value={progress} label="Generating…" status={progressMsg} color="green" />}

      {/* Result */}
      <AnimatePresence>
        {status === STATUS.done && result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="card-cyber p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="section-label">StegaQR Output</p>
                <CheckCircle className="w-4 h-4 text-cyber-green" />
              </div>
              <div className="flex items-center justify-center bg-black/30 rounded-lg p-3 border border-cyber-border">
                <img
                  src={result.previewUrl}
                  alt="StegaQR preview"
                  className="max-h-56 rounded"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <button
                onClick={handleDownload}
                className="btn-primary w-full py-2 flex items-center justify-center gap-2 text-[11px]"
              >
                <Download className="w-3.5 h-3.5" /> Download PNG
              </button>
            </div>

            <MetadataCard
              title="Embedding Stats"
              items={[
                { label: 'QR Version',   value: `v${result.stats.qrVersion}`,                              color: 'blue'   },
                { label: 'Image Size',   value: `${result.stats.imgWidth}×${result.stats.imgWidth}px`,      color: 'muted', mono: true },
                { label: 'Safe Modules', value: `${result.stats.safeMods} / ${result.stats.totalMods}`,     color: 'purple', mono: true },
                { label: 'Density',      value: `${result.stats.density}%`,                                 color: 'yellow' },
                { label: 'Payload',      value: formatBytes(result.stats.rawPayloadSize),                   color: 'muted', mono: true },
                { label: 'Compressed',   value: formatBytes(result.stats.compressedSize),                   color: 'green', mono: true },
                { label: 'Capacity',     value: formatBytes(result.stats.capacity),                         color: 'blue', mono: true  },
                { label: 'Compression',  value: `${result.stats.compressionRatio}% saved`,                  color: 'yellow' },
              ]}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Decode Tab ───────────────────────────────────────────────────────────────

function DecodeTab() {
  const [qrFile,      setQrFile]      = useState(null);
  const [password,    setPassword]    = useState('');
  const [status,      setStatus]      = useState(STATUS.idle);
  const [progress,    setProgress]    = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [result,      setResult]      = useState(null);
  const [imgPreview,  setImgPreview]  = useState(null);
  const previewRef = useRef(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const handleFile = (file) => {
    setQrFile(file); setResult(null); setErrorMsg(''); setStatus(STATUS.idle);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    if (file) {
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setImgPreview(url);
    } else {
      setImgPreview(null);
    }
  };

  const handleExtract = async () => {
    setErrorMsg(''); setResult(null);
    if (!qrFile)           return setErrorMsg('Please upload a StegaQR image.');
    if (!password.trim())  return setErrorMsg('Password is required.');

    setStatus(STATUS.deriving); setProgress(5);

    try {
      // 1. Derive stego key
      setProgressMsg('Deriving stego key (PBKDF2-SHA-256, 100k rounds)…');
      const stegoKey = await deriveStegaKey(password);
      setProgress(20);

      // 2. Load image
      setStatus(STATUS.processing);
      setProgressMsg('Loading image…');
      const { imageData } = await loadImageFile(qrFile);
      setProgress(30);

      // 3. Extract raw payload bytes
      setProgressMsg('Reconstructing embedding positions · extracting bits…');
      const payloadBytes = await extractFromQR(imageData, stegoKey);
      setProgress(75);

      // 4. Decrypt with password
      setProgressMsg('Decrypting (AES-256-GCM)…');
      const message = await decryptQRPayload(payloadBytes, password);
      setProgress(100);

      setResult({ message });
      setStatus(STATUS.done); setProgressMsg('');
    } catch (err) {
      setErrorMsg(err.message); setStatus(STATUS.error); setProgress(0); setProgressMsg('');
    }
  };

  const isProcessing = status === STATUS.processing || status === STATUS.deriving;

  return (
    <div className="max-w-2xl mx-auto space-y-5 overflow-y-auto h-full pb-6">

      {/* QR image drop */}
      <div className="space-y-2">
        <p className="text-[10px] font-display tracking-wider uppercase text-cyber-blue">StegaQR Image</p>
        <FileDropzone accept={['image/png']} onFile={handleFile} label="Drop StegaQR PNG here · or click to browse" />
        <AnimatePresence>
          {imgPreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center bg-black/30 rounded-lg p-2 border border-cyber-border"
            >
              <img src={imgPreview} alt="Uploaded StegaQR" className="max-h-40 rounded" style={{ imageRendering: 'pixelated' }} />
            </motion.div>
          )}
        </AnimatePresence>
        <p className="text-[9px] font-mono text-cyber-muted">
          Only PNG files created with StegaQR are supported. Do not resize or re-encode.
        </p>
      </div>

      {/* Password */}
      <PasswordInput
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="Same password used during generation…"
        hint="Used to reconstruct embedding positions and decrypt the message."
      />

      <ErrorBanner message={errorMsg} />

      {/* Extract button */}
      <button
        onClick={handleExtract}
        disabled={isProcessing}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-[12px]
          bg-cyber-blue/20 border-cyber-blue/40 hover:bg-cyber-blue/30 text-cyber-blue"
      >
        {isProcessing
          ? <><RefreshCw className="w-4 h-4 animate-spin" />{status === STATUS.deriving ? 'Deriving key…' : 'Extracting…'}</>
          : <><Unlock className="w-4 h-4" />Extract & Decrypt</>
        }
      </button>

      {isProcessing && <ProgressBar value={progress} label="Extracting…" status={progressMsg} color="blue" />}

      {/* Result */}
      <AnimatePresence>
        {status === STATUS.done && result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card-cyber p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyber-green" />
                <p className="section-label mb-0">Decrypted Message</p>
                <span className="tag text-[9px] border-cyber-green/30 text-cyber-green bg-cyber-green/10">AES-256-GCM</span>
              </div>
              <div className="bg-black/40 border border-cyber-green/20 rounded-lg p-3">
                <pre className="text-[11px] font-mono text-cyber-text whitespace-pre-wrap break-words leading-relaxed">
                  {result.message}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export default function StegaQRModule() {
  const [activeTab, setActiveTab] = useState('generate');

  const tabs = [
    { id: 'generate', label: 'Generate StegaQR', icon: Lock   },
    { id: 'decode',   label: 'Decode StegaQR',   icon: Unlock },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-cyber-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-cyber-purple/10 border border-cyber-purple/30">
            <QrCode className="w-5 h-5 text-cyber-purple" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm text-cyber-purple tracking-wider">StegaQR</h2>
            <p className="text-[10px] font-mono text-cyber-muted">
              Password-encrypted payload hidden inside a scannable QR · AES-CTR position shuffle · Noise mimicry
            </p>
          </div>
        </div>

        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon   = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-display font-semibold tracking-wide uppercase transition-all
                  ${active
                    ? 'bg-cyber-purple/15 border border-cyber-purple/40 text-cyber-purple'
                    : 'text-cyber-muted hover:text-cyber-text border border-transparent hover:border-cyber-border'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === 'generate' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === 'generate' ? 12 : -12 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            {activeTab === 'generate' ? <GenerateTab /> : <DecodeTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
