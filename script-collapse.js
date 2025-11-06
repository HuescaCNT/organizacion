const collapsedSupernodes = new Set();

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
/*
function showCollapsedTaskList(superId) {
  const container = document.getElementById("canvas");
  const supernode = document.querySelector(`.node[data-id='${superId}']`);
  const existing = document.querySelector(`.task-list[data-super='${superId}']`);
  if (existing) existing.remove();

  const subnodes = getAllDescendantSubnodes(superId);
  if (subnodes.length === 0) return;

  const list = document.createElement("div");
  list.className = "task-list";
  list.dataset.super = superId;
  list.style.position = "absolute";
  list.style.left = supernode.style.left;
  list.style.top = (supernode.offsetTop + supernode.offsetHeight + 6) + "px";
  list.style.background = "#fff";
  list.style.border = "1px solid #ccc";
  list.style.padding = "6px";
  list.style.borderRadius = "4px";
  list.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
  list.style.fontSize = "13px";
  list.style.maxWidth = "200px";
  list.style.zIndex = "10";

  list.innerHTML = `<strong>Tareas:</strong><br>`;
  subnodes.forEach(n => {
    const hasOwner = n.dataset.owner && n.dataset.owner.trim() !== "";
    const icon = hasOwner ? "✅" : "⚠️";
    list.innerHTML += `${icon} ${n.dataset.name}<br>`;
  });

  container.appendChild(list);
}

function hideCollapsedTaskList(superId) {
  const existing = document.querySelector(`.task-list[data-super='${superId}']`);
  if (existing) existing.remove();
}*/