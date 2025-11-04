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
    element.style.left = (e.clientX - offsetX
