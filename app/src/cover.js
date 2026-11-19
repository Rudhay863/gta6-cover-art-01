// Vice Cover — poster render engine.
// Draws the multi-panel GTA-style cover onto any 2d canvas: four photo panels
// in a white-gutter collage, a Vice City sunset/neon colour grade, and a big
// condensed caption with a hard outline. Pure canvas, no network, no library.

export const SIZES = {
  square: { label: '1080 × 1080 · Square post', w: 1080, h: 1080 },
  portrait: { label: '1080 × 1350 · Portrait post', w: 1080, h: 1350 },
  wide: { label: '1920 × 1080 · Wide post', w: 1920, h: 1080 },
};

// Colour grades: warm wash, pink shadow tint, saturation lift and vignette.
export const GRADES = {
  sunset: { name: 'Sunset', warm: 0.34, pink: 0.22, sat: 1.18, vig: 0.34 },
  neon: { name: 'Neon Nights', warm: 0.10, pink: 0.42, sat: 1.32, vig: 0.42 },
  golden: { name: 'Golden Hour', warm: 0.48, pink: 0.06, sat: 1.12, vig: 0.26 },
  noir: { name: 'Noir Pink', warm: 0.05, pink: 0.30, sat: 0.72, vig: 0.55 },
};

export const CAPTION_COLORS = {
  white: '#ffffff',
  pink: '#ff5da2',
  gold: '#ffc53d',
  cyan: '#4de8e8',
};

// Default crop for each panel when one photo fills all four: different zoom and
// pan per panel so a single photo reads as a collage, not four copies.
export const PANEL_DEFAULTS = [
  { zoom: 1.0, panX: 0.5, panY: 0.42 }, // hero, top-left
  { zoom: 1.25, panX: 0.78, panY: 0.45 }, // tall, top-right
  { zoom: 1.45, panX: 0.22, panY: 0.30 }, // small, bottom-left
  { zoom: 1.1, panX: 0.6, panY: 0.5 }, // wide, bottom-right
];

export function blankState() {
  return {
    size: 'wide',
    grade: 'sunset',
    gradeStrength: 1,
    caption: 'SUNSET HEIST',
    subtitle: 'VICE CITY',
    captionSize: 1,
    captionColor: 'white',
    outline: true,
    samePhoto: true,
    panels: PANEL_DEFAULTS.map((d) => ({
      source: 'pier',
      image: null,
      zoom: d.zoom,
      panX: d.panX,
      panY: d.panY,
    })),
  };
}

// Panel rectangles as fractions of the poster, per aspect. The hero takes the
// top-left, a tall panel the top-right, and two panels share the bottom row;
// the caption sits across the bottom row on a dark scrim.
export function panelRects(w, h) {
  const frame = Math.round(Math.min(w, h) * 0.016);
  const gut = Math.round(Math.min(w, h) * 0.012);
  const x0 = frame;
  const y0 = frame;
  const x1 = w - frame;
  const y1 = h - frame;
  const splitY = y0 + Math.round((y1 - y0) * 0.60);
  const splitXTop = x0 + Math.round((x1 - x0) * 0.58);
  const splitXBot = x0 + Math.round((x1 - x0) * 0.34);
  return [
    { x: x0, y: y0, w: splitXTop - gut / 2 - x0, h: splitY - gut / 2 - y0 },
    { x: splitXTop + gut / 2, y: y0, w: x1 - splitXTop - gut / 2, h: splitY - gut / 2 - y0 },
    { x: x0, y: splitY + gut / 2, w: splitXBot - gut / 2 - x0, h: y1 - splitY - gut / 2 },
    { x: splitXBot + gut / 2, y: splitY + gut / 2, w: x1 - splitXBot - gut / 2, h: y1 - splitY - gut / 2 },
  ];
}

function coverFit(img, rect, zoom, panX, panY) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) * panX;
  const dy = rect.y + (rect.h - dh) * panY;
  return { dx, dy, dw, dh };
}

// A tiny deterministic noise tile for film grain, drawn once and reused.
let grainTile = null;
function makeGrain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 140;
  c.height = 140;
  const g = c.getContext('2d');
  const data = g.createImageData(140, 140);
  let seed = 20261119;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return c;
}

