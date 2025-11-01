/* ------------------------------------------------------------
   SCRIPT CORE - VERSIÓN COMPLETA
   - Carga/exporta grafos
   - Drag & drop de nodos
   - Popup de edición (editar, aplicar, eliminar)
   - Crear nodos y supernodos
   - Crear enlaces interactivos (modo "link")
   - Dibujar enlaces visuales
   - Colapsado simple de supernodos
   - Robusto: acepta keys en español/inglés y evita errores .includes()
   ------------------------------------------------------------ */

"use strict";

/* =========================
   Estado global
   ========================= */
let nodos = [];
let enlaces = [];
let personas = [];

// Modo para crear enlaces: si sourceNodeId != null, estamos en proceso de enlace
let linkModeSourceId = null;

/* =========================
   Utilidades
   ========================= */
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function safeString(x) {
  return x == null ? "" : String(x);
}
function findNodeById(id) {
  return nodos.find((n) => n.id === id);
}
function ensureWindowPersonas() {
  if (!Array.isArray(window.personas)) window.personas = [];
}

/* =========================
   Personas (responsables)
   ========================= */
function addPerson() {
  const nombreEl = document.getElementById("newPersonName");
  if (!nombreEl) return;
  const nombre = safeString(nombreEl.value).trim();
  if (!nombre) return alert("Introduce un nombre");

  if (!Array.isArray(personas)) personas = [];
  if ((personas || []).includes(nombre)) return alert("Esa persona ya está añadida.");

  personas.push(nombre);
  actualizarSelects();
  renderPersonList();
  nombreEl.value = "";
  updateSummary();
}

function renderPersonList() {
  const list = document.getElementById("personList");
  if (!list) return;
  list.innerHTML = "";
  (personas || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  });
}

