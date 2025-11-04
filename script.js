/* script.js — versión unificada y optimizada
   (fusiona script-core.js, script-edit.js y script-collapse.js)
   Mantiene todas las funcionalidades del sistema original.
*/

/* -----------------------
   Variables globales
----------------------- */
let nodeCounter = 1;
let superCounter = 1;
let selectedNode = null;
let people = [];
const collapsedSupernodes = new Set();

let canvas, canvasContent, popup, jsonSelect, personList, personSummary;
let zoomLevel = 1;
const MIN_ZOOM = 0.2, MAX_ZOOM = 3;
let edgesDirty = false;

/* -----------------------
   Inicialización
----------------------- */
document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("canvas");
  canvasContent = document.getElementById("canvasContent");
  popup = document.getElementById("popup");
  jsonSelect = document.getElementById("jsonSelect");
  personList = document.getElementById("personList");
  personSummary = document.getElementById("personSummary");

  // Zoom
  document.getElementById("zoomInBtn").addEventListener("click", () => setZoom(zoomLevel + 0.1));
  document.getElementById("zoomOutBtn").addEventListener("click", () => setZoom(zoomLevel - 0.1));
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    setZoom(zoomLevel + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });

  // Pan
  enablePanning();

  // Ocultar paneles
  document.getElementById("toggleLeft").addEventListener("click", toggleLeftPanel);
  document.getElementById("toggleRight").addEventListener("click", toggleRightPanel);

  // Cargar lista de grafos
  loadAvailableGraphs();

  // Importar archivo JSON manualmente
  const importFile = document.getElementById("importFile");
  if (importFile) importFile.addEventListener("change", importGraphFromInput);

  // Iniciar actualización de aristas optimizada
  requestAnimationFrame(edgeUpdateLoop);

  // Inicializar listas vacías
  updatePersonDropdowns();
  updatePersonList();
  updateSuperDropdown();
});

/* -----------------------
   Zoom y Pan
----------------------- */
function setZoom(val) {
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(val.toFixed(2))));
  applyTransform();
}

let isPanning = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
function enablePanning() {
  canvas.style.cursor = "grab";
  canvas.addEventListener("mousedown", (e) => {
    if (e.target.closest(".node") || e.target.closest("#popup")) return;
    isPanning = true;
    canvas.style.cursor = "grabbing";
    startX = e.clientX; startY = e.clientY;
    scrollLeft = canvas.scrollLeft; scrollTop = canvas.scrollTop;
    document.body.style.userSelect = "none";
  });
  window.addEventListener("mouseup", () => {
    isPanning = false;
    canvas.style.cursor = "grab";
    document.body.style.userSelect = "";
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    canvas.scrollLeft = scrollLeft - (e.clientX - startX);
    canvas.scrollTop = scrollTop - (e.clientY - startY);
  });
}

function applyTransform() {
  canvasContent.style.transform = `scale(${zoomLevel})`;
}

/* -----------------------
   Crear nodos
----------------------- */
function createNode() {
  const name = document.getElementById("taskName").value.trim();
  const owner = document.getElementById("taskOwner").value;
  const hours = parseFloat(document.getElementById("taskHours").value);
  const superId = document.getElementById("superSelect").value;
  const description = document.getElementById("taskDescription").value.trim();

  if (!name || isNaN(hours) || hours <= 0) return alert("Nombre y horas válidas son obligatorios.");

  const id = `node_${nodeCounter++}`;
  const node = makeNodeElement({
    id, name, owner, hours, super: superId, type: "sub", description
  });

  positionRandomly(node);
  canvasContent.appendChild(node);

  if (superId) createEdge(id, superId);
  updateSupernodeCompletionCascade(superId);
  updatePersonSummary();
  edgesDirty = true;
}

