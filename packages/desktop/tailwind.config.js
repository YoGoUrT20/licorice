/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                steel: {
                    base: '#1a1c1e',
                    light: '#414549',
                    edge: '#52585e',
                },
                accent: {
                    copper: '#c58e65',
                    active: '#94abbd',
                }
            },
            backgroundImage: {
                'gearbox-gradient': 'radial-gradient(circle at top left, #2c3035 0%, #121416 100%)',
            },
            fontFamily: {
                'grotesk': ['"Space Grotesk"', 'sans-serif'],
                'mono': ['"JetBrains Mono"', 'monospace'],
            }
        },
    },
    plugins: [],
}
