/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#080d1a',
          card: '#0d1628',
          sidebar: '#060b15',
          border: '#1a2744',
          'border-bright': '#2a3f6e',
          green: '#00ff88',
          'green-dim': '#00cc6e',
          blue: '#0ea5e9',
          'blue-dim': '#0284c7',
          red: '#ff4444',
          yellow: '#f59e0b',
          purple: '#8b5cf6',
          text: '#e2e8f0',
          muted: '#94a3b8',
          'muted-dim': '#4b5563',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 255, 136, 0.3)',
        'glow-blue': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow-red': '0 0 20px rgba(255, 68, 68, 0.3)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 255, 136, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 255, 136, 0.6)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(200%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
