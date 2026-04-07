import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated progress bar with label.
 *
 * Props:
 *   value    number  0–100
 *   label    string
 *   color    'green' | 'blue' | 'purple' | 'red'
 *   status   string  additional status message
 */
export default function ProgressBar({ value = 0, label = 'Processing...', color = 'green', status }) {
  const barColor = {
    green:  'from-cyber-green to-cyber-green/70',
    blue:   'from-cyber-blue  to-cyber-blue/70',
    purple: 'from-cyber-purple to-cyber-purple/70',
    red:    'from-cyber-red   to-cyber-red/70',
  }[color] ?? 'from-cyber-green to-cyber-green/70';

  const glowColor = {
    green:  'shadow-glow-green',
    blue:   'shadow-glow-blue',
    purple: 'shadow-glow-purple',
    red:    'shadow-glow-red',
  }[color] ?? 'shadow-glow-green';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-cyber-muted">{label}</span>
        <span className={`text-xs font-display font-bold ${color === 'green' ? 'text-cyber-green' : color === 'blue' ? 'text-cyber-blue' : color === 'purple' ? 'text-cyber-purple' : 'text-cyber-red'}`}>
          {value}%
        </span>
      </div>

      {/* Track */}
      <div className="h-2 bg-black/40 rounded-full border border-cyber-border overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} ${glowColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {status && (
        <p className="text-[10px] font-mono text-cyber-muted animate-pulse">{status}</p>
      )}
    </div>
  );
}
