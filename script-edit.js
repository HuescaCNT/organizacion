// Wrapper seguro para evitar duplicar createEdge definido en script-core.js
// Este archivo unifica las funciones de edición/ventana emergente (popup) y proporciona
// implementaciones compatibles con script-core.js para createEdge/removeEdge/updateEdgePosition.
// Asegúrate de que script-core.js define funciones como updateNodeVisual, updateSupernodeVisual,
// updatePersonSummary, updateSuperDropdown, renderPersonList, loadGraph, etc.

/* -----------------------
   Popup / edición (contextmenu / double click replacement)
   ----------------------- */
function enablePopupEdit(node) {
  // preferimos abrir popup por doble click para editar nombre/horas/owner
  node.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    selectedNode = node;

    const isSuper = node.dataset.type === "super";
    const editName = document.getElementById("editName");
    const editOwner = document.getElementById("editOwner");
    const editHours = document.getElementById("editHours");
    const editDescription = document.getElementById("editDescription");
    const popup = document.getElementById("popup");

    if (editName) editName.value = node.dataset.name || "";
    if (editOwner) editOwner.value = node.dataset.owner || "";
    if (editHours) editHours.value = node.dataset.hours || 0;
    if (editDescription) editDescription.value = node.dataset.description || "";

    // posicionar popup cerca del click (si queremos)
    if (popup) {
      popup.style.left = (e.pageX + 8) + "px";
      popup.style.top = (e.pageY + 8) + "px";
      popup.style.display = "block";
    }
  });

  // También permitir abrir con botón derecho para comportamientos legacy
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    // Reuse dblclick behavior
    const dbl = new MouseEvent('dblclick', {bubbles: true, clientX: e.clientX, clientY: e.clientY});
    node.dispatchEvent(dbl);
  });
}

function applyEdits() {
  if (!selectedNode) return;
  const nameEl = document.getElementById("editName");
  const ownerEl = document.getElementById("editOwner");
  const hoursEl = document.getElementById("editHours");
  const descEl = document.getElementById("editDescription");

  const name = nameEl ? nameEl.value.trim() : selectedNode.dataset.name;
  const owner = ownerEl ? ownerEl.value.trim() : selectedNode.dataset.owner;
  const hours = hoursEl ? parseFloat(hoursEl.value) : parseFloat(selectedNode.dataset.hours) || 0;
  const description = descEl ? descEl.value.trim() : selectedNode.dataset.description || "";

  if (!name) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  const isSuper = selectedNode.dataset.type === "super";
  const oldSuper = selectedNode.dataset.super || "";

  selectedNode.dataset.name = name;
  selectedNode.dataset.owner = owner;
  selectedNode.dataset.description = description;
  if (!isSuper) selectedNode.dataset.hours = hours;

  // Actualizar visual del nodo
  if (isSuper) {
    // recalcular % completion si es necesario (cascade)
    if (typeof updateSupernodeVisual === "function") updateSupernodeVisual(selectedNode, 0);
  } else {
    if (typeof updateNodeVisual === "function") updateNodeVisual(selectedNode);
  }

  // actualizar menús y listados
  if (typeof updatePersonDropdowns === "function") updatePersonDropdowns();
  if (typeof renderPersonList === "function") renderPersonList();
  if (typeof updatePersonSummary === "function") updatePersonSummary();
  if (typeof updateSuperDropdown === "function") updateSuperDropdown();

  closePopup();
}

function deleteNode() {
  if (!selectedNode) return;
  const id = selectedNode.dataset.id;
  const parent = selectedNode.dataset.super || "";

  // eliminar edges asociadas
  document.querySelectorAll(`.edge[data-from='${id}'], .edge[data-to='${id}']`).forEach(e => e.remove());

  // si existían conexiones desde parent, eliminarlas también (removeEdge wrapper)
  if (parent && typeof removeEdge === "function") removeEdge(id, parent);

  selectedNode.remove();
  selectedNode = null;

  if (typeof updatePersonSummary === "function") updatePersonSummary();
  if (typeof updateSuperDropdown === "function") updateSuperDropdown();
  if (typeof renderPersonList === "function") renderPersonList();
  closePopup();
}

