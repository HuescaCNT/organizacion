function enablePopupEdit(node) {
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    selectedNode = node;

    const isSuper = node.dataset.type === "super";
    document.getElementById("editName").value = node.dataset.name;
    document.getElementById("editOwner").value = node.dataset.owner || "";
    document.getElementById("editHours").value = node.dataset.hours || "";
    document.getElementById("editSuperSelect").value = node.dataset.super || "";
	document.getElementById("editDescription").value = node.dataset.description || "";

    document.getElementById("editHours").style.display = isSuper ? "none" : "inline";
    document.getElementById("editHoursLabel").style.display = isSuper ? "none" : "inline";
    document.getElementById("editSuperSelect").style.display = "inline";
    document.getElementById("editSuperLabel").style.display = "inline";

    const popup = document.getElementById("popup");
    popup.style.left = e.pageX + "px";
    popup.style.top = e.pageY + "px";
    popup.style.display = "block";
  });
}

function applyEdits() {
  const name = document.getElementById("editName").value.trim();
  const owner = document.getElementById("editOwner").value.trim();
  const hours = parseFloat(document.getElementById("editHours").value);
  const newSuper = document.getElementById("editSuperSelect").value;
  const isSuper = selectedNode.dataset.type === "super";
  const description = document.getElementById("editDescription").value.trim();

  if (!name) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  if (!isSuper && (isNaN(hours) || hours <= 0)) {
    alert("El número de horas debe ser mayor que 0.");
    return;
  }

  const oldSuper = selectedNode.dataset.super;
  selectedNode.dataset.name = name;
  selectedNode.dataset.owner = owner;
  selectedNode.dataset.super = newSuper;
  selectedNode.dataset.description = description;
  if (!isSuper) selectedNode.dataset.hours = hours;

  if (oldSuper && oldSuper !== newSuper) removeEdge(selectedNode.dataset.id, oldSuper);
  if (newSuper && newSuper !== oldSuper) createEdge(selectedNode.dataset.id, newSuper);

  if (isSuper) {
    updateSupernodeCompletion(selectedNode.dataset.id);
  } else {
    updateNodeVisual(selectedNode);
    if (newSuper) updateSupernodeCompletion(newSuper);
  }

  closePopup();
  updatePersonList();
}

function deleteNode() {
  const superId = selectedNode.dataset.super;
  removeEdge(selectedNode.dataset.id, superId);
  selectedNode.remove();
  if (superId) updateSupernodeCompletion(superId);
  updateSuperDropdown();
  closePopup();
  updatePersonList();
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
  selectedNode = null;
}

function updateSuperDropdown() {
  const selects = [document.getElementById("superSelect"), document.getElementById("editSuperSelect")];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">Sin supernodo</option>';
    document.querySelectorAll(".node[data-type='super']").forEach(n => {
      const option = document.createElement("option");
      option.value = n.dataset.id;
      option.textContent = n.dataset.name;
      select.appendChild(option);
    });
  });
}

function createEdge(fromId, toId) {
  const canvasContent = document.getElementById('canvasContent');
  const from = document.querySelector(`.node[data-id='${fromId}']`);
  const to = document.querySelector(`.node[data-id='${toId}']`);
  if (!from || !to) return;

  const line = document.createElement("div");
  line.className = "edge";
  line.dataset.from = fromId;
  line.dataset.to = toId;
  canvasContent.appendChild(line);
  updateEdgePosition(line, from, to);
  updatePersonList();
}

function removeEdge(fromId, toId) {
  const canvasContent = document.getElementById('canvasContent');
  const edge = canvasContent.querySelector(`.edge[data-from='${fromId}'][data-to='${toId}']`);
  if (edge) edge.remove();
  updatePersonList();
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

setInterval(() => {
  document.querySelectorAll(".edge").forEach(line => {
    const from = document.querySelector(`.node[data-id='${line.dataset.from}']`);
    const to = document.querySelector(`.node[data-id='${line.dataset.to}']`);
    if (from && to) updateEdgePosition(line, from, to);
  });
}, 100);