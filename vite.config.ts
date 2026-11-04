import {defineConfig} from 'vitest/config';
export default defineConfig({base:'./',test:{include:['src/**/*.test.ts']},build:{target:'es2022'}});

