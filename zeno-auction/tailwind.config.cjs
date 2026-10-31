/**
 * ZenoBid design tokens — "Midnight Gold"
 *   ink    midnight navy surfaces (950 darkest → 500 lightest)
 *   royal  electric blue light (focus, links, energy)
 *   gold   champagne gold (money, winning, primary actions)
 *   pearl  soft white for type on dark
 *   hot    coral-red (outbid, drops, last call)   cyan: cool highlight
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#040918', 900: '#070f26', 800: '#0b1636', 700: '#12214a', 600: '#1b2f63', 500: '#2a4488' },
        royal: { DEFAULT: '#2f6bff', 300: '#8fb0ff', 400: '#5b8cff', 600: '#1f4fd6' },
        gold: { DEFAULT: '#f2b84b', soft: '#ffe29a', deep: '#c98a12' },
        pearl: '#f4f7ff',
        hot: '#ff5c7a',
        cyan: { DEFAULT: '#5cc8ff' },
      },
      fontFamily: {
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        stage: ['"Barlow Condensed"', 'Impact', 'Arial Narrow', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '2xl': '1.15rem', '3xl': '1.6rem' },
      keyframes: {
        slam: {
          '0%': { transform: 'scale(4) rotate(-22deg)', opacity: '0' },
          '55%': { transform: 'scale(0.92) rotate(-12deg)', opacity: '1' },
          '75%': { transform: 'scale(1.06) rotate(-12deg)' },
          '100%': { transform: 'scale(1) rotate(-12deg)', opacity: '1' },
        },
        bump: {
          '0%': { transform: 'scale(0.86)', filter: 'brightness(1.8)' },
          '60%': { transform: 'scale(1.07)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
        rise: { '0%': { transform: 'translateY(14px)', opacity: '0' }, '100%': { transform: 'none', opacity: '1' } },
        pop: { '0%': { transform: 'scale(0.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 0 var(--glow)' }, '50%': { boxShadow: '0 0 40px 6px var(--glow)' } },
        confetti: {
          '0%': { transform: 'translate3d(0,-10vh,0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translate3d(var(--dx),110vh,0) rotate(var(--rot))', opacity: '0.9' },
        },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } },
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
          '0%': { color: '#ff5c7a', transform: 'translateY(-8px) scale(1.06)' },
          '100%': { transform: 'none' },
        },
        // a real "lub-dub" heartbeat; speed comes from --beat (seconds per beat)
        beat: {
          '0%,100%': { transform: 'scale(1)' },
          '12%': { transform: 'scale(1.07)' },
          '24%': { transform: 'scale(1)' },
          '38%': { transform: 'scale(1.045)' },
          '60%': { transform: 'scale(1)' },
        },
        beatglow: {
          '0%,100%': { opacity: '0.35' },
          '12%': { opacity: '1' },
          '24%': { opacity: '0.4' },
          '38%': { opacity: '0.8' },
          '60%': { opacity: '0.35' },
        },
        ping: { '0%': { transform: 'scale(0.8)', opacity: '0.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        shine: { '0%': { transform: 'translateX(-130%) skewX(-18deg)' }, '60%,100%': { transform: 'translateX(230%) skewX(-18deg)' } },
        tape: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(3%,-4%,0) scale(1.08)' } },
        twinkle: { '0%,100%': { opacity: '0.25' }, '50%': { opacity: '1' } },
        ecg: { '0%': { strokeDashoffset: '260' }, '100%': { strokeDashoffset: '0' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        slam: 'slam 0.7s cubic-bezier(.2,.9,.3,1) both',
        bump: 'bump 0.45s ease-out',
        rise: 'rise 0.45s cubic-bezier(.2,.8,.2,1) both',
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
        beat: 'beat var(--beat, 1.2s) ease-in-out infinite',
        beatglow: 'beatglow var(--beat, 1.2s) ease-in-out infinite',
        ping: 'ping var(--beat, 1.2s) cubic-bezier(0,0,.2,1) infinite',
        shine: 'shine 3.6s ease-in-out infinite',
        tape: 'tape var(--tape, 40s) linear infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        drift: 'drift 18s ease-in-out infinite',
        twinkle: 'twinkle 1.4s ease-in-out infinite',
        ecg: 'ecg var(--beat, 1.2s) linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
