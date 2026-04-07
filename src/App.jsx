import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import Sidebar from './components/Sidebar.jsx';
import EncryptModule  from './modules/encrypt/EncryptModule.jsx';
import DecryptModule  from './modules/decrypt/DecryptModule.jsx';
import DetectModule   from './modules/detect/DetectModule.jsx';
import HistoryModule  from './modules/history/HistoryModule.jsx';

const MODULES = {
  encrypt: EncryptModule,
  decrypt: DecryptModule,
  detect:  DetectModule,
  history: HistoryModule,
};

export default function App() {
  const [activeModule, setActiveModule] = useState('encrypt');
  const ActiveComponent = MODULES[activeModule] ?? EncryptModule;

  return (
    <div className="flex h-screen bg-cyber-bg bg-grid overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeModule={activeModule} onNavigate={setActiveModule} />

      {/* Main content area */}
      <main className="flex-1 overflow-hidden relative">
        {/* Subtle scan-line overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyber-green/10 to-transparent animate-scan-line" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="h-full relative z-10"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
