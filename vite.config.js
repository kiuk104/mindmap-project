import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 점진적 TS 마이그레이션 지원 — `.js` 파일이 `import './foo.js'`로 작성돼 있는데
 * 실제 파일이 `./foo.ts`로 바뀐 경우 자동으로 `.ts`로 해석.
 *
 * TS 변환 진행 중에만 필요. 모든 .js → .ts 변환이 끝나면 제거해도 됨.
 */
function jsToTsFallback() {
  return {
    name: 'js-to-ts-fallback',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.endsWith('.js') || !importer) return null;
      if (!source.startsWith('./') && !source.startsWith('../')) return null;
      const importerDir = dirname(importer);
      const jsPath = resolve(importerDir, source);
      if (existsSync(jsPath)) return null; // .js가 실제로 존재하면 그대로
      const tsPath = jsPath.replace(/\.js$/, '.ts');
      if (existsSync(tsPath)) return tsPath;
      return null;
    },
  };
}

export default defineConfig({
  base: '/mindmap-project/',
  plugins: [jsToTsFallback()],
  server: {
    // 포트 고정 — 자동 fallback(5174, 5175...) 방지.
    // OAuth 등록 origin과의 불일치(origin_mismatch) 회귀를 차단.
    port: 5173,
    strictPort: true,
  },
});
