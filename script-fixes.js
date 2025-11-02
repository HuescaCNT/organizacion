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
      // si updateEdgePosition acepta ids (core) o elementos (otro), intentamos ambos
      try {
        updateEdgePosition(line, line.dataset.from, line.dataset.to);
      } catch (err) {
        // fallback: intentar con elementos
        const fromEl = document.querySelector(`.node[data-id='${line.dataset.from}']`);
        const toEl = document.querySelector(`.node[data-id='${line.dataset.to}']`);
        if (fromEl && toEl) {
          // posición simple
          const x1 = fromEl.offsetLeft + fromEl.offsetWidth / 2;
          const y1 = fromEl.offsetTop + fromEl.offsetHeight / 2;
          line.style.left = x1 + "px";
          line.style.top = y1 + "px";
        }
      }
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
  // considerar completado basado en dataset.completed === "1"
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
    // insert after the superName input
    const superName = document.getElementById("superName");
    if (superName && superName.parentNode) {
      superName.parentNode.insertBefore(label, superName.nextSibling);
      superName.parentNode.insertBefore(sel, label.nextSibling);
    } else {
      left.appendChild(label);
      left.appendChild(sel);
    }
  }
  if (!document.getElementById("superSelect")) {
    const label2 = document.createElement("label");
    label2.textContent = "Parent (super):";
    label2.style.display = "block";
    const sel2 = document.createElement("select");
    sel2.id = "superSelect";
    const importFile = document.getElementById("importFile");
    if (importFile && importFile.parentNode) {
      importFile.parentNode.insertBefore(label2, importFile);
      importFile.parentNode.insertBefore(sel2, label2.nextSibling);
    } else {
      left.appendChild(label2);
      left.appendChild(sel2);
    }
  }
  // Inicializar opciones (seguras, solo si existen las funciones)
  if (typeof updatePersonDropdowns === 'function') updatePersonDropdowns();
  updateSuperDropdown();
  renderPersonList();
})();
