/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          cyan: '#00E5FF',
          green: '#00FF88',
          amber: '#FFB300',
          red: '#FF3D57',
          violet: '#7B61FF'
        },
        dark: {
          base: '#050B18',
          surface: '#0A1628',
          elevated: '#0F2040',
          border: '#1A3050'
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out'
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 5px #00E5FF' },
          '50%': { boxShadow: '0 0 25px #00E5FF, 0 0 50px #00E5FF33' }
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 }
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        }
      }
    }
  },
  plugins: []
}
