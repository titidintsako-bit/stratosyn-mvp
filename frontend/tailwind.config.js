/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        command: {
          bg: '#03070b',
          panel: 'rgba(7, 14, 22, 0.82)',
          panel2: 'rgba(12, 23, 34, 0.76)',
          line: 'rgba(110, 139, 161, 0.23)',
          text: '#d5e0e8',
          muted: '#7e8ea1',
          cyan: '#41b8c7',
          blue: '#6f8fa8',
          amber: '#c9a14a',
          red: '#c6535c',
          slate: '#64748b'
        }
      },
      boxShadow: {
        panel: '0 18px 60px rgba(0, 0, 0, 0.36)',
        glow: '0 0 28px rgba(45, 212, 255, 0.18)'
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Consolas', 'ui-monospace', 'SFMono-Regular', 'monospace']
      }
    }
  },
  plugins: []
};
