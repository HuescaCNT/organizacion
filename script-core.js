/* ============================================================
   SCRIPT CORE - GESTIÓN DEL GRAFO CNT (ORIGINAL RESTAURADO)
   ============================================================ */

/*
  Este script es la versión "clásica" que incorpora:
  - creación/edición de nodos y supernodos
  - colapso/expansión de supernodos
  - panning/zoom del canvas
  - cálculo y visualización de estadísticas (incluido índice de Gini)
  - colores y estilos según tipo / responsable
  - export/import de JSON
  - comentarios y pequeños emoticonos en logs
*/

/* Variables globales */
let nodeCounter = 1;
let superCounter = 1;
let selectedNode = null;
let people = [];

/* ----------------------
   Crear nodo / supernodo
   ---------------------- */
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
  node.dataset.description = description;
  node.dataset.type = "sub";
  node.dataset.super = superId || "";

  updateNodeVisual(node);
  positionRandomly(node);
  makeDraggable(node);
  enablePopupEdit(node);

  document.getElementById("canvasContent").appendChild(node);

  if (superId) {
    createEdge(id, superId);
    updateSupernodeCompletionCascade(superId);
  }

  updatePersonSummary();
  updateSuperDropdown();
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
  node.dataset.super = parentId || "";

  updateSupernodeVisual(node, 0);
  positionRandomly(node);
  makeDraggable(node);
  enablePopupEdit(node);
  enableCollapseToggle(node);
  document.getElementById("canvasContent").appendChild(node);

  updateSuperDropdown();

  if (parentId) {
    createEdge(id, parentId);
    updateSupernodeCompletionCascade(parentId);
  }
  updatePersonSummary()
}

/* ----------------------
   Visuals y utilidades
   ---------------------- */
function updateNodeVisual(node) {
  // Visual de subnodo (tamaño, color según propietario, etc.)
  const owner = node.dataset.owner || "";
  const hours = parseFloat(node.dataset.hours) || 0;

  node.style.padding = "8px";
  node.style.borderRadius = "6px";
  node.style.minWidth = "110px";
  node.style.color = "#fff";
  node.style.fontWeight = "600";
  node.style.textAlign = "center";
  node.style.boxShadow = "0 2px 6px rgba(0,0,0,0.12)";

  // Color por propietario (si lo hay) o por defecto
  if (owner) {
    node.style.background = colorByString(owner);
  } else {
    node.style.background = "#6c757d"; // gris si no hay owner
  }

  node.textContent = `${node.dataset.name} \n(${hours} h)`;
}

function updateSupernodeVisual(node, percentComplete) {
  // Supernodos con degradado que indica % completado
  const owner = node.dataset.owner || "";
  node.style.padding = "10px";
  node.style.borderRadius = "10px";
  node.style.minWidth = "140px";
  node.style.color = "#fff";
  node.style.fontWeight = "700";
  node.style.textAlign = "center";
  node.style.boxShadow = "0 3px 8px rgba(0,0,0,0.15)";

  const base = colorByString(owner || "super");
  const pct = Math.max(0, Math.min(100, Math.round(percentComplete)));
  node.style.background = `linear-gradient(90deg, ${base} ${pct}%, rgba(0,0,0,0.15) ${pct}%)`;
  node.textContent = `${node.dataset.name} (${pct}%)`;
}

/* Paleta basada en hash para propietarios */
function colorByString(s) {
  const colors = ["#d9534f","#5cb85c","#0275d8","#f0ad4e","#6f42c1","#20c997","#fd7e14","#6610f2","#e83e8c","#20a8d8"];
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  return colors[Math.abs(h) % colors.length];
}

/* ----------------------
   Posicionamiento
   ---------------------- */
function positionRandomly(node) {
  const canvas = document.getElementById("canvasContent");
  const w = Math.max(800, canvas.clientWidth - 200);
  const h = Math.max(600, canvas.clientHeight - 200);
  node.style.left = Math.floor(Math.random() * w) + 40 + "px";
  node.style.top = Math.floor(Math.random() * h) + 40 + "px";
}

/* ----------------------
   Draggables
   ---------------------- */
