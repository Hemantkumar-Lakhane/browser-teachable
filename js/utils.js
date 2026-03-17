// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

// ── UI Helpers ───────────────────────────────────────────────────

export function setStatus(msg, type = '') {
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.textContent = msg;
    statusBar.className = type;
  }
}

export function setPipe(step) {
  const pipeEls = {
    load:    document.getElementById('ps-load'),
    collect: document.getElementById('ps-collect'),
    embed:   document.getElementById('ps-embed'),
    train:   document.getElementById('ps-train'),
    predict: document.getElementById('ps-predict'),
  };
  const order = ['load','collect','embed','train','predict'];
  const idx = order.indexOf(step);
  order.forEach((k, i) => {
    if (!pipeEls[k]) return;
    pipeEls[k].classList.remove('active','done');
    if (i < idx)  pipeEls[k].classList.add('done');
    if (i === idx) pipeEls[k].classList.add('active');
  });
}

// ── Math & Color Helpers ─────────────────────────────────────────

export function cosineSim(a, b) {
  let dot=0, mA=0, mB=0;
  for (let i=0; i<a.length; i++) { dot+=a[i]*b[i]; mA+=a[i]*a[i]; mB+=b[i]*b[i]; }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB) || 1);
}

export function thermalColor(t) {
  let r, g, b;
  if (t < 0.25) {
    const s = t / 0.25;
    r = 0; g = 0; b = Math.round(s * 255);
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    r = 0; g = Math.round(s * 255); b = 255;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    r = Math.round(s * 255); g = 255; b = Math.round((1 - s) * 255);
  } else {
    const s = (t - 0.75) / 0.25;
    r = 255; g = Math.round((1 - s) * 255); b = 0;
  }
  return [r, g, b];
}

export function jetColor(t) {
  const r = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4*t - 3), 0), 1));
  const g = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4*t - 2), 0), 1));
  const b = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4*t - 1), 0), 1));
  return [r, g, b];
}
