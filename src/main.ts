const fileInput = document.getElementById("file");
if (!fileInput) throw new Error("expected file input element, but found none");

const canvas = document.getElementById("canvas")! as HTMLCanvasElement;

if (!canvas) throw new Error("expected canvas element, but found none");

const ctx = canvas.getContext("2d")!;

const spacing = document.getElementById("spacing") as HTMLInputElement;
const thickness = document.getElementById("thickness") as HTMLInputElement;
const opacity = document.getElementById("opacity") as HTMLInputElement;
const color = document.getElementById("color") as HTMLInputElement;

if (!spacing || !thickness || !opacity || !color)
  throw new Error("expected spacing, thickness, opacity, and color inputs");

const spacingValue = document.getElementById("spacing-value");
const thicknessValue = document.getElementById("thickness-value");
const opacityValue = document.getElementById("opacity-value");

if (!spacingValue || !thicknessValue || !opacityValue)
  throw new Error("expected spacing, thickness, and opacity value elements");

// button fits thes the image to the container
const fitButton = document.getElementById("fit-button");
if (!fitButton) throw new Error("expected fit button element, but found none");

const toggleGridButton = document.getElementById("toggle-grid-button");
if (!toggleGridButton)
  throw new Error("expected toggle grid button element, but found none");

let userImage = new Image();
let userImageLoaded = false;
let gridOn = true;

// We draw at a resolution matching the on-screen width for crisp grid lines.
function resizeCanvasToContainer() {
  const stage = canvas.parentElement!;

  if (!stage)
    throw new Error("expected canvas element to have a parent container");

  const rect = stage.getBoundingClientRect();
  const displayWidth = Math.max(1, Math.floor(rect.width));
  const pixelRatio = window.devicePixelRatio || 1;

  // If no image yet, set a default height.
  const aspect = userImageLoaded
    ? userImage.naturalHeight / userImage.naturalWidth
    : 3 / 4;
  const displayHeight = Math.floor(displayWidth * aspect);

  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";

  canvas.width = Math.floor(displayWidth * pixelRatio);
  canvas.height = Math.floor(displayHeight * pixelRatio);

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); // draw in CSS pixels
}

function draw() {
  resizeCanvasToContainer();

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  // Draw image (fit to canvas)
  if (userImageLoaded) {
    ctx.drawImage(userImage, 0, 0, w, h);
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
fileInput!.addEventListener("change", (e) => {
  if (!e.target || !(e.target instanceof HTMLInputElement)) {
    throw new Error("expected file input element");
  }

  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  userImage = new Image();
  userImage.onload = () => {
    userImageLoaded = true;
    URL.revokeObjectURL(url);
    draw();
  };
  userImage.src = url;
});

// Controls update
function syncLabelsAndRedraw() {
  if (!spacingValue || !thicknessValue || !opacityValue)
    throw new Error("expected spacing, thickness, and opacity value elements");

  spacingValue.textContent = spacing.value;
  thicknessValue.textContent = thickness.value;
  opacityValue.textContent = opacity.value;
  draw();
}

[spacing, thickness, opacity, color].forEach((inputElement) => {
  inputElement.addEventListener("input", syncLabelsAndRedraw);
});

fitButton.addEventListener("click", draw);

toggleGridButton.addEventListener("click", () => {
  gridOn = !gridOn;
  toggleGridButton.textContent = "Grid: " + (gridOn ? "On" : "Off");
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
