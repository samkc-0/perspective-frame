// src/main.ts
var fileInput = document.getElementById("file");
var uploadButton = document.getElementById("upload-button");
if (!fileInput || !uploadButton)
  throw new Error("expected upload controls, but found none");
var canvas = document.getElementById("canvas");
canvas.style.touchAction = "none";
if (!canvas)
  throw new Error("expected canvas element, but found none");
var ctx = canvas.getContext("2d");
var spacing = document.getElementById("spacing");
var thickness = document.getElementById("thickness");
var opacity = document.getElementById("opacity");
var color = document.getElementById("color");
var blockResolution = document.getElementById("block-resolution");
var blockPanelElement = document.getElementById("block-panel");
if (!spacing || !thickness || !opacity || !color || !blockResolution)
  throw new Error("expected spacing, thickness, opacity, color, and block resolution inputs");
if (!blockPanelElement)
  throw new Error("expected color block detail panel element");
var spacingValue = document.getElementById("spacing-value");
var thicknessValue = document.getElementById("thickness-value");
var opacityValue = document.getElementById("opacity-value");
var blockResolutionValue = document.getElementById("block-resolution-value");
if (!spacingValue || !thicknessValue || !opacityValue || !blockResolutionValue)
  throw new Error("expected spacing, thickness, opacity, and block resolution value elements");
var toggleGridButton = document.getElementById("toggle-grid-button");
var togglePosterizeButton = document.getElementById("toggle-posterize-button");
if (!toggleGridButton)
  throw new Error("expected toggle grid button element, but found none");
if (!togglePosterizeButton)
  throw new Error("expected toggle posterize button element, but found none");
var controlBar = document.getElementById("control-bar");
var hideControlsButton = document.getElementById("hide-controls");
var openControlsButton = document.getElementById("open-controls");
var controlPanels = Array.from(document.querySelectorAll(".control-panel"));
var controlIconButtons = Array.from(document.querySelectorAll(".control-icon"));
var colorPanelButton = controlIconButtons.find((btn) => btn.dataset.panel === "color-panel") || null;
var blockPanelButton = controlIconButtons.find((btn) => btn.dataset.panel === "block-panel") || null;
if (!controlBar || !hideControlsButton || !openControlsButton)
  throw new Error("expected control bar elements");
if (!controlPanels.length || !controlIconButtons.length)
  throw new Error("expected control panels and icon buttons");
var userImage = new Image;
var userImageLoaded = false;
var gridOn = true;
var posterizeOn = false;
var gridOffsetX = 0;
var gridOffsetY = 0;
var gridDragPointerId = null;
var lastPointerX = 0;
var lastPointerY = 0;
var posterizeCanvas = document.createElement("canvas");
var posterizeCtx = posterizeCanvas.getContext("2d");
if (!posterizeCtx)
  throw new Error("expected posterize canvas context");
var blockSampleCanvas = document.createElement("canvas");
var blockSampleCtx = blockSampleCanvas.getContext("2d");
if (!blockSampleCtx)
  throw new Error("expected block sample canvas context");
