/* ============================================================
   SCRIPT CORE - GESTIÓN DEL GRAFO CNT
   ============================================================ */

console.log("✅ script-core.js cargado correctamente");

let nodos = [];
let enlaces = [];
let personas = [];

/* ============================================================
   INICIALIZACIÓN Y EVENTOS PRINCIPALES
   ============================================================ */

window.addEventListener("DOMContentLoaded", async () => {
  await loadMainGraph(); // Carga automática del grafo principal
  initCanvasInteractions(); // Pan + Zoom
});

/* ============================================================
   CARGA AUTOMÁTICA DEL GRAFO PRINCIPAL
   ============================================================ */
async function loadMainGraph() {
  try {
    console.log("🔄 Cargando grafo principal...");
    const res = await fetch("./graphs/huescageneral.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    importGraphFromData(data);
  } catch (err) {
    console.error("🚨 Error al cargar el grafo principal:", err);
  }
}

/* ============================================================
   IMPORTACIÓN / EXPORTACIÓN DE GRAFOS
   ============================================================ */
function getGraphData() {
  return { nodos, enlaces, personas };
}

function exportGraph() {
  const data = JSON.stringify(getGraphData(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fecha = new Date().toISOString().split("T")[0];
  a.download = `huescageneral_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importGraphFromData(data) {
  console.log("📦 Importando grafo CNT...");

  nodos = data.nodos || data.nodes || [];
  enlaces = data.enlaces || data.edges || [];
  personas = data.personas || data.people || [];

  const canvasWrapper = document.getElementById("canvasWrapper");
  const canvasContent = document.getElementById("canvasContent");

  // ✅ Línea eliminada: canvasContent.appendChild(nuevoNodo);

  canvasContent.innerHTML = "";

  // Renderiza nodos
  nodos.forEach((nodo) => {
    renderNode(nodo);
  });

  // Renderiza enlaces
  enlaces.forEach((enlace) => {
    drawEdge(enlace);
  });

  renderPersonList();
  updateSummary();
}

/* ============================================================
   CREACIÓN Y RENDERIZADO DE NODOS
   ============================================================ */
function renderNode(nodo) {
  const div = document.createElement("div");
  div.className = "node";
  div.dataset.id = nodo.id;
  div.textContent = nodo.nombre;

  // Posición inicial
  div.style.left = (nodo.x || Math.random() * 800) + "px";
  div.style.top = (nodo.y || Math.random() * 600) + "px";

  // Color
  if (nodo.tipo === "supernodo") {
    div.style.background = "#007bff";
  } else {
    div.style.background = "#28a745";
  }

  // Evento de colapsar / expandir
  div.addEventListener("dblclick", () => {
    if (typeof toggleCollapse === "function") toggleCollapse(nodo.id);
  });

  // Popup de edición
  div.addEventListener("click", () => openPopup(nodo));

  document.getElementById("canvasContent").appendChild(div);
}

/* ============================================================
   DIBUJO DE ENLACES
   ============================================================ */
function drawEdge(e) {
  const canvas = document.getElementById("canvasContent");
  const source = nodos.find((n) => n.id === e.origen || n.id === e.source);
  const target = nodos.find((n) => n.id === e.destino || n.id === e.target);
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
  line.style.width = length + "px";
  line.style.left = x1 + "px";
  line.style.top = y1 + "px";
  line.style.transform = `rotate(${angle}deg)`;
  canvas.appendChild(line);
}

/* ============================================================
   PERSONAS Y RESUMEN DE CARGA
   ============================================================ */
function renderPersonList() {
  const list = document.getElementById("personList");
  if (!list) return;
  list.innerHTML = "";
  personas.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  });
}

function updateSummary() {
  const resumen = document.getElementById("personSummary");
  if (!resumen) return;
  resumen.innerHTML = "";
  const horasPorPersona = {};

  nodos.forEach((n) => {
    if (n.owner) {
      horasPorPersona[n.owner] =
        (horasPorPersona[n.owner] || 0) + (n.horas || 0);
    }
  });

  for (const [persona, horas] of Object.entries(horasPorPersona)) {
    const li = document.createElement("li");
    li.textContent = `${persona}: ${horas} h`;
    resumen.appendChild(li);
  }

  // Cálculo de índice de Gini
  const gini = calcularGini(Object.values(horasPorPersona));
  if (!isNaN(gini)) {
    const li = document.createElement("li");
    li.textContent = `Índice Gini: ${(gini * 100).toFixed(1)}%`;
    resumen.appendChild(li);
  }
}

function calcularGini(valores) {
  if (!valores.length) return 0;
  const sorted = valores.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    acumulado += (i + 1) * sorted[i];
  }
  return (2 * acumulado) / (n * sum) - (n + 1) / n;
}

/* ============================================================
   PAN Y ZOOM
   ============================================================ */
function initCanvasInteractions() {
  const canvas = document.getElementById("canvas");
  const content = document.getElementById("canvasContent");
  let isPanning = false;
  let startX, startY, scrollLeft, scrollTop;
  let zoom = 1;

  canvas.addEventListener("mousedown", (e) => {
    isPanning = true;
    startX = e.pageX - canvas.offsetLeft;
    startY = e.pageY - canvas.offsetTop;
    scrollLeft = canvas.scrollLeft;
    scrollTop = canvas.scrollTop;
  });

  canvas.addEventListener("mouseleave", () => (isPanning = false));
  canvas.addEventListener("mouseup", () => (isPanning = false));

  canvas.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    e.preventDefault();
    const x = e.pageX - canvas.offsetLeft;
    const y = e.pageY - canvas.offsetTop;
    const walkX = (x - startX);
    const walkY = (y - startY);
    canvas.scrollLeft = scrollLeft - walkX;
    canvas.scrollTop = scrollTop - walkY;
  });

  document.getElementById("zoomInBtn").onclick = () => {
    zoom = Math.min(zoom * 1.1, 3);
    content.style.transform = `scale(${zoom})`;
  };
  document.getElementById("zoomOutBtn").onclick = () => {
    zoom = Math.max(zoom * 0.9, 0.5);
    content.style.transform = `scale(${zoom})`;
  };
}
