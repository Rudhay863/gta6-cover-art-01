// Vice Cover — editor wiring.
// Owns the page state, loads photos (upload, samples, or the drawn cityscape),
// keeps the live preview in sync with the controls, and exports the PNG.
// Shot mode (?shot=cover|editor) renders a fixed cover for screenshots.

import {
  SIZES, GRADES, blankState, drawCover, exportCover, drawCityscape, panelRects,
} from './cover.js';

const $ = (id) => document.getElementById(id);
const canvas = $('poster');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const state = blankState();

let selected = 0;
let cityCanvas = null;

function getCityCanvas() {
  if (!cityCanvas) {
    cityCanvas = document.createElement('canvas');
    cityCanvas.width = 1200;
    cityCanvas.height = 900;
    drawCityscape(cityCanvas.getContext('2d'), 1200, 900);
  }
  return cityCanvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function setStatus(text) {
  $('status').textContent = text;
}

// Preview at most 960 px on the long side: the draw is resolution-independent,
// so the preview matches the full-size export exactly.
function previewSize() {
  const s = SIZES[state.size];
  const scale = Math.min(1, 960 / Math.max(s.w, s.h));
  return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
}

function render() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(ctx, w, h, state);
  $('sizeLabel').textContent = `${SIZES[state.size].w} × ${SIZES[state.size].h}`;
}

function applyPhotoToPanels(image, source) {
  if (state.samePhoto) {
    state.panels.forEach((p) => {
      p.image = image;
      p.source = source;
    });
  } else {
    state.panels[selected].image = image;
    state.panels[selected].source = source;
  }
  render();
}

async function useSample(name) {
  document.querySelectorAll('.sample').forEach((b) => b.classList.toggle('active', b.dataset.sample === name));
  try {
    if (name === 'city') {
      applyPhotoToPanels(getCityCanvas(), 'city');
      setStatus('Sunset cityscape loaded — drawn by the app, no photo needed');
    } else {
      const img = await loadImage(`samples/${name}.jpg`);
      applyPhotoToPanels(img, name);
      setStatus(`${name === 'pier' ? 'Pier' : 'Boulevard'} sample loaded`);
    }
  } catch {
    setStatus('Could not load that sample — try another one');
  }
}

function readFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    $('photoError').hidden = false;
    return;
  }
  $('photoError').hidden = true;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const img = await loadImage(reader.result);
      applyPhotoToPanels(img, 'upload');
      document.querySelectorAll('.sample').forEach((b) => b.classList.remove('active'));
      setStatus(`Your photo loaded${state.samePhoto ? ' into all four panels' : ` into panel ${selected + 1}`}`);
    } catch {
      $('photoError').hidden = false;
    }
  };
  reader.readAsDataURL(file);
}

function selectPanel(i) {
  selected = i;
  document.querySelectorAll('#panelTabs .tab').forEach((b) => b.classList.toggle('active', Number(b.dataset.panel) === i));
  const p = state.panels[i];
  $('zoom').value = p.zoom;
  $('panX').value = p.panX;
  $('panY').value = p.panY;
  syncCropOutputs();
}

function syncCropOutputs() {
  const p = state.panels[selected];
  $('zoomOut').textContent = `${Number(p.zoom).toFixed(2)}×`;
  $('panXOut').textContent = `${Math.round(p.panX * 100)}%`;
  $('panYOut').textContent = `${Math.round(p.panY * 100)}%`;
}

function bindCrop() {
  $('zoom').addEventListener('input', (e) => {
    state.panels[selected].zoom = Number(e.target.value);
    syncCropOutputs();
    render();
  });
  $('panX').addEventListener('input', (e) => {
    state.panels[selected].panX = Number(e.target.value);
    syncCropOutputs();
    render();
  });
  $('panY').addEventListener('input', (e) => {
    state.panels[selected].panY = Number(e.target.value);
    syncCropOutputs();
    render();
  });
  $('fitBtn').addEventListener('click', () => {
    state.panels[selected].zoom = 1;
    state.panels[selected].panX = 0.5;
    state.panels[selected].panY = 0.5;
    selectPanel(selected);
    render();
  });
  $('resetCropBtn').addEventListener('click', () => {
    const d = [1.0, 1.25, 1.45, 1.1][selected];
    const px = [0.5, 0.78, 0.22, 0.6][selected];
    const py = [0.42, 0.45, 0.3, 0.5][selected];
    state.panels[selected].zoom = d;
    state.panels[selected].panX = px;
    state.panels[selected].panY = py;
    selectPanel(selected);
    render();
  });
}

