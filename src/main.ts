const fileInput = document.getElementById("file");
const canvas = document.getElementById("canvas")! as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

const spacing = document.getElementById("spacing");
const thickness = document.getElementById("thickness");
const opacity = document.getElementById("opacity");
const color = document.getElementById("color");

const spacingVal = document.getElementById("spacingVal");
const thicknessVal = document.getElementById("thicknessVal");
const opacityVal = document.getElementById("opacityVal");

const fitBtn = document.getElementById("fitBtn");
const toggleBtn = document.getElementById("toggleBtn");

let img = new Image();
let imgLoaded = false;
let gridOn = true;

// We draw at a resolution matching the on-screen width for crisp grid lines.
function resizeCanvasToContainer() {
  const stage = canvas.parentElement;
  const rect = stage.getBoundingClientRect();
  const displayWidth = Math.max(1, Math.floor(rect.width));
  const dpr = window.devicePixelRatio || 1;

  // If no image yet, set a default height.
  const aspect = imgLoaded ? img.naturalHeight / img.naturalWidth : 3 / 4;
  const displayHeight = Math.floor(displayWidth * aspect);

  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";

  canvas.width = Math.floor(displayWidth * dpr);
  canvas.height = Math.floor(displayHeight * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}

function draw() {
  resizeCanvasToContainer();

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  // Draw image (fit to canvas)
  if (imgLoaded) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    // Placeholder background
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload a photo to begin", w / 2, h / 2);
  }

  if (!gridOn) return;

  // Grid settings
  const s = Number(spacing.value);
  const t = Number(thickness.value);
  const a = Number(opacity.value) / 100;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color.value;
  ctx.lineWidth = t;

  // Crisp lines trick: offset by 0.5 when thickness is odd
  const offset = t % 2 === 1 ? 0.5 : 0;

  // Vertical lines
  for (let x = 0; x <= w; x += s) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + offset, 0);
    ctx.lineTo(Math.round(x) + offset, h);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= h; y += s) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + offset);
    ctx.lineTo(w, Math.round(y) + offset);
    ctx.stroke();
  }

  ctx.restore();
}

// Handle file upload (local only)
fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img = new Image();
  img.onload = () => {
    imgLoaded = true;
    URL.revokeObjectURL(url);
    draw();
  };
  img.src = url;
});

// Controls update
function syncLabelsAndRedraw() {
  spacingVal.textContent = spacing.value;
  thicknessVal.textContent = thickness.value;
  opacityVal.textContent = opacity.value;
  draw();
}

[spacing, thickness, opacity, color].forEach((el) => {
  el.addEventListener("input", syncLabelsAndRedraw);
});

fitBtn.addEventListener("click", draw);

toggleBtn.addEventListener("click", () => {
  gridOn = !gridOn;
  toggleBtn.textContent = "Grid: " + (gridOn ? "On" : "Off");
  draw();
});

// Redraw on resize/orientation change
window.addEventListener("resize", () => {
  // tiny delay helps Safari settle after rotation
  clearTimeout(window.__gridResizeTimer);
  window.__gridResizeTimer = setTimeout(draw, 80);
});

// Initial render
syncLabelsAndRedraw();
