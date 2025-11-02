// Evitar redeclarar collapsedSupernodes si ya lo definió script-core.js
if (typeof collapsedSupernodes === 'undefined') {
  // definir como variable global (no usar const/let si puede haber redeclaración)
  collapsedSupernodes = new Set();
}

// Guardar (no sobrescribir) enableCollapseToggle
if (typeof enableCollapseToggle === 'undefined') {
  function enableCollapseToggle(node) {
    node.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      toggleCollapse(node.dataset.id);
    });
  }
}

// Guardar (no sobrescribir) toggleCollapse
if (typeof toggleCollapse === 'undefined') {
  function toggleCollapse(superId) {
    if (collapsedSupernodes.has(superId)) {
      collapsedSupernodes.delete(superId);
      if (typeof showChildren === 'function') {
        showChildren(superId);
      }
      console.log("📂 Expandido:", superId);
    } else {
      collapsedSupernodes.add(superId);
      if (typeof hideChildren === 'function') {
        hideChildren(superId);
      }
      console.log("📁 Colapsado:", superId);
    }
  }
}

// Guardar (no sobrescribir) hideChildren
if (typeof hideChildren === 'undefined') {
  function hideChildren(superId) {
    document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
      child.style.display = "none";
      if (child.dataset.type === "super") {
        // recursividad segura: solo llamar si la función existe (se definirá en este u otro archivo)
        if (typeof hideChildren === 'function') hideChildren(child.dataset.id);
      }
    });

    document.querySelectorAll(`.edge[data-from='${superId}'], .edge[data-to='${superId}']`).forEach(edge => {
      edge.style.display = "none";
    });
  }
}

// Guardar (no sobrescribir) showChildren
if (typeof showChildren === 'undefined') {
  function showChildren(superId) {
    document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
      child.style.display = "block";
      if (child.dataset.type === "super" && !collapsedSupernodes.has(child.dataset.id)) {
        if (typeof showChildren === 'function') showChildren(child.dataset.id);
      }
    });

    document.querySelectorAll(`.edge[data-from='${superId}'], .edge[data-to='${superId}']`).forEach(edge => {
      edge.style.display = "block";
    });
  }
}
