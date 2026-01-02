// src/main.ts
var fileInput = document.getElementById("file");
var canvas = document.getElementById("canvas");
if (!canvas) renderErrorAndThrow("expected canvas element");
var ctx = canvas.getContext("2d");
var spacing = document.getElementById("spacing");
var thickness = document.getElementById("thickness");
var opacity = document.getElementById("opacity");
var color = document.getElementById("color");
var spacingVal = document.getElementById("spacingVal");
var thicknessVal = document.getElementById("thicknessVal");
var opacityVal = document.getElementById("opacityVal");
var fitBtn = document.getElementById("fitBtn");
var toggleBtn = document.getElementById("toggleBtn");
var img = new Image();
var imgLoaded = false;
var gridOn = true;
function resizeCanvasToContainer() {
  const stage = canvas.parentElement;
  if (!stage)
    renderErrorAndThrow(
      "expected canvas element to have a parent container with class 'stage'",
    );
  const rect = stage.getBoundingClientRect();
  const displayWidth = Math.max(1, Math.floor(rect.width));
  const dpr = window.devicePixelRatio || 1;
  const aspect = imgLoaded ? img.naturalHeight / img.naturalWidth : 3 / 4;
  const displayHeight = Math.floor(displayWidth * aspect);
  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";
  canvas.width = Math.floor(displayWidth * dpr);
  canvas.height = Math.floor(displayHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function draw() {
  resizeCanvasToContainer();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (imgLoaded) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload a photo to begin", w / 2, h / 2);
  }
  if (!gridOn) return;
  const s = Number(spacing.value);
  const t = Number(thickness.value);
  const a = Number(opacity.value) / 100;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color.value;
  ctx.lineWidth = t;
  const offset = t % 2 === 1 ? 0.5 : 0;
  for (let x = 0; x <= w; x += s) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + offset, 0);
    ctx.lineTo(Math.round(x) + offset, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += s) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + offset);
    ctx.lineTo(w, Math.round(y) + offset);
    ctx.stroke();
  }
  ctx.restore();
}
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
window.addEventListener("resize", () => {
  clearTimeout(window.__gridResizeTimer);
  window.__gridResizeTimer = setTimeout(draw, 80);
});
syncLabelsAndRedraw();
function renderErrorAndThrow(msg) {
  const errorMessage = document.createElement("p");
  errorMessage.classList.add("error");
  errorMessage.textContent = `Error: ${msg}`;
  document.body.appendChild(errorMessage);
  console.error(msg);
  throw new Error(msg);
}
