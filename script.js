/* script.js
   Versión consolidada y optimizada de script-core.js + script-edit.js + script-collapse.js
   Mantiene todas las funcionalidades: creación/edición/borrado de nodos, supernodos, plegado,
   cálculo de Gini, export/import, listas desde graphs.json, zoom/pan, ocultar paneles, etc.
*/

/* -----------------------
   Estado global
   ----------------------- */
let nodeCounter = 1;
let superCounter = 1;
let selectedNode = null;
let people = [];
const collapsedSupernodes = new Set();

/* Canvas / DOM refs (se inicializan en DOMContentLoaded) */
let canvas, canvasContent, popup, jsonSelect, personList, personSummary;
let zoomLevel = 1;
const MIN_ZOOM = 0.2, MAX_ZOOM = 3;

/* Edge update optimization */
let edgesDirty = false;

/* -----------------------
   Utilidades DOM
   ----------------------- */
function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/* -----------------------
   Inicialización y eventos UI
   ----------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // refs
  canvas = q("#canvas");
  canvasContent = q("#canvasContent");
  popup = q("#popup");
  jsonSelect = q("#jsonSelect");
  personList = q("#personList");
  personSummary = q("#personSummary");

  // Zoom buttons
  q("#zoomInBtn").addEventListener("click", () => { setZoom(zoomLevel + 0.1); });
  q("#zoomOutBtn").addEventListener("click", () => { setZoom(zoomLevel - 0.1); });

  // Wheel zoom on canvas
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    setZoom(zoomLevel + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });

  // Pan (drag background)
  enablePanning();

  // Toggle side panels
  q("#toggleLeft").addEventListener("click", toggleLeftPanel);
  q("#toggleRight").addEventListener("click", toggleRightPanel);

  // File loading list / graphs.json
  loadAvailableGraphs();

  // Import file input
  const importFile = q("#importFile");
  if (importFile) importFile.addEventListener("change", importGraphFromInput);

  // Popup close button behaviour (already bound in HTML to functions, but ensure presence)
  // Continuous edge updates via RAF
  requestAnimationFrame(edgeUpdateLoop);

  // Safe: update dropdowns now (in case there are no people yet)
  updatePersonDropdowns();
  updatePersonList();
  updateSuperDropdown();
});

/* -----------------------
   Zoom / Pan
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
   Creación de nodos / supernodos
   ----------------------- */
function createNode() {
  const name = q("#taskName").value.trim();
  const owner = q("#taskOwner").value;
  const hours = parseFloat(q("#taskHours").value);
  const superId = q("#superSelect").value;
  const description = q("#taskDescription").value.trim();

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

function createSupernode() {
  const name = q("#superName").value.trim();
  const owner = q("#superOwner").value;
  const parentId = q("#superSelect").value;

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

/* Crea el elemento DOM de nodo y lo inicializa */
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

  // Visual / interaction
  node.addEventListener("click", () => {
    // evitar selección cuando se hace click en iconos concretos
  });

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
   Draggable y actualización de aristas
   ----------------------- */
function makeDraggable(element) {
  let offsetX = 0, offsetY = 0, dragging = false;

  element.addEventListener("mousedown", (e) => {
    if (e.button === 2) return; // click derecho para popup
    dragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    element.style.left = (e.clientX - offsetX) + "px";
    element.style.top = (e.clientY - offsetY) + "px";
    markEdgesDirtyForNode(element.dataset.id);
  });

  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.userSelect = "";
      edgesDirty = true;
    }
  });
}

/* Marca aristas asociadas a un nodo como sucias (para actualizar) */
function markEdgesDirtyForNode(nodeId) {
  edgesDirty = true;
  // al mover, también actualizamos visual de supernodos para cascada si hace falta
  const parent = q(`.node[data-id='${nodeId}']`)?.dataset.super;
  if (parent) updateSupernodeCompletionCascade(parent);
}

/* -----------------------
   Aristas: creación, eliminación y actualización optimizada
   ----------------------- */
