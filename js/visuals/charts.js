// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store, timelineMax } from '../store.js';

// ── Global Chart.js Options ──────────────────────────────────────

const chartOpts = {
  responsive: true,
  maintainAspectRatio: true,
  animation: false,
  plugins: {
    legend: { labels: { color:'#718096', font:{ size:10 } } }
  },
  scales: {
    x: { ticks:{ color:'#a0aec0', font:{size:9} }, grid:{ color:'#f0f4f8' } },
    y: { ticks:{ color:'#a0aec0', font:{size:9} }, grid:{ color:'#f0f4f8' } }
  }
};

// ── Training History Charts ──────────────────────────────────────

export function resetTrainingCharts() {
  if (store.lossChart) store.lossChart.destroy();
  if (store.accChart)  store.accChart.destroy();

  const lossEl = document.getElementById('lossChart');
  const accEl = document.getElementById('accChart');
  
  if (lossEl) {
    store.lossChart = new Chart(lossEl, {
      type: 'line',
      data: { labels:[], datasets:[{
        label:'Loss', data:[], borderColor:'#f6ad55',
        backgroundColor:'rgba(246,173,85,0.1)', borderWidth:2,
        pointRadius:0, tension:0.3, fill:true
      }]},
      options: { ...chartOpts, scales:{ ...chartOpts.scales, y:{ ...chartOpts.scales.y, min:0 } } }
    });
  }

  if (accEl) {
    store.accChart = new Chart(accEl, {
      type: 'line',
      data: { labels:[], datasets:[{
        label:'Accuracy', data:[], borderColor:'#48bb78',
        backgroundColor:'rgba(72,187,120,0.1)', borderWidth:2,
        pointRadius:0, tension:0.3, fill:true
      }]},
      options: { ...chartOpts, scales:{ ...chartOpts.scales, y:{ ...chartOpts.scales.y, min:0, max:1 } } }
    });
  }
}

export function pushTrainingCharts(epoch, loss, acc) {
  if (store.lossChart) {
    store.lossChart.data.labels.push(`E${epoch}`);
    store.lossChart.data.datasets[0].data.push(+loss.toFixed(4));
    store.lossChart.update('none');
  }
  if (store.accChart) {
    store.accChart.data.labels.push(`E${epoch}`);
    store.accChart.data.datasets[0].data.push(+acc.toFixed(4));
    store.accChart.update('none');
  }
}

// ── Live Confidence Timeline ─────────────────────────────────────

export function initTimelineChart() {
  if (store.timelineChart) store.timelineChart.destroy();

  const datasets = store.classes.map(cls => ({
    label: cls.name,
    data: [],
    borderColor: cls.pal.color,
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
  }));

  const el = document.getElementById('timelineChart');
  if (el) {
    store.timelineChart = new Chart(el, {
      type: 'line',
      data: { labels:[], datasets },
      options: {
        ...chartOpts,
        scales: {
          ...chartOpts.scales,
          y: { ...chartOpts.scales.y, min:0, max:100,
            ticks:{ ...chartOpts.scales.y.ticks, callback: v => v+'%' } }
        }
      }
    });
  }
}

export function pushTimeline(probs) {
  if (!store.timelineChart) return;
  store.timelineTick++;
  const lbl = `${store.timelineTick}`;

  if (store.timelineChart.data.labels.length >= timelineMax) {
    store.timelineChart.data.labels.shift();
    store.timelineChart.data.datasets.forEach(ds => ds.data.shift());
  }

  store.timelineChart.data.labels.push(lbl);
  store.classes.forEach((cls, i) => {
    if (store.timelineChart.data.datasets[i])
      store.timelineChart.data.datasets[i].data.push(+(probs[i]*100).toFixed(1));
  });
  store.timelineChart.update('none');
}
