// Inicializador simple que carga un grafo por defecto si no hay datos.
// Añade <script src="script-init.js"></script> en index.html justo después de script-fixes.js

function loadMainGraph() {
  // 1) Si hay variable global initialGraphData, usarla
  if (typeof window.initialGraphData !== 'undefined' && window.initialGraphData) {
    try {
      loadGraph(window.initialGraphData);
      return;
    } catch (err) {
      console.warn('initialGraphData presente pero loadGraph falló:', err);
    }
  }

  // 2) Intentar cargar un JSON estático en la raíz (huescageneral.json)
  fetch('huescageneral.json').then(r => {
    if (!r.ok) throw new Error('no file');
    return r.json();
  }).then(data => {
    loadGraph(data);
  }).catch(() => {
    // 3) Si no hay nada, crear un grafo de ejemplo mínimo
    const example = {
      nodes: [
        { id: 'super_1', name: 'Proyecto A', owner: 'Coordinador', description: '', hours: 0, type: 'super', left: '200px', top: '200px', super: '' },
        { id: 'node_1', name: 'Tarea 1', owner: 'Ana', description: '', hours: 5, type: 'sub', left: '360px', top: '220px', super: 'super_1' },
        { id: 'node_2', name: 'Tarea 2', owner: 'Luis', description: '', hours: 3, type: 'sub', left: '360px', top: '300px', super: 'super_1' }
      ],
      edges: [
        { from: 'node_1', to: 'super_1' },
        { from: 'node_2', to: 'super_1' }
      ]
    };
    loadGraph(example);
  });
}

// Ejecutar automáticamente al cargar si no hay nodos
document.addEventListener('DOMContentLoaded', () => {
  // No forzar si ya hay nodos en DOM
  if (document.querySelectorAll('.node').length === 0) {
    if (typeof loadMainGraph === 'function') loadMainGraph();
  }
});