function createEdge(fromId, toId) {
  const from = q(`.node[data-id='${fromId}']`);
  const to = q(`.node[data-id='${toId}']`);
  if (!from || !to) return;

  // evitar duplicados
  if (canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`)) return;

  const line = document.createElement("div");
  line.className = "edge";
  line.dataset.from = fromId;
  line.dataset.to = toId;
  canvasContent.appendChild(line);
  updateEdgePosition(line, from, to);
  edgesDirty = true;
  updatePersonList();
}

function removeEdge(fromId, toId) {
  const edge = canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`);
  if (edge) { edge.remove(); edgesDirty = true; updatePersonList(); }
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

/* Bucle de actualización de aristas - solo cuando haga falta */
function edgeUpdateLoop() {
  if (edgesDirty) {
    qa(".edge").forEach(line => {
      const from = q(`.node[data-id='${line.dataset.from}']`);
      const to = q(`.node[data-id='${line.dataset.to}']`);
      if (from && to) updateEdgePosition(line, from, to);
      else line.remove();
    });
    edgesDirty = false;
  }
  requestAnimationFrame(edgeUpdateLoop);
}

/* -----------------------
   Visual de nodos y supernodos
   ----------------------- */
function updateNodeVisual(node) {
  const name = node.dataset.name || "";
  const owner = node.dataset.owner || "";
  const hours = node.dataset.hours || 0;
  const desc = node.dataset.description || "";
  const isVisible = node.dataset.descVisible === "true";
  const toggleIcon = isVisible ? "➖" : "➕";
  const descHTML = isVisible ? `<div class="description" style="margin-top:6px; font-size:13px;">${escapeHtml(desc)}</div>` : "";

  node.innerHTML = `
    <strong>${escapeHtml(name)}</strong><br>
    <small>Responsable: ${escapeHtml(owner || "(sin asignar)")}</small><br>
    <small>Horas: ${hours}</small>
    <span class="toggle-desc" style="float:right; cursor:pointer; font-weight:bold;">${toggleIcon}</span>
    ${descHTML}
  `;

  node.style.backgroundColor = owner ? "#4CAF50" : "#F44336";
  node.style.color = "black";
  node.style.minWidth = "120px";
  node.style.padding = "8px";
  node.style.borderRadius = "6px";
  node.style.border = "1px solid rgba(0,0,0,0.15)";

  const toggle = node.querySelector(".toggle-desc");
  if (toggle) toggle.onclick = (e) => {
    e.stopPropagation();
    node.dataset.descVisible = node.dataset.descVisible === "true" ? "false" : "true";
    updateNodeVisual(node);
  };
}

function updateSupernodeVisual(node, completion) {
  completion = Math.max(0, Math.min(1, completion || 0));
  const name = node.dataset.name || "";
  const owner = node.dataset.owner || "";
  const percent = Math.round(completion * 100);
  const icon = collapsedSupernodes.has(node.dataset.id) ? "➕" : "➖";

  let html = `<span class="collapse-icon" style="float:right; font-size:18px; cursor:pointer;">${icon}</span>
              <strong>${escapeHtml(name)} (${percent}%)</strong><br>
              <small>Responsable: ${escapeHtml(owner || "(sin asignar)")}</small>`;

  if (collapsedSupernodes.has(node.dataset.id)) {
    const subnodes = getAllDescendantSubnodes(node.dataset.id);
    if (subnodes.length > 0) {
      html += `<div style="margin-top:6px; text-align:left; font-size:13px;">`;
      subnodes.forEach(n => {
        const hasOwner = n.dataset.owner && n.dataset.owner.trim() !== "";
        const taskIcon = hasOwner ? "✅" : "⚠️";
        html += `${taskIcon} ${escapeHtml(n.dataset.name)}<br>`;
      });
      html += `</div>`;
    }
  }

  node.innerHTML = html;
  node.style.backgroundColor = getGradientColor(completion);
  node.style.color = "black";
  node.style.minWidth = "140px";
  node.style.padding = "8px";
  node.style.borderRadius = "8px";
  node.style.border = "1px solid rgba(0,0,0,0.12)";
}

/* -----------------------
   Collapse / Expand
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
    edgesDirty = true;
  });
}

function hideChildren(superId) {
  qa(`.node[data-super='${superId}']`).forEach(child => {
    child.style.display = "none";
    if (child.dataset.type === "super") {
      collapsedSupernodes.add(child.dataset.id);
      hideChildren(child.dataset.id);
    }
  });
  qa(`.edge[data-from='${superId}']`).forEach(edge => edge.style.display = "none");
  qa(`.edge[data-to='${superId}']`).forEach(edge => edge.style.display = "none");
}

function showChildren(superId) {
  qa(`.node[data-super='${superId}']`).forEach(child => {
    child.style.display = "block";
    if (child.dataset.type === "super" && !collapsedSupernodes.has(child.dataset.id)) {
      showChildren(child.dataset.id);
    }
  });
  qa(`.edge[data-from='${superId}'], .edge[data-to='${superId}']`).forEach(edge => edge.style.display = "block");
}

/* -----------------------
   Popup edición (contextmenu)
   ----------------------- */
function enablePopupEdit(node) {
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    selectedNode = node;
    const isSuper = node.dataset.type === "super";

    q("#editName").value = node.dataset.name || "";
    q("#editOwner").value = node.dataset.owner || "";
    q("#editHours").value = node.dataset.hours || "";
    q("#editSuperSelect").value = node.dataset.super || "";
    q("#editDescription").value = node.dataset.description || "";

    q("#editHours").style.display = isSuper ? "none" : "inline";
    q("#editHoursLabel").style.display = isSuper ? "none" : "inline";
    q("#editSuperSelect").style.display = "inline";
    q("#editSuperLabel").style.display = "inline";

    popup.style.left = e.pageX + "px";
    popup.style.top = e.pageY + "px";
    popup.style.display = "block";
  });
}

