import { defineConfig } from 'vitest/config';
// Pin the worker timezone so calendar regressions exercise real DST transitions.
export default defineConfig({ test: { env: { TZ: 'Europe/London' }, environment: 'jsdom', environmentOptions: { jsdom: { url: 'https://www.youtube.com/' } }, clearMocks: true } });