function actualizarSelects() {
  const selects = document.querySelectorAll("select");
  selects.forEach((sel) => {
    const id = sel.id || "";
    // actualizar sólos selects relacionados con owners (taskOwner, superOwner, editOwner, etc.)
    if (id.toLowerCase().includes("owner") || id.toLowerCase().includes("person")) {
      sel.innerHTML = (personas || []).map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
    }

    // actualizar selects que referencian supernodos
    if (id.toLowerCase().includes("superselect") || id.toLowerCase().includes("editsuper")) {
      const options = [{ value: "", text: "-- Sin supernodo --" }].concat(
        (nodos || []).filter(n => (n.tipo || "").toLowerCase() === "supernodo").map(s => ({ value: s.id, text: s.nombre || s.name || s.label || s.id }))
      );
      sel.innerHTML = options.map(o => `<option value="${o.value}">${escapeHtml(o.text)}</option>`).join("");
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[m]));
}

/* =========================
   Crear nodos / supernodos
   ========================= */
function createNode() {
  const name = safeString(document.getElementById("taskName")?.value).trim();
  const owner = safeString(document.getElementById("taskOwner")?.value);
  const hours = parseFloat(document.getElementById("taskHours")?.value) || 0;
  const description = safeString(document.getElementById("taskDescription")?.value);
  const superId = safeString(document.getElementById("superSelect")?.value);

  if (!name) return alert("Introduce un nombre de tarea.");

  const nodo = {
    id: `nodo_${Date.now()}`,
    nombre: name,
    owner: owner || "",
    horas: hours || 0,
    descripcion: description || "",
    tipo: "subnodo",
    x: Math.random() * 800,
    y: Math.random() * 600,
    super: superId || ""
  };

  nodos.push(nodo);
  renderNode(nodo);
  actualizarSelects();
  updateSummary();
}

function createSupernode() {
  const name = safeString(document.getElementById("superName")?.value).trim();
  const owner = safeString(document.getElementById("superOwner")?.value);

  if (!name) return alert("Introduce un nombre para el supernodo.");

  const nodo = {
    id: `super_${Date.now()}`,
    nombre: name,
    owner: owner || "",
    tipo: "supernodo",
    x: Math.random() * 800,
    y: Math.random() * 600
  };

  nodos.push(nodo);
  renderNode(nodo);
  actualizarSelects();
}

/* =========================
   Renderizado nodos y edges
   ========================= */
function clearCanvasContent() {
  const canvas = document.getElementById("canvasContent");
  if (!canvas) return;
  canvas.innerHTML = "";
}

function renderNode(nodo) {
  const canvas = document.getElementById("canvasContent");
  if (!canvas) return;

  const div = document.createElement("div");
  div.className = "node";
  div.style.left = (nodo.x || 0) + "px";
  div.style.top = (nodo.y || 0) + "px";
  div.textContent = nodo.nombre || nodo.name || "Nodo sin nombre";
  div.dataset.id = nodo.id;
  div.dataset.tipo = nodo.tipo || "subnodo";

  // atributos para facilitar selección
  div.style.position = "absolute";
  div.style.userSelect = "none";

  // permitir arrastrar
  enableDragForElement(div);

  // click normal -> abrir popup / cargar info
  div.addEventListener("click", (ev) => {
    ev.stopPropagation();
    // si estamos en modo link: manejar enlace (source -> target)
    if (linkModeSourceId) {
      const sourceId = linkModeSourceId;
      const targetId = nodo.id;
      if (sourceId === targetId) {
        // cancelar si mismo
        linkModeSourceId = null;
        updateLinkModeUI();
        return;
      }
      createEdgeByIds(sourceId, targetId);
      linkModeSourceId = null;
      updateLinkModeUI();
      return;
    }
    openPopup(nodo);
  });

  canvas.appendChild(div);
}

function renderAllNodes() {
  clearCanvasContent();
  (nodos || []).forEach(renderNode);
  drawEdges();
}

/* =========================
   Drag & drop para nodos
   ========================= */
function enableDragForElement(el) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("mousedown", (e) => {
    // ignore right-click
    if (e.button !== 0) return;
    isDragging = true;
    el.style.cursor = "grabbing";
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const canvas = document.getElementById("canvas");
    const content = document.getElementById("canvasContent");
    if (!canvas || !content) return;
    // compute new position relative to canvasContent
    const canvasRect = content.getBoundingClientRect();
    let newLeft = e.clientX - canvasRect.left - offsetX;
    let newTop = e.clientY - canvasRect.top - offsetY;
    // update style
    el.style.left = Math.max(0, newLeft) + "px";
    el.style.top = Math.max(0, newTop) + "px";
    // update model
    const id = el.dataset.id;
    const nodeObj = findNodeById(id);
    if (nodeObj) {
      nodeObj.x = parseFloat(el.style.left);
      nodeObj.y = parseFloat(el.style.top);
    }
    // redraw edges dynamically
    drawEdges();
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      el.style.cursor = "move";
    }
  });

  // estilo inicial
  el.style.cursor = "move";
}

/* =========================
   Edges (enlaces)
   ========================= */
function createEdgeByIds(sourceId, targetId) {
  // evita duplicados
  const existing = (enlaces || []).some(e => {
    const s = e.origen || e.source;
    const t = e.destino || e.target;
    return (s === sourceId && t === targetId);
  });
  if (existing) {
    console.log("Enlace ya existe:", sourceId, targetId);
    return;
  }
  const e = { origen: sourceId, destino: targetId };
  enlaces.push(e);
  drawEdges();
  console.log("Enlace creado:", sourceId, "->", targetId);
}

function drawEdges() {
  const canvas = document.getElementById("canvasContent");
  if (!canvas) return;
  // remover las edges antiguas
  const old = canvas.querySelectorAll(".edge");
  old.forEach(n => n.remove());

  (enlaces || []).forEach((e) => {
    const sourceId = e.origen || e.source;
    const targetId = e.destino || e.target;
    const source = findNodeById(sourceId);
    const target = findNodeById(targetId);
    if (!source || !target) return;

    const x1 = (source.x || 0) + 60;
    const y1 = (source.y || 0) + 20;
    const x2 = (target.x || 0) + 60;
    const y2 = (target.y || 0) + 20;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const line = document.createElement("div");
    line.className = "edge";
    line.style.position = "absolute";
    line.style.height = "2px";
    line.style.backgroundColor = "#333";
    line.style.left = x1 + "px";
    line.style.top = y1 + "px";
    line.style.width = length + "px";
    line.style.transformOrigin = "0 0";
    line.style.transform = `rotate(${angle}deg)`;
    line.style.zIndex = 10;

    canvas.appendChild(line);
  });
}

