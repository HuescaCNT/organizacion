/* ------------------------------------------------------------
   SCRIPT CORE - VERSIÓN CORREGIDA (colores + layout para evitar solapamiento)
   - Colorea nodos por owner / tipo
   - Layout por grid si faltan posiciones o hay solapamiento
   - Mantiene drag & drop, popup, edges, import/export
   ------------------------------------------------------------ */

"use strict";

let nodos = [];
let enlaces = [];
let personas = [];
let linkModeSourceId = null;

/* -----------------------
   UTILIDADES
   ----------------------- */
function safeArray(x) { return Array.isArray(x) ? x : []; }
function safeString(x) { return x == null ? "" : String(x); }
function findNodeById(id) { return nodos.find(n => n.id === id); }
function ensureWindowPersonas() { if (!Array.isArray(window.personas)) window.personas = []; }

/* Paleta simple */
const COLOR_PALETTE = [
  "#FFB74D","#4FC3F7","#A1887F","#81C784","#F06292",
  "#BA68C8","#90A4AE","#FFD54F","#4DB6AC","#E57373"
];

function colorForOwner(owner, fallbackType) {
  const key = (owner || fallbackType || "").toString();
  if (!key) return "#ffffff";
  // hash to index
  let h = 0;
  for (let i=0;i<key.length;i++) h = (h<<5) - h + key.charCodeAt(i)|0;
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}

/* -----------------------
   PERSONAS
   ----------------------- */
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
  (personas||[]).forEach(p => {
    const li = document.createElement("li"); li.textContent = p; list.appendChild(li);
  });
}

function actualizarSelects() {
  const selects = document.querySelectorAll("select");
  selects.forEach(sel => {
    const id = (sel.id||"").toLowerCase();
    if (id.includes("owner") || id.includes("person")) {
      sel.innerHTML = (personas||[]).map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
    }
    if (id.includes("superselect") || id.includes("editsuper")) {
      const options = [{v:"",t:"-- Sin supernodo --"}].concat((nodos||[]).filter(n => (n.tipo||"").toLowerCase()==="supernodo").map(s=>({v:s.id,t:s.nombre||s.name||s.label||s.id})));
      sel.innerHTML = options.map(o => `<option value="${o.v}">${escapeHtml(o.t)}</option>`).join("");
    }
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

/* -----------------------
   CREAR NODOS / SUPERNODOS
   ----------------------- */
function createNode() {
  const name = safeString(document.getElementById("taskName")?.value).trim();
  const owner = safeString(document.getElementById("taskOwner")?.value);
  const hours = parseFloat(document.getElementById("taskHours")?.value) || 0;
  const description = safeString(document.getElementById("taskDescription")?.value);
  const superId = safeString(document.getElementById("superSelect")?.value);

  if (!name) return alert("Introduce un nombre de tarea.");

  const nodo = { id:`nodo_${Date.now()}`, nombre:name, owner:owner||"", horas:hours||0, descripcion:description||"", tipo:"subnodo", x: Math.random()*800, y:Math.random()*600, super: superId||"" };
  nodos.push(nodo);
  renderAllNodes();
  actualizarSelects(); updateSummary();
}

function createSupernode() {
  const name = safeString(document.getElementById("superName")?.value).trim();
  const owner = safeString(document.getElementById("superOwner")?.value);
  if (!name) return alert("Introduce un nombre para el supernodo.");
  const nodo = { id:`super_${Date.now()}`, nombre:name, owner:owner||"", tipo:"supernodo", x: Math.random()*800, y:Math.random()*600 };
  nodos.push(nodo);
  renderAllNodes();
  actualizarSelects();
}

/* -----------------------
   LAYOUT: evita solapamiento
   - si muchos nodos sin posiciones, aplica grid
   - si hay posiciones muy agrupadas, los separa (simple)
   ----------------------- */
function applySmartLayoutIfNeeded() {
  const count = (nodos||[]).length;
  if (count === 0) return;
  // detecta cuantos nodos sin posicion explícita (x undefined or 0)
  const noPos = nodos.filter(n => n.x==null || n.y==null || isNaN(n.x) || isNaN(n.y) || (n.x===0 && n.y===0));
  // si hay más del 30% sin pos, aplica grid layout
  if (noPos.length >= Math.ceil(count * 0.3)) {
    applyGridLayout();
    return;
  }
  // si todos están muy agrupados (ej. bounding box muy pequeña), aplicar separación
  const xs = nodos.map(n => n.x||0), ys = nodos.map(n => n.y||0);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bboxW = maxX - minX, bboxH = maxY - minY;
  if (bboxW < 200 && bboxH < 200 && count > 6) {
    applyGridLayout();
  }
}

function applyGridLayout() {
  const cols = Math.ceil(Math.sqrt(nodos.length));
  const spacingX = 140, spacingY = 100;
  nodos.forEach((n
