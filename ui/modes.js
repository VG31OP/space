export function createModes() {
  const container = document.getElementById("cesiumContainer");
  const overlay = document.getElementById("visualOverlay");
  const noiseCanvas = document.getElementById("noiseOverlay");
  const ctx = noiseCanvas.getContext("2d");
  let activeMode = "normal";

  function resizeNoise() {
    noiseCanvas.width = window.innerWidth;
    noiseCanvas.height = window.innerHeight;
  }

  function drawNoise(alpha = 0.06) {
    resizeNoise();
    const imageData = ctx.createImageData(noiseCanvas.width, noiseCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() * 255;
      imageData.data[i] = activeMode === "nvg" ? 40 : value;
      imageData.data[i + 1] = activeMode === "nvg" ? 180 + Math.random() * 75 : value;
      imageData.data[i + 2] = activeMode === "nvg" ? 60 : value;
      imageData.data[i + 3] = Math.floor(alpha * 255);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function applyMode(mode) {
    activeMode = mode;
    container.style.filter = "none";
    overlay.style.opacity = "0";
    noiseCanvas.style.opacity = "0";
    overlay.style.background =
      "radial-gradient(circle at center, transparent 45%, rgba(0, 0, 0, 0.48) 100%), repeating-linear-gradient(180deg, transparent 0, transparent 3px, rgba(0, 0, 0, 0.14) 3px, rgba(0, 0, 0, 0.14) 4px)";

    if (mode === "thermal") {
      container.style.filter = "sepia(1) hue-rotate(100deg) saturate(5) contrast(1.5) brightness(0.7)";
    }

    if (mode === "nvg") {
      container.style.filter = "saturate(0.1) brightness(0.5) contrast(1.8) sepia(0.3) hue-rotate(80deg)";
      noiseCanvas.style.opacity = "0.22";
      drawNoise(0.075);
    }

    if (mode === "crt") {
      container.style.filter = "contrast(1.2) brightness(0.9)";
      overlay.style.opacity = "0.85";
      noiseCanvas.style.opacity = "0.08";
      drawNoise(0.04);
    }
  }

  resizeNoise();
  window.addEventListener("resize", resizeNoise);

  return {
    bindButtons(buttons) {
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          buttons.forEach((item) => item.classList.toggle("active", item === button));
          applyMode(button.dataset.mode);
        });
      });
    },
    applyMode,
  };
}

