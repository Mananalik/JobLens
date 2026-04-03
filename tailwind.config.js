/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        panel: '#1e293b',
        accent: '#6366f1',
        glow: '#22d3ee',
      },
      boxShadow: {
        glass: '0 20px 60px rgba(15, 23, 42, 0.35)',
        lift: '0 10px 30px rgba(15, 23, 42, 0.35)',
      },
      backgroundImage: {
        'radial-spot': 'radial-gradient(1200px 600px at 20% -10%, rgba(99, 102, 241, 0.25), transparent)',
        'mesh-dark': 'radial-gradient(600px 400px at 80% 20%, rgba(34, 211, 238, 0.15), transparent)',
      },
    },
  },
  plugins: [],
}

