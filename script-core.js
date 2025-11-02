let nodeCounter = 1;
let superCounter = 1;
let selectedNode = null;
let people = [];
const collapsedSupernodes = new Set();

// === CREACIÓN DE NODOS ===
function createNode() {
  const name = document.getElementById("taskName").value.trim();
  const owner = document.getElementById("taskOwner").value;
  const hours = parseFloat(document.getElementById("taskHours").value);
  const superId = document.getElementById("superSelect").value;
  const description = document.getElementById("taskDescription").value.trim();

  if (!name || isNaN(hours) || hours <= 0) return;

  const id = `node_${nodeCounter++}`;
  const node = document.createElement("div");
  node.className = "node";
  node.dataset.id = id;
  node.dataset.name = name;
  node.dataset.owner = owner;
  node.dataset.hours = hours;
  node.dataset.super = superId;
  node.dataset.type = "sub";
  node.dataset.description = description;

  updateNodeVisual(node);
  positionRandomly(node);
  makeDraggable(node);
  enablePopupEdit(node);
  document.getElementById("canvasContent").appendChild(node);

  if (superId) {
    createEdge(id, superId);
    updateSupernodeCompletionCascade(superId);
  }

  updatePersonSummary();
}

// === POSICIONAMIENTO ALEATORIO ===
function positionRandomly(node) {
  const canvasContent = document.getElementById('canvasContent');
  const canvasWidth = canvasContent.offsetWidth;
  const canvasHeight = canvasContent.offsetHeight;
  const nodeWidth = 120;
  const nodeHeight = 60;
  const x = Math.random() * (canvasWidth - nodeWidth);
  const y = Math.random() * (canvasHeight - nodeHeight);
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

// === DRAG ===
function makeDraggable(element) {
  let offsetX = 0, offsetY = 0, isDragging = false;
  element.addEventListener("mousedown", (e) => {
    if (e.button === 2) return;
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      element.style.left = (e.clientX - offsetX) + "px";
      element.style.top = (e.clientY - offsetY) + "px";
      updateConnectedEdges(element);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

// === ACTUALIZAR CONEXIONES ===
function updateConnectedEdges(node) {
  const nodeId = node.dataset.id;
  document.querySelectorAll(`.edge[data-from='${nodeId}'], .edge[data-to='${nodeId}']`).forEach(line => {
    const from = document.querySelector(`.node[data-id='${line.dataset.from}']`);
    const to = document.querySelector(`.node[data-id='${line.dataset.to}']`);
    if (from && to) updateEdgePosition(line, from, to);
  });
}

function updateEdgePosition(line, from, to) {
  const x1 = from.offsetLeft + from.offsetWidth / 2;
  const y1 = from.offsetTop + from.offsetHeight / 2;
  const x2 = to.offsetLeft + to.offsetWidth / 2;
  const y2 = to.offsetTop + to.offsetHeight / 2;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  line.style.width = length + "px";
  line.style.transform = `rotate(${angle}deg)`;
  line.style.transformOrigin = "0 0";
  line.style.left = x1 + "px";
  line.style.top = y1 + "px";
}

function animateVisibility(element, hide) {
  element.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  element.style.opacity = hide ? "0" : "1";
  element.style.transform = hide ? "scale(0.9)" : "scale(1)";
  setTimeout(() => {
    element.style.display = hide ? "none" : "block";
  }, hide ? 300 : 0);
}

// === SUPERNODOS ===
function createSupernode() {
  const name = document.getElementById("superName").value.trim();
  const owner = document.getElementById("superOwner").value;
  const parentId = document.getElementById("superSelect").value;
  if (!name) return;

  const id = `super_${superCounter++}`;
  const node = document.createElement("div");
  node.className = "node";
  node.dataset.id = id;
  node.dataset.name = name;
  node.dataset.owner = owner;
  node.dataset.type = "super";
  node.dataset.super = parentId;

  updateSupernodeVisual(node, 0);
  positionRandomly(node);
  makeDraggable(node);
  enablePopupEdit(node);
  enableCollapseToggle(node);
  document.getElementById("canvasContent").appendChild(node);
  updateSuperDropdown();

  if (parentId) {
    createEdge(id, parentId);
    updateSupernodeCompletionCascade(parentId);
  }

  updatePersonSummary();
}

// === VISUALES DE NODOS ===
function updateNodeVisual(node) {
  const name = node.dataset.name;
  const owner = node.dataset.owner;
  const hours = node.dataset.hours;
  const description = node.dataset.description || "";
  const isVisible = node.dataset.descVisible === "true";
  const toggleIcon = isVisible ? "➖" : "➕";
  const descHTML = isVisible ? `<div class="description">${description}</div>` : "";
  node.innerHTML = `
    <strong>${name}</strong><br>
    Responsable: ${owner || "(sin asignar)"}<br>
    Horas: ${hours}
    <span class="toggle-desc" style="float:right; cursor:pointer;">${toggleIcon}</span>
    ${descHTML}
  `;
  node.style.backgroundColor = owner ? "#4CAF50" : "#F44336";
  node.style.color = "black";

  const toggle = node.querySelector(".toggle-desc");
  if (toggle) {
    toggle.onclick = () => {
      node.dataset.descVisible = node.dataset.descVisible === "true" ? "false" : "true";
      updateNodeVisual(node);
    };
  }
}

function updateSupernodeVisual(node, completion) {
  const name = node.dataset.name;
  const owner = node.dataset.owner;
  const percent = Math.round(completion * 100);
  const icon = collapsedSupernodes.has(node.dataset.id) ? "➕" : "➖";
  let html = `
    <span class="collapse-icon" style="float:right; font-size:18px;">${icon}</span>
    <strong>${name} (${percent}%)</strong><br>
    Responsable: ${owner || "(sin asignar)"}
  `;
  if (collapsedSupernodes.has(node.dataset.id)) {
    const subnodes = getAllDescendantSubnodes(node.dataset.id);
    if (subnodes.length > 0) {
      html += `<div style="margin-top:6px; text-align:left;">`;
      subnodes.forEach(n => {
        const hasOwner = n.dataset.owner && n.dataset.owner.trim() !== "";
        const taskIcon = hasOwner ? "✅" : "⚠️";
        html += `${taskIcon} ${n.dataset.name}<br>`;
      });
      html += `</div>`;
    }
  }
  node.innerHTML = html;
  node.style.backgroundColor = getGradientColor(completion);
  node.style.color = "black";
}

function getGradientColor(value) {
  value = Math.max(0, Math.min(1, value));
  const r = value < 0.5 ? 244 + (255 - 244) * (value / 0.5) : 255 - (255 - 76) * ((value - 0.5) / 0.5);
  const g = value < 0.5 ? 67 + (255 - 67) * (value / 0.5) : 255 - (255 - 175) * ((value - 0.5) / 0.5);
  const b = value < 0.5 ? 54 : 0 + 80 * ((value - 0.5) / 0.5);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// (…continúa con tus funciones de cascada, personas, resumen, Gini, export/import idénticas…)

// === DOMContentLoaded ===
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas");
  const content = document.getElementById("canvasContent");

  let scale = 1, panX = 0, panY = 0, isPanning = false, startX = 0, startY = 0, hasCentered = false;
  content.style.transition = "transform 0.4s ease";

  // Cargar grafo
  fetch("graphs/huescageneral.json")
    .then(r => r.json())
    .then(data => {
      loadGraph(data);
      requestAnimationFrame(() => setTimeout(() => centerAndFit(true), 200));
    })
    .catch(err => console.warn("⚠️ No se pudo cargar el grafo inicial:", err));

  // Zoom
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoom = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.3, Math.min(3, scale * zoom));
    panX = mouseX - (mouseX - panX) * (newScale / scale);
    panY = mouseY - (mouseY - panY) * (newScale / scale);
    scale = newScale;
    updateTransform();
  });

  // Pan
  canvas.addEventListener("mousedown", e => {
    if (e.button !== 1 && !e.ctrlKey) return;
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    content.style.transition = "none";
    canvas.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  });

  document.addEventListener("mouseup", () => {
    isPanning = false;
    canvas.style.cursor = "grab";
    content.style.transition = "transform 0.3s ease";
  });

  // Botones zoom
  document.getElementById("zoomInBtn")?.addEventListener("click", () => changeZoom(1.2));
  document.getElementById("zoomOutBtn")?.addEventListener("click", () => changeZoom(1 / 1.2));

  function changeZoom(factor) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(0.3, Math.min(3, scale * factor));
    panX = cx - (cx - panX) * (newScale / scale);
    panY = cy - (cy - panY) * (newScale / scale);
    scale = newScale;
    updateTransform();
  }

  function centerAndFit(initial = false) {
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    const gw = content.scrollWidth || content.offsetWidth;
    const gh = content.scrollHeight || content.offsetHeight;
    if (!gw || !gh || gw < 50 || gh < 50) {
      setTimeout(() => centerAndFit(initial), 200);
      return;
    }
    if (initial && hasCentered) return;
    hasCentered = true;
    const scaleFit = Math.min(cw / gw, ch / gh) * 0.9;
    scale = Math.min(1, scaleFit);
    panX = (cw - gw * scale) / 2;
    panY = (ch - gh * scale) / 2;
    updateTransform();
  }

  function updateTransform() {
    content.style.transformOrigin = "0 0";
    content.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  // Botón centrar
  const centerBtn = document.createElement("button");
  centerBtn.textContent = "Centrar grafo";
  centerBtn.style.position = "absolute";
  centerBtn.style.top = "70px";
  centerBtn.style.left = "50%";
  centerBtn.style.transform = "translateX(-50%)";
  centerBtn.style.background = "#007bff";
  centerBtn.style.color = "#fff";
  centerBtn.style.border = "none";
  centerBtn.style.padding = "6px 10px";
  centerBtn.style.borderRadius = "6px";
  centerBtn.style.cursor = "pointer";
  centerBtn.onclick = () => centerAndFit(false);
  document.body.appendChild(centerBtn);
});