function closePopup() {
  const popup = document.getElementById("popup");
  if (popup) popup.style.display = "none";
  selectedNode = null;
}

/* -----------------------
   Dropdowns helper (edición)
   ----------------------- */
function updateSuperDropdown() {
  // Compatibilidad: rellenar #superSelect y #editSuperSelect si existen
  const selects = [document.getElementById("superSelect"), document.getElementById("editSuperSelect")];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">Sin supernodo</option>';
    document.querySelectorAll(".node").forEach(n => {
      if (n.dataset.type === "super") {
        const option = document.createElement("option");
        option.value = n.dataset.id;
        option.textContent = n.dataset.name || n.dataset.id;
        select.appendChild(option);
      }
    });
  });
}

/* -----------------------
   Edge helpers (compatibles)
   ----------------------- */

// Si script-core ya define createEdge, usamos la de core. Si no, definimos una impl.
if (typeof createEdge === "undefined") {
  function createEdge(fromId, toId) {
    const canvasContent = document.getElementById('canvasContent');
    if (!canvasContent) return;
    // si la arista ya existe, no duplicar
    const exists = canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`);
    if (exists) return;

    const from = document.querySelector(`.node[data-id='${fromId}']`);
    const to = document.querySelector(`.node[data-id='${toId}']`);
    if (!from || !to) return;

    const line = document.createElement("div");
    line.className = "edge";
    line.dataset.from = fromId;
    line.dataset.to = toId;
    canvasContent.appendChild(line);

    // Usar updateEdgePosition de core si existe (acepta line, fromId, toId)
    if (typeof updateEdgePosition === "function") {
      try {
        updateEdgePosition(line, fromId, toId);
      } catch (err) {
        // fallback: posición aproximada usando offsets
        const x1 = from.offsetLeft + from.offsetWidth / 2;
        const y1 = from.offsetTop + from.offsetHeight / 2;
        line.style.left = x1 + "px";
        line.style.top = y1 + "px";
      }
    } else {
      // fallback básico
      const x1 = from.offsetLeft + from.offsetWidth / 2;
      const y1 = from.offsetTop + from.offsetHeight / 2;
      line.style.left = x1 + "px";
      line.style.top = y1 + "px";
    }

    if (typeof updatePersonSummary === "function") updatePersonSummary();
  }
}

// safe removeEdge wrapper
if (typeof removeEdge === "undefined") {
  function removeEdge(fromId, toId) {
    const canvasContent = document.getElementById('canvasContent');
    if (!canvasContent) return;
    const edge = canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`);
    if (edge) edge.remove();
    if (typeof updatePersonSummary === "function") updatePersonSummary();
  }
}

// If core doesn't provide updateEdgePosition with (line, fromId, toId) signature, provide a compatible fallback
if (typeof updateEdgePosition === "undefined") {
  function updateEdgePosition(line, fromId, toId) {
    const from = document.querySelector(`.node[data-id='${fromId}']`);
    const to = document.querySelector(`.node[data-id='${toId}']`);
    if (!from || !to || !line) return;
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
}

/* -----------------------
   Periodic updater for edges (keeps edges in place while dragging)
   ----------------------- */
if (typeof window.__edgeUpdaterInstalled === 'undefined') {
  window.__edgeUpdaterInstalled = true;
  setInterval(() => {
    document.querySelectorAll(".edge").forEach(line => {
      const fromId = line.dataset.from;
      const toId = line.dataset.to;
      if (typeof updateEdgePosition === "function") {
        try {
          updateEdgePosition(line, fromId, toId);
        } catch (err) {
          // ignore per-frame errors
        }
      }
    });
  }, 100);
}

/* -----------------------
   Compatibility shims: rename or map legacy function names if necessary
   ----------------------- */
// Some parts of the codebase used updatePersonList / updatePersonDropdown; ensure aliases exist
if (typeof updatePersonList === "undefined" && typeof updatePersonSummary === "function") {
  function updatePersonList() { updatePersonSummary(); }
}
if (typeof updatePersonDropdown === "undefined" && typeof updatePersonDropdowns === "function") {
  function updatePersonDropdown() { updatePersonDropdowns(); }
}
