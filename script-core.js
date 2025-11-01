/* ------------------------------------------------------------
   SCRIPT CORE CNT - versión completa para GitHub Pages
   Carga automática de graphs/huescageneral.json
   Edición, movimiento, enlaces, guardado automático
------------------------------------------------------------ */

let nodos = [];
let enlaces = [];
let personas = [];
let selectedNode = null;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let draggingNode = null;

/* ============================================================
   INICIALIZACIÓN AUTOMÁTICA
   ============================================================ */

window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Cargando grafo principal...");
  await loadMainGraph();
  updateSummary();
});

/* ============================================================
   CARGA PRINCIPAL DE GRAFO
   ============================================================ */
async function loadMainGraph() {
  try {
    const res = await fetch("graphs/huescageneral.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    importGraphFromData(data);
    console.log("✅ Grafo cargado correctamente");
  } catch (err) {
    console.error("🚨 Error al cargar el grafo:", err);
    alert("No se pudo cargar el grafo principal.");
  }
}

/* ============================================================
   IMPORTACIÓN DE DATOS DE GRAFO
   ============================================================ */
function importGraphFromData(data) {
  console.log("📥 Importando grafo desde datos...");
  nodos = data.nodos || data.nodes || [];
  enlaces = data.enlaces || data.edges || [];
  personas = data.personas || data.people || [];

  const canvas = document.getElementById("canvasContent");
  canvas.innerHTML = "";

  // Renderizar nodos
  nodos.forEach((n) => renderNode(n));

  // Renderizar enlaces
  drawEdges();
  renderPersonList();
}

/* ============================================================
   RENDERIZADO DE NODOS Y ENLACES
   ============================================================ */
function renderNode(nodo) {
  const div = document.createElement("div");
  div.className = "node";
  div.dataset.id = nodo.id || crypto.randomUUID();
  div.textContent = nodo.nombre || "Nodo";

  div.style.left = (nodo.x || Math.random() * 800) + "px";
  div.style.top = (nodo.y || Math.random() * 600) + "px";
  div.style.backgroundColor = getColorByType(nodo.tipo);

  // Drag and drop
  div.addEventListener("mousedown", (e) => startDragNode(e, nodo, div));
  div.addEventListener("mouseup", () => (draggingNode = null));

  // Popup al hacer click
  div.addEventListener("dblclick", () => openPopup(nodo));

  document.getElementById("canvasContent").appendChild(div);
}

function drawEdges() {
  const canvas = document.getElementById("canvasContent");
  enlaces.forEach((e) => {
    const src = nodos.find((n) => n.id === e.origen || n.id === e.source);
    const dst = nodos.find((n) => n.id === e.destino || n.id === e.target);
    if (!src || !dst) return;

    const x1 = (src.x || 0) + 60;
    const y1 = (src.y || 0) + 20;
    const x2 = (dst.x || 0) + 60;
    const y2 = (dst.y || 0) + 20;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const line = document.createElement("div");
    line.className = "edge";
    line.style.width = len + "px";
    line.style.left = x1 + "px";
    line.style.top = y1 + "px";
    line.style.transform = `rotate(${angle}deg)`;
    canvas.appendChild(line);
  });
}

function getColorByType(tipo) {
  switch (tipo) {
    case "supernodo": return "#ffeeba";
    case "subnodo": return "#cce5ff";
    case "tarea": return "#d4edda";
    default: return "#f8d7da";
  }
}

/* ============================================================
   MOVER NODOS
   ============================================================ */
function startDragNode(e, nodo, div) {
  draggingNode = { nodo, div, startX: e.clientX, startY: e.clientY };
  document.addEventListener("mousemove", onDragNode);
  document.addEventListener("mouseup", stopDragNode);
}

function onDragNode(e) {
  if (!draggingNode) return;
  const dx = e.clientX - draggingNode.startX;
  const dy = e.clientY - draggingNode.startY;
  const left = parseFloat(draggingNode.div.style.left) + dx;
  const top = parseFloat(draggingNode.div.style.top) + dy;
  draggingNode.div.style.left = left + "px";
  draggingNode.div.style.top = top + "px";
  draggingNode.nodo.x = left;
  draggingNode.nodo.y = top;
  draggingNode.startX = e.clientX;
  draggingNode.startY = e.clientY;
}

function stopDragNode() {
  document.removeEventListener("mousemove", onDragNode);
  document.removeEventListener("mouseup", stopDragNode);
  draggingNode = null;
  redraw();
}

/* ============================================================
   POPUP DE EDICIÓN
   ============================================================ */
function openPopup(nodo) {
  selectedNode = nodo;
  document.getElementById("popup").style.display = "block";
  document.getElementById("editName").value = nodo.nombre || "";
  document.getElementById("editOwner").value = nodo.owner || "";
  document.getElementById("editHours").value = nodo.horas || 0;
  document.getElementById("editDescription").value = nodo.descripcion || "";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

function applyEdits() {
  if (!selectedNode) return;
  selectedNode.nombre = document.getElementById("editName").value;
  selectedNode.owner = document.getElementById("editOwner").value;
  selectedNode.horas = parseInt(document.getElementById("editHours").value);
  selectedNode.descripcion = document.getElementById("editDescription").value;
  redraw();
  closePopup();
}

function deleteNode() {
  if (!selectedNode) return;
  nodos = nodos.filter((n) => n !== selectedNode);
  enlaces = enlaces.filter(
    (e) =>
      e.origen !== selectedNode.id &&
      e.destino !== selectedNode.id &&
      e.source !== selectedNode.id &&
      e.target !== selectedNode.id
  );
  redraw();
  closePopup();
}

/* ============================================================
   CREACIÓN Y EXPORTACIÓN
   ============================================================ */
function createNode() {
  const name = document.getElementById("taskName").value.trim();
  if (!name) return alert("Introduce un nombre de tarea");
  const nodo = {
    id: crypto.randomUUID(),
    nombre: name,
    owner: document.getElementById("taskOwner").value,
    horas: parseInt(document.getElementById("taskHours").value) || 0,
    descripcion: document.getElementById("taskDescription").value.trim(),
    tipo: "subnodo",
    x: Math.random() * 800,
    y: Math.random() * 600,
  };
  nodos.push(nodo);
  redraw();
}

function createSupernode() {
  const name = document.getElementById("superName").value.trim();
  if (!name) return alert("Introduce un nombre para el supernodo");
  const nodo = {
    id: crypto.randomUUID(),
    nombre: name,
    tipo: "supernodo",
    x: Math.random() * 800,
    y: Math.random() * 600,
  };
  nodos.push(nodo);
  redraw();
}

function exportGraph() {
  const data = { nodos, enlaces, personas };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `huescageneral_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log("💾 Grafo exportado con éxito");
}

/* ============================================================
   UTILIDADES
   ============================================================ */
function redraw() {
  const canvas = document.getElementById("canvasContent");
  canvas.innerHTML = "";
  nodos.forEach((n) => renderNode(n));
  drawEdges();
  updateSummary();
}

function renderPersonList() {
  const ul = document.getElementById("personList");
  if (!ul) return;
  ul.innerHTML = "";
  personas.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    ul.appendChild(li);
  });
}

function updateSummary() {
  const resumen = document.getElementById("personSummary");
  if (!resumen) return;
  resumen.innerHTML = "";
  const horasPorPersona = {};
  nodos.forEach((n) => {
    if (n.owner) horasPorPersona[n.owner] = (horasPorPersona[n.owner] || 0) + (n.horas || 0);
  });
  for (const [persona, horas] of Object.entries(horasPorPersona)) {
    const li = document.createElement("li");
    li.textContent = `${persona}: ${horas} h`;
    resumen.appendChild(li);
  }
}

console.log("✅ script-core.js cargado correctamente");