// Procedural sample art: a sunset cityscape drawn by code — sky gradient, sun,
// skyline silhouettes, lit windows and a neon waterfront. Used as a built-in
// sample and as the fallback when no photo is loaded.
export function drawCityscape(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b0f54');
  sky.addColorStop(0.38, '#8a1e63');
  sky.addColorStop(0.62, '#ff5e62');
  sky.addColorStop(0.8, '#ff9a3d');
  sky.addColorStop(1, '#ffc53d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun, low over the skyline but high enough to clear most rooftops.
  const sunR = w * 0.12;
  const sunX = w * 0.68;
  const sunY = h * 0.40;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.85)');
  glow.addColorStop(1, 'rgba(255, 94, 98, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Back skyline, hazy purple.
  ctx.fillStyle = '#5b2360';
  let x = 0;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (x < w) {
    const bw = w * (0.05 + rnd() * 0.07);
    const bh = h * (0.18 + rnd() * 0.22);
    ctx.fillRect(x, h * 0.62 - bh, bw, bh + h * 0.4);
    x += bw + w * 0.008;
  }
  // Front skyline, near-black, with lit windows.
  ctx.fillStyle = '#160a24';
  x = 0;
  while (x < w) {
    const bw = w * (0.06 + rnd() * 0.08);
    const bh = h * (0.26 + rnd() * 0.24);
    const top = h * 0.72 - bh;
    ctx.fillRect(x, top, bw, bh + h * 0.3);
    ctx.fillStyle = 'rgba(255, 197, 61, 0.9)';
    for (let wy = top + h * 0.03; wy < h * 0.68; wy += h * 0.045) {
      for (let wx = x + bw * 0.15; wx < x + bw * 0.85; wx += bw * 0.28) {
        if (rnd() > 0.55) ctx.fillRect(wx, wy, Math.max(2, bw * 0.07), Math.max(2, h * 0.012));
      }
    }
    ctx.fillStyle = '#160a24';
    x += bw + w * 0.01;
  }
  // Waterfront strip with neon reflections.
  const water = ctx.createLinearGradient(0, h * 0.72, 0, h);
  water.addColorStop(0, '#3a1040');
  water.addColorStop(1, '#12041c');
  ctx.fillStyle = water;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.strokeStyle = 'rgba(255, 93, 162, 0.55)';
  ctx.lineWidth = Math.max(2, h * 0.004);
  for (let i = 0; i < 7; i++) {
    const yy = h * (0.76 + i * 0.033);
    ctx.beginPath();
    ctx.moveTo(w * 0.08, yy);
    ctx.lineTo(w * (0.3 + rnd() * 0.6), yy);
    ctx.stroke();
  }
  return ctx.canvas;
}

let cityCanvas = null;
function cityFallback() {
  if (!cityCanvas) {
    cityCanvas = document.createElement('canvas');
    cityCanvas.width = 960;
    cityCanvas.height = 960;
    drawCityscape(cityCanvas.getContext('2d'), 960, 960);
  }
  return cityCanvas;
}

function gradeOverlay(ctx, w, h, grade, strength) {
  // A unifying tint over the whole poster first, so even a bright daylight
  // photo bends toward sunset or neon. 'overlay' keeps the photo's detail.
  const tints = {
    sunset: '255, 120, 40',
    neon: '255, 45, 149',
    golden: '255, 170, 60',
    noir: '120, 40, 160',
  };
  const tintAlpha = { sunset: 0.20, neon: 0.16, golden: 0.22, noir: 0.14 };
  const key = Object.keys(GRADES).find((k) => GRADES[k] === grade) || 'sunset';
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = `rgba(${tints[key]}, ${tintAlpha[key] * strength})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Warm wash from the top-left, pink in the shadows, then vignette + grain.
  const warm = ctx.createLinearGradient(0, 0, w * 0.4, h);
  warm.addColorStop(0, `rgba(255, 122, 26, ${0.55 * grade.warm * strength})`);
  warm.addColorStop(1, 'rgba(255, 122, 26, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  const pink = ctx.createLinearGradient(0, h, w, 0);
  pink.addColorStop(0, `rgba(255, 45, 149, ${0.45 * grade.pink * strength})`);
  pink.addColorStop(1, 'rgba(255, 45, 149, 0)');
  ctx.fillStyle = pink;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(10, 2, 20, 0)');
  vig.addColorStop(1, `rgba(10, 2, 20, ${grade.vig * strength})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.05 * strength;
  ctx.fillStyle = ctx.createPattern(makeGrain(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawCaption(ctx, w, h, state) {
  const frame = Math.min(w, h) * 0.016;
  const rects = panelRects(w, h);
  const bottom = rects[2];
  // Dark scrim behind the lettering so it reads over any photo.
  const scrim = ctx.createLinearGradient(0, bottom.y - h * 0.06, 0, h - frame);
  scrim.addColorStop(0, 'rgba(12, 2, 24, 0)');
  scrim.addColorStop(0.45, `rgba(12, 2, 24, ${0.55 * state.gradeStrength + 0.2})`);
  scrim.addColorStop(1, 'rgba(12, 2, 24, 0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(frame, bottom.y - h * 0.06, w - frame * 2, h - frame - bottom.y + h * 0.06);

  const text = (state.caption || 'UNTITLED').toUpperCase();
  const sub = (state.subtitle || '').toUpperCase();
  const base = Math.min(w, h) * 0.115 * state.captionSize;
  // Fit the caption to the poster width, then condense it for poster punch.
  let size = base;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const measure = (s) => {
    ctx.font = `900 ${s}px "Vice Bold", "Liberation Sans", sans-serif`;
    return ctx.measureText(text).width * 0.84;
  };
  while (size > base * 0.4 && measure(size) > w - frame * 2 - w * 0.06) size *= 0.94;
  const baseline = h - frame - Math.min(w, h) * 0.045 - (sub ? Math.min(w, h) * 0.045 : 0);
  ctx.translate(frame + w * 0.035, baseline);
  ctx.rotate(-0.022);
  ctx.scale(0.84, 1);
  ctx.font = `900 ${size}px "Vice Bold", "Liberation Sans", sans-serif`;
  ctx.fillStyle = CAPTION_COLORS[state.captionColor] || '#ffffff';
  if (state.outline) {
    ctx.lineWidth = Math.max(2, size * 0.055);
    ctx.strokeStyle = '#12041f';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
  }
  ctx.shadowColor = 'rgba(255, 45, 149, 0.85)';
  ctx.shadowBlur = size * 0.10;
  ctx.shadowOffsetY = size * 0.02;
  ctx.fillText(text, 0, 0);
  ctx.restore();

  if (sub) {
    const subSize = Math.min(w, h) * 0.038;
    ctx.save();
    ctx.font = `700 ${subSize}px "Vice Regular", "Liberation Sans", sans-serif`;
    ctx.fillStyle = '#ff5da2';
    ctx.shadowColor = 'rgba(255, 45, 149, 0.9)';
    ctx.shadowBlur = subSize * 0.5;
    const letters = sub.split('').join('  ');
    ctx.fillText(letters, frame + w * 0.035, h - frame - Math.min(w, h) * 0.038);
    ctx.restore();
  }

  // Corner tag, top-left of the hero panel.
  const tagSize = Math.min(w, h) * 0.026;
  ctx.save();
  ctx.font = `700 ${tagSize}px "Vice Regular", "Liberation Sans", sans-serif`;
  const tag = '★ VICE COVER';
  const pad = tagSize * 0.7;
  const tw = ctx.measureText(tag).width + pad * 2;
  ctx.fillStyle = 'rgba(12, 2, 24, 0.72)';
  ctx.fillRect(rects[0].x + tagSize * 0.5, rects[0].y + tagSize * 0.5, tw, tagSize * 2.1);
  ctx.fillStyle = '#ffc53d';
  ctx.fillText(tag, rects[0].x + tagSize * 0.5 + pad, rects[0].y + tagSize * 0.5 + tagSize * 1.45);
  ctx.restore();
}

// Draw the whole poster onto ctx at its own size. `state.panels[i].image` must
// be a loaded image (or null, in which case the procedural cityscape fills in).
export function drawCover(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // White poster frame.
  ctx.fillStyle = '#f5efe4';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(w, h);
  const fallback = cityFallback();
  state.panels.forEach((panel, i) => {
    const r = rects[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const img = panel.image || fallback;
    const fit = coverFit(img, r, panel.zoom, panel.panX, panel.panY);
    ctx.filter = `saturate(${grade.sat}) contrast(1.06)`;
    ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
    ctx.filter = 'none';
    ctx.restore();
  });
  gradeOverlay(ctx, w, h, grade, state.gradeStrength);
  drawCaption(ctx, w, h, state);
  ctx.restore();
}

// Render the poster at an export size and return a PNG blob.
export function exportCover(state, sizeKey) {
  const size = SIZES[sizeKey] || SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