function bindCaption() {
  $('captionInput').addEventListener('input', (e) => {
    state.caption = e.target.value;
    render();
  });
  $('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    render();
  });
  $('capSize').addEventListener('input', (e) => {
    state.captionSize = Number(e.target.value);
    $('capSizeOut').textContent = `${Math.round(state.captionSize * 100)}%`;
    render();
  });
  document.querySelectorAll('.swatch').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.captionColor = b.dataset.color;
      render();
    });
  });
  $('outlineCheck').addEventListener('change', (e) => {
    state.outline = e.target.checked;
    render();
  });
}

function bindGrade() {
  document.querySelectorAll('#gradeBtns .grade').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#gradeBtns .grade').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.grade = b.dataset.grade;
      render();
    });
  });
  $('gradeStrength').addEventListener('input', (e) => {
    state.gradeStrength = Number(e.target.value);
    $('gradeOut').textContent = `${Math.round(state.gradeStrength * 100)}%`;
    render();
  });
}

function bindSize() {
  document.querySelectorAll('#sizeBtns .size').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#sizeBtns .size').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.size = b.dataset.size;
      render();
    });
  });
}

async function doExport() {
  const btns = [$('exportBtn'), $('exportBtn2')];
  btns.forEach((b) => { b.disabled = true; b.textContent = 'Rendering…'; });
  setStatus('Rendering your cover…');
  try {
    const blob = await exportCover(state, state.size);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const s = SIZES[state.size];
    a.href = url;
    a.download = `vice-cover-${s.w}x${s.h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported ${s.w} × ${s.h} PNG — check your downloads`);
  } catch {
    setStatus('Export failed in this browser — try again');
  } finally {
    btns.forEach((b) => { b.disabled = false; b.textContent = '↓ Export PNG'; });
    $('exportBtn2').textContent = '↓ Export PNG';
  }
}

function bindPanels() {
  document.querySelectorAll('#panelTabs .tab').forEach((b) => {
    b.addEventListener('click', () => selectPanel(Number(b.dataset.panel)));
  });
  // Clicking the poster itself selects the panel under the cursor.
  canvas.addEventListener('click', (e) => {
    const box = canvas.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * canvas.width;
    const y = ((e.clientY - box.top) / box.height) * canvas.height;
    const rects = panelRects(canvas.width, canvas.height);
    const hit = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit >= 0) selectPanel(hit);
  });
  // Dropping a photo onto the poster fills the panel under the cursor.
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * canvas.width;
    const y = ((e.clientY - box.top) / box.height) * canvas.height;
    const rects = panelRects(canvas.width, canvas.height);
    const hit = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (hit >= 0) selectPanel(hit);
    readFile(e.dataTransfer.files[0]);
  });
}

function bindPhotos() {
  $('fileInput').addEventListener('change', (e) => readFile(e.target.files[0]));
  $('cityBtn').addEventListener('click', () => useSample('city'));
  document.querySelectorAll('.sample').forEach((b) => {
    b.addEventListener('click', () => useSample(b.dataset.sample));
  });
  $('samePhoto').addEventListener('change', (e) => {
    state.samePhoto = e.target.checked;
    if (state.samePhoto) {
      const first = state.panels[0];
      state.panels.forEach((p) => {
        p.image = first.image;
        p.source = first.source;
      });
      render();
    }
  });
}

async function boot() {
  // Shot mode: fixed cover or editor, driven by query params for screenshots.
  if (params.get('caption')) state.caption = params.get('caption');
  if (params.get('subtitle')) state.subtitle = params.get('subtitle');
  if (params.get('size') && SIZES[params.get('size')]) state.size = params.get('size');
  if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
  const photo = params.get('photo') || 'pier';

  bindPhotos();
  bindPanels();
  bindCrop();
  bindCaption();
  bindGrade();
  bindSize();
  $('exportBtn').addEventListener('click', doExport);
  $('exportBtn2').addEventListener('click', doExport);
  selectPanel(0);

  // Wait for the poster fonts so the first paint already has real lettering.
  try {
    await Promise.all([
      document.fonts.load('900 100px "Vice Bold"'),
      document.fonts.load('700 40px "Vice Regular"'),
    ]);
  } catch {
    // Fall back to the system sans if the bundled fonts fail to load.
  }
  await useSample(photo);

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // Draw the cover at full export resolution for the screenshot.
    const s = SIZES[state.size];
    canvas.width = s.w;
    canvas.height = s.h;
    drawCover(ctx, s.w, s.h, state);
  }
  document.title = `Vice Cover — ${state.caption}`;
  window.__viceReady = true;
  // Test hook for automation: renders the current cover at a size and
  // reports the PNG blob's bytes and type. Used by local verification only.
  window.__viceExportPNG = async (sizeKey) => {
    const blob = await exportCover(state, sizeKey || state.size);
    return { bytes: blob.size, type: blob.type };
  };
}

boot();
