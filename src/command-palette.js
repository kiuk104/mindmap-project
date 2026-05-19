/**
 * command-palette.js — Ctrl+K 명령 팔레트
 */

let overlay, input, list, commands = [];

export function registerCommands(cmds) {
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

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePalette();
  });

  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.cmd-item:not(.cmd-disabled)');
    const cur = list.querySelector('.cmd-item.active');
    let idx = Array.from(items).indexOf(cur);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
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

function fuzzyScore(query, target) {
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

function renderList(query) {
  const scored = commands
    .map((cmd) => {
      const labelScore = fuzzyScore(query, cmd.label);
      const keyScore   = Math.max(...(cmd.keywords ?? []).map((k) => fuzzyScore(query, k)));
      return { cmd, score: Math.max(labelScore, keyScore) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (!scored.length) {
    list.innerHTML = `<div class="cmd-empty">검색 결과 없음</div>`;
    return;
  }

  list.innerHTML = scored.map(({ cmd }, i) => `
    <div class="cmd-item ${i === 0 ? 'active' : ''} ${cmd.disabled ? 'cmd-disabled' : ''}"
         data-idx="${i}">
      <span class="cmd-icon">${cmd.icon ?? '▸'}</span>
      <span class="cmd-label">${cmd.label}</span>
      ${cmd.shortcut ? `<kbd class="cmd-shortcut">${cmd.shortcut}</kbd>` : ''}
      ${cmd.hint ? `<span class="cmd-hint">${cmd.hint}</span>` : ''}
    </div>`).join('');

  list.querySelectorAll('.cmd-item:not(.cmd-disabled)').forEach((el, i) => {
    el.addEventListener('mouseenter', () => {
      list.querySelectorAll('.cmd-item').forEach((x) => x.classList.remove('active'));
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
