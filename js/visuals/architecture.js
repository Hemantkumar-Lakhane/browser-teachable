import { store } from '../store.js';
export function drawArchDiagram() {
  const archSvg = document.getElementById('arch-svg');
  if (!archSvg) return;
  const n = store.classes.length || 2;
  const cfg = store.trainingConfig || {};
  const backboneLabel = store.backbone?.shortLabel || store.backbone?.label || 'MobileNet v1';
  const embeddingSize = store.embeddingSize || 1024;
  const hiddenUnits = cfg.hiddenUnits || 128;
  const secondDense = Math.max(8, Math.round(hiddenUnits / 2));
  const dropoutPct = Math.round((cfg.dropoutRate ?? 0.3) * 100);
  const layers = [{
    label: 'Your Image',
    sub: '224x224px',
    neurons: 0,
    special: 'img',
    color: '#667eea'
  }, {
    label: backboneLabel,
    sub: 'frozen extractor',
    neurons: 0,
    special: 'frozen',
    color: '#9f7aea'
  }, {
    label: 'Embedding',
    sub: `${embeddingSize} features`,
    neurons: 8,
    special: '',
    color: '#667eea'
  }, {
    label: `Dense(${hiddenUnits})`,
    sub: 'ReLU activation',
    neurons: 6,
    special: '',
    color: '#48bb78'
  }, {
    label: 'Dropout',
    sub: `${dropoutPct}% rate`,
    neurons: 0,
    special: 'drop',
    color: '#f6ad55'
  }, {
    label: `Dense(${secondDense})`,
    sub: 'ReLU activation',
    neurons: 5,
    special: '',
    color: '#48bb78'
  }, {
    label: 'Output',
    sub: `${n} classes - Softmax`,
    neurons: Math.min(n, 5),
    special: 'out',
    color: '#f56565'
  }];
  const W = 780,
    H = 130;
  const colW = W / layers.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;font-family:Segoe UI,sans-serif;">`;
  for (let i = 0; i < layers.length - 1; i++) {
    const x1 = colW * i + colW * 0.78;
    const x2 = colW * (i + 1) + colW * 0.22;
    svg += `<line x1="${x1}" y1="50" x2="${x2}" y2="50" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="${layers[i + 1].special === 'frozen' ? '4,3' : '0'}"/>`;
  }
  layers.forEach((l, i) => {
    const cx = colW * i + colW / 2;
    if (l.special === 'img') {
      svg += `<rect x="${cx - 18}" y="26" width="36" height="28" rx="5" fill="${l.color}" opacity="0.15" stroke="${l.color}" stroke-width="1.5"/>`;
      svg += `<text x="${cx}" y="47" text-anchor="middle" font-size="16">IMG</text>`;
    } else if (l.special === 'frozen') {
      svg += `<rect x="${cx - 24}" y="22" width="48" height="36" rx="6" fill="${l.color}" opacity="0.15" stroke="${l.color}" stroke-width="1.5"/>`;
      svg += `<text x="${cx}" y="38" text-anchor="middle" font-size="8.5" font-weight="700" fill="${l.color}">${l.label.split(' ')[0]}</text>`;
      svg += `<text x="${cx}" y="50" text-anchor="middle" font-size="8" fill="#9f7aea">FROZEN</text>`;
    } else if (l.special === 'drop') {
      svg += `<rect x="${cx - 18}" y="28" width="36" height="24" rx="4" fill="none" stroke="${l.color}" stroke-width="1.5" stroke-dasharray="4,2"/>`;
      svg += `<text x="${cx}" y="44" text-anchor="middle" font-size="9" fill="${l.color}">${dropoutPct}%</text>`;
    } else {
      const dots = l.neurons;
      const r = 5;
      const gap = 13;
      const totalH = dots * gap - gap * 0.3;
      const startY = 50 - totalH / 2;
      for (let d = 0; d < dots; d++) {
        const cy = startY + d * gap;
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${l.color}" opacity="0.8"/>`;
      }
      if (l.special === 'out' && n > 5) {
        svg += `<text x="${cx}" y="${startY + dots * gap + 6}" text-anchor="middle" font-size="9" fill="#a0aec0">+${n - 5} more</text>`;
      }
    }
    svg += `<text x="${cx}" y="96" text-anchor="middle" font-size="9.5" font-weight="700" fill="#4a5568">${l.label}</text>`;
    svg += `<text x="${cx}" y="110" text-anchor="middle" font-size="8" fill="#a0aec0">${l.sub}</text>`;
  });
  svg += '</svg>';
  archSvg.setHTMLUnsafe(svg);
}