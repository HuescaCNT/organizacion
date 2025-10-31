/* ------------------------------------------------------------
   SCRIPT CORE - GESTIÓN PRINCIPAL DEL GRAFO CNT
   ------------------------------------------------------------ */

let nodos = [];
let enlaces = [];
let personas = [];

/* ============================================================
   FUNCIONES BÁSICAS
   ============================================================ */

function addPerson() {
  const nombre = document.getElementById("newPersonName").value.trim();
  if (!nombre) return alert("Introduce un nombre");
  if (personas.includes(nombre)) return alert("Esa persona ya está añadida.");

  personas.push(nombre);
  actualizarSelects();
  renderPersonList();
  document.getElementById("newPersonName").value = "";
  updateSummary();
}

function renderPersonList() {
  const list = document.getElementById("personList");
  list.innerHTML = "";
  personas.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  });
}

function actualizarSelects() {
  const selects = document.querySelectorAll("select");
  selects.forEach((sel) => {
    if (sel.id.includes("Owner")) {
      sel.innerHTML = personas.map((p) => `<option value="${p}">${p}</option>`).join("");
    }
  });
}

/* ============================================================
   CREACIÓN DE NODOS Y ENLACES
   ============================================================ */

function createNode() {
  const name = document.getElementById("taskName").value.trim();
  const owner = document.getElementById("taskOwner").value;
  const hours = parseInt(document.getElementById("taskHours").value);
  const description = document.getElementById("taskDescription").value.trim();

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
  };

  nodos.push(nodo);
  renderNode(nodo);
  updateSummary();
}

function createSupernode() {
  const name = document.getElementById("superName").value.trim();
  const owner = document.getElementById("superOwner").value;

  if (!name) return alert("Introduce un nombre para el supernodo.");

  const nodo = {
    id: `super_${Date.now()}`,
    nombre: name,
    owner: owner || "",
    tipo: "supernodo",
    x: Math.random() * 800,
    y: Math.random() * 600,
  };

  nodos.push(nodo);
  renderNode(nodo);
}

/* ============================================================
   RENDERIZADO DE NODOS
   ============================================================ */

function renderNode(nodo) {
  const div = document.createElement("div");
  div.className = "node";
  div.style.left = nodo.x + "px";
  div.style.top = nodo.y + "px";
  div.textContent = nodo.nombre;
  div.dataset.id = nodo.id;
  div.onclick = () => openPopup(nodo);
  document.getElementById("canvasContent").appendChild(div);
}

/* ============================================================
   POPUP DE EDICIÓN
   ============================================================ */

function openPopup(nodo) {
  const popup = document.getElementById("popup");
  document.getElementById("editName").value = nodo.nombre;
  document.getElementById("editOwner").value = nodo.owner || "";
  document.getElementById("editHours").value = nodo.horas || "";
  document.getElementById("editDescription").value = nodo.descripcion || "";
  popup.style.display = "block";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

/* ============================================================
   EXPORTACIÓN / IMPORTACIÓN DE GRAFOS
   ============================================================ */

function getGraphData() {
  return { nodos, enlaces, personas };
}

function importGraph(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = JSON.parse(e.target.result);
    importGraphFromData(data);
  };
  reader.readAsText(file);
}

function importGraphFromData(data) {
  nodos = data.nodos || data.nodes || [];
  enlaces = data.enlaces || data.edges || [];
  personas = data.personas || data.people || [];
  document.getElementById("canvasContent").innerHTML = "";
  nodos.forEach((n) => renderNode(n));
  renderPersonList();
  updateSummary();
}

/* ============================================================
   RESUMEN DE CARGA
   ============================================================ */

function updateSummary() {
  const resumen = document.getElementById("personSummary");
  resumen.innerHTML = "";
  const horasPorPersona = {};

  nodos.forEach((n) => {
    if (n.owner) {
      horasPorPersona[n.owner] = (horasPorPersona[n.owner] || 0) + (n.horas || 0);
    }
  });

  for (const [persona, horas] of Object.entries(horasPorPersona)) {
    const li = document.createElement("li");
    li.textContent = `${persona}: ${horas} h`;
    resumen.appendChild(li);
  }
}

/* ============================================================
   FIN DE SCRIPT - LIMPIO Y FUNCIONAL
   ============================================================ */

console.log("✅ script-core.js cargado correctamente");

