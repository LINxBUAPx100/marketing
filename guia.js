/* =========================================================
   Guía de estudio · comportamiento
   - convierte las tareas prácticas en checklists persistentes
   - construye el checklist maestro del apéndice
   - marca el índice y calcula el progreso
   - tooltips de las gráficas
   - navegación del índice en móvil
   ========================================================= */
(function () {
  'use strict';

  var CLAVE = 'guia-marketing-progreso';
  var estado = {};
  try { estado = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (e) { estado = {}; }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {}
  }

  /* ---------- 1. convertir cada tarea en checklist ---------- */
  var tareas = [];

  Array.prototype.forEach.call(document.querySelectorAll('.tarea'), function (tarea) {
    var seccion = tarea.closest('.seccion');
    if (!seccion) return;
    var idSec = seccion.id;                       // s3-2
    var num = idSec.replace('s', '').replace('-', '.');  // 3.2
    var h3 = seccion.querySelector('h3');
    var titulo = h3 ? h3.textContent.replace(/^\s*\d+\.\d+\s*/, '').trim() : num;

    var lista = tarea.querySelector('ol, ul');
    var items = [];

    if (lista) {
      items = Array.prototype.slice.call(lista.children);
      lista.classList.add('lista-chk');
    } else {
      // tareas de un solo párrafo: el párrafo se vuelve el único ítem
      var p = tarea.querySelector('p');
      if (!p) return;
      lista = document.createElement('ul');
      lista.className = 'lista-chk';
      var li = document.createElement('li');
      li.innerHTML = p.innerHTML;
      lista.appendChild(li);
      p.parentNode.replaceChild(lista, p);
      items = [li];
    }

    var claves = [];
    items.forEach(function (li, i) {
      var clave = num + '-' + (i + 1);
      claves.push(clave);
      var contenido = li.innerHTML;
      var label = document.createElement('label');
      label.className = 'chk';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-clave', clave);
      if (estado[clave]) input.checked = true;
      var span = document.createElement('span');
      span.innerHTML = contenido;
      label.appendChild(input);
      label.appendChild(span);
      li.innerHTML = '';
      li.appendChild(label);
    });

    tareas.push({ num: num, titulo: titulo, idSec: idSec, claves: claves, modulo: num.charAt(0) });
  });

  /* ---------- 2. checklist maestro del apéndice ---------- */
  var contenedor = document.getElementById('checklist-maestro');
  var nombresModulo = {
    '1': 'Módulo 1 · Estrategia y posicionamiento',
    '2': 'Módulo 2 · El consumidor actual',
    '3': 'Módulo 3 · Ecosistema digital',
    '4': 'Módulo 4 · Contenido, redes y comunidad',
    '5': 'Módulo 5 · Analítica y decisiones'
  };

  if (contenedor) {
    var actual = null, grupo = null, ul = null;
    tareas.forEach(function (t) {
      if (t.modulo !== actual) {
        actual = t.modulo;
        grupo = document.createElement('div');
        grupo.className = 'grupo';
        var h3 = document.createElement('h3');
        h3.textContent = nombresModulo[actual] || ('Módulo ' + actual);
        ul = document.createElement('ul');
        grupo.appendChild(h3);
        grupo.appendChild(ul);
        contenedor.appendChild(grupo);
      }
      var li = document.createElement('li');
      var label = document.createElement('label');
      label.className = 'chk';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-maestro', t.num);
      var span = document.createElement('span');
      span.innerHTML = '<span class="n">' + t.num + '</span><a href="#' + t.idSec + '">' + t.titulo + '</a>';
      label.appendChild(input);
      label.appendChild(span);
      li.appendChild(label);
      ul.appendChild(li);
    });
  }

  /* ---------- 3. sincronización y progreso ---------- */
  var barra = document.getElementById('prog-bar');
  var texto = document.getElementById('prog-txt');

  function completa(t) {
    return t.claves.length > 0 && t.claves.every(function (c) { return !!estado[c]; });
  }

  function pintar() {
    var hechas = 0;
    tareas.forEach(function (t) {
      var ok = completa(t);
      if (ok) hechas++;
      var maestro = document.querySelector('[data-maestro="' + t.num + '"]');
      if (maestro) maestro.checked = ok;
      var enlace = document.querySelector('[data-toc="' + t.idSec + '"]');
      if (enlace) enlace.classList.toggle('hecho', ok);
    });
    if (texto) texto.textContent = hechas + ' de ' + tareas.length + ' tareas';
    if (barra) barra.style.width = (tareas.length ? (hechas / tareas.length) * 100 : 0) + '%';
  }

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || el.type !== 'checkbox') return;

    var clave = el.getAttribute('data-clave');
    if (clave) {
      if (el.checked) estado[clave] = true; else delete estado[clave];
      guardar();
      pintar();
      return;
    }

    var num = el.getAttribute('data-maestro');
    if (num) {
      var t = tareas.filter(function (x) { return x.num === num; })[0];
      if (!t) return;
      t.claves.forEach(function (c) {
        if (el.checked) estado[c] = true; else delete estado[c];
        var casilla = document.querySelector('[data-clave="' + c + '"]');
        if (casilla) casilla.checked = el.checked;
      });
      guardar();
      pintar();
    }
  });

  var reiniciar = document.getElementById('reiniciar');
  if (reiniciar) {
    reiniciar.addEventListener('click', function () {
      estado = {};
      guardar();
      Array.prototype.forEach.call(document.querySelectorAll('.chk input'), function (i) { i.checked = false; });
      pintar();
    });
  }

  pintar();

  /* ---------- 4. tooltips de las gráficas ---------- */
  var tip = document.createElement('div');
  tip.id = 'tip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);

  function mostrar(texto, x, y) {
    tip.textContent = texto;
    tip.classList.add('visible');
    var ancho = tip.offsetWidth, alto = tip.offsetHeight;
    var izq = Math.min(Math.max(8, x - ancho / 2), window.innerWidth - ancho - 8);
    var arriba = y - alto - 12;
    if (arriba < 8) arriba = y + 18;
    tip.style.left = izq + 'px';
    tip.style.top = arriba + 'px';
  }
  function ocultar() { tip.classList.remove('visible'); }

  document.addEventListener('pointerover', function (e) {
    var el = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    mostrar(el.getAttribute('data-tip'), r.left + r.width / 2, r.top);
  });
  document.addEventListener('pointerout', function (e) {
    if (e.target.closest && e.target.closest('[data-tip]')) ocultar();
  });
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (el) {
      var r = el.getBoundingClientRect();
      mostrar(el.getAttribute('data-tip'), r.left + r.width / 2, r.top);
      setTimeout(ocultar, 2600);
    }
  });
  window.addEventListener('scroll', ocultar, { passive: true });

  /* ---------- 5. índice en móvil ---------- */
  var boton = document.getElementById('btn-indice');
  var indice = document.getElementById('indice');
  if (boton && indice) {
    boton.addEventListener('click', function () {
      var abierto = indice.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.textContent = abierto ? 'Cerrar' : 'Índice';
    });
    indice.addEventListener('click', function (e) {
      if (e.target.closest('a') && window.innerWidth < 900) {
        indice.classList.remove('abierto');
        boton.setAttribute('aria-expanded', 'false');
        boton.textContent = 'Índice';
      }
    });
  }
})();
