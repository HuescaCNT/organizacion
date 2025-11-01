/* ------------------------------------------------------------
   SCRIPT-CORE.JS - VERSIÓN FINAL FUSIONADA
   - Mantiene colores/jerarquía/estadísticas del original
   - Carga automática de graphs/huescageneral.json
   - Exporta grafo actualizado (descarga huescageneral_YYYY-MM-DD.json)
   - Drag & drop, popup de edición, creación de nodos/enlaces
   - Protecciones contra undefined y compatibilidad esp/eng
   ------------------------------------------------------------ */

"use strict";

/* =========================
   Estado global
   ========================= */
let nodos = [];
let enlaces = [];
let personas = [];

// UI / estado
let selectedNode = null;
let draggingNode = null;
let linkModeSourceId = null; // para crear enlaces con click (si se usa)
let canvasScale = 1;
let panX = 0;
let panY = 0;

/* =========================
   Utilidades
   ========================= */
function safeArray(a) { return Array.isArray(a) ? a : []; }
function safeString(s) { return s == null ? "" : String(s); }
function findNodeById(id) { return (nodos || []).find(n => n && (n.id === id || n.id == id)); }
function nowDateString() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}
function cssEscape(s) {
  try { return CSS.escape(s); } catch { return s.replace(/["'`\\]/g, ""); }
}

/* =========================
   Color / apariencia
   ========================= */
const PALETTE = ["#FFB74D","#4FC3F7","#A1887F","#81C784","#F06292","#BA68C8","#90A4AE","#FFD54F","#4DB6AC","#E57373"];

function hashToIndex(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  return Math.abs(h);
}

function colorByOwner(owner, tipo) {
  const key = safeString(owner || tipo || "default");
  const idx = hashToIndex(key) % PALETTE.length;
  return PALETTE[idx];
}

/* =========================
   CARGA AUTOMÁTICA AL INICIAR
   ========================= */
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🔁 script-core.js inicio - intentando cargar graphs/huescageneral.json ...");
  await loadMainGraph();
  // inicial UI
  actualizarSelects();
  renderPersonList();
  updateSummary();
  // listeners globales
  setupCanvasPan();
});

/* Carga principal del archivo */
async function loadMainGraph() {
  try {
    const res = await fetch("graphs/huescageneral.json");
    if (!res.ok) {
      console.warn("No se pudo cargar graphs/huescageneral.json:", res.status);
      return;
    }
    const data = await res.json();
    importGraphFromData(data);
    console.log("✅ Grafo principal cargado");
  } catch (err) {
    console.error("Error al cargar grafo principal:", err);
  }
}

/* =========================
   IMPORTACIÓN DE DATOS
   ========================= */
function importGraphFromData(data) {
  console.log("📥 importGraphFromData");
  // Acepta inglés o español
  nodos = safeArray(data.nodos || data.nodes || []);
  enlaces = safeArray(data.enlaces || data.edges || []);
  personas = safeArray(data.personas || data.people || []);

  // Normalizar nodos (asegurar ids, propiedades mínimas)
  nodos = nodos.map((n, idx) => {
    const id = n.id || n._id || `n_${idx}_${Date.now()}`;
    return {
      id,
      nombre: safeString(n.nombre || n.name || n.label || `Nodo ${idx+1}`),
      owner: safeString(n.owner || n.propietario || ""),
      horas: Number(n.horas || n.hours || 0),
      descripcion: safeString(n.descripcion || n.description || ""),
      tipo: safeString(n.tipo || n.type || "subnodo"),
      x: (n.x == null ? n.positionX : n.x) || n.x || n.positionX || null,
      y: (n.y == null ? n.positionY : n.y) || n.y || n.positionY || null,
      super: safeString(n.super || n.parent || "")
    };
  });

  // Normalizar enlaces - dejar campos origen/destino
  enlaces = enlaces.map((e) => {
    return {
      origen: safeString(e.origen || e.source || e.from || ""),
      destino: safeString(e.destino || e.target || e.to || "")
    };
  });

  // Si muchos nodos sin posición, aplicar layout simple
  applyLayoutIfNeeded();

  // Render
  renderAll();
  console.log(`📊 Importado: ${nodos.length} nodos, ${enlaces.length} enlaces, ${personas.length} personas`);
}

/* =========================
   LAYOUT SIMPLE
   - Si >30% nodos sin x/y asignadas -> grid layout
   - Evita clustering
   ========================= */
function applyLayoutIfNeeded() {
  const total = nodos.length;
  if (total === 0) return;
  const noPos = nodos.filter(n => n.x == null || n.y == null);
  if (noPos.length >= Math.ceil(total * 0.3)) {
    // grid
    const cols = Math.ceil(Math.sqrt(total));
    const spacingX = 160, spacingY = 110;
    nodos.forEach((n, i) => {
      if (n.x == null || n.y == null) {
        const r = Math.floor(i / cols), c = i % cols;
        n.x = 40 + c * spacingX;
        n.y = 40 + r * spacingY;
      }
    });
  } else {
    // si están todos en (0,0) o muy juntos, espaciarlos
    const xs = nodos.map(n => n.x || 0), ys = nodos.map(n => n.y || 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    if ((maxX - minX) < 120 && (maxY - minY) < 120 && total > 6) {
      // aplicar grid igualmente
      const cols = Math.ceil(Math.sqrt(total));
      const spacingX = 160, spacingY = 110;
      nodos.forEach((n, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        n.x = 40 + c * spacingX;
        n.y = 40 + r * spacingY;
      });
    }
  }
}

/* =========================
   RENDERIZADO
   ========================= */
function clearCanvas() {
  const canvas = document.getElementById("canvasContent");
  if (!canvas) return;
  canvas.innerHTML = "";
}

function renderAll() {
  clearCanvas();
  nodos.forEach(renderNode);
  drawEdges();
  actualizarSelects();
  renderPersonList();
  updateSummary();
}

function renderNode(n) {
  const canvas = document.getElementById("canvasContent");
  if (!canvas) return;

  const div = document.createElement("div");
  div.className = "node";
  div.dataset.id = n.id;
  div.textContent = n.nombre;
  div.style.left = (Number(n.x) || 0) + "px";
  div.style.top = (Number(n.y) || 0) + "px";
  div.style.background = colorByOwner(n.owner, n.tipo);
  div.style.border = "1px solid rgba(0,0,0,0.2)";
  div.style.minWidth = "110px";
  div.style.padding = "8px";
  div.style.borderRadius = "6px";
  div.style.position = "absolute";
  div.style.cursor = "move";
  div.style.zIndex = 20;
  div.style.textAlign = "center";
  div.title = `${n.nombre}\nResponsable: ${n.owner || "-"}`;

  // handlers
  div.addEventListener("mousedown", (ev) => {
    ev.stopPropagation();
    startDragNode(ev, n, div);
  });

  div.addEventListener("dblclick", (ev) => {
    ev.stopPropagation();
    openPopup(n);
  });

  // click for link mode (if set)
  div.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (linkModeSourceId) {
      if (linkModeSourceId === n.id) {
        // cancel
        linkModeSourceId = null;
        updateLinkModeUI();
        return;
      }
      // create edge
      enlaces.push({ origen: linkModeSourceId, destino: n.id });
      linkModeSourceId = null;
      renderAll();
      return;
    }
  });

  canvas.appendChild(div);
}

