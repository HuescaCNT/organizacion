/* =========================================================
   script-core.js — versión estable 2025-11-02
   ========================================================= */

let nodes = [];
let edges = [];
let people = [];
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let selectedNode = null;

const canvas = document.getElementById("canvas");
const canvasContent = document.getElementById("canvasContent");

/* =========================================================
   CARGA DEL GRAFO
   ========================================================= */
async function loadMainGraph() {
  try {
    const response = await fetch("graphs/huescageneral.json?v=" + Date.now());
    if (!response.ok) throw new Error("No se pudo cargar el grafo.");
    const data = await response.json();

    nodes = data.nodes || [];
    edges = data.edges || [];
    people = data.people || [];

    renderGraph();
    updatePersonList();
    updateSummary();

    // Centrar y escalar automáticamente tras un breve retraso
    setTimeout(centerAndFitGraph, 400);
  } catch (error) {
    console.error("Error al cargar el grafo:", error);
  }
}

/* =========================================================
   RENDERIZADO DE GRAFO
   ========================================================= */
function renderGraph() {
  canvasContent.innerHTML = "";

  // Renderizar aristas
  edges.forEach(edge => {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    if (!source || !target) return;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const line = document.createElement("div");
    line.className = "edge";
    line.style.width = `${length}px`;
    line.style.transform = `translate(${source.x}px, ${source.y}px) rotate(${angle}rad)`;
    canvasContent.appendChild(line);
  });

  // Renderizar nodos
  nodes.forEach(node => {
    const div = document.createElement("div");
    div.className = "node";
    div.innerText = node.name;
    div.style.left = `${node.x}px`;
    div.style.top = `${node.y}px`;
    div.style.background = node.color || "#007bff";
    div.onclick = () => openEditPopup(node);
    canvasContent.appendChild(div);
  });

  applyTransform();
}

/* =========================================================
   ZOOM Y PAN
   ========================================================= */
function applyTransform() {
  canvasContent.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

function centerAndFitGraph() {
  if (nodes.length === 0) return;

  const minX = Math.min(...nodes.map(n => n.x));
  const maxX = Math.max(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxY = Math.max(...nodes.map(n => n.y));

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;

  const viewWidth = canvas.clientWidth;
  const viewHeight = canvas.clientHeight;

  const scaleX = viewWidth / (graphWidth + 200);
  const scaleY = viewHeight / (graphHeight + 200);
  scale = Math.min(scaleX, scaleY, 1);

  offsetX = (viewWidth - graphWidth * scale) / 2 - minX * scale;
  offsetY = (viewHeight - graphHeight * scale) / 2 - minY * scale;

  applyTransform();
}

// Zoom con botones
document.getElementById("zoomInBtn").onclick = () => {
  scale *= 1.2;
  applyTransform();
};
document.getElementById("zoomOutBtn").onclick = () => {
  scale /= 1.2;
  applyTransform();
};

// Pan con ratón
let isPanning = false;
let startX, startY;

canvas.addEventListener("mousedown", e => {
  isPanning = true;
  startX = e.clientX;
  startY = e.clientY;
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("mouseup", () => {
  isPanning = false;
  canvas.style.cursor = "grab";
});

canvas.addEventListener("mousemove", e => {
  if (!isPanning) return;
  offsetX += e.clientX - startX;
  offsetY += e.clientY - startY;
  startX = e.clientX;
  startY = e.clientY;
  applyTransform();
});

/* =========================================================
   PERSONAS
   ========================================================= */
function updatePersonList() {
  const select = document.getElementById("taskOwner");
  const editSelect = document.getElementById("editOwner");
  const list = document.getElementById("personList");

  select.innerHTML = "";
  editSelect.innerHTML = "";
  list.innerHTML = "";

  people.forEach(p => {
    const option1 = document.createElement("option");
    option1.value = p.name;
    option1.textContent = p.name;
    select.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = p.name;
    option2.textContent = p.name;
    editSelect.appendChild(option2);

    const li = document.createElement("li");
    li.textContent = p.name;
    list.appendChild(li);
  });
}

function updateSummary() {
  const summary = document.getElementById("personSummary");
  if (!summary) return;

  summary.innerHTML = "";
  people.forEach(p => {
    const hours = nodes
      .filter(n => n.owner === p.name)
      .reduce((sum, n) => sum + (n.hours || 0), 0);
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${hours}h`;
    summary.appendChild(li);
  });
}

/* =========================================================
   POPUP EDICIÓN
   ========================================================= */
function openEditPopup(node) {
  selectedNode = node;
  document.getElementById("editName").value = node.name || "";
  document.getElementById("editOwner").value = node.owner || "";
  document.getElementById("editHours").value = node.hours || "";
  document.getElementById("editDescription").value = node.description || "";
  document.getElementById("popup").style.display = "block";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

function applyEdits() {
  if (!selectedNode) return;
  selectedNode.name = document.getElementById("editName").value;
  selectedNode.owner = document.getElementById("editOwner").value;
  selectedNode.hours = parseInt(document.getElementById("editHours").value) || 0;
  selectedNode.description = document.getElementById("editDescription").value;
  closePopup();
  renderGraph();
  updateSummary();
}

function deleteNode() {
  if (!selectedNode) return;
  nodes = nodes.filter(n => n.id !== selectedNode.id);
  edges = edges.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
  closePopup();
  renderGraph();
  updateSummary();
}

/* =========================================================
   EXPORTAR / IMPORTAR
   ========================================================= */
function exportGraph() {
  const data = { nodes, edges, people };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "grafo-exportado.json";
  a.click();
}

function importGraph(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = JSON.parse(e.target.result);
    nodes = data.nodes || [];
    edges = data.edges || [];
    people = data.people || [];
    renderGraph();
    updatePersonList();
    updateSummary();
    setTimeout(centerAndFitGraph, 400);
  };
  reader.readAsText(file);
}

/* =========================================================
   INICIO AUTOMÁTICO
   ========================================================= */
document.addEventListener("DOMContentLoaded", loadMainGraph);
