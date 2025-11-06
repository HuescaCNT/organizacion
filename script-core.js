// script-core.js - versión con integración d3.zoom para pan y zoom
// Mantén el resto de tus funciones (creación de nodos, carga de grafo, etc.) aquí arriba.
// Este bloque se centra en detectar el <svg> del grafo y aplicar d3.zoom() sin
// interferir con la lógica existente de nodos y eventos.

(function () {
  // Configuración por defecto
  const SCALE_MIN = 0.2;
  const SCALE_MAX = 3;

  // Elementos del DOM
  const canvasContainer = document.getElementById('canvas');
  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  const toggleBtn = document.getElementById('togglePanels');

  // Añade clase .canvas-ready al contenedor cuando tenga contenido para estilos
  function markReady() {
    canvasContainer.classList.add('canvas-ready');
  }

  // Aplica la clase hidden a los paneles
  function togglePanels() {
    const hidden = leftPanel.classList.toggle('hidden') && rightPanel.classList.toggle('hidden');
    // Ajustar texto del botón
    if (toggleBtn) toggleBtn.textContent = hidden ? '↩️ Mostrar paneles' : '🖥️ Pantalla completa';
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', togglePanels);
  }

  // Intenta inicializar el zoom cuando exista un <svg> dentro de #canvas.
  // Usamos MutationObserver para detectar cuando D3 u otro script inserte el SVG.
  function initZoomOnSVG(svg) {
    // Evitar re-inicializar
    if (svg.__zoom_initialized) return;
    svg.__zoom_initialized = true;

    // d3 selection
    const s = d3.select(svg);

    // Buscamos el <g> interior donde normalmente se dibuja el contenido.
    // Si no hay <g>, creamos uno y movemos los elementos dentro.
    let inner = s.select('g');
    if (inner.empty()) {
      inner = s.append('g');
      // Mover elementos (excepto defs) dentro del <g> podría ser necesario si tu app no usa g.
      // Pero para no romper nada, no movemos automáticamente aquí — asumimos que tu grafo usa un <g>.
    }

    // Crear zoom
    const zoom = d3.zoom()
      .scaleExtent([SCALE_MIN, SCALE_MAX])
      .on('zoom', (event) => {
        inner.attr('transform', event.transform);
      });

    // Aplicar zoom al svg
    s.call(zoom);

    // Para una experiencia de usuario mejor: permitir que la rueda haga zoom sin necesidad de modificador
    // y evitar que el scroll de la página interfiera cuando estamos sobre el canvas.
    svg.addEventListener('wheel', (e) => {
      // Cuando el cursor esté sobre el svg, evitamos el scroll de la página para que la rueda haga zoom.
      e.preventDefault();
    }, { passive: false });

    // Marcar listo
    markReady();
    console.log('D3 zoom inicializado sobre SVG');
  }

  // Observador para detectar inserción del <svg> por D3 u otros scripts
  function observeCanvasForSVG() {
    if (!canvasContainer) return;
    // Si ya existe un svg al cargar, inicializamos inmediatamente
    const existingSVG = canvasContainer.querySelector('svg');
    if (existingSVG) {
      initZoomOnSVG(existingSVG);
      return;
    }

    const mo = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === 1 && node.tagName.toLowerCase() === 'svg') {
            initZoomOnSVG(node);
            return;
          }
        }
      }
    });

    mo.observe(canvasContainer, { childList: true, subtree: false });

    // Además, como fallback, hacemos reintentos por si el SVG se crea más tarde dentro de estructuras internas.
    let retries = 0;
    const interval = setInterval(() => {
      const svg = canvasContainer.querySelector('svg');
      if (svg) {
        initZoomOnSVG(svg);
        clearInterval(interval);
      }
      retries++;
      if (retries > 40) clearInterval(interval); // ~40*250ms = 10s de reintentos
    }, 250);
  }

  // Si la página ya ha cargado, arrancamos; si no, esperamos al DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeCanvasForSVG);
  } else {
    observeCanvasForSVG();
  }

  // === Funciones de ayuda opcionales ===
  // Puedes exponer una función global para forzar re-inicialización (útil en dev)
  window.__initPanZoom = function () {
    const svg = canvasContainer && canvasContainer.querySelector('svg');
    if (svg) initZoomOnSVG(svg);
    else observeCanvasForSVG();
  };

  // También expongo una función para centrar y ajustar zoom automático si quieres
  window.__fitToScreen = function (duration = 300) {
    const svg = canvasContainer && canvasContainer.querySelector('svg');
    if (!svg) return;
    const s = d3.select(svg);
    const inner = s.select('g');
    if (inner.empty()) return;
    // calcular bounding box
    try {
      const bbox = inner.node().getBBox();
      const width = svg.clientWidth || svg.getBoundingClientRect().width;
      const height = svg.clientHeight || svg.getBoundingClientRect().height;
      const scale = Math.min((width - 40) / bbox.width, (height - 40) / bbox.height);
      const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
      const translateX = -bbox.x * clamped + (width - bbox.width * clamped) / 2;
      const translateY = -bbox.y * clamped + (height - bbox.height * clamped) / 2;
      const t = d3.zoomIdentity.translate(translateX, translateY).scale(clamped);
      s.transition().duration(duration).call(d3.zoom().transform, t);
    } catch (err) {
      console.warn('No se pudo ajustar al contenido:', err);
    }
  };

})();