/* -----------------------
   Crear supernodos
----------------------- */
function createSupernode() {
  const name = document.getElementById("superName").value.trim();
  const owner = document.getElementById("superOwner").value;
  const parentId = document.getElementById("superSelect").value;

  if (!name) return alert("El nombre del supernodo no puede estar vacío.");

  const id = `super_${superCounter++}`;
  const node = makeNodeElement({
    id, name, owner, type: "super", super: parentId
  });

  positionRandomly(node);
  canvasContent.appendChild(node);
  enableCollapseToggle(node);
  updateSuperDropdown();

  if (parentId) createEdge(id, parentId);
  updateSupernodeCompletionCascade(parentId);
  updatePersonSummary();
  edgesDirty = true;
}
/* -----------------------
   Utilidades de creación y posición
----------------------- */
function makeNodeElement({ id, name, owner = "", hours = 0, super: sup = "", type = "sub", description = "" }) {
  const node = document.createElement("div");
  node.className = "node";
  node.dataset.id = id;
  node.dataset.name = name;
  node.dataset.owner = owner;
  node.dataset.hours = hours;
  node.dataset.super = sup;
  node.dataset.type = type;
  node.dataset.description = description;
  node.dataset.descVisible = "false";

  if (type === "sub") updateNodeVisual(node);
  else updateSupernodeVisual(node, 0);

  makeDraggable(node);
  enablePopupEdit(node);
  return node;
}

function positionRandomly(node) {
  const cw = canvasContent.offsetWidth || 2000;
  const ch = canvasContent.offsetHeight || 2000;
  const w = 140, h = 70;
  const x = Math.max(0, Math.random() * (cw - w));
  const y = Math.max(0, Math.random() * (ch - h));
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

/* -----------------------
   Drag & Drop
----------------------- */
function makeDraggable(element) {
  let offsetX = 0, offsetY = 0, dragging = false;

  element.addEventListener("mousedown", (e) => {
    if (e.button === 2) return; // click derecho abre popup
    dragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    element.style.left = (e.clientX - offsetX) + "px";
    element.style.top = (e.clientY - offsetY) + "px";
    edgesDirty = true;
  });

  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.userSelect = "";
      edgesDirty = true;
    }
  });
}

