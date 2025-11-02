// Implementaciones mínimas para funciones que faltaban y correcciones
// Incluir este archivo justo después de script-core.js en index.html

// Evitar re-definición accidental de redrawEdges: si ya existe, no sobreescribimos.
if (typeof redrawEdges === 'undefined') {
  function redrawEdges() {
    // Limpiar y recalcular posiciones para todas las aristas existentes
    document.querySelectorAll(".edge").forEach(e => e.remove());
    // Si el export/import crea edges, asumimos que createEdge fue llamado en loadGraph.
    // Aquí simplemente actualizamos posiciones de cualquier .edge existente.
    document.querySelectorAll(".edge").forEach(line => {
      updateEdgePosition(line, line.dataset.from, line.dataset.to);
    });
  }
}

// Rellena el select de supernodos (#superSelect) con nodos tipo "super"
function updateSuperDropdown() {
  const sel = document.getElementById("superSelect");
  if (!sel) return;
  sel.innerHTML = '<option value="">(sin parent)</option>';
  document.querySelectorAll(".node").forEach(n => {
    if (n.dataset.type === "super") {
      const opt = document.createElement("option");
      opt.value = n.dataset.id;
      opt.textContent = n.dataset.name || n.dataset.id;
      sel.appendChild(opt);
    }
  });
}

// Renderiza la lista de personas en #personList
function renderPersonList() {
  const ul = document.getElementById("personList");
  if (!ul) return;
  ul.innerHTML = "";
  people.forEach((p, idx) => {
    const li = document.createElement("li");
    li.textContent = p + " ";
    const btn = document.createElement("button");
    btn.textContent = "Eliminar";
    btn.style.marginLeft = "8px";
    btn.onclick = () => {
      people.splice(idx, 1);
      updatePersonDropdowns();
      renderPersonList();
      updatePersonSummary();
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

// Recalcula y actualiza el % completado de un supernodo
function updateSupernodeCompletionCascade(superId) {
  const superNode = document.querySelector(`.node[data-id='${superId}']`);
  if (!superNode) return;
  const descendants = getAllDescendantSubnodes(superId);
  const total = descendants.reduce((s, n) => s + (parseFloat(n.dataset.hours)||0), 0);
  // considerar completado basado en hours=0 como completado? Aquí hacemos ejemplo simple:
  // si subnodo tiene dataset.completed === "1" contar como completado; sino 0
  const completed = descendants.reduce((s, n) => s + ((n.dataset.completed === "1") ? (parseFloat(n.dataset.hours)||0) : 0), 0);
  const pct = total === 0 ? 0 : (completed / total) * 100;
  updateSupernodeVisual(superNode, pct);
}

// Si el documento no tiene #superOwner o #superSelect en index.html, crear elementos mínimo dinámicamente
(function ensureSuperControls() {
  const left = document.getElementById("leftPanel");
  if (!left) return;
  if (!document.getElementById("superOwner")) {
    const label = document.createElement("label");
    label.textContent = "Responsable supernodo:";
    label.style.display = "block";
    const sel = document.createElement("select");
    sel.id = "superOwner";
    left.insertBefore(label, document.getElementById("superName").nextSibling);
    left.insertBefore(sel, label.nextSibling);
  }
  if (!document.getElementById("superSelect")) {
    const label2 = document.createElement("label");
    label2.textContent = "Parent (super):";
    label2.style.display = "block";
    const sel2 = document.createElement("select");
    sel2.id = "superSelect";
    left.insertBefore(label2, document.getElementById("importFile"));
    left.insertBefore(sel2, label2.nextSibling);
  }
  // Inicializar opciones
  updatePersonDropdowns();
  updateSuperDropdown();
  renderPersonList();
})();