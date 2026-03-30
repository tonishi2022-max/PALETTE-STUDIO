const SIZE = 240, CX = 120, CY = 120;
const OUTER_R = 118, RING_W = 22, INNER_R = OUTER_R - RING_W - 6;

let hue = 20, sat = 72, light = 55;
let currentMode = 'analogous';
let dragZone = null;

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

/* ── Color conversion utilities ── */

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(8, Math.min(92, l));
  return rgbToHex(...hslToRgb(h, s, l));
}

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function currentHex() {
  return rgbToHex(...hslToRgb(hue, sat, light));
}

/* ── Wheel drawing ── */

function drawWheel() {
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - CX, dy = y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      const idx = (y * SIZE + x) * 4;

      if (dist >= OUTER_R - RING_W && dist <= OUTER_R) {
        const [r, g, b] = hslToRgb(angle, 90, 55);
        d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
      } else if (dist < INNER_R) {
        const innerSat = (dx / INNER_R + 1) / 2 * 100;
        const innerLight = (1 - (dy / INNER_R + 1) / 2) * 80 + 10;
        const [r, g, b] = hslToRgb(hue, innerSat, innerLight);
        d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
      } else {
        d[idx+3] = 0;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.save();

  ctx.beginPath();
  ctx.arc(CX, CY, OUTER_R + 0.5, 0, Math.PI * 2);
  ctx.arc(CX, CY, OUTER_R - RING_W - 0.5, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX, CY, INNER_R + 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const hueAngle = hue * Math.PI / 180;
  const midR = OUTER_R - RING_W / 2;
  const hx = CX + midR * Math.cos(hueAngle);
  const hy = CY + midR * Math.sin(hueAngle);

  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const hueColor = rgbToHex(...hslToRgb(hue, 90, 55));
  ctx.beginPath();
  ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = hueColor;
  ctx.fill();

  ctx.restore();

  const ix = CX + ((sat / 100) * 2 - 1) * INNER_R;
  const iy = CY + (1 - (light - 10) / 80) * 2 * INNER_R - INNER_R;
  const innerCursor = document.getElementById('innerCursor');
  innerCursor.style.left = ix + 'px';
  innerCursor.style.top = iy + 'px';
  innerCursor.style.background = currentHex();
}

function updateSelected() {
  const hex = currentHex();
  document.getElementById('selectedSwatch').style.background = hex;
  document.getElementById('selectedHex').textContent = hex.toUpperCase();
}

/* ── Drag interaction ── */

function getZone(x, y) {
  const dx = x - CX, dy = y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= OUTER_R - RING_W - 4 && dist <= OUTER_R + 4) return 'ring';
  if (dist < INNER_R + 4) return 'inner';
  return null;
}

function handlePick(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = SIZE / rect.width;
  const x = (clientX - rect.left) * scale;
  const y = (clientY - rect.top) * scale;
  const dx = x - CX, dy = y - CY;

  if (dragZone === 'ring') {
    hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
  } else if (dragZone === 'inner') {
    sat = Math.max(0, Math.min(100, (dx / INNER_R + 1) / 2 * 100));
    light = Math.max(10, Math.min(90, (1 - (dy / INNER_R + 1) / 2) * 80 + 10));
  }
  drawWheel();
  updateSelected();
}

function startDrag(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = SIZE / rect.width;
  const cx2 = e.touches ? e.touches[0].clientX : e.clientX;
  const cy2 = e.touches ? e.touches[0].clientY : e.clientY;
  const x = (cx2 - rect.left) * scale;
  const y = (cy2 - rect.top) * scale;
  dragZone = getZone(x, y);
  if (dragZone) handlePick(cx2, cy2);
}

function moveDrag(e) {
  if (!dragZone) return;
  const cx2 = e.touches ? e.touches[0].clientX : e.clientX;
  const cy2 = e.touches ? e.touches[0].clientY : e.clientY;
  handlePick(cx2, cy2);
}

canvas.addEventListener('mousedown', e => startDrag(e));
window.addEventListener('mousemove', e => moveDrag(e));
window.addEventListener('mouseup', () => dragZone = null);
canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(e); }, { passive: false });
window.addEventListener('touchend', () => dragZone = null);

/* ── Mode selection ── */

function setMode(btn) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMode = btn.dataset.mode;
}

/* ── Mood keyword map ── */

