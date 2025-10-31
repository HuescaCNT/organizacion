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

  if (!Array.isArray(personas)) personas = [];
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
    if ((sel.id || "").includes("Owner")) {
      sel.innerHTML = personas
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
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
  div.textContent = nodo.nombre || "Nodo sin nombre";
  div.dataset.id = nodo.id;
  div.onclick = () => openPopup(nodo);
  document.getElementById("canvasContent").appendChild(div);
}

/* ============================================================
   POPUP DE EDICIÓN
   ============================================================ */

function openPopup(nodo) {
  const popup = document.getElementById("popup");
  document.getElementById("editName").value = nodo.nombre || "";
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
  console.log("🔄 Importando grafo...");

  // Acepta nombres en inglés o español
  nodos = data.nodos || data.nodes || [];
  enlaces = data.enlaces || data.edges || [];
  personas = data.personas || data.people || [];

  const canvas = document.getElementById("canvasContent");
  canvas.innerHTML = "";

  // Crea nodos de manera segura
  nodos.forEach((n) => {
    const id = n.id || crypto.randomUUID();
    const nombre = n.nombre || n.name || n.label || `Nodo ${id}`;
    const owner = n.owner || n.propietario || "";
    const horas = n.horas || n.hours || 0;
    const descripcion = n.descripcion || n.description || "";

    const div = document.createElement("div");
    div.className = "node";
    div.style.left = (n.x || Math.random() * 800) + "px";
    div.style.top = (n.y || Math.random() * 600) + "px";
    div.dataset.id = id;
    div.textContent = nombre;

    // Muestra información del nodo al hacer clic
    div.onclick = () => {
      const info = {
        id,
        nombre,
        owner,
        horas,
        descripcion,
        super: n.super || "",
      };
      if (typeof openPopup === "function") {
        openPopup(info);
      } else {
        console.log("ℹ️ Nodo:", info);
      }
    };

    canvas.appendChild(div);
  });

  // Dibuja enlaces visuales entre nodos
  drawEdges();

  // Carga lista de personas
  if (!Array.isArray(window.personas)) window.personas = [];
  if (Array.isArray(personas)) {
    personas.forEach((p) => {
      if (!window.personas.includes(p)) window.personas.push(p);
    });
  }
  renderPersonList();

  updateSummary();
  console.log(`✅ Grafo importado correctamente (${nodos.length} nodos, ${enlaces.length} enlaces)`);
}

/* ============================================================
   DIBUJO DE ENLACES ENTRE NODOS
   ============================================================ */

function drawEdges() {
  const canvas = document.getElementById("canvasContent");

  enlaces.forEach((e) => {
    const sourceId = e.origen || e.source;
    const targetId = e.destino || e.target;
    const source = nodos.find((n) => n.id === sourceId);
    const target = nodos.find((n) => n.id === targetId);
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
  });
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
      horasPorPersona[n.owner] =
        (horasPorPersona[n.owner] || 0) + (n.horas || 0);
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