/* -----------------------
   Aristas (edges)
----------------------- */
function createEdge(fromId, toId) {
  const from = document.querySelector(`.node[data-id='${fromId}']`);
  const to = document.querySelector(`.node[data-id='${toId}']`);
  if (!from || !to) return;

  if (canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`)) return; // evitar duplicados

  const line = document.createElement("div");
  line.className = "edge";
  line.dataset.from = fromId;
  line.dataset.to = toId;
  canvasContent.appendChild(line);
  updateEdgePosition(line, from, to);
  updatePersonList();
  edgesDirty = true;
}

function removeEdge(fromId, toId) {
  const edge = canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`);
  if (edge) edge.remove();
  edgesDirty = true;
  updatePersonList();
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

/* Actualización optimizada de aristas */
function edgeUpdateLoop() {
  if (edgesDirty) {
    document.querySelectorAll(".edge").forEach(line => {
      const from = document.querySelector(`.node[data-id='${line.dataset.from}']`);
      const to = document.querySelector(`.node[data-id='${line.dataset.to}']`);
      if (from && to) updateEdgePosition(line, from, to);
      else line.remove();
    });
    edgesDirty = false;
  }
  requestAnimationFrame(edgeUpdateLoop);
}

/* -----------------------
   Visualización de nodos
----------------------- */
function updateNodeVisual(node) {
  const name = node.dataset.name;
  const owner = node.dataset.owner;
  const hours = node.dataset.hours;
  const description = node.dataset.description || "";
  const isVisible = node.dataset.descVisible === "true";

  const toggleIcon = isVisible ? "➖" : "➕";
  const descHTML = isVisible ? `<div class='description'>${description}</div>` : "";

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
  if (toggle) toggle.onclick = () => {
    node.dataset.descVisible = node.dataset.descVisible === "true" ? "false" : "true";
    updateNodeVisual(node);
  };
}

/* -----------------------
   Visualización de supernodos
----------------------- */
function updateSupernodeVisual(node, completion) {
  const name = node.dataset.name;
  const owner = node.dataset.owner;
  const percent = Math.round((completion || 0) * 100);
  const icon = collapsedSupernodes.has(node.dataset.id) ? "➕" : "➖";

  let html = `<span class="collapse-icon" style="float:right; font-size:18px;">${icon}</span>
    <strong>${name} (${percent}%)</strong><br>Responsable: ${owner || "(sin asignar)"}`;

  if (collapsedSupernodes.has(node.dataset.id)) {
    const subs = getAllDescendantSubnodes(node.dataset.id);
    if (subs.length) {
      html += `<div style="margin-top:6px; text-align:left;">`;
      subs.forEach(n => {
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
/* -----------------------
   Colapso / Expansión de supernodos
----------------------- */
function enableCollapseToggle(node) {
  node.addEventListener("click", (e) => {
    if (!e.target.classList.contains("collapse-icon")) return;
    const id = node.dataset.id;
    const collapsed = collapsedSupernodes.has(id);

    if (collapsed) {
      collapsedSupernodes.delete(id);
      showChildren(id);
    } else {
      collapsedSupernodes.add(id);
      hideChildren(id);
    }

    updateSupernodeCompletionCascade(id);
    updateSupernodeVisual(node, calculateSupernodeCompletion(id));
  });
}

function hideChildren(superId) {
  document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
    child.style.display = "none";
    if (child.dataset.type === "super") {
      collapsedSupernodes.add(child.dataset.id);
      hideChildren(child.dataset.id);
    }
  });

  document.querySelectorAll(`.edge[data-from='${superId}'], .edge[data-to='${superId}']`).forEach(edge => {
    const related = edge.dataset.from === superId || edge.dataset.to === superId;
    if (related) edge.style.display = "none";
  });
}

function showChildren(superId) {
  document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
    child.style.display = "block";
    if (child.dataset.type === "super" && !collapsedSupernodes.has(child.dataset.id)) {
      showChildren(child.dataset.id);
    }
  });

  document.querySelectorAll(`.edge[data-from='${superId}'], .edge[data-to='${superId}']`).forEach(edge => {
    edge.style.display = "block";
  });
}

/* -----------------------
   Popup de edición contextual
----------------------- */
function enablePopupEdit(node) {
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    selectedNode = node;

    const isSuper = node.dataset.type === "super";
    document.getElementById("editName").value = node.dataset.name;
    document.getElementById("editOwner").value = node.dataset.owner || "";
    document.getElementById("editHours").value = node.dataset.hours || "";
    document.getElementById("editSuperSelect").value = node.dataset.super || "";
    document.getElementById("editDescription").value = node.dataset.description || "";

    document.getElementById("editHours").style.display = isSuper ? "none" : "inline";
    document.getElementById("editHoursLabel").style.display = isSuper ? "none" : "inline";
    document.getElementById("editSuperSelect").style.display = "inline";
    document.getElementById("editSuperLabel").style.display = "inline";

    popup.style.left = e.pageX + "px";
    popup.style.top = e.pageY + "px";
    popup.style.display = "block";
  });
}

function applyEdits() {
  if (!selectedNode) return;
  const name = document.getElementById("editName").value.trim();
  const owner = document.getElementById("editOwner").value.trim();
  const hours = parseFloat(document.getElementById("editHours").value);
  const newSuper = document.getElementById("editSuperSelect").value;
  const description = document.getElementById("editDescription").value.trim();
  const isSuper = selectedNode.dataset.type === "super";

  if (!name) return alert("El nombre no puede estar vacío.");
  if (!isSuper && (isNaN(hours) || hours <= 0)) return alert("Las horas deben ser mayores que 0.");

  const oldSuper = selectedNode.dataset.super;
  selectedNode.dataset.name = name;
  selectedNode.dataset.owner = owner;
  selectedNode.dataset.super = newSuper;
  selectedNode.dataset.description = description;
  if (!isSuper) selectedNode.dataset.hours = hours;

  if (oldSuper && oldSuper !== newSuper) removeEdge(selectedNode.dataset.id, oldSuper);
  if (newSuper && newSuper !== oldSuper) createEdge(selectedNode.dataset.id, newSuper);

  if (isSuper) updateSupernodeCompletionCascade(selectedNode.dataset.id);
  else updateNodeVisual(selectedNode);

  closePopup();
  updatePersonList();
  edgesDirty = true;
}

