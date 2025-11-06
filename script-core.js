let nodeCounter = 1;
let superCounter = 1;
let selectedNode = null;
let people = [];

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
  node.dataset.super = superId;
  node.dataset.type = "sub";
  node.dataset.description = description;


  updateNodeVisual(node);
  positionRandomly(node);
  makeDraggable(node);
  enablePopupEdit(node);
  document.getElementById("canvas").appendChild(node);

  if (superId) {
    createEdge(id, superId);
    updateSupernodeCompletionCascade(superId);
  }
  updatePersonSummary()
}

function positionRandomly(node) {
  const canvas = document.getElementById("canvas");
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;

  const nodeWidth = 120; // puedes ajustar este valor si tus nodos son más grandes
  const nodeHeight = 60;

  const x = Math.random() * (canvasWidth - nodeWidth);
  const y = Math.random() * (canvasHeight - nodeHeight);

  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

function makeDraggable(element) {
  let offsetX = 0, offsetY = 0, isDragging = false;

  element.addEventListener("mousedown", (e) => {
    if (e.button === 2) return; // Ignora clic derecho
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      element.style.left = (e.clientX - offsetX) + "px";
      element.style.top = (e.clientY - offsetY) + "px";
      updateConnectedEdges(element);
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function updateConnectedEdges(node) {
  const nodeId = node.dataset.id;
  document.querySelectorAll(`.edge[data-from='${nodeId}'], .edge[data-to='${nodeId}']`).forEach(line => {
    const from = document.querySelector(`.node[data-id='${line.dataset.from}']`);
    const to = document.querySelector(`.node[data-id='${line.dataset.to}']`);
    if (from && to) updateEdgePosition(line, from, to);
  });
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

function animateVisibility(element, hide) {
  element.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  element.style.opacity = hide ? "0" : "1";
  element.style.transform = hide ? "scale(0.9)" : "scale(1)";
  setTimeout(() => {
    element.style.display = hide ? "none" : "block";
  }, hide ? 300 : 0);
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
  node.dataset.super = parentId;

  updateSupernodeVisual(node, 0);
  positionRandomly(node);
  makeDraggable(node);
  enablePopupEdit(node);
  enableCollapseToggle(node);
  document.getElementById("canvas").appendChild(node);

  updateSuperDropdown();

  if (parentId) {
    createEdge(id, parentId);
    updateSupernodeCompletionCascade(parentId);
  }
  updatePersonSummary()
}

function updateNodeVisual(node) {
  const name = node.dataset.name;
  const owner = node.dataset.owner;
  const hours = node.dataset.hours;
  const description = node.dataset.description || "";

  const isVisible = node.dataset.descVisible === "true";

  const toggleIcon = isVisible ? "➖" : "➕";
  const descHTML = isVisible ? `<div class="description">${description}</div>` : "";

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
  if (toggle) {
    toggle.onclick = () => {
      node.dataset.descVisible = node.dataset.descVisible === "true" ? "false" : "true";
      updateNodeVisual(node);
    };
  }
}



function updateSupernodeVisual(node, completion) {
  const name = node.dataset.name;
  const owner = node.dataset.owner;
  const percent = Math.round(completion * 100);
  const icon = collapsedSupernodes.has(node.dataset.id) ? "➕" : "➖";

  let html = `<span class="collapse-icon" style="float:right; font-size:18px;">${icon}</span>
    <strong>${name} (${percent}%)</strong><br>Responsable: ${owner || "(sin asignar)"}`;

  if (collapsedSupernodes.has(node.dataset.id)) {
    const subnodes = getAllDescendantSubnodes(node.dataset.id);
    if (subnodes.length > 0) {
      html += `<div style="margin-top:6px; text-align:left;">`;
      subnodes.forEach(n => {
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



function getGradientColor(value) {
  value = Math.max(0, Math.min(1, value));
  const r = value < 0.5 ? 244 + (255 - 244) * (value / 0.5) : 255 - (255 - 76) * ((value - 0.5) / 0.5);
  const g = value < 0.5 ? 67 + (255 - 67) * (value / 0.5) : 255 - (255 - 175) * ((value - 0.5) / 0.5);
  const b = value < 0.5 ? 54 : 0 + 80 * ((value - 0.5) / 0.5);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function updateSupernodeCompletionCascade(superId) {
  updateSupernodeCompletion(superId);
  const parentId = document.querySelector(`.node[data-id='${superId}']`)?.dataset.super;
  if (parentId) updateSupernodeCompletionCascade(parentId);
}

function updateSupernodeCompletion(superId) {
  const subnodes = getAllDescendantSubnodes(superId);
  const total = subnodes.reduce((sum, n) => sum + parseFloat(n.dataset.hours || 0), 0);
  const withOwner = subnodes.reduce((sum, n) => n.dataset.owner ? sum + parseFloat(n.dataset.hours || 0) : sum, 0);
  const completion = total > 0 ? withOwner / total : 0;

  const supernode = document.querySelector(`.node[data-id='${superId}']`);
  if (supernode) updateSupernodeVisual(supernode, completion);
}

function getAllDescendantSubnodes(superId) {
  let result = [];
  const children = [...document.querySelectorAll(".node")].filter(n => n.dataset.super === superId);
  for (const child of children) {
    if (child.dataset.type === "sub") result.push(child);
    else if (child.dataset.type === "super") result = result.concat(getAllDescendantSubnodes(child.dataset.id));
  }
  return result;
}
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
  if (!name || people.includes(name)) return;
  people.push(name);
  updatePersonDropdowns();
  updatePersonList();
  document.getElementById("newPersonName").value = "";
}


function updatePersonList() {
  const list = document.getElementById("personList");
  list.innerHTML = "";
  people.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input value="${p}" onchange="editPerson(${i}, this.value)">
      <button onclick="removePerson(${i})">Eliminar</button>
    `;
    list.appendChild(li);
  });
  updatePersonSummary();
}

function editPerson(index, newName) {
  const oldName = people[index];
  people[index] = newName;
  document.querySelectorAll(".node").forEach(n => {
    if (n.dataset.owner === oldName) {
      n.dataset.owner = newName;
      if (n.dataset.type === "sub") updateNodeVisual(n);
      else updateSupernodeCompletionCascade(n.dataset.id);
    }
  });
  updatePersonDropdowns();
  updatePersonList();
}

function removePerson(index) {
  const name = people[index];
  people.splice(index, 1);
  document.querySelectorAll(".node").forEach(n => {
    if (n.dataset.owner === name) {
      n.dataset.owner = "";
      if (n.dataset.type === "sub") updateNodeVisual(n);
      else updateSupernodeCompletionCascade(n.dataset.id);
    }
  });
  updatePersonDropdowns();
  updatePersonList();
}

function updatePersonSummary() {
  const summary = document.getElementById("personSummary");
  summary.innerHTML = "";

  const subnodes = [...document.querySelectorAll(".node[data-type='sub']")];
  const totalTasks = subnodes.length;
  const assignedTasks = subnodes.filter(n => n.dataset.owner && n.dataset.owner.trim() !== "").length;

  const totalHours = subnodes.map(n => parseFloat(n.dataset.hours || 0));
  const assignedHours = subnodes
    .filter(n => n.dataset.owner && n.dataset.owner.trim() !== "")
    .map(n => parseFloat(n.dataset.hours || 0));

  const totalHoursSum = totalHours.reduce((sum, h) => sum + h, 0);
  const assignedHoursSum = assignedHours.reduce((sum, h) => sum + h, 0);
  const assignedPercent = totalHoursSum > 0 ? (assignedHoursSum / totalHoursSum) : 0;
  const assignedTaskPercent = totalTasks > 0 ? (assignedTasks / totalTasks) : 0;

  const personHours = people.map(p => {
    return subnodes
      .filter(n => n.dataset.owner === p)
      .reduce((sum, n) => sum + parseFloat(n.dataset.hours || 0), 0);
  });

  const giniByPerson = calculateGini(personHours);
  const giniTotalHours = calculateGini(totalHours);
  const giniAssignedHours = calculateGini(assignedHours);

  // Barras visuales con valores
  summary.appendChild(createProgressBar(giniByPerson, "Índice de Gini por persona (horas asignadas)"));
  summary.appendChild(createProgressBar(giniTotalHours, "Índice de Gini de todas las tareas (horas)"));
  summary.appendChild(createProgressBar(giniAssignedHours, "Índice de Gini de tareas asignadas (horas)"));
  summary.appendChild(createProgressBar(assignedPercent, "Proporción de horas asignadas"));
  summary.appendChild(createProgressBar(assignedTaskPercent, "Proporción de tareas asignadas"));

  // Datos numéricos complementarios
  const extraStats = [
    `Horas asignadas: ${assignedHoursSum.toFixed(1)} / ${totalHoursSum.toFixed(1)} (${(assignedPercent * 100).toFixed(1)}%)`,
    `Tareas totales: ${totalTasks}`,
    `Tareas asignadas: ${assignedTasks}`
  ];

  extraStats.forEach(text => {
    const li = document.createElement("li");
    li.textContent = text;
    summary.appendChild(li);
  });

  // Carga media y personas sobrecargadas
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
    overTitle.innerHTML = `<strong>Personas con más del doble de carga:</strong>`;
    summary.appendChild(overTitle);

    overloaded.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `• ${p.name}: ${p.hours.toFixed(1)} h`;
      summary.appendChild(li);
    });
  }
}


function calculateGini(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;

  const total = sorted.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;

  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    cumulative += (i + 1) * sorted[i];
  }

  return 1 - ((2 * cumulative) / (n * total) - (n + 1) / n);
}

function createProgressBar(value, label) {
  const container = document.createElement("li");

  const percentText = `${(value * 100).toFixed(1)}%`;
  container.innerHTML = `<strong>${label}</strong> <span style="float:right;">${percentText}</span>`;

  const bar = document.createElement("div");
  bar.style.height = "12px";
  bar.style.borderRadius = "6px";
  bar.style.marginTop = "4px";
  bar.style.background = "#ddd";
  bar.style.overflow = "hidden";

  const fill = document.createElement("div");
  fill.style.height = "100%";
  fill.style.width = percentText;
  fill.style.backgroundColor = getColorGradient(value);
  fill.style.transition = "width 0.3s ease";

  bar.appendChild(fill);
  container.appendChild(bar);
  return container;
}


function getColorGradient(value) {
  value = Math.max(0, Math.min(1, value));
  const r = 255 - Math.round(255 * value);
  const g = Math.round(200 * value);
  return `rgb(${r},${g},60)`;
}


function exportGraph() {
  const nodes = [...document.querySelectorAll(".node")].map(n => ({
    id: n.dataset.id,
    name: n.dataset.name,
    owner: n.dataset.owner,
    hours: n.dataset.hours,
	description: n.dataset.description,
    super: n.dataset.super,
    type: n.dataset.type,
    left: n.style.left,
    top: n.style.top
  }));

  const edges = [...document.querySelectorAll(".edge")].map(e => ({
    from: e.dataset.from,
    to: e.dataset.to
  }));

  const data = { nodes, edges, people };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "grafo.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importGraph(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = JSON.parse(e.target.result);
    loadGraph(data);
  };
  reader.readAsText(file);
}

function loadGraph(data) {
  document.getElementById("canvas").innerHTML = "";
  nodeCounter = 1;
  superCounter = 1;

  people = data.people || [];
  updatePersonDropdowns();
  updatePersonList();

  data.nodes.forEach(n => {
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
    document.getElementById("canvas").appendChild(node);

    const num = parseInt(n.id.split("_")[1]);
    if (n.type === "sub") nodeCounter = Math.max(nodeCounter, num + 1);
    else superCounter = Math.max(superCounter, num + 1);
  });

  data.edges.forEach(e => {
    createEdge(e.from, e.to);
  });

  const superIds = data.nodes.filter(n => n.type === "super").map(n => n.id);
  superIds.forEach(id => updateSupernodeCompletionCascade(id));

  updateSuperDropdown();
  updatePersonSummary();
}

let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

const canvasWrapper = document.getElementById("canvasWrapper");
const canvas = document.getElementById("canvas");

canvasWrapper.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  scale = Math.max(0.2, Math.min(2, scale + delta));
  updateTransform();
});

canvasWrapper.addEventListener("mousedown", (e) => {
  if (e.button !== 1 && !e.ctrlKey) return; // botón central o Ctrl+clic
  isPanning = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
});

document.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  updateTransform();
});

document.addEventListener("mouseup", () => {
  isPanning = false;
});

function updateTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
// === PAN, ZOOM Y PANTALLA COMPLETA ===

let canvas = document.getElementById("canvas");
let leftPanel = document.getElementById("leftPanel");
let rightPanel = document.getElementById("rightPanel");
let toggleBtn = document.getElementById("togglePanels");

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isPanning = false;
let startX, startY;

// --- PANNING ---
canvas.addEventListener("mousedown", (e) => {
  if (e.target.id === "canvas") { // solo si clicas fondo
    isPanning = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
  }
});

window.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  offsetX = e.clientX - startX;
  offsetY = e.clientY - startY;
  updateCanvasTransform();
});

window.addEventListener("mouseup", () => {
  isPanning = false;
});

// --- ZOOM ---
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomIntensity = 0.1;
  const wheel = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
  scale *= wheel;
  scale = Math.min(Math.max(0.2, scale), 3);
  updateCanvasTransform();
});

function updateCanvasTransform() {
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// --- PANTALLA COMPLETA ---
if (toggleBtn) {
  let panelsHidden = false;
  toggleBtn.addEventListener("click", () => {
    panelsHidden = !panelsHidden;
    leftPanel.classList.toggle("hidden", panelsHidden);
    rightPanel.classList.toggle("hidden", panelsHidden);
    toggleBtn.textContent = panelsHidden ? "↩️ Mostrar paneles" : "🖥️ Pantalla completa";
  });
}

}