/* Dibuja todas las edges como divs rotadas */
function drawEdges() {
  const canvas = document.getElementById("canvasContent");
  if (!canvas) return;

  // eliminar previas
  const prev = canvas.querySelectorAll(".edge");
  prev.forEach(e => e.remove());

  (enlaces || []).forEach(e => {
    const sId = e.origen || e.source;
    const tId = e.destino || e.target;
    const s = findNodeById(sId);
    const t = findNodeById(tId);
    if (!s || !t) return;

    const x1 = (Number(s.x) || 0) + 60;
    const y1 = (Number(s.y) || 0) + 20;
    const x2 = (Number(t.x) || 0) + 60;
    const y2 = (Number(t.y) || 0) + 20;

    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const line = document.createElement("div");
    line.className = "edge";
    line.style.position = "absolute";
    line.style.left = x1 + "px";
    line.style.top = y1 + "px";
    line.style.width = length + "px";
    line.style.height = "2px";
    line.style.transformOrigin = "0 0";
    line.style.transform = `rotate(${angle}deg)`;
    line.style.background = "#444";
    line.style.zIndex = 10;
    canvas.appendChild(line);
  });
}

/* =========================
   DRAG & DROP NODOS
   ========================= */
function startDragNode(ev, nodo, el) {
  ev.preventDefault();
  draggingNode = { nodo, el, startX: ev.clientX, startY: ev.clientY, origLeft: parseFloat(el.style.left) || 0, origTop: parseFloat(el.style.top) || 0 };
  document.addEventListener("mousemove", onDragNode);
  document.addEventListener("mouseup", stopDragNode);
  el.style.cursor = "grabbing";
}