/* =========================
   Popup (editar / eliminar)
   ========================= */
function openPopup(nodo) {
  const popup = document.getElementById("popup");
  if (!popup) return;

  // Rellenar campos del popup
  document.getElementById("editName").value = nodo.nombre || "";
  document.getElementById("editOwner").value = nodo.owner || "";
  document.getElementById("editHours").value = nodo.horas || "";
  document.getElementById("editDescription").value = nodo.descripcion || "";
  // si hay select de super, rellenarlo
  const editSuperSelect = document.getElementById("editSuperSelect");
  if (editSuperSelect) {
    // actualizar options
    actualizarSelects();
    editSuperSelect.value = nodo.super || "";
  }

  // mostrar popup y guardar nodo actual en atributo dataset
  popup.dataset.currentNodeId = nodo.id;
  popup.style.display = "block";
  // posicionar popup cerca del mouse (opcional) - aquí lo centramos en la esquina superior izquierda
  popup.style.left = "20px";
  popup.style.top = "20px";
}

function closePopup() {
  const popup = document.getElementById("popup");
  if (!popup) return;
  popup.style.display = "none";
  delete popup.dataset.currentNodeId;
}

function applyEdits() {
  const popup = document.getElementById("popup");
  if (!popup) return;
  const nodeId = popup.dataset.currentNodeId;
  if (!nodeId) return alert("Nodo inválido");

  const node = findNodeById(nodeId);
  if (!node) return alert("Nodo no encontrado");

  // tomar valores del popup
  const name = safeString(document.getElementById("editName")?.value).trim();
  const owner = safeString(document.getElementById("editOwner")?.value);
  const hours = parseFloat(document.getElementById("editHours")?.value) || 0;
  const description = safeString(document.getElementById("editDescription")?.value);
  const superSelect = safeString(document.getElementById("editSuperSelect")?.value);

  node.nombre = name || node.nombre;
  node.owner = owner || "";
  node.horas = hours || 0;
  node.descripcion = description || "";
  node.super = superSelect || "";

  // actualizar representación visual
  const el = document.querySelector(`#canvasContent .node[data-id="${CSS.escape(nodeId)}"]`);
  if (el) {
    el.textContent = node.nombre;
    el.style.left = (node.x || 0) + "px";
    el.style.top = (node.y || 0) + "px";
  }

  actualizarSelects();
  renderPersonList();
  updateSummary();
  closePopup();
  drawEdges();
}

function deleteNode() {
  const popup = document.getElementById("popup");
  if (!popup) return;
  const nodeId = popup.dataset.currentNodeId;
  if (!nodeId) return alert("Nodo inválido");

  // quitar nodo del array
  nodos = (nodos || []).filter(n => n.id !== nodeId);
  // quitar enlaces asociados
  enlaces = (enlaces || []).filter(e => {
    const s = e.origen || e.source;
    const t = e.destino || e.target;
    return s !== nodeId && t !== nodeId;
  });

  // remover visual
  const el = document.querySelector(`#canvasContent .node[data-id="${CSS.escape(nodeId)}"]`);
  if (el) el.remove();

  renderPersonList();
  actualizarSelects();
  updateSummary();
  closePopup();
  drawEdges();
}

/* =========================
   Import / Export
   ========================= */
function getGraphData() {
  return {
    nodos: nodos,
    enlaces: enlaces,
    personas: personas
  };
}

function importGraph(event) {
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
}

function importGraphFromData(data) {
  console.log("🔄 Importando grafo...");
  nodos = data.nodos || data.nodes || [];
  enlaces = data.enlaces || data.edges || [];
  personas = data.personas || data.people || [];

  // asegurar arrays
  nodos = safeArray(nodos);
  enlaces = safeArray(enlaces);
  personas = safeArray(personas);

  // limpiar y representar
  clearCanvasContent();
  renderAllNodes();

  // actualizar personas global y selects
  ensureWindowPersonas();
  (personas || []).forEach(p => {
    if (!(window.personas || []).includes(p)) window.personas.push(p);
  });

  actualizarSelects();
  renderPersonList();
  updateSummary();
  console.log(`✅ Grafo importado correctamente (${nodos.length} nodos, ${enlaces.length} enlaces)`);
}

