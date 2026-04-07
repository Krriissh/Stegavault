import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ImageIcon, X, AlertCircle } from 'lucide-react';
import { isAcceptedImageType, formatBytes, truncateFilename } from '../utils/helpers.js';

/**
 * Drag-and-drop image uploader with preview.
 *
 * Props:
 *   onFile     (File) => void   – called when a valid file is selected
 *   label      string           – header label
 *   accentColor 'green'|'blue'|'purple'
 *   file       File|null        – controlled file value (for external reset)
 */
export default function FileDropzone({ onFile, label = 'Drop Image Here', accentColor = 'green', file: controlledFile }) {
  const [dragging, setDragging]     = useState(false);
  const [error, setError]           = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [localFile, setLocalFile]   = useState(null);

  const activeFile = controlledFile !== undefined ? controlledFile : localFile;

  const accent = {
    green:  { border: 'border-cyber-green/40', bg: 'bg-cyber-green/5',  text: 'text-cyber-green',  icon: 'text-cyber-green/60' },
    blue:   { border: 'border-cyber-blue/40',  bg: 'bg-cyber-blue/5',   text: 'text-cyber-blue',   icon: 'text-cyber-blue/60' },
    purple: { border: 'border-cyber-purple/40',bg: 'bg-cyber-purple/5', text: 'text-cyber-purple', icon: 'text-cyber-purple/60' },
  }[accentColor];

  const handleFile = useCallback((f) => {
    setError('');
    if (!f) return;
    if (!isAcceptedImageType(f.type)) {
      setError(`Unsupported format: ${f.type || 'unknown'}. Use PNG, JPG, WEBP, or BMP.`);
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File too large. Max 50 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setLocalFile(f);
    onFile(f);
  }, [previewUrl, onFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const onInputChange = (e) => handleFile(e.target.files?.[0]);

  const clearFile = (e) => {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setLocalFile(null);
    setError('');
    onFile(null);
  };

  return (
    <div className="space-y-2">
      {label && <p className="section-label">{label}</p>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden
          ${dragging ? `${accent.border} ${accent.bg} scale-[1.01]` : 'border-cyber-border hover:border-cyber-border-bright'}
          ${activeFile ? 'bg-transparent' : 'bg-cyber-card/50'}
        `}
        onClick={() => !activeFile && document.getElementById('file-input-' + accentColor)?.click()}
      >
        <input
          id={'file-input-' + accentColor}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.bmp"
          className="sr-only"
          onChange={onInputChange}
        />

        <AnimatePresence mode="wait">
          {activeFile && previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative"
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-52 object-contain bg-black/40"
              />
              {/* Overlay info */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className={`w-3.5 h-3.5 ${accent.text}`} />
                    <span className="text-xs font-mono text-cyber-text truncate max-w-[180px]">
                      {truncateFilename(activeFile.name)}
                    </span>
                    <span className="text-[10px] text-cyber-muted">{formatBytes(activeFile.size)}</span>
                  </div>
                  <button
                    onClick={clearFile}
                    className="p-1 rounded-full hover:bg-white/10 text-cyber-muted hover:text-cyber-red transition-colors"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10 px-4 gap-3"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className={`w-12 h-12 rounded-xl border ${accent.border} ${accent.bg} flex items-center justify-center`}
              >
                <Upload className={`w-5 h-5 ${accent.icon}`} />
              </motion.div>
              <div className="text-center">
                <p className={`text-sm font-display font-semibold ${dragging ? accent.text : 'text-cyber-text/70'}`}>
                  {dragging ? 'Release to Upload' : 'Drag & Drop Image'}
                </p>
                <p className="text-xs text-cyber-muted mt-1">
                  or <span className={`${accent.text} underline cursor-pointer`}>browse files</span>
                </p>
                <p className="text-[10px] text-cyber-muted/60 mt-1.5 font-mono">
                  PNG · JPG · WEBP · BMP · Max 50 MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-cyber-red text-xs font-mono px-1"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
