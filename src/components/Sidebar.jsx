import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Search, Clock, Shield, ChevronRight, QrCode } from 'lucide-react';

const NAV_ITEMS = [
  {
    id: 'encrypt',
    label: 'Encrypt & Embed',
    icon: Lock,
    color: 'green',
    description: 'Hide encrypted data',
  },
  {
    id: 'decrypt',
    label: 'Decrypt & Extract',
    icon: Unlock,
    color: 'blue',
    description: 'Recover hidden data',
  },
  {
    id: 'stegaqr',
    label: 'StegaQR',
    icon: QrCode,
    color: 'purple',
    description: 'QR steganography',
  },
  {
    id: 'detect',
    label: 'Steganalysis',
    icon: Search,
    color: 'purple',
    description: 'Detect hidden data',
  },
  {
    id: 'history',
    label: 'History',
    icon: Clock,
    color: 'yellow',
    description: 'Past operations',
  },
];

const colorMap = {
  green:  { text: 'text-cyber-green',  bg: 'bg-cyber-green/10',  border: 'border-cyber-green/30' },
  blue:   { text: 'text-cyber-blue',   bg: 'bg-cyber-blue/10',   border: 'border-cyber-blue/30' },
  purple: { text: 'text-cyber-purple', bg: 'bg-cyber-purple/10', border: 'border-cyber-purple/30' },
  yellow: { text: 'text-cyber-yellow', bg: 'bg-cyber-yellow/10', border: 'border-cyber-yellow/30' },
};

export default function Sidebar({ activeModule, onNavigate }) {
  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-cyber-sidebar border-r border-cyber-border flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-cyber-border">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 bg-cyber-green/10 border border-cyber-green/30 rounded-lg animate-pulse-glow" />
            <Shield className="w-5 h-5 text-cyber-green relative z-10" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm text-cyber-green tracking-wider glow-green">
              StegaVault
            </h1>
            <p className="text-[10px] text-cyber-muted font-mono tracking-widest uppercase">
              v1.0 · Secure
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <p className="section-label px-2 mb-3">Modules</p>
        {NAV_ITEMS.map((item) => {
          const Icon    = item.icon;
          const active  = activeModule === item.id;
          const c       = colorMap[item.color];

          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-left transition-all duration-200 group
                ${active
                  ? `${c.bg} ${c.border} border ${c.text}`
                  : 'text-cyber-muted hover:text-cyber-text hover:bg-white/[0.03] border border-transparent'
                }
              `}
            >
              <div className={`
                w-8 h-8 flex items-center justify-center rounded-md flex-shrink-0
                ${active ? `${c.bg} ${c.border} border` : 'bg-white/[0.03] border border-cyber-border'}
              `}>
                <Icon className={`w-4 h-4 ${active ? c.text : 'text-cyber-muted group-hover:text-cyber-text'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-display text-[11px] font-semibold tracking-wide uppercase truncate
                  ${active ? c.text : 'text-cyber-text/70 group-hover:text-cyber-text'}`}>
                  {item.label}
                </div>
                <div className="text-[10px] text-cyber-muted truncate">{item.description}</div>
              </div>
              {active && <ChevronRight className={`w-3 h-3 flex-shrink-0 ${c.text}`} />}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="px-4 py-4 border-t border-cyber-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
          <span className="text-[10px] font-mono text-cyber-muted">Client-side only</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyber-blue" />
          <span className="text-[10px] font-mono text-cyber-muted">AES-256-GCM</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyber-purple" />
          <span className="text-[10px] font-mono text-cyber-muted">Randomized LSB</span>
        </div>
        <p className="text-[9px] text-cyber-muted/50 font-mono pt-1 border-t border-cyber-border">
          Zero-knowledge · No server storage
        </p>
      </div>
    </aside>
  );
}
