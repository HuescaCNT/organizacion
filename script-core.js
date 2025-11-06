let nodeCounter = 1;
let superCounter = 1;
let selectedNode = null;
let people = [];

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

  (document.querySelector("#canvas .canvas-inner") || document.getElementById("canvas")).appendChild(node);

  if (superId) {
    createEdge(id, superId);
    updateSupernodeCompletionCascade(superId);
  }
  updatePersonSummary();
}

function positionRandomly(node) {
  const canvas = document.getElementById("canvas");
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;

  const nodeWidth = 120;
  const nodeHeight = 60;

  const x = Math.random() * (canvasWidth - nodeWidth);
  const y = Math.random() * (canvasHeight - nodeHeight);

  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

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

  (document.querySelector("#canvas .canvas-inner") || document.getElementById("canvas")).appendChild(node);

  updateSuperDropdown();

  if (parentId) {
    createEdge(id, parentId);
    updateSupernodeCompletionCascade(parentId);
  }
  updatePersonSummary();
}

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

  let html = `<span class="collapse-icon" style="float:right; font-size:18px;">${icon}</span>
    <strong>${name} (${percent}%)</strong><br>Responsable: ${owner || "(sin asignar)"}`;

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

function loadGraph(data) {
  (document.querySelector("#canvas .canvas-inner") || document.getElementById("canvas")).innerHTML = "";
  nodeCounter = 1;
  superCounter = 1;

  people = data.people || [];
  updatePersonDropdowns();
  updatePersonList();

  data.nodes.forEach(n => {
    const node = document.createElement("div");
    node.className = "node";
    node.dataset.id = n.id;
    node.dataset.name = n.name;
    node.dataset.owner = n.owner;
    node.dataset.description = n.description || "";
    node.dataset.hours = n.hours;
    node.dataset.super = n.super;
    node.dataset.type = n.type;
    node.style.left = n.left;
    node.style.top = n.top;

    if (n.type === "sub") {
      updateNodeVisual(node);
    } else {
      updateSupernodeVisual(node, 0);
      enableCollapseToggle(node);
    }

    makeDraggable(node);
    enablePopupEdit(node);
    (document.querySelector("#canvas .canvas-inner") || document.getElementById("canvas")).appendChild(node);

    const num = parseInt(n.id.split("_")[1]);
    if (n.type === "sub") nodeCounter = Math.max(nodeCounter, num + 1);
    else superCounter = Math.max(superCounter, num + 1);
  });

  data.edges.forEach(e => createEdge(e.from, e.to));

  const superIds = data.nodes.filter(n => n.type === "super").map(n => n.id);
  superIds.forEach(id => updateSupernodeCompletionCascade(id));

  updateSuperDropdown();
  updatePersonSummary();
}

// === ASEGURAR CANVAS-INNER EXISTE Y CONTIENE LOS NODOS ===
(function ensureCanvasInner() {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;
  let inner = canvas.querySelector(".canvas-inner");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "canvas-inner";
    inner.style.position = "absolute";
    inner.style.left = "0";
    inner.style.top = "0";
    inner.style.width = "100%";
    inner.style.height = "100%";
    inner.style.transformOrigin = "0 0";
    const children = Array.from(canvas.childNodes);
    children.forEach(c => inner.appendChild(c));
    canvas.appendChild(inner);
  }
})();

// === PANNING ROBUSTO (pegar AL FINAL de script-core.js) ===
(function () {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;
  let inner = canvas.querySelector(".canvas-inner");
  if (!inner) return;
  let isPanning = false;
  let startX = 0, startY = 0;
  let offsetX = 0, offsetY = 0;

  function isEventInsideNode(el) {
    while (el && el !== canvas) {
      if (el.classList && (el.classList.contains("node") || el.classList.contains("no-pan"))) return true;
      if (el.hasAttribute && el.hasAttribute("data-node")) return true;
      el = el.parentElement;
    }
    return false;
  }

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (isEventInsideNode(e.target)) return;
    isPanning = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    inner.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  window.addEventListener("mouseup", () => {
    if (!isPanning) return;
    isPanning = false;
    canvas.style.cursor = "default";
  });
})();
