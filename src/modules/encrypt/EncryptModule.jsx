import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Download, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Shield } from 'lucide-react';

import FileDropzone from '../../components/FileDropzone.jsx';
import KeyManager from '../../components/KeyManager.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';
import MetadataCard, { buildEmbedMetadata } from '../../components/MetadataCard.jsx';

import { buildHybridPayload } from '../../core/crypto/cryptoEngine.js';
import { loadImageFile, embedData, imageDataToPngBlob, getCapacity } from '../../core/stego/stegoEngine.js';
import { saveHistory } from '../../storage/indexedDB.js';
import { downloadBlob, stegoFilename, formatBytes } from '../../utils/helpers.js';

const STATUS = { idle: 'idle', processing: 'processing', done: 'done', error: 'error' };

export default function EncryptModule() {
  const [imageFile, setImageFile]     = useState(null);
  const [message, setMessage]         = useState('');
  const [keys, setKeys]               = useState({});
  const [status, setStatus]           = useState(STATUS.idle);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult]           = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [imgInfo, setImgInfo]         = useState(null);

  const handleImageFile = async (file) => {
    setImageFile(file);
    setResult(null);
    setStatus(STATUS.idle);
    setImgInfo(null);
    if (!file) return;
    try {
      const { width, height } = await loadImageFile(file);
      setImgInfo({ width, height, capacity: getCapacity(width, height) });
    } catch { /* surfaced during embed */ }
  };

  const handleEmbed = async () => {
    setErrorMsg('');

    if (!imageFile)         return setErrorMsg('Please select a cover image.');
    if (!message.trim())    return setErrorMsg('Message cannot be empty.');
    if (!keys.encPublicKey) return setErrorMsg("Load the recipient's encryption public key.");

    setStatus(STATUS.processing);
    setProgress(0);

    try {
      // 1. Load image
      setProgressMsg('Loading cover image…');
      setProgress(5);
      const { imageData, width, height } = await loadImageFile(imageFile);

      // 2. Build hybrid payload (AES encrypt → RSA wrap → RSA-PSS sign)
      setProgressMsg('Encrypting message (AES-256-GCM)…');
      setProgress(15);

      setProgressMsg('Wrapping AES key with RSA-OAEP…');
      setProgress(25);

      if (keys.signPrivateKey) {
        setProgressMsg('Signing payload (RSA-PSS)…');
        setProgress(30);
      }

      const payloadBytes = await buildHybridPayload(
        message.trim(),
        keys.encPublicKey,
        keys.signPrivateKey ?? null
      );

      setProgressMsg('Embedding payload with sequential LSB…');
      setProgress(35);
      const embedResult = embedData(imageData, payloadBytes, (pct) => {
        setProgress(35 + Math.round(pct * 0.50));
        setProgressMsg(`Embedding… ${35 + Math.round(pct * 0.50)}%`);
      });

      // 3. Encode as PNG
      setProgressMsg('Encoding stego image as PNG…');
      setProgress(88);
      const blob = await imageDataToPngBlob(embedResult.stego);

      // 4. History
      setProgressMsg('Saving to history…');
      setProgress(95);
      const meta = {
        dimensions:    { width, height },
        messageLen:    new TextEncoder().encode(message.trim()).length,
        payloadBytes:  payloadBytes.length,
        bitsUsed:      embedResult.bitsUsed,
        capacity:      embedResult.capacity,
        density:       embedResult.density,
        signed:        !!keys.signPrivateKey,
      };
      await saveHistory({
        filename:  imageFile.name,
        operation: 'embed',
        status:    'success',
        stegoBlob: blob,
        meta,
      });

      setProgress(100);
      setResult({ blob, meta, width, height, outputName: stegoFilename(imageFile.name) });
      setStatus(STATUS.done);
      setProgressMsg('');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus(STATUS.error);
      setProgressMsg('');
      await saveHistory({
        filename:  imageFile?.name ?? 'unknown',
        operation: 'embed',
        status:    'error',
        stegoBlob: null,
        meta:      { error: err.message },
      }).catch(() => {});
    }
  };

  const reset = () => {
    setResult(null);
    setStatus(STATUS.idle);
    setErrorMsg('');
    setProgress(0);
  };

  const canEmbed = imageFile && message.trim() && keys.encPublicKey;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyber-green/10 border border-cyber-green/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-cyber-green" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-cyber-green tracking-wide">
              Encrypt &amp; Embed
            </h2>
            <p className="text-xs text-cyber-muted font-mono">
              AES-256-GCM · asymmetric key wrap · optional signature · LSB steganography
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Image upload */}
            <div className="card-cyber p-4">
              <FileDropzone
                label="Cover Image"
                accentColor="green"
                onFile={handleImageFile}
                file={imageFile}
              />
              {imgInfo && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <span className="tag tag-blue">{imgInfo.width} × {imgInfo.height} px</span>
                  <span className="tag tag-green">
                    Max {formatBytes(imgInfo.capacity)} payload
                  </span>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="card-cyber p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="section-label">Secret Message</p>
                <span className={`text-[10px] font-mono ${message.length > 5000 ? 'text-cyber-red' : 'text-cyber-muted'}`}>
                  {message.length} chars
                </span>
              </div>
              <textarea
                className="input-cyber resize-none h-28"
                placeholder="Enter your secret message here…"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            {/* Advanced options */}
            <div className="card-cyber overflow-hidden">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between px-4 py-3 text-cyber-muted hover:text-cyber-text transition-colors"
              >
                <span className="text-xs font-display tracking-wider uppercase">Security Details</span>
                {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-cyber-border"
                  >
                    <div className="p-4 space-y-2 text-[10px] font-mono text-cyber-muted">
                      {[
                        ['AES Key', 'Randomly generated per message (secure RNG)'],
                        ['Encryption', 'AES-256-GCM with 96-bit IV + 128-bit auth tag'],
                        ['Key wrap', 'Asymmetric (auto-detected from recipient key)'],
                        ['Signature', keys.signPrivateKey ? 'Asymmetric sign ✓' : 'No signing key loaded (optional)'],
                        ['Embedding', 'Sequential LSB – RGB channels, PNG output'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-cyber-blue w-20 flex-shrink-0">{k}</span>
                          <span className={keys.signPrivateKey && k === 'Signature' ? 'text-cyber-green' : ''}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">

            {/* Key manager */}
            <div className="card-cyber p-4">
              <KeyManager mode="encrypt" onKeys={setKeys} />
            </div>

            {/* Action button */}
            <button
              onClick={handleEmbed}
              disabled={status === STATUS.processing || !canEmbed}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {status === STATUS.processing ? 'Processing…' : 'Encrypt & Embed'}
            </button>

            {/* Progress */}
            <AnimatePresence>
              {status === STATUS.processing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="card-cyber p-4"
                >
                  <ProgressBar value={progress} label="Embedding…" color="green" status={progressMsg} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {(status === STATUS.error || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="card-cyber p-4 border border-cyber-red/30 bg-cyber-red/5"
                >
                  <div className="flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-cyber-red flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-display text-cyber-red font-semibold">Operation Failed</p>
                      <p className="text-xs font-mono text-cyber-muted">{errorMsg}</p>
                      <button onClick={reset} className="btn-danger text-[10px] px-3 py-1.5">Retry</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success result */}
            <AnimatePresence>
              {status === STATUS.done && result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="card-cyber p-4 border border-cyber-green/30 bg-cyber-green/5">
                    <div className="flex gap-3 items-center">
                      <CheckCircle className="w-6 h-6 text-cyber-green flex-shrink-0" />
                      <div>
                        <p className="text-sm font-display text-cyber-green font-bold">Embedding Successful</p>
                        <p className="text-xs font-mono text-cyber-muted">
                          {result.outputName} · {formatBytes(result.blob.size)}
                          {result.meta.signed && (
                            <span className="ml-2 text-cyber-yellow">· Signed ✓</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => downloadBlob(result.blob, result.outputName)}
                        className="btn-primary flex items-center gap-1.5 py-2 px-4 text-[11px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PNG
                      </button>
                      <button onClick={reset} className="btn-secondary text-[11px] px-4 py-2">
                        New Operation
                      </button>
                    </div>
                  </div>

                  <MetadataCard
                    title="Embedding Report"
                    items={buildEmbedMetadata({
                      width:       result.width,
                      height:      result.height,
                      bitsUsed:    result.meta.bitsUsed,
                      capacity:    result.meta.capacity,
                      density:     result.meta.density,
                      messageLen:  result.meta.messageLen,
                      payloadBytes: result.meta.payloadBytes,
                      signed:      result.meta.signed,
                    })}
                  />

                  <div className="text-[10px] font-mono text-cyber-muted px-1">
                    ⚠ Output saved as lossless PNG to preserve embedded bits. Share securely.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