var imageRevision = 0;
var posterizeCacheWidth = 0;
var posterizeCacheHeight = 0;
var posterizeCacheRevision = -1;
var posterizeCacheDetail = Number(blockResolution.value) || DEFAULT_BLOCK_TARGET_CELLS;
var LAST_IMAGE_STORAGE_KEY = "perspective-frame:last-photo";
var POSTERIZE_COLORS = 12;
var BUCKET_BITS = 5;
var BUCKET_SIZE = 1 << BUCKET_BITS;
var BUCKET_COUNT = BUCKET_SIZE * BUCKET_SIZE * BUCKET_SIZE;
var RED_SHIFT = BUCKET_BITS * 2;
var GREEN_SHIFT = BUCKET_BITS;
var BLUE_SHIFT = 0;
var BUCKET_REDUCTION_SHIFT = 8 - BUCKET_BITS;
var BUCKET_MASK = BUCKET_SIZE - 1;
var DEFAULT_BLOCK_TARGET_CELLS = 90;
var BLOCK_MIN_CELL_PX = 5;
function resizeCanvasToContainer() {
  const stage = canvas.parentElement;
  if (!stage)
    throw new Error("expected canvas element to have a parent container");
  const rect = stage.getBoundingClientRect();
  let displayWidth = Math.max(1, Math.floor(rect.width));
  let displayHeight = Math.max(1, Math.floor(rect.height));
  const pixelRatio = window.devicePixelRatio || 1;
  if (userImageLoaded) {
    const widthScale = displayWidth / userImage.naturalWidth;
    const heightScale = displayHeight / userImage.naturalHeight;
    const scale = Math.min(widthScale, heightScale);
    displayWidth = Math.max(1, Math.floor(userImage.naturalWidth * scale));
    displayHeight = Math.max(1, Math.floor(userImage.naturalHeight * scale));
  }
  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";
  canvas.width = Math.floor(displayWidth * pixelRatio);
  canvas.height = Math.floor(displayHeight * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}
function draw() {
  resizeCanvasToContainer();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (userImageLoaded) {
    const scale = Math.max(w / userImage.naturalWidth, h / userImage.naturalHeight);
    const drawWidth = userImage.naturalWidth * scale;
    const drawHeight = userImage.naturalHeight * scale;
    const offsetX2 = (w - drawWidth) / 2;
    const offsetY2 = (h - drawHeight) / 2;
    if (posterizeOn) {
      const processed = getPosterizedImage(Math.round(drawWidth), Math.round(drawHeight));
      ctx.drawImage(processed, offsetX2, offsetY2, drawWidth, drawHeight);
    } else {
      ctx.drawImage(userImage, offsetX2, offsetY2, drawWidth, drawHeight);
    }
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload a photo to begin", w / 2, h / 2);
  }
  if (!gridOn)
    return;
  const s = Number(spacing.value);
  const t = Number(thickness.value);
  const a = Number(opacity.value) / 100;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color.value;
  ctx.lineWidth = t;
  const offset = t % 2 === 1 ? 0.5 : 0;
  const offsetX = (gridOffsetX % s + s) % s;
  const offsetY = (gridOffsetY % s + s) % s;
  for (let x = -offsetX;x <= w; x += s) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + offset, 0);
    ctx.lineTo(Math.round(x) + offset, h);
    ctx.stroke();
  }
  for (let y = -offsetY;y <= h; y += s) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + offset);
    ctx.lineTo(w, Math.round(y) + offset);
    ctx.stroke();
  }
  ctx.restore();
}
function getPosterizedImage(targetWidth, targetHeight) {
  const width = Math.max(1, targetWidth);
  const height = Math.max(1, targetHeight);
  const detailTarget = getBlockTargetCells();
  const sizeChanged = posterizeCacheWidth !== width || posterizeCacheHeight !== height;
  const sourceChanged = posterizeCacheRevision !== imageRevision;
  const detailChanged = posterizeCacheDetail !== detailTarget;
  if (!sizeChanged && !sourceChanged && !detailChanged) {
    return posterizeCanvas;
  }
  posterizeCanvas.width = width;
  posterizeCanvas.height = height;
  const { sampleWidth, sampleHeight } = getSampleDimensions(width, height, detailTarget);
  blockSampleCanvas.width = sampleWidth;
  blockSampleCanvas.height = sampleHeight;
  blockSampleCtx.save();
  blockSampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  blockSampleCtx.imageSmoothingEnabled = true;
  blockSampleCtx.imageSmoothingQuality = "high";
  blockSampleCtx.drawImage(userImage, 0, 0, sampleWidth, sampleHeight);
  blockSampleCtx.restore();
  const sampleImageData = blockSampleCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  applyPosterize(sampleImageData.data);
  blockSampleCtx.putImageData(sampleImageData, 0, 0);
  posterizeCtx.save();
  posterizeCtx.clearRect(0, 0, width, height);
  posterizeCtx.imageSmoothingEnabled = false;
  posterizeCtx.drawImage(blockSampleCanvas, 0, 0, width, height);
  posterizeCtx.restore();
  posterizeCacheWidth = width;
  posterizeCacheHeight = height;
  posterizeCacheRevision = imageRevision;
  posterizeCacheDetail = detailTarget;
  return posterizeCanvas;
}
function applyPosterize(data) {
  const histogram = buildHistogram(data);
  if (!histogram.populatedBuckets.length)
    return;
  const targetBoxes = Math.min(POSTERIZE_COLORS, histogram.populatedBuckets.length);
  const boxes = runMedianCut(histogram, targetBoxes);
  if (!boxes.length)
    return;
  const palette = boxes.map((box) => box.getAverageColor());
  const bucketAssignments = assignBucketsToPalette(histogram, palette);
  for (let i = 0;i < data.length; i += 4) {
    const bucketIndex = getBucketIndex(data[i], data[i + 1], data[i + 2]);
    const paletteIndex = bucketAssignments[bucketIndex];
    const color2 = palette[paletteIndex] || palette[0];
    data[i] = Math.round(color2.r);
    data[i + 1] = Math.round(color2.g);
    data[i + 2] = Math.round(color2.b);
  }
}
function getSampleDimensions(width, height, targetCells) {
  const longestSide = Math.max(width, height);
  const desiredCellSize = Math.max(BLOCK_MIN_CELL_PX, Math.round(longestSide / targetCells));
  const sampleWidth = Math.max(1, Math.round(width / desiredCellSize));
  const sampleHeight = Math.max(1, Math.round(height / desiredCellSize));
  return { sampleWidth, sampleHeight };
}
function getBlockTargetCells() {
  const raw = Number(blockResolution.value);
  const min = Number(blockResolution.min) || 1;
  const max = Number(blockResolution.max) || raw || DEFAULT_BLOCK_TARGET_CELLS;
  if (!Number.isFinite(raw))
    return DEFAULT_BLOCK_TARGET_CELLS;
  return Math.max(min, Math.min(max, raw));
}
function getBucketIndex(r, g, b) {
  return r >> BUCKET_REDUCTION_SHIFT << RED_SHIFT | g >> BUCKET_REDUCTION_SHIFT << GREEN_SHIFT | b >> BUCKET_REDUCTION_SHIFT;
}
function buildHistogram(data) {
  const counts = new Uint32Array(BUCKET_COUNT);
  const sumR = new Float64Array(BUCKET_COUNT);
  const sumG = new Float64Array(BUCKET_COUNT);
  const sumB = new Float64Array(BUCKET_COUNT);
  const populatedBuckets = [];
  for (let i = 0;i < data.length; i += 4) {
    const bucketIndex = getBucketIndex(data[i], data[i + 1], data[i + 2]);
    if (counts[bucketIndex] === 0) {
      populatedBuckets.push(bucketIndex);
    }
    counts[bucketIndex] += 1;
    sumR[bucketIndex] += data[i];
    sumG[bucketIndex] += data[i + 1];
    sumB[bucketIndex] += data[i + 2];
  }
  return { counts, sumR, sumG, sumB, populatedBuckets };
}

