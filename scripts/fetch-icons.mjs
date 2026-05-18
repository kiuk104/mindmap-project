/**
 * fetch-icons.mjs — Lucide / OpenMoji SVG 다운로더 + 카탈로그 생성기
 *
 * 실행: `npm run icons`
 *
 * 동작:
 *   1. icon-manifest.mjs를 읽어 각 아이콘을 GitHub raw에서 다운로드
 *   2. Lucide(sticker) — `currentColor`를 중립 회색 #8b949e로 치환
 *      (라이트/다크 테마 모두에서 보이는 톤)
 *   3. OpenMoji(illustration) — 원본 컬러 SVG 그대로 저장
 *   4. public/icons/<tier>/<Category>/<file>.svg에 저장
 *   5. src/icon-assets.js를 생성 (런타임 카탈로그 + 헬퍼)
 *   6. public/icons/LICENSE.txt에 라이선스 표기
 *
 * 환경: Node 18+ (전역 fetch 사용)
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST } from './icon-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const OUT_PUBLIC = path.join(ROOT, 'public', 'icons');
const OUT_ASSETS = path.join(ROOT, 'src',    'icon-assets.js');

const LUCIDE_BASE   = 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/';
const OPENMOJI_BASE = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/';

const STICKER_STROKE = '#8b949e';   // 라이트/다크 양쪽에서 보이는 중립 톤

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function resetDir(p) {
  if (existsSync(p)) await rm(p, { recursive: true, force: true });
  await mkdir(p, { recursive: true });
}

// ── Lucide ─────────────────────────────────────────────
async function downloadSticker() {
  const catalog = {};
  let ok = 0, fail = 0;

  for (const [cat, names] of Object.entries(MANIFEST.sticker)) {
    catalog[cat] = [];
    const dir = path.join(OUT_PUBLIC, 'sticker', cat);
    await ensureDir(dir);

    for (const name of names) {
      try {
        let svg = await fetchText(LUCIDE_BASE + name + '.svg');
        // 중립 회색으로 치환 — <img>로 로드해도 양쪽 테마에서 보임
        svg = svg.replace(/currentColor/g, STICKER_STROKE);
        const file = name + '.svg';
        await writeFile(path.join(dir, file), svg, 'utf8');
        catalog[cat].push({ id: `sticker/${cat}/${name}`, name, file });
        ok++;
        process.stdout.write(`  ✓ sticker/${cat}/${name}\n`);
      } catch (e) {
        fail++;
        process.stdout.write(`  ✗ sticker/${cat}/${name} (${e.message})\n`);
      }
    }
  }

  console.log(`Lucide: ${ok}개 성공 / ${fail}개 실패\n`);
  return catalog;
}

// ── OpenMoji ───────────────────────────────────────────
async function downloadIllustration() {
  const catalog = {};
  let ok = 0, fail = 0;

  for (const [cat, items] of Object.entries(MANIFEST.illustration)) {
    catalog[cat] = [];
    const dir = path.join(OUT_PUBLIC, 'illustration', cat);
    await ensureDir(dir);

    for (const item of items) {
      // 두 가지 코드 형식 시도 (FE0F 유무)
      const candidates = [item.code, item.code + '-FE0F'];
      let saved = false;

      for (const code of candidates) {
        try {
          const svg = await fetchText(OPENMOJI_BASE + code + '.svg');
          const file = `${item.name}.svg`;
          await writeFile(path.join(dir, file), svg, 'utf8');
          catalog[cat].push({ id: `illustration/${cat}/${item.name}`, name: item.name, file });
          saved = true;
          ok++;
          process.stdout.write(`  ✓ illustration/${cat}/${item.name} = ${code}\n`);
          break;
        } catch {
          /* try next candidate */
        }
      }
      if (!saved) {
        fail++;
        process.stdout.write(`  ✗ illustration/${cat}/${item.name} (모든 후보 실패)\n`);
      }
    }
  }

  console.log(`OpenMoji: ${ok}개 성공 / ${fail}개 실패\n`);
  return catalog;
}

// ── 카탈로그 JS 모듈 생성 ──────────────────────────────
function generateCatalogModule(sticker, illustration) {
  return `/**
 * icon-assets.js — fetch-icons.mjs가 자동 생성. 직접 편집하지 마세요.
 *
 * 새 아이콘을 원하면:
 *   1. scripts/icon-manifest.mjs를 수정
 *   2. \`npm run icons\` 재실행
 *
 * 자산 ID 형식: 'asset:<tier>/<Category>/<name>'
 *   예: 'asset:sticker/Business/briefcase'
 *       'asset:illustration/Travel/island'
 */

export const ICON_ASSETS = ${JSON.stringify({ sticker, illustration }, null, 2)};

/** 'asset:...' 형식 ID인지 검사 */
export function isAssetIcon(icon) {
  return typeof icon === 'string' && icon.startsWith('asset:');
}

/**
 * 자산 ID → public/ 기준 URL 변환.
 * 'asset:sticker/Business/briefcase'
 *   → '<BASE_URL>icons/sticker/Business/briefcase.svg'
 * 카탈로그에 없는 자산이면 null.
 */
export function assetIdToUrl(icon) {
  if (!isAssetIcon(icon)) return null;
  const parts = icon.slice('asset:'.length).split('/');
  if (parts.length !== 3) return null;
  const [tier, cat, name] = parts;
  const list = ICON_ASSETS[tier] && ICON_ASSETS[tier][cat];
  const item = list && list.find((it) => it.name === name);
  if (!item) return null;
  return import.meta.env.BASE_URL + 'icons/' + tier + '/' + cat + '/' + item.file;
}
`;
}

// ── 라이선스 표기 ──────────────────────────────────────
async function writeLicense() {
  const txt = `# Icon Assets — Licenses

This directory contains third-party icons fetched by \`npm run icons\`.

## Sticker — Lucide
- Source: https://lucide.dev/
- License: ISC (https://github.com/lucide-icons/lucide/blob/main/LICENSE)
- Lucide is a fork of Feather Icons (MIT).

## Illustration — OpenMoji
- Source: https://openmoji.org/
- License: CC BY-SA 4.0
- Attribution: "All emojis designed by OpenMoji – the open-source emoji and
  icon project. License: CC BY-SA 4.0"

When redistributing, keep this notice intact.
`;
  await writeFile(path.join(OUT_PUBLIC, 'LICENSE.txt'), txt, 'utf8');
}

// ── main ───────────────────────────────────────────────
async function main() {
  console.log('🧹 기존 public/icons/ 정리 중…');
  await resetDir(OUT_PUBLIC);

  console.log('⬇️  Lucide sticker 다운로드…');
  const sticker = await downloadSticker();

  console.log('⬇️  OpenMoji illustration 다운로드…');
  const illustration = await downloadIllustration();

  console.log('📝 src/icon-assets.js 생성…');
  await writeFile(OUT_ASSETS, generateCatalogModule(sticker, illustration), 'utf8');

  console.log('📜 LICENSE.txt 작성…');
  await writeLicense();

  console.log('\n✅ 완료. 다음 명령으로 빌드를 확인하세요: npm run build');
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