function makeDraggable(node) {
  node.style.position = "absolute";
  node.style.cursor = "move";

  let isDown = false;
  let startX, startY, origX, origY;

  node.addEventListener("mousedown", (e) => {
    // solo botón izquierdo
    if (e.button !== 0) return;
    isDown = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = parseInt(node.style.left || 0);
    origY = parseInt(node.style.top || 0);
    node.style.zIndex = 999;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    node.style.left = Math.max(0, origX + dx) + "px";
    node.style.top = Math.max(0, origY + dy) + "px";
    // actualizar edges en movimiento
    redrawEdges();
  });

  document.addEventListener("mouseup", () => {
    if (!isDown) return;
    isDown = false;
    node.style.zIndex = "";
    // si se desea, guardar posición en dataset para exportar luego
    node.dataset.left = node.style.left;
    node.dataset.top = node.style.top;
  });
}

/* ----------------------
   Popup edición (doble click / editar)
   ---------------------- */
function enablePopupEdit(node) {
  node.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    openPopup(node);
  });
}

function openPopup(node) {
  selectedNode = node;
  const popup = document.getElementById("popup");
  if (!popup) return;
  // llenar campos
  document.getElementById("editName").value = node.dataset.name || "";
  document.getElementById("editOwner").value = node.dataset.owner || "";
  document.getElementById("editHours").value = node.dataset.hours || 0;
  document.getElementById("editDescription").value = node.dataset.description || "";
  document.getElementById("popup").style.display = "block";
}

/* aplicar cambios del popup */
function applyEdits() {
  if (!selectedNode) return;
  selectedNode.dataset.name = document.getElementById("editName").value.trim();
  selectedNode.dataset.owner = document.getElementById("editOwner").value.trim();
  selectedNode.dataset.hours = parseFloat(document.getElementById("editHours").value) || 0;
  selectedNode.dataset.description = document.getElementById("editDescription").value.trim();

  if (selectedNode.dataset.type === "sub") updateNodeVisual(selectedNode);
  else updateSupernodeVisual(selectedNode, 0);

  document.getElementById("popup").style.display = "none";
  updatePersonSummary();
  updateSuperDropdown();
}

/* eliminar nodo desde popup */
function deleteNode() {
  if (!selectedNode) return;
  const id = selectedNode.dataset.id;
  // eliminar enlaces asociados
  document.querySelectorAll(`.edge[data-from='${id}'], .edge[data-to='${id}']`).forEach(e => e.remove());
  selectedNode.remove();
  selectedNode = null;
  updatePersonSummary();
}

/* ----------------------
   Edges (creación / dibujo)
   ---------------------- */
function createEdge(fromId, toId) {
  const canvas = document.getElementById("canvasContent");
  const line = document.createElement("div");
  line.className = "edge";
  line.dataset.from = fromId;
  line.dataset.to = toId;
  line.style.position = "absolute";
  // calcular y posicionar
  updateEdgePosition(line, fromId, toId);
  canvas.appendChild(line);
}

function updateEdgePosition(line, fromId, toId) {
  const fromEl = document.querySelector(`.node[data-id='${fromId}']`);
  const toEl = document.querySelector(`.node[data-id='${toId}']`);
  if (!fromEl || !toEl) return;
  const x1 = (parseInt(fromEl.style.left) || 0) + 60;
  const y1 = (parseInt(fromEl.style.top) || 0) + 20;
  const x2 = (parseInt(toEl.style.left) || 0) + 60;
  const y2 = (parseInt(toEl.style.top) || 0) + 20;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const ang = Math.atan2(dy, dx) * (180/Math.PI);
  line.style.left = x1 + "px";
  line.style.top = y1 + "px";
  line.style.width = len + "px";
  line.style.transform = `rotate(${ang}deg)`;
  line.style.height = "2px";
  line.style.backgroundColor = "#333";
}

function redrawEdges() {
  document.querySelectorAll(".edge").forEach(line => {
    const from = line.dataset.from;
    const to = line.dataset.to;
    updateEdgePosition(line, from, to);
  });
}

/* ----------------------
   Plegado / desplegado
   ---------------------- */
const collapsedSupernodes = new Set();

function enableCollapseToggle(node) {
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    toggleCollapse(node.dataset.id);
  });
}

function toggleCollapse(superId) {
  if (collapsedSupernodes.has(superId)) {
    // expandir
    collapsedSupernodes.delete(superId);
    showChildren(superId);
    console.log("📂 Expandido:", superId);
  } else {
    // colapsar
    collapsedSupernodes.add(superId);
    hideChildren(superId);
    console.log("📁 Colapsado:", superId);
  }
}

