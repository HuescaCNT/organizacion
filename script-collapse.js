// Evitar redeclarar collapsedSupernodes si ya lo definió script-core.js
if (typeof collapsedSupernodes === 'undefined') {
  // definir como variable global (no usar const/let si puede haber redeclaración)
  collapsedSupernodes = new Set();
}

// Evitar redefinir funciones si ya están definidas en otro archivo
if (typeof enableCollapseToggle === 'undefined') {
  function enableCollapseToggle(node) {
    node.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      toggleCollapse(node.dataset.id);
    });
  }
}

if (typeof toggleCollapse === 'undefined') {
  function toggleCollapse(superId) {
    if (collapsedSupernodes.has(superId)) {
      collapsedSupernodes.delete(superId);
      showChildren(superId);
      console.log("📂 Expandido:", superId);
    } else {
      collapsedSupernodes.add(superId);
      hideChildren(superId);
      console.log("📁 Colapsado:", superId);
    }
  }
}

if (typeof hideChildren === 'undefined') {
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
}

if (typeof showChildren === 'undefined') {
  function showChildren(superId) {
    document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
      child.style.display = "block";
      if (child.dataset.type === "super" && !collapsedSupernodes.has(child.dataset.id)) {
        showChildren(child.dataset.id);
      }
    });

    document.querySelectorAll(`.
