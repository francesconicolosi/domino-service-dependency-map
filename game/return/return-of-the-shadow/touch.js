// ============================================================================
//  touch.js — on-screen controls for phones/tablets. Feeds the shim's key set
//  and dispatches keypressed, so game.js needs no touch-specific branching.
//  Shown only on coarse-pointer devices; keyboard remains primary on desktop.
// ============================================================================

(function () {
  'use strict';

  const root = document.getElementById('touch');
  if (!root) return;

  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  if (!coarse && !hasTouch) return; // desktop: keep it hidden
  root.classList.add('on');

  // gameplay buttons (everything except R / ENTER) are hidden during cutscenes
  const gameplayBtns = [];

  // A button either HOLDS a key (movement) or TAPS it (jump/attack).
  function makeButton(label, key, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'tbtn' + (opts.round ? ' round' : '');
    el.textContent = label;
    Object.assign(el.style, opts.style || {});
    if (opts.font) el.style.fontSize = opts.font;

    let active = false;
    function press(e) {
      if (e) e.preventDefault();
      if (active) return;
      active = true;
      el.classList.add('held');
      if (love._unlockAudio) love._unlockAudio();
      if (love._pressKey) love._pressKey(key);
      if (opts.tap && love._releaseKey) {
        // fire-and-forget: keypressed already ran; release on next tick so
        // isDown() reads false again (jump-buffer / attack are edge-triggered)
        setTimeout(function () { love._releaseKey(key); }, 40);
      }
    }
    function release(e) {
      if (e) e.preventDefault();
      if (!active) return;
      active = false;
      el.classList.remove('held');
      if (!opts.tap && love._releaseKey) love._releaseKey(key);
    }
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
    root.appendChild(el);
    if (!opts.always) gameplayBtns.push(el);   // R / ENTER pass opts.always
    return el;
  }

  const S = 66;   // button size
  const P = 22;   // padding from edges  // left / right at bottom-left
  const difficultyChoiceBtns = [];
  const btnLeft = makeButton('◀', 'left',  { style: { left: P + 'px', bottom: P + 'px', width: S + 'px', height: S + 'px' }, font: '26px' });
  const btnRight = makeButton('▶', 'right', { style: { left: (P + S + 14) + 'px', bottom: P + 'px', width: S + 'px', height: S + 'px' }, font: '26px' });
  difficultyChoiceBtns.push(btnLeft, btnRight);
  // up / down (climb, grab, let-go) stacked just right of the d-pad
  makeButton('▲', 'up',   { style: { left: (P + (S + 14) * 2) + 'px', bottom: (P + S + 14) + 'px', width: S + 'px', height: S + 'px' }, font: '22px' });
  makeButton('▼', 'down', { style: { left: (P + (S + 14) * 2) + 'px', bottom: P + 'px', width: S + 'px', height: S + 'px' }, font: '22px' });

  // action buttons bottom-right: Jump + Attack + Block
  makeButton('JUMP', 'space', { round: true, tap: true, style: { right: P + 'px', bottom: (P + 8) + 'px', width: (S + 18) + 'px', height: (S + 18) + 'px' }, font: '15px' });
  makeButton('ATK',  'x',     { round: true, tap: true, style: { right: (P + S + 34) + 'px', bottom: P + 'px', width: S + 'px', height: S + 'px' }, font: '15px' });
  // BLK is a HOLD button (not a tap): L2/L3 read the press edge for a parry, and
  // Level 5's Fire-Sword reads the held key for its 2-second charge.
  makeButton('BLK',  'c',     { round: true, style: { right: (P + S + 34) + 'px', bottom: (P + S + 24) + 'px', width: S + 'px', height: S + 'px' }, font: '15px' });

  // small utility taps top-right: Restart + Enter (castle) — always available,
  // including during cutscenes
  makeButton('R',     'r',      { tap: true, always: true, style: { right: P + 'px', top: P + 'px', width: '46px', height: '38px' }, font: '15px' });
  makeButton('ENTER', 'return', { tap: true, always: true, style: { right: (P + 56) + 'px', top: P + 'px', width: '80px', height: '38px' }, font: '13px' });
// hide the gameplay buttons while a cutscene is playing (keep only R / ENTER)
  let hidden = false;
  function syncCutscene() {
    const cut = !!(love._game && love._game.inCutscene && love._game.inCutscene());
    const diffChoice = !!(love._game && love._game.inDifficultyChoice && love._game.inDifficultyChoice());
    hidden = cut;
    for (const el of gameplayBtns) {
      const keepForDifficulty = diffChoice && difficultyChoiceBtns.indexOf(el) >= 0;
      el.style.display = (!cut || keepForDifficulty) ? 'flex' : 'none';
    }
    requestAnimationFrame(syncCutscene);
  }
  requestAnimationFrame(syncCutscene);
})();
