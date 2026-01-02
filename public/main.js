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
var blockResolutionUnit = document.getElementById("block-resolution-unit");
if (!spacing || !thickness || !opacity || !color || !blockResolution)
  throw new Error("expected spacing, thickness, opacity, color, and block resolution inputs");
if (!blockResolutionUnit)
  throw new Error("expected block resolution unit element");
var spacingValue = document.getElementById("spacing-value");
var thicknessValue = document.getElementById("thickness-value");
var opacityValue = document.getElementById("opacity-value");
var blockResolutionValue = document.getElementById("block-resolution-value");
if (!spacingValue || !thicknessValue || !opacityValue || !blockResolutionValue || !blockResolutionUnit)
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
if (!controlBar || !hideControlsButton || !openControlsButton)
  throw new Error("expected control bar elements");
if (!controlPanels.length || !controlIconButtons.length)
  throw new Error("expected control panels and icon buttons");
initializeBlockResolutionSlider();
updateBlockResolutionLabel();
var userImage = new Image;
var userImageLoaded = false;
var gridOn = true;
var posterizeOn = false;
var gridOffsetX = 0;
var gridOffsetY = 0;
var gridDragPointerId = null;
var gridDragMoved = false;
var lastPointerX = 0;
var lastPointerY = 0;
var dragStartPointerX = 0;
var dragStartPointerY = 0;
var cellDownsampledCells = new Set;
var lastTapTime = 0;
var lastTapCanvasX = 0;
var lastTapCanvasY = 0;
var lastTapCellKey = null;
var lastTapDownsampleState = null;
var filledCells = new Set;
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
var posterizeCacheDetail = getBlockTargetCells();
var LAST_IMAGE_STORAGE_KEY = "perspective-frame:last-photo";
var SETTINGS_STORAGE_KEY = "perspective-frame:settings";
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
var MIN_BLOCK_DETAIL_CELLS = 30;
var MAX_BLOCK_DETAIL_CELLS = 2000;
var BLOCK_DETAIL_SLIDER_MIN = 0;
var BLOCK_DETAIL_SLIDER_MAX = 100;
var BLOCK_DETAIL_RANGE = MAX_BLOCK_DETAIL_CELLS / MIN_BLOCK_DETAIL_CELLS;
var BLOCK_MIN_CELL_PX = 1;
var GRID_DRAG_DEADZONE_PX = 3;
var GRID_DRAG_DEADZONE_SQ = GRID_DRAG_DEADZONE_PX * GRID_DRAG_DEADZONE_PX;
var DOUBLE_TAP_THRESHOLD_MS = 350;
var DOUBLE_TAP_DISTANCE_PX = 18;
var DOUBLE_TAP_DISTANCE_SQ = DOUBLE_TAP_DISTANCE_PX * DOUBLE_TAP_DISTANCE_PX;
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
    const imageOffsetX = (w - drawWidth) / 2;
    const imageOffsetY = (h - drawHeight) / 2;
    const posterizedWidth = Math.round(drawWidth);
    const posterizedHeight = Math.round(drawHeight);
    if (posterizeOn) {
      const processed = getPosterizedImage(posterizedWidth, posterizedHeight);
      ctx.drawImage(processed, imageOffsetX, imageOffsetY, drawWidth, drawHeight);
    } else {
      ctx.drawImage(userImage, imageOffsetX, imageOffsetY, drawWidth, drawHeight);
      if (cellDownsampledCells.size) {
        const processed = getPosterizedImage(posterizedWidth, posterizedHeight);
        renderCellDownsamples(processed, imageOffsetX, imageOffsetY, drawWidth, drawHeight);
      }
      if (filledCells.size) {
        renderFilledCells();
      }
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
  const s = Math.max(1, Number(spacing.value));
  const t = Number(thickness.value);
  const a = Number(opacity.value) / 100;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color.value;
  ctx.lineWidth = t;
  const offset = t % 2 === 1 ? 0.5 : 0;
  const { normalizedX: gridNormalizedX, normalizedY: gridNormalizedY } = getNormalizedGridOffsets(s);
  for (let x = -gridNormalizedX;x <= w; x += s) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + offset, 0);
    ctx.lineTo(Math.round(x) + offset, h);
    ctx.stroke();
  }
  for (let y = -gridNormalizedY;y <= h; y += s) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + offset);
    ctx.lineTo(w, Math.round(y) + offset);
    ctx.stroke();
  }
  ctx.restore();
}
function getNormalizedGridOffsets(currentSpacing) {
  const spacingValue2 = Number.isFinite(currentSpacing) && currentSpacing ? Math.max(1, currentSpacing) : Math.max(1, Number(spacing.value));
  const normalizedX = (gridOffsetX % spacingValue2 + spacingValue2) % spacingValue2;
  const normalizedY = (gridOffsetY % spacingValue2 + spacingValue2) % spacingValue2;
  return { spacingValue: spacingValue2, normalizedX, normalizedY };
}
function initializeBlockResolutionSlider() {
  blockResolution.min = String(BLOCK_DETAIL_SLIDER_MIN);
  blockResolution.max = String(BLOCK_DETAIL_SLIDER_MAX);
  if (!blockResolution.step)
    blockResolution.step = "1";
  blockResolution.value = String(detailToSliderValue(DEFAULT_BLOCK_TARGET_CELLS));
}
function sliderValueToDetail(value) {
  if (value >= BLOCK_DETAIL_SLIDER_MAX)
    return Infinity;
  const normalized = Math.max(0, Math.min(1, value / BLOCK_DETAIL_SLIDER_MAX));
  const detail = MIN_BLOCK_DETAIL_CELLS * Math.pow(BLOCK_DETAIL_RANGE, normalized);
  return Math.max(MIN_BLOCK_DETAIL_CELLS, Math.round(detail));
}
function detailToSliderValue(detail) {
  if (!Number.isFinite(detail) || detail >= MAX_BLOCK_DETAIL_CELLS) {
    return BLOCK_DETAIL_SLIDER_MAX;
  }
  const clamped = Math.max(MIN_BLOCK_DETAIL_CELLS, Math.min(MAX_BLOCK_DETAIL_CELLS, detail));
  const ratio = clamped / MIN_BLOCK_DETAIL_CELLS;
  const normalized = Math.log(ratio) / Math.log(BLOCK_DETAIL_RANGE);
  return Math.round(Math.max(0, Math.min(1, normalized)) * BLOCK_DETAIL_SLIDER_MAX);
}
function renderCellDownsamples(source, imageOffsetX, imageOffsetY, drawWidth, drawHeight) {
  const { spacingValue: spacingValue2, normalizedX, normalizedY } = getNormalizedGridOffsets();
  if (!spacingValue2)
    return;
  const imageRight = imageOffsetX + drawWidth;
  const imageBottom = imageOffsetY + drawHeight;
  const posterizedWidth = source.width;
  const posterizedHeight = source.height;
  const scaleX = posterizedWidth / drawWidth;
  const scaleY = posterizedHeight / drawHeight;
  cellDownsampledCells.forEach((key) => {
    const [colStr, rowStr] = key.split(",");
    const col = Number(colStr);
    const row = Number(rowStr);
    if (!Number.isFinite(col) || !Number.isFinite(row))
      return;
    const cellLeft = col * spacingValue2 - normalizedX;
    const cellTop = row * spacingValue2 - normalizedY;
    const cellRight = cellLeft + spacingValue2;
    const cellBottom = cellTop + spacingValue2;
    const overlapLeft = Math.max(cellLeft, imageOffsetX);
    const overlapTop = Math.max(cellTop, imageOffsetY);
    const overlapRight = Math.min(cellRight, imageRight);
    const overlapBottom = Math.min(cellBottom, imageBottom);
    const overlapWidth = overlapRight - overlapLeft;
    const overlapHeight = overlapBottom - overlapTop;
    if (overlapWidth <= 0 || overlapHeight <= 0)
      return;
    const srcX = (overlapLeft - imageOffsetX) * scaleX;
    const srcY = (overlapTop - imageOffsetY) * scaleY;
    const srcWidth = overlapWidth * scaleX;
    const srcHeight = overlapHeight * scaleY;
    ctx.drawImage(source, srcX, srcY, srcWidth, srcHeight, overlapLeft, overlapTop, overlapWidth, overlapHeight);
  });
}
function renderFilledCells() {
  const { spacingValue: spacingValue2, normalizedX, normalizedY } = getNormalizedGridOffsets();
  if (!spacingValue2)
    return;
  ctx.save();
  ctx.fillStyle = color.value;
  filledCells.forEach((key) => {
    const [colStr, rowStr] = key.split(",");
    const col = Number(colStr);
    const row = Number(rowStr);
    if (!Number.isFinite(col) || !Number.isFinite(row))
      return;
    const cellLeft = col * spacingValue2 - normalizedX;
    const cellTop = row * spacingValue2 - normalizedY;
    const cellRight = cellLeft + spacingValue2;
    const cellBottom = cellTop + spacingValue2;
    if (cellRight <= 0 || cellBottom <= 0)
      return;
    if (cellLeft >= canvas.clientWidth || cellTop >= canvas.clientHeight)
      return;
    const overlapLeft = Math.max(cellLeft, 0);
    const overlapTop = Math.max(cellTop, 0);
    const width = Math.min(cellRight, canvas.clientWidth) - overlapLeft;
    const height = Math.min(cellBottom, canvas.clientHeight) - overlapTop;
    if (width <= 0 || height <= 0)
      return;
    ctx.fillRect(overlapLeft, overlapTop, width, height);
  });
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
  if (!Number.isFinite(targetCells) || targetCells <= 0) {
    return { sampleWidth: width, sampleHeight: height };
  }
  const longestSide = Math.max(width, height);
  const desiredCellSize = Math.max(BLOCK_MIN_CELL_PX, Math.round(longestSide / targetCells));
  const sampleWidth = Math.max(1, Math.round(width / desiredCellSize));
  const sampleHeight = Math.max(1, Math.round(height / desiredCellSize));
  return { sampleWidth, sampleHeight };
}
function getBlockTargetCells() {
  const sliderValue = Number(blockResolution.value);
  if (!Number.isFinite(sliderValue))
    return DEFAULT_BLOCK_TARGET_CELLS;
  return sliderValueToDetail(sliderValue);
}
function getCellKey(col, row) {
  return `${col},${row}`;
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
function persistSettings() {
  try {
    const payload = {
      spacing: Number(spacing.value),
      thickness: Number(thickness.value),
      opacity: Number(opacity.value),
      color: color.value,
      blockResolution: Number(blockResolution.value),
      gridOn,
      posterizeOn,
      gridOffsetX,
      gridOffsetY,
      cellPosterize: Array.from(cellDownsampledCells),
      cellFill: Array.from(filledCells)
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to remember settings", error);
  }
}
function applyStoredRangeValue(input, value) {
  if (!Number.isFinite(value))
    return;
  const min = Number(input.min);
  const max = Number(input.max);
  let next = value;
  if (Number.isFinite(min))
    next = Math.max(min, next);
  if (Number.isFinite(max))
    next = Math.min(max, next);
  input.value = String(next);
}
function restoreSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw)
      return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object")
      return;
    if (typeof saved.spacing === "number") {
      applyStoredRangeValue(spacing, saved.spacing);
    }
    if (typeof saved.thickness === "number") {
      applyStoredRangeValue(thickness, saved.thickness);
    }
    if (typeof saved.opacity === "number") {
      applyStoredRangeValue(opacity, saved.opacity);
    }
    if (typeof saved.blockResolution === "number") {
      const sliderValue = saved.blockResolution > BLOCK_DETAIL_SLIDER_MAX ? detailToSliderValue(saved.blockResolution) : saved.blockResolution;
      applyStoredRangeValue(blockResolution, sliderValue);
    }
    if (typeof saved.color === "string" && saved.color.length) {
      color.value = saved.color;
    }
    if (typeof saved.gridOn === "boolean") {
      gridOn = saved.gridOn;
    }
    if (typeof saved.posterizeOn === "boolean") {
      posterizeOn = saved.posterizeOn;
    }
    if (typeof saved.gridOffsetX === "number" && Number.isFinite(saved.gridOffsetX)) {
      gridOffsetX = saved.gridOffsetX;
    }
    if (typeof saved.gridOffsetY === "number" && Number.isFinite(saved.gridOffsetY)) {
      gridOffsetY = saved.gridOffsetY;
    }
    cellDownsampledCells.clear();
    if (Array.isArray(saved.cellPosterize)) {
      saved.cellPosterize.forEach((key) => {
        if (typeof key === "string" && key.length) {
          cellDownsampledCells.add(key);
        }
      });
    }
    filledCells.clear();
    if (Array.isArray(saved.cellFill)) {
      saved.cellFill.forEach((key) => {
        if (typeof key === "string" && key.length) {
          filledCells.add(key);
        }
      });
    }
    updateGridButtonUI();
    updatePosterizeButtonUI();
    updateBlockResolutionLabel();
    syncColorSwatch();
  } catch (error) {
    console.warn("Unable to restore settings", error);
  }
}
function syncLabelsAndRedraw() {
  if (!spacingValue || !thicknessValue || !opacityValue || !blockResolutionValue)
    throw new Error("expected spacing, thickness, opacity, and block resolution value elements");
  spacingValue.textContent = spacing.value;
  thicknessValue.textContent = thickness.value;
  opacityValue.textContent = opacity.value;
  updateBlockResolutionLabel();
  syncColorSwatch();
  draw();
  persistSettings();
}
[spacing, thickness, opacity, color, blockResolution].forEach((inputElement) => {
  inputElement.addEventListener("input", syncLabelsAndRedraw);
});
function syncColorSwatch() {
  if (!colorPanelButton)
    return;
  colorPanelButton.style.setProperty("--color-chip-color", color.value);
}
function updateBlockResolutionLabel() {
  const sliderValue = Number(blockResolution.value);
  const detail = sliderValueToDetail(sliderValue);
  if (!Number.isFinite(detail)) {
    blockResolutionValue.textContent = "Full detail";
    blockResolutionUnit.textContent = "";
  } else {
    blockResolutionValue.textContent = detail.toString();
    blockResolutionUnit.textContent = "cells";
  }
}
toggleGridButton.addEventListener("click", () => {
  gridOn = !gridOn;
  updateGridButtonUI();
  persistSettings();
  draw();
});
togglePosterizeButton.addEventListener("click", () => {
  posterizeOn = !posterizeOn;
  if (posterizeOn && cellDownsampledCells.size) {
    cellDownsampledCells.clear();
  }
  updatePosterizeButtonUI();
  persistSettings();
  draw();
});
function updateGridButtonUI() {
  toggleGridButton.textContent = "Grid: " + (gridOn ? "On" : "Off");
  toggleGridButton.setAttribute("aria-pressed", gridOn ? "true" : "false");
}
function updatePosterizeButtonUI() {
  togglePosterizeButton.textContent = "Downsample: " + (posterizeOn ? "On" : "Off");
  togglePosterizeButton.setAttribute("aria-pressed", posterizeOn ? "true" : "false");
}
updateGridButtonUI();
updatePosterizeButtonUI();
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
function showControls() {
  controlBar.classList.remove("collapsed");
  controlBar.removeAttribute("aria-hidden");
  openControlsButton.classList.remove("visible");
  const activeIcon = controlIconButtons.find((btn) => btn.classList.contains("active")) || controlIconButtons[0];
  activeIcon?.focus();
}
function hideControls() {
  controlBar.classList.add("collapsed");
  controlBar.setAttribute("aria-hidden", "true");
  openControlsButton.classList.add("visible");
  openControlsButton.focus();
}
hideControlsButton.addEventListener("click", hideControls);
openControlsButton.addEventListener("click", showControls);
restoreSettings();
restoreLastUserImage();
hideControls();
canvas.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary)
    return;
  if (event.pointerType === "mouse" && event.button !== 0)
    return;
  gridDragPointerId = event.pointerId;
  gridDragMoved = false;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  dragStartPointerX = event.clientX;
  dragStartPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (gridDragPointerId !== event.pointerId)
    return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  const totalDx = event.clientX - dragStartPointerX;
  const totalDy = event.clientY - dragStartPointerY;
  if (!gridDragMoved) {
    const distanceSq = totalDx * totalDx + totalDy * totalDy;
    if (distanceSq < GRID_DRAG_DEADZONE_SQ) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      return;
    }
    gridDragMoved = true;
  }
  if (dx === 0 && dy === 0)
    return;
  gridOffsetX += dx;
  gridOffsetY += dy;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  draw();
  persistSettings();
});
function endGridDrag(event) {
  if (gridDragPointerId !== event.pointerId)
    return;
  const shouldToggleCell = !gridDragMoved && event.type === "pointerup" && userImageLoaded;
  gridDragPointerId = null;
  gridDragMoved = false;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (_) {}
  if (shouldToggleCell) {
    handleCellTap(event);
  }
}
canvas.addEventListener("pointerup", endGridDrag);
canvas.addEventListener("pointercancel", endGridDrag);
function handleCellTap(event) {
  const coords = getCanvasCoordinates(event);
  if (!coords)
    return;
  const { x, y } = coords;
  const cellInfo = getCellInfoAtPosition(x, y);
  if (!cellInfo)
    return;
  const { key } = cellInfo;
  const now = Date.now();
  const dx = x - lastTapCanvasX;
  const dy = y - lastTapCanvasY;
  const isDouble = lastTapCellKey === key && now - lastTapTime <= DOUBLE_TAP_THRESHOLD_MS && dx * dx + dy * dy <= DOUBLE_TAP_DISTANCE_SQ;
  let changed = false;
  if (isDouble) {
    if (lastTapDownsampleState !== null) {
      toggleDownsampleCellKey(key);
      changed = true;
    }
    toggleFilledCellKey(key);
    changed = true;
    lastTapTime = 0;
    lastTapCellKey = null;
    lastTapDownsampleState = null;
  } else {
    const newState = toggleDownsampleCellKey(key);
    lastTapTime = now;
    lastTapCanvasX = x;
    lastTapCanvasY = y;
    lastTapCellKey = key;
    lastTapDownsampleState = newState;
    changed = true;
  }
  if (changed) {
    persistSettings();
    draw();
  }
}
function getCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return { x, y };
}
function getCellInfoAtPosition(x, y) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (x < 0 || y < 0 || x > width || y > height)
    return null;
  const { spacingValue: spacingValue2, normalizedX, normalizedY } = getNormalizedGridOffsets();
  if (!spacingValue2)
    return null;
  const col = Math.floor((x + normalizedX) / spacingValue2);
  const row = Math.floor((y + normalizedY) / spacingValue2);
  const key = getCellKey(col, row);
  return { key, col, row };
}
function toggleDownsampleCellKey(key) {
  if (cellDownsampledCells.has(key)) {
    cellDownsampledCells.delete(key);
    return false;
  }
  disableGlobalPosterizeForCellMode();
  cellDownsampledCells.add(key);
  return true;
}
function toggleFilledCellKey(key) {
  if (filledCells.has(key)) {
    filledCells.delete(key);
    return false;
  }
  filledCells.add(key);
  return true;
}
function disableGlobalPosterizeForCellMode() {
  if (!posterizeOn)
    return;
  posterizeOn = false;
  updatePosterizeButtonUI();
}
window.addEventListener("resize", () => {
  clearTimeout(window.__gridResizeTimer);
  window.__gridResizeTimer = setTimeout(draw, 80);
});
syncLabelsAndRedraw();
