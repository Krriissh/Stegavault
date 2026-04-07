import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Unlock, Copy, Check, CheckCircle, AlertCircle, MessageSquare, ShieldCheck, ShieldOff } from 'lucide-react';

import FileDropzone from '../../components/FileDropzone.jsx';
import KeyManager from '../../components/KeyManager.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';
import MetadataCard, { buildExtractMetadata } from '../../components/MetadataCard.jsx';

import { decryptHybridPayload } from '../../core/crypto/cryptoEngine.js';
import { loadImageFile, extractData } from '../../core/stego/stegoEngine.js';
import { saveHistory } from '../../storage/indexedDB.js';
import { copyToClipboard } from '../../utils/helpers.js';

const STATUS = { idle: 'idle', processing: 'processing', done: 'done', error: 'error' };

export default function DecryptModule() {
  const [imageFile, setImageFile]     = useState(null);
  const [keys, setKeys]               = useState({});
  const [status, setStatus]           = useState(STATUS.idle);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [plaintext, setPlaintext]     = useState('');
  const [result, setResult]           = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [copied, setCopied]           = useState(false);

  const handleExtract = async () => {
    setErrorMsg('');
    if (!imageFile)       return setErrorMsg('Please select a stego image.');
    if (!keys.decPrivateKey) return setErrorMsg('Load your RSA decryption private key.');

    setStatus(STATUS.processing);
    setProgress(0);
    setPlaintext('');

    try {
      // 1. Load image
      setProgressMsg('Loading stego image…');
      setProgress(5);
      const { imageData, width, height } = await loadImageFile(imageFile);

      // 2. Extract raw payload bytes from LSBs
      setProgressMsg('Extracting embedded payload…');
      const payloadBytes = extractData(imageData, (pct) => {
        setProgress(5 + Math.round(pct * 0.55));
        setProgressMsg(`Extracting… ${5 + Math.round(pct * 0.55)}%`);
      });

      // 3. Verify signature (if verify key provided), unwrap AES key, decrypt
      setProgressMsg('Verifying signature…');
      setProgress(65);

      setProgressMsg('Unwrapping AES key (RSA-OAEP)…');
      setProgress(75);

      setProgressMsg('Decrypting message (AES-256-GCM)…');
      setProgress(85);

      const { message, signed, encAlgo, signAlgo } = await decryptHybridPayload(
        payloadBytes,
        keys.decPrivateKey,
        keys.verifyPublicKey ?? null
      );

      // 4. History
      setProgressMsg('Saving to history…');
      setProgress(95);
      const meta = {
        dimensions: { width, height },
        messageLen: new TextEncoder().encode(message).length,
        signed,
        encAlgo,
        signAlgo,
      };
      await saveHistory({
        filename:  imageFile.name,
        operation: 'extract',
        status:    'success',
        stegoBlob: null,
        meta,
      });

      setProgress(100);
      setPlaintext(message);
      setResult({ width, height, messageLen: meta.messageLen, signed, encAlgo, signAlgo });
      setStatus(STATUS.done);
      setProgressMsg('');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus(STATUS.error);
      setProgressMsg('');
      await saveHistory({
        filename:  imageFile?.name ?? 'unknown',
        operation: 'extract',
        status:    'error',
        stegoBlob: null,
        meta:      { error: err.message },
      }).catch(() => {});
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(plaintext);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const reset = () => {
    setStatus(STATUS.idle);
    setErrorMsg('');
    setPlaintext('');
    setResult(null);
    setProgress(0);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-cyber-blue" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-cyber-blue tracking-wide">
              Decrypt &amp; Extract
            </h2>
            <p className="text-xs text-cyber-muted font-mono">
              LSB extraction · signature verify · asymmetric key unwrap · AES-256-GCM decrypt
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Image upload */}
            <div className="card-cyber p-4">
              <FileDropzone
                label="Stego Image"
                accentColor="blue"
                onFile={f => {
                  setImageFile(f);
                  setStatus(STATUS.idle);
                  setErrorMsg('');
                  setResult(null);
                  setPlaintext('');
                }}
                file={imageFile}
              />
            </div>

            {/* Key manager */}
            <div className="card-cyber p-4">
              <KeyManager mode="decrypt" onKeys={setKeys} />
            </div>

            {/* Action */}
            <button
              onClick={handleExtract}
              disabled={status === STATUS.processing || !imageFile || !keys.decPrivateKey}
              className="w-full py-3 font-display font-bold text-[13px] tracking-wider uppercase rounded-lg border transition-all flex items-center justify-center gap-2
                bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/20 hover:shadow-glow-blue
                disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Unlock className="w-4 h-4" />
              {status === STATUS.processing ? 'Extracting…' : 'Extract & Decrypt'}
            </button>

            {/* Progress */}
            <AnimatePresence>
              {status === STATUS.processing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="card-cyber p-4"
                >
                  <ProgressBar value={progress} label="Extracting…" color="blue" status={progressMsg} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {(status === STATUS.error || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="card-cyber p-4 border border-cyber-red/30 bg-cyber-red/5"
                >
                  <div className="flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-cyber-red flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-display text-cyber-red font-semibold">Extraction Failed</p>
                      <p className="text-xs font-mono text-cyber-muted">{errorMsg}</p>
                      <button onClick={reset} className="btn-danger text-[10px] px-3 py-1.5">Retry</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right column: result ── */}
          <div className="space-y-5">
            <AnimatePresence>
              {status === STATUS.done && result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  {/* Success header */}
                  <div className="card-cyber p-4 border border-cyber-blue/30 bg-cyber-blue/5">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-cyber-blue flex-shrink-0" />
                      <div>
                        <p className="text-sm font-display text-cyber-blue font-bold">Extraction Successful</p>
                        <p className="text-xs font-mono text-cyber-muted">
                          AES-256-GCM auth tag verified · RSA-OAEP key unwrapped
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Signature status */}
                  <div className={`card-cyber p-3 flex items-center gap-3 border ${
                    result.signed
                      ? 'border-cyber-green/30 bg-cyber-green/5'
                      : 'border-cyber-yellow/20 bg-cyber-yellow/5'
                  }`}>
                    {result.signed
                      ? <ShieldCheck className="w-5 h-5 text-cyber-green flex-shrink-0" />
                      : <ShieldOff  className="w-5 h-5 text-cyber-yellow flex-shrink-0" />
                    }
                    <div>
                      <p className={`text-xs font-display font-bold ${result.signed ? 'text-cyber-green' : 'text-cyber-yellow'}`}>
                        {result.signed ? 'Signature Verified' : 'Signature Not Verified'}
                      </p>
                      <p className="text-[10px] font-mono text-cyber-muted">
                        {result.signed
                          ? "Payload authenticated with sender\u2019s RSA-PSS key"
                          : 'No sender verification key loaded – authenticity unconfirmed'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Plaintext */}
                  <div className="card-cyber p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-cyber-blue" />
                        <p className="section-label mb-0">Decrypted Message</p>
                      </div>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-[10px] font-mono text-cyber-muted hover:text-cyber-blue transition-colors"
                      >
                        {copied
                          ? <Check className="w-3.5 h-3.5 text-cyber-green" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-black/40 border border-cyber-border rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-sm font-mono text-cyber-text whitespace-pre-wrap break-words leading-relaxed">
                        {plaintext}
                      </pre>
                    </div>
                  </div>

                  {/* Metadata */}
                  <MetadataCard
                    title="Extraction Report"
                    items={buildExtractMetadata({
                      width:      result.width,
                      height:     result.height,
                      messageLen: result.messageLen,
                      signed:     result.signed,
                      encAlgo:    result.encAlgo,
                      signAlgo:   result.signAlgo,
                    })}
                  />

                  <button onClick={reset} className="w-full btn-secondary text-[11px] py-2">
                    New Operation
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Idle hint */}
            {status === STATUS.idle && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card-cyber p-6 text-center space-y-3"
              >
                <div className="w-14 h-14 rounded-full bg-cyber-blue/10 border border-cyber-blue/20 flex items-center justify-center mx-auto">
                  <Unlock className="w-6 h-6 text-cyber-blue/50" />
                </div>
                <p className="text-sm text-cyber-muted font-mono">
                  Upload a stego image and load your private key to extract the hidden message
                </p>
                <div className="flex flex-col gap-1 text-[10px] font-mono text-cyber-muted/60 text-left max-w-xs mx-auto">
                  <p>1. Upload the PNG stego image</p>
                  <p>2. Load your RSA decryption private key (.pem)</p>
                  <p>3. Optionally load sender's signing public key to verify authenticity</p>
                  <p>4. Click Extract & Decrypt</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
