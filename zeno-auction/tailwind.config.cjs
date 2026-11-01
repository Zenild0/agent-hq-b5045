/**
 * ZenoBid design tokens — "Midnight Gold"
 *   ink    midnight navy surfaces (950 darkest → 500 lightest)
 *   royal  electric blue light (focus, links, energy)
 *   gold   champagne gold (money, winning, primary actions)
 *   pearl  soft white for type on dark
 *   hot    coral-red (outbid, drops, last call)   cyan: cool highlight
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every colour is a CSS variable ("r g b") filled in by the active theme (shared/themes.ts), so the
      // whole app can switch theme and light/dark without rebuilding.
      colors: {
        ink: { 950: v('ink-950'), 900: v('ink-900'), 800: v('ink-800'), 700: v('ink-700'), 600: v('ink-600'), 500: v('ink-500') },
        royal: { DEFAULT: v('royal'), 300: v('royal-300'), 400: v('royal-400'), 600: v('royal-600') },
        gold: { DEFAULT: v('gold'), soft: v('gold-soft'), deep: v('gold-deep') },
        onaccent: v('on-accent'),
        pearl: v('pearl'),
        white: v('white'),
        hot: v('hot'),
        cyan: { DEFAULT: v('cyan') },
        slate: { 100: v('slate-100'), 200: v('slate-200'), 300: v('slate-300'), 400: v('slate-400'), 500: v('slate-500'), 600: v('slate-600') },
        emerald: { 100: v('emerald-100'), 200: v('emerald-200'), 300: v('emerald-300'), 400: v('emerald-400'), 950: v('emerald-950') },
        red: { 100: v('red-100'), 200: v('red-200'), 300: v('red-300'), 400: v('red-400'), 500: v('red-500') },
        amber: { 100: v('amber-100'), 200: v('amber-200'), 300: v('amber-300'), 400: v('amber-400'), 500: v('amber-500') },
        orange: { 400: v('orange-400') },
      },
      fontFamily: {
        display: 'var(--font-display)',
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
