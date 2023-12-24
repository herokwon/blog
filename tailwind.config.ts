import type { Config } from 'tailwindcss'

const width0_2000: { [key: string]: string } = Object.assign(Array.from(Array(2001)).map((_, i) => `${i}px`));
const height0_2000: { [key: string]: string } = Object.assign(Array.from(Array(2001)).map((_, i) => `${i}px`));
const opacity0_200: { [key: string]: string } = Object.assign(Array.from(Array(201)).map((_, i) => `${(i / 100).toFixed(2)} `));

const config: Config = {
    darkMode: 'class',
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic':
                    'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
            fontFamily: {
                'sans-kr': 'var(--font-noto-sans-kr)',
            },
            width: width0_2000,
            height: height0_2000,
            margin: {
                'block': '1rem',
                'content': '0.25rem',
            },
            opacity: {
                ...opacity0_200,
                'bold': '87%',
                'normal': '60%',
                'off': '38%',
            },
            colors: {
                'light': 'var(--light-foreground)',
                'dark': 'var(--dark-foreground)',
            },
            backgroundColor: {
                'light-primary': 'var(--light-primary-background)',
                'light-secondary': 'var(--light-secondary-background)',
                'light-tertiary': 'var(--light-tertiary-background)',
                'dark-primary': 'var(--dark-primary-background)',
                'dark-secondary': 'var(--dark-secondary-background)',
                'dark-tertiary': 'var(--dark-tertiary-background)'
            },
        },
    },
    plugins: [],
}
export default config
