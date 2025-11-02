// Evitar redeclarar collapsedSupernodes si ya lo definió script-core.js
if (typeof collapsedSupernodes === 'undefined') {
  // definir como variable global
  collapsedSupernodes = new Set();
}

function enableCollapseToggle(node) {
  node.addEventListener("click", (e) => {
    if (!e.target.classList.contains("collapse-icon")) return;
    const id = node.dataset.id;
    const collapsed = collapsedSupernodes.has(id);

    if (collapsed) {
      collapsedSupernodes.delete(id);
      showChildren(id);
    } else {
      collapsedSupernodes.add(id);
      hideChildren(id);
    }

    updateSupernodeCompletionCascade(id);
  });
}


function hideChildren(superId) {
  document.querySelectorAll(`.node[data-super='${superId}']`).forEach(child => {
    child.style.display = "none";
    if (child.dataset.type === "super") {
      collapsedSupernodes.add(child.dataset.id);
      hideChildren(child.dataset.id);
      hideCollapsedTaskList(child.dataset.id);
    }
  });

  document.querySelectorAll(`.edge[data-from='${superId}']`).forEach(edge => {
	  const target = edge.dataset.to;
	  const targetNode = document.querySelector(`.node[data-id='${target}']`);
	  if (targetNode && targetNode.dataset.super === superId) {
		edge.style.display = "none";
	  }
	});

	document.querySelectorAll(`.edge[data-to='${superId}']`).forEach(edge => {
	  const source = edge.dataset.from;
	  const sourceNode = document.querySelector(`.node[data-id='${source}']`);
	  if (sourceNode && sourceNode.dataset.super === superId) {
		edge.style.display = "none";
	  }
	});
}

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
