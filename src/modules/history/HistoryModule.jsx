import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Download, Trash2, RefreshCw, Lock, Unlock, Search, AlertCircle, Inbox, CheckCircle, XCircle } from 'lucide-react';

import { getAllHistory, deleteHistory, clearHistory } from '../../storage/indexedDB.js';
import { downloadBlob, formatTimestamp, truncateFilename } from '../../utils/helpers.js';

const OP_CONFIG = {
  embed:   { label: 'Embed',    Icon: Lock,   color: 'text-cyber-green',  bg: 'bg-cyber-green/10',  border: 'border-cyber-green/30',  tag: 'tag-green'  },
  extract: { label: 'Extract',  Icon: Unlock, color: 'text-cyber-blue',   bg: 'bg-cyber-blue/10',   border: 'border-cyber-blue/30',   tag: 'tag-blue'   },
  analyze: { label: 'Analyze',  Icon: Search, color: 'text-cyber-purple', bg: 'bg-cyber-purple/10', border: 'border-cyber-purple/30', tag: 'tag-purple' },
};

function HistoryEntry({ entry, onDelete }) {
  const op  = OP_CONFIG[entry.operation] ?? OP_CONFIG.embed;
  const Icon = op.Icon;

  const handleDownload = () => {
    if (entry.stegoBlob) {
      const stem = entry.filename.replace(/\.[^.]+$/, '');
      downloadBlob(entry.stegoBlob, `${stem}_stego.png`);
    }
  };

  const handleDelete = async () => {
    await deleteHistory(entry.id);
    onDelete(entry.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`card-cyber p-4 border ${entry.status === 'error' ? 'border-cyber-red/20' : op.border} hover:border-opacity-60 transition-all`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg ${op.bg} ${op.border} border flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${op.color}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-cyber-text truncate max-w-[200px]">
              {truncateFilename(entry.filename)}
            </span>
            <span className={`tag ${op.tag} text-[9px]`}>{op.label}</span>
            {entry.status === 'success'
              ? <CheckCircle className="w-3.5 h-3.5 text-cyber-green" />
              : <XCircle className="w-3.5 h-3.5 text-cyber-red" />
            }
          </div>

          <p className="text-[10px] font-mono text-cyber-muted">
            {formatTimestamp(entry.timestamp)}
          </p>

          {/* Meta snippets */}
          {entry.meta && entry.status === 'success' && (
            <div className="flex gap-2 flex-wrap mt-1">
              {entry.meta.dimensions && (
                <span className="text-[9px] font-mono text-cyber-muted/60 bg-black/20 px-2 py-0.5 rounded">
                  {entry.meta.dimensions.width}×{entry.meta.dimensions.height}
                </span>
              )}
              {entry.meta.probability !== undefined && (
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                  entry.meta.riskLevel === 'HIGH' ? 'bg-cyber-red/10 text-cyber-red' :
                  entry.meta.riskLevel === 'MEDIUM' ? 'bg-cyber-yellow/10 text-cyber-yellow' :
                  'bg-cyber-green/10 text-cyber-green'
                }`}>
                  {entry.meta.riskLevel} · {entry.meta.probability}%
                </span>
              )}
              {entry.meta.density && (
                <span className="text-[9px] font-mono text-cyber-muted/60 bg-black/20 px-2 py-0.5 rounded">
                  {entry.meta.density}% density
                </span>
              )}
            </div>
          )}

          {entry.status === 'error' && entry.meta?.error && (
            <p className="text-[10px] font-mono text-cyber-red/70 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {entry.meta.error.slice(0, 80)}{entry.meta.error.length > 80 ? '…' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 flex-shrink-0">
          {entry.stegoBlob && entry.status === 'success' && (
            <button
              onClick={handleDownload}
              title="Download stego image"
              className="w-7 h-7 rounded-lg bg-cyber-green/10 border border-cyber-green/20 flex items-center justify-center text-cyber-green hover:bg-cyber-green/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            title="Delete entry"
            className="w-7 h-7 rounded-lg bg-cyber-red/5 border border-cyber-red/20 flex items-center justify-center text-cyber-red/60 hover:text-cyber-red hover:bg-cyber-red/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function HistoryModule() {
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');   // all | embed | extract | analyze
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllHistory();
      setEntries(all);
    } catch {
      // IndexedDB not available in all environments
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (id) => setEntries(prev => prev.filter(e => e.id !== id));

  const handleClear = async () => {
    await clearHistory();
    setEntries([]);
    setConfirmClear(false);
  };

  const filtered = filter === 'all' ? entries : entries.filter(e => e.operation === filter);

  const counts = {
    all:     entries.length,
    embed:   entries.filter(e => e.operation === 'embed').length,
    extract: entries.filter(e => e.operation === 'extract').length,
    analyze: entries.filter(e => e.operation === 'analyze').length,
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyber-yellow/10 border border-cyber-yellow/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyber-yellow" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-cyber-yellow tracking-wide">Operation History</h2>
              <p className="text-xs text-cyber-muted font-mono">
                Stored in IndexedDB · No server sync · {entries.length} total entries
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="w-8 h-8 rounded-lg bg-cyber-yellow/10 border border-cyber-yellow/20 flex items-center justify-center text-cyber-yellow hover:bg-cyber-yellow/20 transition-colors" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {entries.length > 0 && (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 text-[10px] font-display tracking-wider uppercase px-3 py-1.5 rounded-lg border border-cyber-red/30 text-cyber-red/70 hover:text-cyber-red hover:bg-cyber-red/10 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Confirm clear dialog */}
        <AnimatePresence>
          {confirmClear && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card-cyber p-4 border border-cyber-red/30 bg-cyber-red/5">
              <p className="text-sm font-display text-cyber-red font-semibold">Clear all history?</p>
              <p className="text-xs font-mono text-cyber-muted mt-1">This will permanently delete all {entries.length} entries and any stored stego images.</p>
              <div className="flex gap-2 mt-3">
                <button onClick={handleClear} className="btn-danger text-[11px] px-4 py-2">Confirm Clear</button>
                <button onClick={() => setConfirmClear(false)} className="btn-secondary text-[11px] px-4 py-2">Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-black/30 rounded-lg border border-cyber-border w-fit">
          {['all', 'embed', 'extract', 'analyze'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[10px] font-display tracking-wider uppercase rounded-md transition-all
                ${filter === f ? 'bg-cyber-yellow/15 text-cyber-yellow border border-cyber-yellow/30' : 'text-cyber-muted hover:text-cyber-text'}`}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        {/* Entry list */}
        {loading ? (
          <div className="text-center py-16 text-cyber-muted font-mono text-sm">Loading history…</div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 space-y-4">
            <Inbox className="w-12 h-12 text-cyber-muted/30 mx-auto" />
            <div>
              <p className="text-sm font-display text-cyber-muted">No history entries</p>
              <p className="text-xs font-mono text-cyber-muted/60 mt-1">
                {filter === 'all' ? 'Perform an operation to see it here' : `No ${filter} operations yet`}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map(entry => (
                <HistoryEntry key={entry.id} entry={entry} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