/* Aplicar cambios desde popup */
function applyEdits() {
  if (!selectedNode) return;
  const name = q("#editName").value.trim();
  const owner = q("#editOwner").value.trim();
  const hours = parseFloat(q("#editHours").value);
  const newSuper = q("#editSuperSelect").value;
  const isSuper = selectedNode.dataset.type === "super";
  const description = q("#editDescription").value.trim();

  if (!name) return alert("El nombre no puede estar vacío.");
  if (!isSuper && (isNaN(hours) || hours <= 0)) return alert("El número de horas debe ser mayor que 0.");

  const oldSuper = selectedNode.dataset.super;
  selectedNode.dataset.name = name;
  selectedNode.dataset.owner = owner;
  selectedNode.dataset.super = newSuper;
  selectedNode.dataset.description = description;
  if (!isSuper) selectedNode.dataset.hours = hours;

  if (oldSuper && oldSuper !== newSuper) removeEdge(selectedNode.dataset.id, oldSuper);
  if (newSuper && newSuper !== oldSuper) createEdge(selectedNode.dataset.id, newSuper);

  if (isSuper) {
    updateSupernodeCompletion(selectedNode.dataset.id);
  } else {
    updateNodeVisual(selectedNode);
    if (newSuper) updateSupernodeCompletion(newSuper);
  }

  closePopup();
  updatePersonList();
  edgesDirty = true;
}

function deleteNode() {
  if (!selectedNode) return;
  const superId = selectedNode.dataset.super;
  removeEdge(selectedNode.dataset.id, superId);
  selectedNode.remove();
  if (superId) updateSupernodeCompletion(superId);
  updateSuperDropdown();
  closePopup();
  updatePersonList();
  edgesDirty = true;
}

function closePopup() {
  popup.style.display = "none";
  selectedNode = null;
}

/* -----------------------
   Dropdowns y listas
   ----------------------- */
function updateSuperDropdown() {
  const selects = [q("#superSelect"), q("#editSuperSelect")].filter(Boolean);
  selects.forEach(select => {
    select.innerHTML = '<option value="">Sin supernodo</option>';
    qa(".node[data-type='super']").forEach(n => {
      const option = document.createElement("option");
      option.value = n.dataset.id;
      option.textContent = n.dataset.name;
      select.appendChild(option);
    });
  });
}