/* ocultar hijos recursivamente */
function hideChildren(superId) {
  document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
    child.style.display = "none";
    if (child.dataset.type === "super") {
      hideChildren(child.dataset.id);
    }
  });

  document.querySelectorAll(`.edge[data-from='${superId}'], .edge[data-to='${superId}']`).forEach(edge => {
    edge.style.display = "none";
  });
}

/* mostrar hijos recursivamente */
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

/* Obtener todos los subnodos descendientes (útil para estadísticas) */
function getAllDescendantSubnodes(superId) {
  let result = [];
  const children = [...document.querySelectorAll(".node")].filter(n => n.dataset.super === superId);
  for (const child of children) {
    if (child.dataset.type === "sub") result.push(child);
    else if (child.dataset.type === "super") result = result.concat(getAllDescendantSubnodes(child.dataset.id));
  }
  return result;
}

/* ----------------------
   Dropdowns y personas
   ---------------------- */
function updatePersonDropdowns() {
  const selects = [
    document.getElementById("taskOwner"),
    document.getElementById("superOwner"),
    document.getElementById("editOwner")
  ];
  selects.forEach(select => {
    if (!select) return;
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
  const name = document.getElementById("newPersonName").value.trim();
  if (!name) return;
  if (!people.includes(name)) people.push(name);
  updatePersonDropdowns();
  renderPersonList();
  document.getElementById("newPersonName").value = "";
}

/* ----------------------
   Resumen y Gini
   ---------------------- */
function updatePersonSummary() {
  const summary = document.getElementById("personSummary");
  if (!summary) return;
  summary.innerHTML = "";

  // obtener todas las tareas (subnodos) visibles en el DOM
  const subnodes = [...document.querySelectorAll(".node")].filter(n => n.dataset.type === "sub");

  let totalTasks = subnodes.length;
  let assignedTasks = subnodes.filter(n => n.dataset.owner).length;
  let totalHours = subnodes.reduce((sum, n) => sum + (parseFloat(n.dataset.hours) || 0), 0);
  let assignedHoursSum = subnodes.reduce((sum, n) => sum + ((n.dataset.owner) ? (parseFloat(n.dataset.hours)||0) : 0), 0);

  // horas por persona
  const personHours = people.map(p => {
    return subnodes.filter(n => n.dataset.owner === p).reduce((s, n) => s + (parseFloat(n.dataset.hours)||0), 0);
  });

  // resumen simple
  const totalLi = document.createElement("li");
  totalLi.innerHTML = `<strong>Total horas asignadas:</strong> ${assignedHoursSum.toFixed(1)}`;
  summary.appendChild(totalLi);

  // datos complementarios
  const extraStats = [
    `Horas asignadas: ${assignedHoursSum.toFixed(1)} / ${totalHours.toFixed(1)} (${((assignedHoursSum/Math.max(1,totalHours))*100).toFixed(1)}%)`,
    `Tareas totales: ${totalTasks}`,
    `Tareas asignadas: ${assignedTasks}`
  ];

  extraStats.forEach(text => {
    const li = document.createElement("li");
    li.textContent = text;
    summary.appendChild(li);
  });

  // cálculo de Gini
  const gini = calcularGini(personHours);
  const giniLi = document.createElement("li");
  giniLi.innerHTML = `<strong>Índice Gini:</strong> ${(gini*100).toFixed(1)}%`;
  summary.appendChild(giniLi);

  // media y sobrecarga
  const totalAssignedPeople = personHours.filter(h => h > 0).length;
  const averageHours = totalAssignedPeople > 0
    ? personHours.reduce((sum, h) => sum + h, 0) / totalAssignedPeople
    : 0;

  const overloaded = people
    .map((p, i) => ({ name: p, hours: personHours[i] }))
    .filter(p => p.hours > 2 * averageHours);

  const avgLi = document.createElement("li");
  avgLi.innerHTML = `<strong>Media de horas por persona asignada:</strong> ${averageHours.toFixed(1)} h`;
  summary.appendChild(avgLi);

  if (overloaded.length > 0) {
    const overTitle = document.createElement("li");
    overTitle.innerHTML = `<strong>Posibles personas sobrecargadas:</strong>`;
    summary.appendChild(overTitle);
    overloaded.forEach(o => {
      const li = document.createElement("li");
      li.textContent = `${o.name}: ${o.hours.toFixed(1)} h`;
      summary.appendChild(li);
    });
  }
}

/* cálculo Gini clásico */
function calcularGini(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a,b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a,b) => a + b, 0);
  if (sum === 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (i + 1) * sorted[i];
  return (2 * acc) / (n * sum) - (n + 1) / n;
}

/* ----------------------
   Carga desde JSON / export
   ---------------------- */
function exportGraph() {
  const data = {
    nodes: [],
    edges: []
  };

  // recorrer DOM y reconstruir estructura
  document.querySelectorAll(".node").forEach(n => {
    data.nodes.push({
      id: n.dataset.id,
      name: n.dataset.name,
      owner: n.dataset.owner,
      description: n.dataset.description || "",
      hours: parseFloat(n.dataset.hours) || 0,
      type: n.dataset.type,
      left: n.style.left,
      top: n.style.top,
      super: n.dataset.super || ""
    });
  });

  document.querySelectorAll(".edge").forEach(e => {
    data.edges.push({
      from: e.dataset.from,
      to: e.dataset.to
    });
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `huescageneral_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* importar JSON subido por usuario (input file) */
function importGraph(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      loadGraph(data);
    } catch (err) {
      alert("Error al parsear JSON: " + err);
    }
  };
  reader.readAsText(file);
}

/* loadGraph espera la estructura {nodes: [], edges: []} */
function loadGraph(data) {
  // limpiar canvas
  const canvasContent = document.getElementById("canvasContent");
  canvasContent.innerHTML = "";
  people = [];
  nodeCounter = 1;
  superCounter = 1;

  // create nodes
  (data.nodes || []).forEach(n => {
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
    document.getElementById("canvasContent").appendChild(node);

    const num = parseInt(n.id.split("_")[1]);
    if (n.type === "sub") nodeCounter = Math.max(nodeCounter, num + 1);
    else superCounter = Math.max(superCounter, num + 1);
  });

  data.edges.forEach(e => {
    createEdge(e.from, e.to);
  });

  updatePersonDropdowns();
  renderPersonList();
  updatePersonSummary();
  redrawEdges();
}

/* ----------------------
   Helper para reconstruir datos desde tu JSON original (compatibilidad)
   ---------------------- */
function importGraphFromData(data) {
  // Acepta estructura antigua con keys esp/eng
  console.log("🔁 importGraphFromData: importando...");
  const nodes = data.nodos || data.nodes || [];
  const edges = data.enlaces || data.edges || data.edges || [];
  const peopleList = data.personas || data.people || [];

  const normalized = {
    nodes: nodes.map(n => ({
      id: n.id || n._id || (n.name ? n.name.replace(/\s+/g,'_') : `node_${Math.random()}`),
      name: n.nombre || n.name || n.label || (n.id || ''),
      owner: n.owner || n.propietario || n.responsable || "",
      description: n.descripcion || n.description || "",
      hours: n.horas || n.hours || 0,
      type: (n.tipo || n.type || (n.id && n.id.startsWith('super') ? 'super' : 'sub')),
      left: n.x || n.left || n.positionX || "",
      top: n.y || n.top || n.positionY || "",
      super: n.super || n.parent || ""
    })),
    edges: (edges || []).map(e => ({
      from: e.origen || e.source || e.from || e[0],
      to: e.destino || e.target || e.to || e[1]
    }))
  };

  // push people if any
  people = (peopleList || []).slice();

  loadGraph(normalized);
}

/* ----------------------
   Redibujar edges
   ---------------------- */
function redrawEdges() {
  document.querySelectorAll(".edge").forEach(e => e.remove());
  // recrear todas
  document.querySelectorAll(".node").forEach(n => {
    const id = n.dataset.id;
    // buscar edges que tengan from/to = id en DOM? (ya se crean desde load/export)
  });
  // se asume createEdge fue llamada en loadGraph/importGraphFromData
  document.querySelectorAll(".edge").forEach(line => {
    updateEdgePosition(line, line.dataset.from, line.dataset.to);
  });
}

/* ----------------------
   PAN / ZOOM para canvas
   ---------------------- */
function initCanvasInteractions() {
  const canvas = document.getElementById("canvas");
  const canvasContent = document.getElementById("canvasContent");
  let isPanning = false;
  let startX = 0, startY = 0, panX = 0, panY = 0, scale = 1;

  canvas.addEventListener("mousedown", (e) => {
    // evita iniciar pan si el click ha sido