function onDragNode(ev) {
  if (!draggingNode) return;
  const dx = ev.clientX - draggingNode.startX;
  const dy = ev.clientY - draggingNode.startY;
  const newLeft = Math.max(0, draggingNode.origLeft + dx);
  const newTop = Math.max(0, draggingNode.origTop + dy);
  draggingNode.el.style.left = newLeft + "px";
  draggingNode.el.style.top = newTop + "px";
  draggingNode.nodo.x = newLeft;
  draggingNode.nodo.y = newTop;
  // redibujar edges dinámiamente
  drawEdges();
}

function stopDragNode() {
  if (!draggingNode) return;
  draggingNode.el.style.cursor = "move";
  draggingNode = null;
  document.removeEventListener("mousemove", onDragNode);
  document.removeEventListener("mouseup", stopDragNode);
}

/* =========================
   POPUP EDICIÓN
   ========================= */
function openPopup(n) {
  selectedNode = n;
  const popup = document.getElementById("popup");
  if (!popup) return;
  document.getElementById("editName").value = n.nombre || "";
  document.getElementById("editOwner").value = n.owner || "";
  document.getElementById("editHours").value = n.horas || 0;
  document.getElementById("editDescription").value = n.descripcion || "";
  popup.style.display = "block";
  // position popup near top-right (simple)
  popup.style.left = "20px";
  popup.style.top = "20px";
}

function closePopup() {
  const popup = document.getElementById("popup");
  if (!popup) return;
  popup.style.display = "none";
  selectedNode = null;
}

function applyEdits() {
  if (!selectedNode) return;
  selectedNode.nombre = safeString(document.getElementById("editName").value).trim();
  selectedNode.owner = safeString(document.getElementById("editOwner").value).trim();
  selectedNode.horas = Number(document.getElementById("editHours").value) || 0;
  selectedNode.descripcion = safeString(document.getElementById("editDescription").value).trim();
  renderAll();
  closePopup();
}

/* Eliminar nodo seleccionado */
function deleteNode() {
  if (!selectedNode) return;
  const id = selectedNode.id;
  nodos = (nodos || []).filter(n => n.id !== id);
  enlaces = (enlaces || []).filter(e => (e.origen || e.source) !== id && (e.destino || e.target) !== id);
  renderAll();
  closePopup();
}

/* =========================
   CREAR NODOS / SUPERNODOS / ENLACES
   ========================= */
function createNode() {
  const name = safeString(document.getElementById("taskName")?.value).trim();
  if (!name) return alert("Introduce un nombre de tarea");
  const owner = safeString(document.getElementById("taskOwner")?.value);
  const horas = Number(document.getElementById("taskHours")?.value) || 0;
  const descripcion = safeString(document.getElementById("taskDescription")?.value);

  const nuevo = {
    id: `n_${Date.now()}`,
    nombre: name,
    owner,
    horas,
    descripcion,
    tipo: "subnodo",
    x: Math.random()*800,
    y: Math.random()*600,
    super: ""
  };
  nodos.push(nuevo);
  renderAll();
  actualizarSelects();
  updateSummary();
}

function createSupernode() {
  const name = safeString(document.getElementById("superName")?.value).trim();
  if (!name) return alert("Introduce un nombre para el supernodo");
  const nuevo = {
    id: `super_${Date.now()}`,
    nombre: name,
    owner: "",
    horas: 0,
    descripcion: "",
    tipo: "supernodo",
    x: Math.random()*800,
    y: Math.random()*600
  };
  nodos.push(nuevo);
  renderAll();
  actualizarSelects();
}