function deleteNode() {
  if (!selectedNode) return;
  const superId = selectedNode.dataset.super;
  removeEdge(selectedNode.dataset.id, superId);
  selectedNode.remove();
  if (superId) updateSupernodeCompletionCascade(superId);
  updateSuperDropdown();
  updatePersonList();
  closePopup();
  edgesDirty = true;
}

function closePopup() {
  popup.style.display = "none";
  selectedNode = null;
}
/* -----------------------
   Cálculo de completitud y cascada
----------------------- */
function getAllDescendantSubnodes(superId) {
  const descendants = [];
  document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
    if (child.dataset.type === "sub") descendants.push(child);
    else descendants.push(...getAllDescendantSubnodes(child.dataset.id));
  });
  return descendants;
}

function calculateSupernodeCompletion(superId) {
  const subs = getAllDescendantSubnodes(superId);
  if (!subs.length) return 0;
  const completed = subs.filter(n => n.dataset.owner && n.dataset.owner.trim() !== "");
  return completed.length / subs.length;
}

function updateSupernodeCompletionCascade(superId) {
  if (!superId) return;
  const node = document.querySelector(`.node[data-id='${superId}']`);
  if (!node) return;

  const completion = calculateSupernodeCompletion(superId);
  updateSupernodeVisual(node, completion);

  const parent = node.dataset.super;
  if (parent) updateSupernodeCompletionCascade(parent);
}

/* -----------------------
   Actualizar listas de personas
----------------------- */
function updatePersonList() {
  const allNodes = Array.from(document.querySelectorAll(".node[data-type='sub']"));
  const personMap = {};

  allNodes.forEach(n => {
    const owner = n.dataset.owner || "";
    const hours = parseFloat(n.dataset.hours || 0);
    if (!owner) return;
    if (!personMap[owner]) personMap[owner] = 0;
    personMap[owner] += hours;
  });

  people = Object.keys(personMap);
  personList.innerHTML = "";

  for (const [p, hrs] of Object.entries(personMap)) {
    const li = document.createElement("li");
    li.textContent = `${p}: ${hrs.toFixed(1)} h`;
    personList.appendChild(li);
  }

  updatePersonSummary();
}

/* -----------------------
   Gini y resumen general
----------------------- */
function updatePersonSummary() {
  const allNodes = Array.from(document.querySelectorAll(".node[data-type='sub']"));
  const totalTasks = allNodes.length;
  const assignedTasks = allNodes.filter(n => n.dataset.owner && n.dataset.owner.trim() !== "").length;
  const totalHours = allNodes.reduce((sum, n) => sum + parseFloat(n.dataset.hours || 0), 0);
  const assignedHours = allNodes.filter(n => n.dataset.owner && n.dataset.owner.trim() !== "")
    .reduce((sum, n) => sum + parseFloat(n.dataset.hours || 0), 0);

  const personHours = {};
  allNodes.forEach(n => {
    const o = n.dataset.owner;
    if (o) {
      if (!personHours[o]) personHours[o] = 0;
      personHours[o] += parseFloat(n.dataset.hours || 0);
    }
  });

  const gini = calculateGini(Object.values(personHours));
  const overload = findOverloadedPeople(personHours);

  personSummary.innerHTML = `
    <strong>Tareas totales:</strong> ${totalTasks}<br>
    <strong>Tareas asignadas:</strong> ${assignedTasks} (${percent(assignedTasks, totalTasks)})<br>
    <strong>Horas totales:</strong> ${totalHours}<br>
    <strong>Horas asignadas:</strong> ${assignedHours} (${percent(assignedHours, totalHours)})<br>
    <strong>Índice Gini:</strong> ${gini.toFixed(3)}<br>
    <strong>Personas con sobrecarga:</strong> ${overload.join(", ") || "ninguna"}
  `;
}

