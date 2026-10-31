/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07071a', 900: '#0d0d24', 800: '#15152e', 700: '#1f1f3d', 600: '#2c2c52' },
        gold: { DEFAULT: '#ffc933', soft: '#ffe08a' },
        hot: '#ff3d81',
        cyan: { DEFAULT: '#29e0ff' },
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'Arial Black', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        slam: {
          '0%': { transform: 'scale(4) rotate(-22deg)', opacity: '0' },
          '55%': { transform: 'scale(0.92) rotate(-12deg)', opacity: '1' },
          '75%': { transform: 'scale(1.06) rotate(-12deg)' },
          '100%': { transform: 'scale(1) rotate(-12deg)', opacity: '1' },
        },
        bump: {
          '0%': { transform: 'scale(0.85)', filter: 'brightness(2)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
        rise: { '0%': { transform: 'translateY(14px)', opacity: '0' }, '100%': { transform: 'none', opacity: '1' } },
        pop: { '0%': { transform: 'scale(0.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 0 var(--glow)' }, '50%': { boxShadow: '0 0 40px 6px var(--glow)' } },
        confetti: {
          '0%': { transform: 'translate3d(0,-10vh,0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translate3d(var(--dx),110vh,0) rotate(var(--rot))', opacity: '0.9' },
        },
        floatup: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.8)' },
          '15%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(-70px) scale(1.15)' },
        },
        fall: {
          '0%': { opacity: '0', transform: 'translateY(-14px) scale(0.8)' },
          '15%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(70px) scale(1.1)' },
        },
        spark: {
          '0%': { opacity: '1', transform: 'translate(0,0) scale(0.5) rotate(0)' },
          '100%': { opacity: '0', transform: 'translate(var(--sx), var(--sy)) scale(1.4) rotate(var(--sr))' },
        },
        edge: {
          '0%': { opacity: '0', boxShadow: 'inset 0 0 0 0 var(--edge)' },
          '25%': { opacity: '1', boxShadow: 'inset 0 0 160px 36px var(--edge)' },
          '100%': { opacity: '0.45', boxShadow: 'inset 0 0 90px 14px var(--edge)' },
        },
        edgepulse: {
          '0%,100%': { opacity: '0.35', boxShadow: 'inset 0 0 90px 14px var(--edge)' },
          '50%': { opacity: '1', boxShadow: 'inset 0 0 180px 44px var(--edge)' },
        },
        dropflash: {
          '0%': { color: '#ff3d57', transform: 'translateY(-8px) scale(1.06)' },
          '100%': { transform: 'none' },
        },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
      },
      animation: {
        slam: 'slam 0.7s cubic-bezier(.2,.9,.3,1) both',
        bump: 'bump 0.45s ease-out',
        rise: 'rise 0.35s ease-out both',
        pop: 'pop 0.25s ease-out both',
        glow: 'glow 1.6s ease-in-out infinite',
        confetti: 'confetti var(--dur) linear var(--delay) forwards',
        shake: 'shake 0.3s',
        floatup: 'floatup 1.3s ease-out forwards',
        fall: 'fall 1.3s ease-out forwards',
        spark: 'spark var(--dur) ease-out forwards',
        edge: 'edge 1.6s ease-out forwards',
        edgepulse: 'edgepulse 0.9s ease-in-out infinite',
        dropflash: 'dropflash 0.5s ease-out',
      },
    },
  },
  plugins: [],
};
