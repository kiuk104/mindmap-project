/**
 * command-palette.ts — Ctrl+K 명령 팔레트
 */

interface Command {
  label: string;
  icon?: string;
  keywords?: string[];
  shortcut?: string;
  hint?: string;
  /** boolean이거나 매 렌더마다 동적으로 평가하는 함수 */
  disabled?: boolean | (() => boolean);
  action: () => void;
}

let overlay: any, input: any, list: any;
let commands: Command[] = [];

export function registerCommands(cmds: Command[]) {
  commands = cmds;
}

export function initCommandPalette() {
  overlay = document.createElement('div');
  overlay.id = 'cmd-overlay';
  overlay.innerHTML = `
    <div id="cmd-palette">
      <div id="cmd-search-wrap">
        <span id="cmd-icon">⌘</span>
        <input id="cmd-input" type="text" placeholder="명령어 또는 기능 검색…" autocomplete="off" spellcheck="false" />
        <kbd id="cmd-esc-hint">Esc</kbd>
      </div>
      <div id="cmd-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  input = document.getElementById('cmd-input');
  list  = document.getElementById('cmd-list');

  overlay.addEventListener('click', (e: Event) => {
    if (e.target === overlay) closePalette();
  });

  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    const items = list.querySelectorAll('.cmd-item:not(.cmd-disabled)');
    const cur = list.querySelector('.cmd-item.active');
    let idx = Array.from(items).indexOf(cur);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
      items.forEach((el: Element, i: number) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      items.forEach((el: Element, i: number) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = list.querySelector('.cmd-item.active');
      if (active) { active.click(); }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });
}

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 2;
  let i = 0, j = 0, score = 0;
  while (i < q.length && j < t.length) {
    if (q[i] === t[j]) { i++; score++; }
    j++;
  }
  return i === q.length ? score / t.length : 0;
}

/** disabled가 함수면 호출, 아니면 truthy 그대로 평가 — 매 렌더 시점에 동적으로 갱신 */
function isDisabled(cmd: Command): boolean {
  return typeof cmd.disabled === 'function' ? !!cmd.disabled() : !!cmd.disabled;
}

function renderList(query: string) {
  const scored = commands
    .map((cmd: Command) => {
      const labelScore = fuzzyScore(query, cmd.label);
      const keyScore   = Math.max(...(cmd.keywords ?? []).map((k: string) => fuzzyScore(query, k)));
      return { cmd, score: Math.max(labelScore, keyScore), disabled: isDisabled(cmd) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (!scored.length) {
    list.innerHTML = `<div class="cmd-empty">검색 결과 없음</div>`;
    return;
  }

  // 첫 번째 active는 비활성이 아닌 항목 중 첫 번째로
  const firstActiveIdx = scored.findIndex((s) => !s.disabled);

  list.innerHTML = scored.map(({ cmd, disabled }, i) => `
    <div class="cmd-item ${i === firstActiveIdx ? 'active' : ''} ${disabled ? 'cmd-disabled' : ''}"
         data-idx="${i}">
      <span class="cmd-icon">${cmd.icon ?? '▸'}</span>
      <span class="cmd-label">${cmd.label}</span>
      ${cmd.shortcut ? `<kbd class="cmd-shortcut">${cmd.shortcut}</kbd>` : ''}
      ${cmd.hint ? `<span class="cmd-hint">${cmd.hint}</span>` : ''}
    </div>`).join('');

  list.querySelectorAll('.cmd-item:not(.cmd-disabled)').forEach((el: any) => {
    const i = Number(el.dataset.idx);
    el.addEventListener('mouseenter', () => {
      list.querySelectorAll('.cmd-item').forEach((x: any) => x.classList.remove('active'));
      el.classList.add('active');
    });
    el.addEventListener('click', () => {
      closePalette();
      scored[i].cmd.action();
    });
  });
}

export function openPalette() {
  overlay.classList.add('open');
  input.value = '';
  renderList('');
  requestAnimationFrame(() => input.focus());
}

export function closePalette() {
  overlay.classList.remove('open');
}
