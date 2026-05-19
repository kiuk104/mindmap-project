import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mindmap-project/',
  server: {
    // 포트 고정 — 자동 fallback(5174, 5175...) 방지.
    // OAuth 등록 origin과의 불일치(origin_mismatch) 회귀를 차단.
    port: 5173,
    strictPort: true,
  },
});
