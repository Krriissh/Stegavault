import React from 'react';
import { motion } from 'framer-motion';
import { formatBits, formatBytes } from '../utils/helpers.js';

/**
 * Displays operation metadata in a grid of stat tiles.
 *
 * Props:
 *   items   Array<{ label: string, value: string|number, color?: string, mono?: boolean }>
 *   title   string
 */
export default function MetadataCard({ items = [], title = 'Metadata' }) {
  const colorMap = {
    green:  'text-cyber-green',
    blue:   'text-cyber-blue',
    purple: 'text-cyber-purple',
    yellow: 'text-cyber-yellow',
    red:    'text-cyber-red',
    muted:  'text-cyber-muted',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-cyber p-4 space-y-3"
    >
      <p className="section-label">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="bg-black/30 rounded-lg border border-cyber-border px-3 py-2"
          >
            <p className="text-[9px] font-mono text-cyber-muted uppercase tracking-widest mb-0.5">
              {item.label}
            </p>
            <p className={`text-sm font-bold ${item.mono ? 'font-mono' : 'font-display'} ${colorMap[item.color ?? 'green'] ?? 'text-cyber-green'} truncate`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Preset builders ──────────────────────────────────────────────────────────

export function buildEmbedMetadata({ width, height, bitsUsed, capacity, density, messageLen, payloadBytes, signed }) {
  return [
    { label: 'Dimensions',     value: `${width} × ${height}`,                    color: 'blue'   },
    { label: 'Message Size',   value: formatBytes(messageLen),                    color: 'green'  },
    { label: 'Payload Size',   value: formatBytes(payloadBytes),                  color: 'yellow' },
    { label: 'Capacity',       value: formatBits(capacity),                       color: 'muted'  },
    { label: 'Density',        value: `${density}%`,                              color: density > 50 ? 'red' : 'green' },
    { label: 'Signature',      value: signed ? 'RSA-PSS ✓' : 'None (unsigned)',   color: signed ? 'green' : 'yellow', mono: true },
    { label: 'Encryption',     value: 'AES-256-GCM + asymmetric wrap',            color: 'purple', mono: true },
    { label: 'Embedding',      value: 'Sequential LSB → PNG',                    color: 'muted',  mono: true },
  ];
}

export function buildExtractMetadata({ width, height, messageLen, signed, encAlgo, signAlgo }) {
  return [
    { label: 'Dimensions',    value: `${width} × ${height}`,                              color: 'blue'   },
    { label: 'Message Size',  value: formatBytes(messageLen),                              color: 'green'  },
    { label: 'AES Auth Tag',  value: 'Verified ✓',                                        color: 'green'  },
    { label: 'Signature',     value: signed ? 'Verified ✓' : 'Not checked',               color: signed ? 'green' : 'yellow' },
    { label: 'Key Exchange',  value: encAlgo  ?? '—',                                     color: 'blue',   mono: true },
    { label: 'Signing Algo',  value: signAlgo ?? (signed ? '—' : 'None'),                 color: 'purple', mono: true },
  ];
}

export function buildAnalysisMetadata({ probability, riskLevel, verdict, voteScore, width, height, totalPixels, tests }) {
  return [
    { label: 'Verdict',       value: verdict ?? (riskLevel === 'HIGH' ? 'Likely Stego' : 'Clean'),
                                                                                  color: riskLevel === 'HIGH' ? 'red' : riskLevel === 'MEDIUM' ? 'yellow' : 'green' },
    { label: 'Vote Score',    value: `${voteScore ?? '?'} / 3 tests`,            color: (voteScore ?? 0) >= 2 ? 'red' : 'green' },
    { label: 'Chi-Square',    value: `${tests.chiSquare.score}% ${tests.chiSquare.flag ? '⚑' : ''}`,  color: tests.chiSquare.flag ? 'red' : 'blue' },
    { label: 'Histogram',     value: `${tests.histogram.score}% ${tests.histogram.flag ? '⚑' : ''}`,  color: tests.histogram.flag ? 'red' : 'purple' },
    { label: 'Entropy',       value: `${(tests.entropy ?? tests.noise)?.score}% ${(tests.entropy ?? tests.noise)?.flag ? '⚑' : ''}`,
                                                                                  color: (tests.entropy ?? tests.noise)?.flag ? 'red' : 'yellow' },
    { label: 'Total Pixels',  value: totalPixels.toLocaleString(),               color: 'muted', mono: true },
  ];
}