function percent(a, b) {
  if (!b) return "0%";
  return ((a / b) * 100).toFixed(1) + "%";
}

/* -----------------------
   Gini y sobrecarga
----------------------- */
function calculateGini(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      numerator += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return numerator / (2 * n * n * mean);
}

function findOverloadedPeople(personHours) {
  const values = Object.values(personHours);
  if (!values.length) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const threshold = mean * 2;
  return Object.entries(personHours)
    .filter(([_, v]) => v > threshold)
    .map(([k]) => k);
}

/* -----------------------
   Colores y gradientes
----------------------- */
function getGradientColor(value) {
  const r = Math.floor(255 - (value * 200));
  const g = Math.floor(200 * value + 55);
  return `rgb(${r},${g},100)`;
}
/* -----------------------
   Guardar y cargar grafos
----------------------- */
function loadAvailableGraphs() {
  fetch("graphs.json")
    .then(res => res.json())
    .then(files => {
      jsonSelect.innerHTML = "";
      files.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f.replace(/^graphs\//, "");
        jsonSelect.appendChild(opt);
      });
    })
    .catch(() => console.warn("No se pudo cargar graphs.json"));
}

function loadSelectedGraph() {
  const file = jsonSelect.value;
  if (!file) return;
  fetch(file)
    .then(res => res.json())
    .then(data => loadGraphData(data))
    .catch(() => alert("Error al cargar el archivo"));
}

function importGraphFromInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = JSON.parse(ev.target.result);
    loadGraphData(data);
  };
  reader.readAsText(file);
}

function loadGraphData(data) {
  canvasContent.innerHTML = "";
  collapsedSupernodes.clear();
  nodeCounter = 1;
  superCounter = 1;

  (data.nodes || []).forEach(n => {
    const node = makeNodeElement(n);
    node.style.left = n.x || "100px";
    node.style.top = n.y || "100px";
    canvasContent.appendChild(node);
    if (n.type === "super") enableCollapseToggle(node);
  });

  (data.edges || []).forEach(e => createEdge(e.from, e.to));

  updateSuperDropdown();
  updatePersonList();
  updatePersonSummary();
  edgesDirty = true;
}

function exportGraph() {
  const nodes = Array.from(document.querySelectorAll(".node")).map(n => ({
    id: n.dataset.id,
    name: n.dataset.name,
    owner: n.dataset.owner,
    hours: n.dataset.hours,
    super: n.dataset.super,
    type: n.dataset.type,
    description: n.dataset.description,
    x: n.style.left,
    y: n.style.top
  }));

  const edges = Array.from(document.querySelectorAll(".edge")).map(e => ({
    from: e.dataset.from,
    to: e.dataset.to
  }));

  const json = JSON.stringify({ nodes, edges }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "graph.json";
  a.click();
  URL.revokeObjectURL(url);
}

/* -----------------------
   Actualización de dropdowns
----------------------- */
function updateSuperDropdown() {
  const selects = [document.getElementById("superSelect"), document.getElementById("editSuperSelect")];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">Sin supernodo</option>';
    document.querySelectorAll(".node[data-type='super']").forEach(n => {
      const option = document.createElement("option");
      option.value = n.dataset.id;
      option.textContent = n.dataset.name;
      select.appendChild(option);
    });
  });
}

function updatePersonDropdowns() {
  const selects = [document.getElementById("taskOwner"), document.getElementById("superOwner"), document.getElementById("editOwner")];
  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = "";
    people.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
  });
}

/* -----------------------
   Paneles laterales
----------------------- */
function toggleLeftPanel() {
  const left = document.getElementById("leftPanel");
  if (!left) return;
  left.style.display = left.style.display === "none" ? "block" : "none";
}

function toggleRightPanel() {
  const right = document.getElementById("rightPanel");
  if (!right) return;
  right.style.display = right.style.display === "none" ? "block" : "none";
}

/* -----------------------
   Fin del script
----------------------- */
console.log("✅ script.js unificado y optimizado cargado correctamente");

