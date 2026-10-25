import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FFCC00',
          hover: '#E6B800',
        },
        background: '#121212',
        surface: '#1E1E1E',
        border: '#3A3A3A',
      },
    },
  },
  plugins: [],
};

export default config;