/* Exportar grafo como archivo JSON descargable */
function exportGraph() {
  try {
    const data = getGraphData();
    const now = new Date();
    const filename = "grafo_" + now.toISOString().replace(/[:.]/g, "-") + ".json";
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert(`✅ Grafo exportado como: ${filename}\n📁 Sube este archivo a "graphs/" y añádelo a graphs.json si quieres que aparezca en el desplegable.`);
  } catch (err) {
    console.error("Error al exportar:", err);
    alert("Error al exportar grafo");
  }
}

/* =========================
   Resumen y utilidades
   ========================= */
function updateSummary() {
  const resumen = document.getElementById("personSummary");
  if (!resumen) return;
  resumen.innerHTML = "";
  const horasPorPersona = {};

  (nodos || []).forEach((n) => {
    const owner = safeString(n.owner);
    const horas = parseFloat(n.horas) || 0;
    if (owner) {
      horasPorPersona[owner] = (horasPorPersona[owner] || 0) + horas;
    }
  });

  for (const [persona, horas] of Object.entries(horasPorPersona)) {
    const li = document.createElement("li");
    li.textContent = `${persona}: ${horas} h`;
    resumen.appendChild(li);
  }
}

/* =========================
   Link mode UI helper
   ========================= */
function enterLinkMode(sourceId) {
  linkModeSourceId = sourceId;
  updateLinkModeUI();
}

function exitLinkMode() {
  linkModeSourceId = null;
  updateLinkModeUI();
}

function updateLinkModeUI() {
  // marcar visualmente el nodo origen si hay uno
  document.querySelectorAll("#canvasContent .node").forEach(el => {
    el.classList.remove("link-source");
  });
  if (linkModeSourceId) {
    const el = document.querySelector(`#canvasContent .node[data-id="${CSS.escape(linkModeSourceId)}"]`);
    if (el) el.classList.add("link-source");
  }
}

/* =========================
   Colapsar / Expandir supernodos (simplificado)
   ========================= */
function toggleCollapseSuper(superId) {
  const children = (nodos || []).filter(n => (n.super || "") === superId);
  const isHidden = children.length > 0 && !children.some(c => {
    const el = document.querySelector(`#canvasContent .node[data-id="${CSS.escape(c.id)}"]`);
    return el && el.style.display !== "none";
  });
  // si están ocultos -> mostrar, si están visibles -> ocultar
  children.forEach(c => {
    const el = document.querySelector(`#canvasContent .node[data-id="${CSS.escape(c.id)}"]`);
    if (el) el.style.display = isHidden ? "block" : "none";
  });
  drawEdges();
}

/* =========================
   Inicialización automática
   ========================= */
window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ script-core.js cargado correctamente");
  // asegurar que existan selects y listeners mínimos
  actualizarSelects();
  renderPersonList();
  updateSummary();

  // Click en canvas para salir de modos
  const canvas = document.getElementById("canvas");
  if (canvas) {
    canvas.addEventListener("click", (e) => {
      // clic en fondo cancela modo link y cierra popup
      exitLinkMode();
      closePopup();
    });
  }
});

/* =========================
   Exponer funciones al scope global (para usar desde HTML)
   ========================= */
window.addPerson = addPerson;
window.createNode = createNode;
window.createSupernode = createSupernode;
window.importGraph = importGraph;
window.importGraphFromData = importGraphFromData;
window.exportGraph = exportGraph;
window.applyEdits = applyEdits;
window.deleteNode = deleteNode;
window.closePopup = closePopup;
window.enterLinkMode = enterLinkMode;
window.toggleCollapseSuper = toggleCollapseSuper;
window.addEventListener("resize", () => {
  // redraw edges so they scale/match positions if container size changes
  drawEdges();
});