const moodMap = {
  sunset: '#E8693A', sunrise: '#F5A623', ocean: '#1A6B8A', forest: '#2D6A4F',
  desert: '#C4853A', lavender: '#8B72BE', rose: '#D4617A', sky: '#5BA4CF',
  midnight: '#1A1B4B', mint: '#3EB489', coral: '#FF6B6B', slate: '#5F7A8A',
  autumn: '#C0392B', spring: '#27AE60', winter: '#2980B9', summer: '#F39C12',
  earth: '#8B6914', smoke: '#95A5A6', cherry: '#C0392B', sage: '#6B8F71',
  rust: '#B7410E', blush: '#DE8FAB', gold: '#D4AC0D', indigo: '#3F51B5',
  fog: '#B0BEC5', sand: '#C2B280', storm: '#546E7A', lemon: '#F4D03F',
  wine: '#722F37', moss: '#8A9A5B', clay: '#B66A50', dusk: '#7B68A0',
  fire: '#E25822', ice: '#A8D8EA', pastel: '#FFD1DC', noir: '#444444',
  tropical: '#00B272', vintage: '#B5976A', cosmic: '#4B0082'
};

function resolveMood(keyword) {
  const lower = keyword.toLowerCase().trim();
  for (const [key, val] of Object.entries(moodMap)) {
    if (lower.includes(key)) return val;
  }
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = lower.charCodeAt(i) + ((hash << 5) - hash);
  return hslToHex(Math.abs(hash) % 360, 55, 50);
}

/* ── Palette generation ── */

function buildPalette(hex, mode) {
  const [h, s, l] = hexToHsl(hex);
  switch(mode) {
    case 'analogous':
      return [hslToHex(h-30,s,l+5), hslToHex(h-15,s,l+2), hex, hslToHex(h+15,s,l-2), hslToHex(h+30,s,l-5)];
    case 'complementary':
      return [hslToHex(h,s,l+22), hslToHex(h,s,l+8), hex, hslToHex(h+180,s,l+8), hslToHex(h+180,s,l-10)];
    case 'triadic':
      return [hslToHex(h,s,l+15), hex, hslToHex(h+120,s,l), hslToHex(h+240,s,l), hslToHex(h+240,s,l-12)];
    case 'split':
      return [hslToHex(h,s,l+15), hex, hslToHex(h,s,l-15), hslToHex(h+150,s,l), hslToHex(h+210,s,l)];
    case 'monochromatic':
      return [hslToHex(h,s-20,l+30), hslToHex(h,s-10,l+15), hex, hslToHex(h,s+5,l-15), hslToHex(h,s+10,l-28)];
  }
}

function generate() {
  const mood = document.getElementById('moodInput').value.trim();
  let base;
  if (mood) {
    base = resolveMood(mood);
    const [h, s, l] = hexToHsl(base);
    hue = h; sat = s; light = Math.max(20, Math.min(75, l));
    drawWheel();
    updateSelected();
  } else {
    base = currentHex();
  }
  const colors = buildPalette(base, currentMode);
  renderPalette(colors);
  document.getElementById('modeTag').textContent =
    currentMode.charAt(0).toUpperCase() + currentMode.slice(1).replace('-', ' ');
}

/* ── Render palette ── */

function renderPalette(colors) {
  const inner = document.getElementById('paletteInner');
  inner.innerHTML = '';

  colors.forEach(hex => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = hex;

    const hexLabel = document.createElement('div');
    hexLabel.className = 'swatch-hex';
    hexLabel.textContent = hex.toUpperCase();

    const copiedLabel = document.createElement('div');
    copiedLabel.className = 'swatch-copied';
    copiedLabel.textContent = 'Copied!';

    sw.appendChild(hexLabel);
    sw.appendChild(copiedLabel);
    sw.onclick = () => copyHex(hex, sw);
    inner.appendChild(sw);
  });

  document.getElementById('hexRowCard').style.display = 'block';
  const chips = document.getElementById('hexChips');
  chips.innerHTML = '';

  colors.forEach(hex => {
    const chip = document.createElement('div');
    chip.className = 'hex-chip';

    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = hex;

    const span = document.createElement('span');
    span.textContent = hex.toUpperCase();

    chip.appendChild(dot);
    chip.appendChild(span);
    chip.onclick = () => {
      navigator.clipboard.writeText(hex.toUpperCase());
      showToast(hex.toUpperCase() + ' copied');
    };
    chips.appendChild(chip);
  });
}

/* ── Copy & toast ── */

function copyHex(hex, swatch) {
  navigator.clipboard.writeText(hex.toUpperCase()).then(() => {
    swatch.classList.add('copied');
    setTimeout(() => swatch.classList.remove('copied'), 1200);
    showToast(hex.toUpperCase() + ' copied');
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

/* ── Init ── */
drawWheel();
updateSelected();