/* Para iniciar modo enlace desde JS/UI */
function enterLinkMode(sourceId) {
  linkModeSourceId = sourceId;
  updateLinkModeUI();
}
function exitLinkMode() {
  linkModeSourceId = null;
  updateLinkModeUI();
}
function updateLinkModeUI() {
  document.querySelectorAll("#canvasContent .node").forEach(el => el.classList.remove("link-source"));
  if (linkModeSourceId) {
    const el = document.querySelector(`#canvasContent .node[data-id="${cssEscape(linkModeSourceId)}"]`);
    if (el) el.classList.add("link-source");
  }
}

/* =========================
   EXPORTAR / GUARDAR (descarga)
   ========================= */
function exportGraph() {
  try {
    const data = {
      nodos: nodos,
      enlaces: enlaces,
      personas: personas
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = nowDateString();
    a.href = url;
    a.download = `huescageneral_${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert(`Grafo descargado: huescageneral_${date}.json\nSube este archivo a /graphs/ y reemplaza el original si quieres publicarlo.`);
  } catch (err) {
    console.error("Error exportando grafo:", err);
    alert("Error al exportar el grafo");
  }
}

/* =========================
   SELECTS / PERSONAS / RESUMEN
   ========================= */
function actualizarSelects() {
  // ejemplos: taskOwner, superOwner, editOwner, editSuperSelect, superSelect
  const selects = document.querySelectorAll("select");
  (selects || []).forEach(sel => {
    const id = (sel.id || "").toLowerCase();
    if (id.includes("owner") || id.includes("person")) {
      sel.innerHTML = (personas || []).map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
    }
    if (id.includes("superselect") || id.includes("editsuper")) {
      // options for supernodes
      const opts = [{ val: "", text: "-- Sin supernodo --" }].concat((nodos || []).filter(n => (n.tipo || "").toLowerCase() === "supernodo").map(s => ({ val: s.id, text: s.nombre || s.name || s.id })));
      sel.innerHTML = opts.map(o => `<option value="${o.val}">${escapeHtml(o.text)}</option>`).join("");
    }
  });
}

function renderPersonList() {
  const ul = document.getElementById("personList");
  if (!ul) return;
  ul.innerHTML = "";
  (personas || []).forEach(p => {
    const li = document.createElement("li"); li.textContent = p; ul.appendChild(li);
  });
}

function updateSummary() {
  const ul = document.getElementById("personSummary");
  if (!ul) return;
  ul.innerHTML = "";
  const map = {};
  (nodos || []).forEach(n => {
    const owner = safeString(n.owner);
    const horas = Number(n.horas) || 0;
    if (owner) map[owner] = (map[owner] || 0) + horas;
  });
  for (const [person, h] of Object.entries(map)) {
    const li = document.createElement("li");
    li.textContent = `${person}: ${h} h`;
    ul.appendChild(li);
  }
  // opcional: mostrar Gini u otros indicadores si quieres (se podria añadir)
}

/* =========================
   PAN / ZOOM (básico)
   ========================= */
function setupCanvasPan() {
  const canvas = document.getElementById("canvas");
  const content = document.getElementById("canvasContent");
  if (!canvas || !content) return;

  let isPanning = false, startX = 0, startY = 0;

  canvas.addEventListener("mousedown", (e) => {
    // solo si no se está arrastrando un nodo (evitar conflicto)
    if (e.target !== canvas && !e.target.classList.contains("node")) return;
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    canvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    content.style.transform = `translate(${panX}px, ${panY}px) scale(${canvasScale})`;
  });

  window.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = "grab";
    }
  });

  // wheel zoom (ctrl + wheel to zoom)
  canvas.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    canvasScale = Math.max(0.2, Math.min(2.5, canvasScale * delta));
    content.style.transform = `translate(${panX}px, ${panY}px) scale(${canvasScale})`;
  });
}

/* =========================
   Helpers / small utils
   ========================= */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

/* =========================
   Expose some functions to global scope for HTML buttons
   ========================= */
window.createNode = createNode;
window.createSupernode = createSupernode;
window.applyEdits = applyEdits;
window.deleteNode = deleteNode;
window.closePopup = closePopup;
window.enterLinkMode = enterLinkMode;
window.exitLinkMode = exitLinkMode;
window.exportGraph = exportGraph;
window.importGraph = function (event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      importGraphFromData(data);
    } catch (err) {
      alert("Error al parsear JSON: " + err);
    }
  };
  reader.readAsText(file);
};

console.log("✅ script-core.js final cargado");