class ColorBox {
  indexes;
  histogram;
  rMin = BUCKET_MASK;
  rMax = 0;
  gMin = BUCKET_MASK;
  gMax = 0;
  bMin = BUCKET_MASK;
  bMax = 0;
  pixelCount = 0;
  constructor(indexes, histogram) {
    this.indexes = indexes;
    this.histogram = histogram;
    this.recalculate();
  }
  recalculate() {
    const { counts } = this.histogram;
    let total = 0;
    let rMin = BUCKET_MASK;
    let rMax = 0;
    let gMin = BUCKET_MASK;
    let gMax = 0;
    let bMin = BUCKET_MASK;
    let bMax = 0;
    for (const index of this.indexes) {
      const count = counts[index];
      total += count;
      if (!count)
        continue;
      const r = index >> RED_SHIFT & BUCKET_MASK;
      const g = index >> GREEN_SHIFT & BUCKET_MASK;
      const b = index & BUCKET_MASK;
      if (r < rMin)
        rMin = r;
      if (r > rMax)
        rMax = r;
      if (g < gMin)
        gMin = g;
      if (g > gMax)
        gMax = g;
      if (b < bMin)
        bMin = b;
      if (b > bMax)
        bMax = b;
    }
    if (!total) {
      rMin = rMax = gMin = gMax = bMin = bMax = 0;
    }
    this.pixelCount = total;
    this.rMin = rMin;
    this.rMax = rMax;
    this.gMin = gMin;
    this.gMax = gMax;
    this.bMin = bMin;
    this.bMax = bMax;
  }
  getScore() {
    const rRange = this.rMax - this.rMin;
    const gRange = this.gMax - this.gMin;
    const bRange = this.bMax - this.bMin;
    return this.pixelCount * Math.max(rRange, gRange, bRange, 1);
  }
  longestAxis() {
    const rRange = this.rMax - this.rMin;
    const gRange = this.gMax - this.gMin;
    const bRange = this.bMax - this.bMin;
    if (rRange >= gRange && rRange >= bRange)
      return "r";
    if (gRange >= rRange && gRange >= bRange)
      return "g";
    return "b";
  }
  split() {
    if (this.indexes.length < 2)
      return null;
    const axis = this.longestAxis();
    const shift = axis === "r" ? RED_SHIFT : axis === "g" ? GREEN_SHIFT : BLUE_SHIFT;
    const sorted = this.indexes.slice().sort((a, b) => (a >> shift & BUCKET_MASK) - (b >> shift & BUCKET_MASK));
    const { counts } = this.histogram;
    const total = sorted.reduce((sum, idx) => sum + counts[idx], 0);
    if (!total)
      return null;
    const target = total / 2;
    let accumulated = 0;
    let splitIndex = 0;
    for (let i = 0;i < sorted.length; i++) {
      accumulated += counts[sorted[i]];
      if (accumulated >= target) {
        splitIndex = i;
        break;
      }
    }
    let left = sorted.slice(0, splitIndex + 1);
    let right = sorted.slice(splitIndex + 1);
    if (!left.length || !right.length) {
      const fallbackSplit = Math.floor(sorted.length / 2);
      left = sorted.slice(0, fallbackSplit);
      right = sorted.slice(fallbackSplit);
      if (!left.length || !right.length)
        return null;
    }
    return [
      new ColorBox(left, this.histogram),
      new ColorBox(right, this.histogram)
    ];
  }
  getAverageColor() {
    const { counts, sumR, sumG, sumB } = this.histogram;
    let total = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const index of this.indexes) {
      const count = counts[index];
      total += count;
      r += sumR[index];
      g += sumG[index];
      b += sumB[index];
    }
    if (!total) {
      return { r: 0, g: 0, b: 0 };
    }
    return { r: r / total, g: g / total, b: b / total };
  }
}
function runMedianCut(histogram, desiredColors) {
  if (!histogram.populatedBuckets.length)
    return [];
  const initialIndexes = histogram.populatedBuckets.slice();
  const boxes = [new ColorBox(initialIndexes, histogram)];
  while (boxes.length < desiredColors) {
    boxes.sort((a, b) => b.getScore() - a.getScore());
    const targetBox = boxes.shift();
    if (!targetBox)
      break;
    const splitResult = targetBox.split();
    if (!splitResult) {
      boxes.push(targetBox);
      break;
    }
    boxes.push(splitResult[0], splitResult[1]);
    if (boxes.length >= histogram.populatedBuckets.length)
      break;
  }
  return boxes;
}
function assignBucketsToPalette(histogram, palette) {
  const assignment = new Uint16Array(BUCKET_COUNT);
  if (!palette.length)
    return assignment;
  const { counts, sumR, sumG, sumB, populatedBuckets } = histogram;
  for (const index of populatedBuckets) {
    const count = counts[index];
    if (!count)
      continue;
    const avgR = sumR[index] / count;
    const avgG = sumG[index] / count;
    const avgB = sumB[index] / count;
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0;i < palette.length; i++) {
      const color2 = palette[i];
      const dR = avgR - color2.r;
      const dG = avgG - color2.g;
      const dB = avgB - color2.b;
      const distance = dR * dR + dG * dG + dB * dB;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    assignment[index] = best;
  }
  return assignment;
}
uploadButton.addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});
fileInput.addEventListener("change", (e) => {
  if (!e.target || !(e.target instanceof HTMLInputElement)) {
    throw new Error("expected file input element");
  }
  const file = e.target.files?.[0];
  if (!file)
    return;
  const reader = new FileReader;
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string")
      return;
    loadUserImage(reader.result, { persist: true });
  });
  reader.addEventListener("error", () => {
    console.warn("Unable to read the selected file");
  });
  reader.readAsDataURL(file);
});
function loadUserImage(dataUrl, options = {}) {
  userImageLoaded = false;
  const nextImage = new Image;
  nextImage.onload = () => {
    userImage = nextImage;
    userImageLoaded = true;
    imageRevision += 1;
    posterizeCacheRevision = -1;
    draw();
  };
  nextImage.onerror = () => {
    console.warn("Unable to load image data");
  };
  if (options.persist) {
    saveLastUserImage(dataUrl);
  }
  nextImage.src = dataUrl;
}
function saveLastUserImage(dataUrl) {
  try {
    window.localStorage.setItem(LAST_IMAGE_STORAGE_KEY, dataUrl);
  } catch (error) {
    console.warn("Unable to remember last photo", error);
  }
}
function restoreLastUserImage() {
  try {
    const saved = window.localStorage.getItem(LAST_IMAGE_STORAGE_KEY);
    if (!saved)
      return;
    loadUserImage(saved);
  } catch (error) {
    console.warn("Unable to access saved photo", error);
  }
}
function syncLabelsAndRedraw() {
  if (!spacingValue || !thicknessValue || !opacityValue || !blockResolutionValue)
    throw new Error("expected spacing, thickness, opacity, and block resolution value elements");
  spacingValue.textContent = spacing.value;
  thicknessValue.textContent = thickness.value;
  opacityValue.textContent = opacity.value;
  blockResolutionValue.textContent = blockResolution.value;
  syncColorSwatch();
  draw();
}
[spacing, thickness, opacity, color, blockResolution].forEach((inputElement) => {
  inputElement.addEventListener("input", syncLabelsAndRedraw);
});
function syncColorSwatch() {
  if (!colorPanelButton)
    return;
  colorPanelButton.style.setProperty("--color-chip-color", color.value);
}
function syncBlockResolutionAvailability() {
  const disabled = !posterizeOn;
  blockResolution.disabled = disabled;
  blockResolution.setAttribute("aria-disabled", disabled ? "true" : "false");
  blockPanelElement.classList.toggle("disabled", disabled);
  if (blockPanelButton) {
    blockPanelButton.disabled = disabled;
    blockPanelButton.setAttribute("aria-disabled", disabled ? "true" : "false");
    if (disabled && blockPanelButton.classList.contains("active")) {
      const fallbackButton = controlIconButtons.find((btn) => !btn.disabled);
      const fallbackPanelId = fallbackButton?.dataset.panel || controlPanels[0]?.id || "";
      if (fallbackPanelId) {
        setActivePanel(fallbackPanelId);
      }
    }
  }
}
toggleGridButton.addEventListener("click", () => {
  gridOn = !gridOn;
  toggleGridButton.textContent = "Grid: " + (gridOn ? "On" : "Off");
  toggleGridButton.setAttribute("aria-pressed", gridOn ? "true" : "false");
  draw();
});
togglePosterizeButton.addEventListener("click", () => {
  posterizeOn = !posterizeOn;
  togglePosterizeButton.textContent = "Downsample: " + (posterizeOn ? "On" : "Off");
  togglePosterizeButton.setAttribute("aria-pressed", posterizeOn ? "true" : "false");
  syncBlockResolutionAvailability();
  draw();
});
toggleGridButton.setAttribute("aria-pressed", "true");
togglePosterizeButton.setAttribute("aria-pressed", "false");
syncBlockResolutionAvailability();
function setActivePanel(panelId) {
  controlPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  controlIconButtons.forEach((btn) => {
    const active = btn.dataset.panel === panelId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
controlIconButtons.forEach((button) => {
  button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
  button.addEventListener("click", () => {
    const targetPanel = button.dataset.panel;
    if (!targetPanel)
      return;
    const wasActive = button.classList.contains("active");
    setActivePanel(targetPanel);
    if (colorPanelButton && button === colorPanelButton && wasActive) {
      color.click();
    }
  });
});
var firstPanel = controlIconButtons[0]?.dataset.panel || controlPanels[0]?.id || "";
if (firstPanel) {
  setActivePanel(firstPanel);
}
hideControlsButton.addEventListener("click", () => {
  controlBar.classList.add("collapsed");
  openControlsButton.classList.add("visible");
  openControlsButton.focus();
});
openControlsButton.addEventListener("click", () => {
  controlBar.classList.remove("collapsed");
  openControlsButton.classList.remove("visible");
  const activeIcon = controlIconButtons.find((btn) => btn.classList.contains("active")) || controlIconButtons[0];
  activeIcon?.focus();
});
restoreLastUserImage();
canvas.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary)
    return;
  if (event.pointerType === "mouse" && event.button !== 0)
    return;
  gridDragPointerId = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (gridDragPointerId !== event.pointerId)
    return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  if (dx === 0 && dy === 0)
    return;
  gridOffsetX += dx;
  gridOffsetY += dy;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  draw();
});
function endGridDrag(event) {
  if (gridDragPointerId !== event.pointerId)
    return;
  gridDragPointerId = null;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (_) {}
}
canvas.addEventListener("pointerup", endGridDrag);
canvas.addEventListener("pointercancel", endGridDrag);
window.addEventListener("resize", () => {
  clearTimeout(window.__gridResizeTimer);
  window.__gridResizeTimer = setTimeout(draw, 80);
});
syncLabelsAndRedraw();
