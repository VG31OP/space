export function createLayerPanel({ container, sections, onToggle }) {
  const refs = new Map();

  sections.forEach((section) => {
    const group = document.createElement("section");
    group.className = "layer-group";

    const title = document.createElement("h3");
    title.textContent = section.title;
    group.appendChild(title);

    section.layers.forEach((layer) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `layer-row${layer.enabled ? " active" : ""}`;
      row.dataset.layerId = layer.id;
      row.innerHTML = `
        <span class="layer-checkbox"></span>
        <span class="layer-icon" style="color:${layer.color}">${layer.icon}</span>
        <span class="layer-label">${layer.label}</span>
        <span class="layer-count">0</span>
      `;
      row.addEventListener("click", () => onToggle(layer.id));
      refs.set(layer.id, {
        row,
        count: row.querySelector(".layer-count"),
      });
      group.appendChild(row);
    });

    container.appendChild(group);
  });

  return {
    setLayerState(layerId, enabled) {
      const ref = refs.get(layerId);
      if (!ref) {
        return;
      }
      ref.row.classList.toggle("active", enabled);
    },
    setLayerCount(layerId, count) {
      const ref = refs.get(layerId);
      if (!ref) {
        return;
      }
      ref.count.textContent = String(count);
      ref.count.animate(
        [
          { transform: "scale(1)", opacity: 0.75 },
          { transform: "scale(1.12)", opacity: 1 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 260, easing: "ease-out" },
      );
    },
  };
}