function updatePersonDropdowns() {
  const selects = [q("#taskOwner"), q("#superOwner"), q("#editOwner")].filter(Boolean);
  selects.forEach(select => {
    select.innerHTML = '<option value="">(sin asignar)</option>';
    people.forEach(p => {
      const option = document.createElement("option");
      option.value = p;
      option.textContent = p;
      select.appendChild(option);
    });
  });
}

function addPerson() {
  const name = q("#newPersonName").value.trim();
  if (!name) return;
  if (people.includes(name)) return alert("Persona ya existente.");
  people.push(name);
  q("#newPersonName").value = "";
  updatePersonDropdowns();
  updatePersonList();
}

function updatePersonList() {
  personList.innerHTML = "";
  people.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input value="${escapeHtml(p)}" onchange="editPerson(${i}, this.value)">
      <button onclick="removePerson(${i})">Eliminar</button>
    `;
    personList.appendChild(li);
  });
  updatePersonSummary();
}

/* editar persona (llamada desde input onchange) */
window.editPerson = function(index, newName) {
  const oldName = people[index];
  people[index] = newName;
  qa(".node").forEach(n => {
    if (n.dataset.owner === oldName) {
      n.dataset.owner = newName;
      if (n.dataset.type === "sub") updateNodeVisual(n);
      else updateSupernodeCompletionCascade(n.dataset.id);
    }
  });
  updatePersonDropdowns();
  updatePersonList();
};

function removePerson(index) {
  const name = people[index];
  people.splice(index, 1);
  qa(".node").forEach(n => {
    if (n.dataset.owner === name) {
      n.dataset.owner = "";
      if (n.dataset.type === "sub") updateNodeVisual(n);
      else updateSupernodeCompletionCascade(n.dataset.id);
    }
  });
  updatePersonDropdowns();
  updatePersonList();
}

/* -----------------------
   Estadísticas y Gini
   ----------------------- */
function updatePersonSummary() {
  personSummary.innerHTML = "";

  const subnodes = qa(".node[data-type='sub']");
  const totalTasks = subnodes.length;
  const assignedTasks = subnodes.filter(n => n.dataset.owner && n.dataset.owner.trim() !== "").length;

  const totalHoursArr = subnodes.map(n => parseFloat(n.dataset.hours || 0));
  const assignedHoursArr = subnodes
    .filter(n => n.dataset.owner && n.dataset.owner.trim() !== "")
    .map(n => parseFloat(n.dataset.hours || 0));

  const totalHoursSum = totalHoursArr.reduce((s, h) => s + h, 0);
  const assignedHoursSum = assignedHoursArr.reduce((s, h) => s + h, 0);
  const assignedPercent = totalHoursSum > 0 ? (assignedHoursSum / totalHoursSum) : 0;
  const assignedTaskPercent = totalTasks > 0 ? (assignedTasks / totalTasks) : 0;

  const personHours = people.map(p => subnodes
    .filter(n => n.dataset.owner === p)
    .reduce((sum, n) => sum + parseFloat(n.dataset.hours || 0), 0)
  );

  const giniByPerson = calculateGini(personHours);
  const giniTotalHours = calculateGini(totalHoursArr);
  const giniAssignedHours = calculateGini(assignedHoursArr);

  personSummary.appendChild(createProgressBar(giniByPerson, "Índice de Gini por persona (horas asignadas)"));
  personSummary.appendChild(createProgressBar(giniTotalHours, "Índice de Gini de todas las tareas (horas)"));
  personSummary.appendChild(createProgressBar(giniAssignedHours, "Índice de Gini de tareas asignadas (horas)"));
  personSummary.appendChild(createProgressBar(assignedPercent, "Proporción de horas asignadas"));
  personSummary.appendChild(createProgressBar(assignedTaskPercent, "Proporción de tareas asignadas"));

  ["Horas asignadas: " + assignedHoursSum.toFixed(1) + " / " + totalHoursSum.toFixed(1) + ` (${(assignedPercent*100).toFixed(1)}%)`,
   "Tareas totales: " + totalTasks,
   "Tareas asignadas: " + assignedTasks].forEach(txt => {
     const li = document.createElement("li"); li.textContent = txt; personSummary.appendChild(li);
  });

  const totalAssignedPeople = personHours.filter(h => h > 0).length;
  const averageHours = totalAssignedPeople > 0 ? personHours.reduce((s,h) => s+h, 0) / totalAssignedPeople : 0;

  const overloaded = people.map((p,i)=>({name:p,hours:personHours[i]})).filter(p=>p.hours > 2*averageHours);
  const avgLi = document.createElement("li");
  avgLi.innerHTML = `<strong>Media de horas por persona asignada:</strong> ${averageHours.toFixed(1)} h`;
  personSummary.appendChild(avgLi);

  if (overloaded.length) {
    const overTitle = document.createElement("li");
    overTitle.innerHTML = `<strong>Personas con más del doble de carga:</strong>`;
    personSummary.appendChild(overTitle);
    overloaded.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `• ${p.name}: ${p.hours.toFixed(1)} h`;
      personSummary.appendChild(li);
    });
  }
}

function calculateGini(values) {
  const sorted = values.slice().sort((a,b)=>a-b);
  const n = sorted.length;
  if (n === 0) return 0;
  const total = sorted.reduce((s,v)=>s+v,0);
  if (total === 0) return 0;
  let cumulative = 0;
  for (let i=0;i<n;i++) cumulative += (i+1)*sorted[i];
  return 1 - ((2*cumulative)/(n*total) - (n+1)/n);
}

function createProgressBar(value, label) {
  const container = document.createElement("li");
  const percentText = `${(value*100).toFixed(1)}%`;
  container.innerHTML = `<strong>${label}</strong> <span style="float:right;">${percentText}</span>`;
  const bar = document.createElement("div");
  bar.style.height = "12px"; bar.style.borderRadius = "6px"; bar.style.marginTop = "4px"; bar.style.background = "#ddd"; bar.style.overflow = "hidden";
  const fill = document.createElement("div");
  fill.style.height = "100%"; fill.style.width = percentText; fill.style.backgroundColor = getColorGradient(value); fill.style.transition = "width 0.3s ease";
  bar.appendChild(fill);
  container.appendChild(bar);
  return container;
}

/* -----------------------
   Supernode completion cascade
   ----------------------- */
function updateSupernodeCompletionCascade(superId) {
  if (!superId) return;
  updateSupernodeCompletion(superId);
  const parentId = q(`.node[data-id='${superId}']`)?.dataset.super;
  if (parentId) updateSupernodeCompletionCascade(parentId);
}

function updateSupernodeCompletion(superId) {
  const subnodes = getAllDescendantSubnodes(superId);
  const total = subnodes.reduce((sum, n) => sum + parseFloat(n.dataset.hours || 0), 0);
  const withOwner = subnodes.reduce((sum, n) => n.dataset.owner ? sum + parseFloat(n.dataset.hours || 0) : sum, 0);
  const completion = total > 0 ? withOwner / total : 0;
  const supernode = q(`.node[data-id='${superId}']`);
  if (supernode) updateSupernodeVisual(supernode, completion);
}

/* Recursivo: obtiene todos los subnodos descendientes (sub) de un supernodo */
function getAllDescendantSubnodes(superId) {
  let result = [];
  const children = qa(".node").filter(n => n.dataset.super === superId);
  for (const child of children) {
    if (child.dataset.type === "sub") result.push(child);
    else if (child.dataset.type === "super") result = result.concat(getAllDescendantSubnodes(child.dataset.id));
  }
  return result;
}

/* -----------------------
   Export / Import / graphs.json
   ----------------------- */
function exportGraph() {
  const nodes = qa(".node").map(n => ({
    id: n.dataset.id,
    name: n.dataset.name,
    owner: n.dataset.owner,
    hours: n.dataset.hours,
    description: n.dataset.description || "",
    super: n.dataset.super,
    type: n.dataset.type,
    left: n.style.left,
    top: n.style.top
  }));
  const edges = qa(".edge").map(e => ({ from: e.dataset.from, to: e.dataset.to }));
  const data = { nodes, edges, people };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "grafo.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert("✅ Grafo exportado. Sube el archivo a graphs/ y agrégalo a graphs.json si quieres cargarlo desde la lista.");
}

async function loadAvailableGraphs() {
  try {
    const res = await fetch("graphs.json");
    const files = await res.json();
    jsonSelect.innerHTML = '<option value="">-- Selecciona un archivo --</option>';
    files.forEach(file => {
      const opt = document.createElement("option");
      opt.value = file;
      opt.textContent = file.split("/").pop();
      jsonSelect.appendChild(opt);
    });
  } catch (err) {
    console.warn("No se pudo cargar graphs.json:", err);
  }
}

async function loadSelectedGraph() {
  const file = q("#jsonSelect").value;
  if (!file) return alert("Selecciona un archivo primero");
  try {
    const res = await fetch(file);
    const data = await res.json();
    importGraphFromData(data);
  } catch (err) { alert("Error al cargar el JSON: " + err); }
}

function importGraphFromInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      importGraphFromData(data);
    } catch (err) { alert("JSON inválido: " + err); }
  };
  reader.readAsText(file);
}

function importGraphFromData(data) {
  canvasContent.innerHTML = "";
  nodeCounter = 1; superCounter = 1;
  people = data.people || [];
  updatePersonDropdowns();
  updatePersonList();

  (data.nodes || []).forEach(n => {
    const node = makeNodeElement({
      id: n.id,
      name: n.name,
      owner: n.owner,
      hours: n.hours,
      super: n.super,
      type: n.type,
      description: n.description || ""
    });
    node.style.left = n.left || "10px";
    node.style.top = n.top || "10px";

    if (n.type === "super") enableCollapseToggle(node);
    canvasContent.appendChild(node);

    // actualizar contadores para evitar ID duplicados
    const num = parseInt((n.id.split("_")[1] || "0"), 10);
    if (n.type === "sub") nodeCounter = Math.max(nodeCounter, num + 1);
    else superCounter = Math.max(superCounter, num + 1);
  });

  (data.edges || []).forEach(e => { createEdge(e.from, e.to); });
  qa(".node[data-type='super']").forEach(n => updateSupernodeCompletionCascade(n.dataset.id));
  updateSuperDropdown();
  updatePersonSummary();
  edgesDirty = true;
}

/* -----------------------
   Ayudas visuales / colores / escape
   ----------------------- */
function getGradientColor(value) {
  value = Math.max(0, Math.min(1, value));
  // suave gradiente verde->amarillo->rojo
  const r = value < 0.5 ? 244 + (255 - 244) * (value / 0.5) : 255 - (255 - 76) * ((value - 0.5) / 0.5);
  const g = value < 0.5 ? 67 + (255 - 67) * (value / 0.5) : 255 - (255 - 175) * ((value - 0.5) / 0.5);
  const b = value < 0.5 ? 54 : Math.round(80 * ((value - 0.5) / 0.5));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function getColorGradient(value) {
  value = Math.max(0, Math.min(1, value));
  const r = 255 - Math.round(255 * value);
  const g = Math.round(200 * value);
  return `rgb(${r},${g},60)`;
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* -----------------------
   UI: ocultar paneles
   ----------------------- */
function toggleLeftPanel() {
  document.body.classList.toggle("hide-left");
  q("#toggleLeft").textContent = document.body.classList.contains("hide-left") ? "⮞" : "⮜";
}
function toggleRightPanel() {
  document.body.classList.toggle("hide-right");
  q("#toggleRight").textContent = document.body.classList.contains("hide-right") ? "⮜" : "⮞";
}

/* -----------------------
   Helper: marcar aristas sucias
   ----------------------- */
function markAllEdgesDirty() { edgesDirty = true; }

/* -----------------------
   Utilidades varias expuestas en global para HTML inline
   ----------------------- */
window.createNode = createNode;
window.createSupernode = createSupernode;
window.exportGraph = exportGraph;
window.loadSelectedGraph = loadSelectedGraph;
window.applyEdits = applyEdits;
window.deleteNode = deleteNode;
window.closePopup = closePopup;
window.addPerson = addPerson;
window.removePerson = removePerson;
window.updateSuperDropdown = updateSuperDropdown;
window.updatePersonSummary = updatePersonSummary;

/* -----------------------
   FINAL: marca inicial
   ----------------------- */
edgesDirty = true;
