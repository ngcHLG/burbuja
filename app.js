(function() { var noop = function() {}; console.log = noop; console.warn = noop; console.error = noop; console.info = noop; })();

const SUPABASE_URL = 'https://xjjbrnjgpncxwqishseo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_e68llCL_CYuf2M9TyVcdWA_HdMDYpVF';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const NTFY_TOPIC = 'comecome_8f3js9f83jf93jf';

let todasCategorias = [];
let todosProductos = [];
let hayCombosActivos = false;
let categoriaActiva = 'todas';
let carrito = [];
let checkoutModalInstance = null;
let horarioAbierto = true;
let recargoTransferencia = 0;
let repartosDisponibles = [];

// Lógica del Tema Claro/Oscuro
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);

  const icon = document.getElementById('theme-icon');
  if (newTheme === 'dark') {
    icon.className = 'bi bi-sun-fill';
  } else {
    icon.className = 'bi bi-moon-stars-fill';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const modalEl = document.getElementById('checkoutModal');
  if (modalEl) checkoutModalInstance = new bootstrap.Modal(modalEl);

  await cargarConfiguracion();
  await cargarCategorias();
  await cargarProductos();
  await verificarCombosActivos();
  await cargarRepartosEnvio();
  renderCategorias();
  await verificarHorario();
  renderProductos();

  document.getElementById('metodo-pago').addEventListener('change', () => {
    actualizarInfoRecargo();
    actualizarCarrito();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.reparto-autocomplete')) {
      document.getElementById('reparto-sugerencias').classList.remove('show');
    }
  });

  setInterval(async () => {
    await verificarHorario();
    if (categoriaActiva === 'combos') {
      cargarCombosPublicos();
    } else {
      renderProductos();
    }
  }, 60000);
});

async function cargarConfiguracion() {
  const { data } = await supabaseClient.from('configuracion').select('recargo_transferencia').single();
  if (data) { recargoTransferencia = parseFloat(data.recargo_transferencia) || 0; actualizarInfoRecargo(); }
}

function actualizarInfoRecargo() {
  const metodo = document.getElementById('metodo-pago').value;
  const info = document.getElementById('recargo-info');
  if (metodo === 'transferencia' && recargoTransferencia > 0) {
    info.textContent = `+${recargoTransferencia}% por transferencia.`;
    info.classList.remove('d-none');
  } else {
    info.classList.add('d-none');
  }
}

async function cargarCategorias() {
  const { data } = await supabaseClient.from('categorias').select('*').order('nombre');
  if (data) todasCategorias = data;
}

async function cargarProductos() {
  const { data } = await supabaseClient.from('productos').select('*, categorias(nombre)').eq('activo', true).order('nombre');
  if (data) todosProductos = data;
}

async function verificarCombosActivos() {
  const { data } = await supabaseClient.from('combos').select('id').eq('activo', true).limit(1);
  hayCombosActivos = data && data.length > 0;
}

async function cargarRepartosEnvio() {
  const { data, error } = await supabaseClient.from('repartos').select('*').eq('activo', true).order('nombre');
  if (!error && data) repartosDisponibles = data;
}

function mostrarSugerencias() {
  if (repartosDisponibles.length > 0 && !document.getElementById('reparto-id').value) filtrarRepartos();
}

function filtrarRepartos() {
  const input = document.getElementById('reparto-input');
  const sugerencias = document.getElementById('reparto-sugerencias');
  const texto = input.value.toLowerCase().trim();
  let filtrados = texto ? repartosDisponibles.filter(r => r.nombre.toLowerCase().includes(texto)) : repartosDisponibles;

  if (filtrados.length === 0) {
    sugerencias.innerHTML = '<div class="reparto-opcion text-muted text-center py-2"><small>No disponible</small></div>';
  } else {
    sugerencias.innerHTML = filtrados.map(r => `
      <div class="reparto-opcion d-flex justify-content-between" onclick="seleccionarReparto('${r.id}', '${r.nombre}', ${r.precio})">
        <span>${r.nombre}</span><span class="fw-bold">+${parseFloat(r.precio).toFixed(2)}</span>
      </div>
    `).join('');
  }
  sugerencias.classList.add('show');
}

function seleccionarReparto(id, nombre, precio) {
  document.getElementById('reparto-id').value = id;
  document.getElementById('reparto-precio').value = precio;
  document.getElementById('reparto-sugerencias').classList.remove('show');
  document.getElementById('reparto-seleccionado-texto').textContent = `${nombre}`;
  document.getElementById('reparto-seleccionado').classList.remove('d-none');
  document.getElementById('reparto-input').classList.add('d-none');
  actualizarCarrito();
}

function limpiarReparto() {
  document.getElementById('reparto-id').value = '';
  document.getElementById('reparto-precio').value = '';
  document.getElementById('reparto-input').value = '';
  document.getElementById('reparto-seleccionado').classList.add('d-none');
  document.getElementById('reparto-input').classList.remove('d-none');
  actualizarCarrito();
}

function renderCategorias() {
  const container = document.getElementById('categorias-container');
  let html = `<button class="btn-categoria active" onclick="filtrarPorCategoria('todas', this)">Todo el Catálogo</button>`;
  if (hayCombosActivos) html += `<button class="btn-categoria" onclick="filtrarPorCategoria('combos', this)">Kits & Ofertas <i class="bi bi-stars"></i></button>`;

  const categoriasConProductos = todasCategorias.filter(cat => todosProductos.some(prod => prod.categoria_id === cat.id));
  categoriasConProductos.forEach(cat => {
    html += `<button class="btn-categoria" onclick="filtrarPorCategoria('${cat.id}', this)">${cat.nombre}</button>`;
  });
  container.innerHTML = html;
}

function filtrarPorCategoria(catId, el) {
  categoriaActiva = catId;
  document.querySelectorAll('.btn-categoria').forEach(btn => btn.classList.remove('active'));
  el.classList.add('active');
  if (catId === 'combos') cargarCombosPublicos(); else renderProductos();
}

function renderProductos() {
  const container = document.getElementById('productos-container');
  let prods = categoriaActiva === 'todas' ? todosProductos : todosProductos.filter(p => p.categoria_id === categoriaActiva);
  if (prods.length === 0) { container.innerHTML = '<div class="col-12 text-center text-muted mt-5"><i class="bi bi-box-seam fs-1"></i><p>Próximamente más productos.</p></div>'; return; }

  container.innerHTML = prods.map(p => `
    <div class="col">
      <div class="card-producto h-100 d-flex flex-column">
        <div class="producto-media">
          ${p.foto_url ? `<img src="${p.foto_url}" class="card-img-top shadow-sm" alt="${p.nombre}">` : `<div class="producto-sin-foto shadow-sm"><i class="bi bi-droplet-half"></i></div>`}
          <button class="btn-add-flotante" onclick="agregarAlCarrito('${p.id}')" ${horarioAbierto ? '' : 'disabled'} aria-label="Añadir ${p.nombre}">
            <i class="bi bi-plus"></i>
          </button>
        </div>
        <div class="flex-grow-1 d-flex flex-column justify-content-between">
          <div>
            <h5 class="card-title mb-1">${p.nombre}</h5>
            <p class="card-text">${p.descripcion || ''}</p>
          </div>
          <div><span class="precio-pill">${parseFloat(p.precio).toFixed(2)} CUP</span></div>
        </div>
      </div>
    </div>`).join('');
}

async function cargarCombosPublicos() {
  const container = document.getElementById('productos-container');
  container.innerHTML = '<div class="col"><div class="skeleton skeleton-card"></div></div><div class="col"><div class="skeleton skeleton-card"></div></div>';
  const { data: combos, error } = await supabaseClient.from('combos').select('*').eq('activo', true).order('nombre');

  if (error || !combos || combos.length === 0) { container.innerHTML = '<p class="text-muted text-center w-100">Sin kits activos en este momento.</p>'; return; }

  let html = '';
  for (const combo of combos) {
    const { data: items } = await supabaseClient.from('combo_items').select('*, productos(nombre, precio)').eq('combo_id', combo.id);
    const totalOriginal = (items || []).reduce((s, i) => s + (parseFloat(i.productos.precio) * i.cantidad), 0);
    let precioFinal = totalOriginal;
    if (combo.tipo_descuento === 'porcentaje') precioFinal = totalOriginal * (1 - combo.valor_descuento / 100);
    else if (combo.tipo_descuento === 'fijo') precioFinal = parseFloat(combo.valor_descuento);

    const listaProductos = (items || []).map(i => `${i.cantidad}x ${i.productos.nombre}`).join('<br>');

    html += `
    <div class="col">
      <div class="card-producto h-100 d-flex flex-column">
        <div class="producto-media">
          <div class="producto-sin-foto shadow-sm" style="color: var(--rosa-principal)"><i class="bi bi-box2-heart-fill"></i></div>
          <span class="badge-oferta shadow-sm"><i class="bi bi-stars"></i> KIT</span>
          <button class="btn-add-flotante" onclick="agregarComboAlCarrito('${combo.id}')" ${horarioAbierto ? '' : 'disabled'}>
            <i class="bi bi-plus"></i>
          </button>
        </div>
        <div class="flex-grow-1 d-flex flex-column justify-content-between">
          <div>
            <h5 class="card-title mb-1">${combo.nombre}</h5>
            <p class="card-text mt-2 text-start px-2 border-start border-2 border-opacity-50" style="border-color: var(--rosa-principal) !important;">${listaProductos}</p>
          </div>
          <div class="mt-2 d-flex flex-column align-items-center">
            <s class="text-muted small">${totalOriginal.toFixed(2)} CUP</s>
            <span class="precio-pill">${precioFinal.toFixed(2)} CUP</span>
          </div>
        </div>
      </div>
    </div>`;
  }
  container.innerHTML = html;
}

async function verificarHorario() {
  const ahora = new Date(); const diaSemana = ahora.getDay(); const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
  const { data } = await supabaseClient.from('horarios').select('abierto, hora_apertura, hora_cierre').eq('dia_semana', diaSemana).single();
  let textoHorario = 'Fuera de servicio hoy.';

  if (data) {
    if (data.abierto) { horarioAbierto = true; textoHorario = ''; }
    else if (data.hora_apertura && data.hora_cierre && data.hora_apertura !== data.hora_cierre) {
      const [hA, mA] = data.hora_apertura.split(':').map(Number); const [hC, mC] = data.hora_cierre.split(':').map(Number);
      const apertura = hA + mA / 60; const cierre = hC + mC / 60;
      horarioAbierto = horaActual >= apertura && horaActual < cierre;
      if (!horarioAbierto) textoHorario = `Servicio de ${data.hora_apertura.slice(0,5)} a ${data.hora_cierre.slice(0,5)}.`;
    } else { horarioAbierto = false; }
  } else { horarioAbierto = false; }

  const aviso = document.getElementById('horario-aviso');
  if (!horarioAbierto) { aviso.classList.remove('d-none'); document.getElementById('horario-texto').textContent = textoHorario; }
  else { aviso.classList.add('d-none'); }
}

function agregarAlCarrito(idProducto) {
  const producto = todosProductos.find(p => p.id === idProducto); if (!producto) return;
  const grupo = carrito.find(item => item.id === idProducto && !item.esCombo);
  if (grupo) grupo.cantidad++;
  else carrito.push({ id: producto.id, nombre: producto.nombre, precio: parseFloat(producto.precio), permiteExtras: producto.permite_extras, cantidad: 1, extras: '', esCombo: false });
  actualizarCarrito();
}

async function agregarComboAlCarrito(comboId) {
  const { data: combo } = await supabaseClient.from('combos').select('*').eq('id', comboId).single(); if (!combo) return;
  const { data: items } = await supabaseClient.from('combo_items').select('*, productos(nombre, precio)').eq('combo_id', comboId);
  const totalOriginal = (items || []).reduce((s, i) => s + (parseFloat(i.productos.precio) * i.cantidad), 0);
  let precioFinal = totalOriginal;
  if (combo.tipo_descuento === 'porcentaje') precioFinal = totalOriginal * (1 - combo.valor_descuento / 100);
  else if (combo.tipo_descuento === 'fijo') precioFinal = parseFloat(combo.valor_descuento);

  const comboItem = { id: combo.id, nombre: combo.nombre, precio: precioFinal, permiteExtras: false, cantidad: 1, extras: '', esCombo: true };
  const grupo = carrito.find(item => item.id === combo.id && item.esCombo);
  if (grupo) grupo.cantidad++; else carrito.push(comboItem);
  actualizarCarrito();
}

function cambiarCantidad(index, delta) {
  if (index < 0 || index >= carrito.length) return;
  carrito[index].cantidad += delta;
  if (carrito[index].cantidad <= 0) carrito.splice(index, 1);
  actualizarCarrito();
}

function actualizarCarrito() {
  const lista = document.getElementById('carrito-lista');
  const countBadge = document.getElementById('cart-count');
  const btnCheckout = document.getElementById('btn-checkout');

  if (carrito.length === 0) {
    lista.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-basket3-fill fs-1" style="color: var(--rosa-claro);"></i><p class="mt-3 mb-0 fw-semibold">Tu cesta está vacía</p><small>Añade artículos para tu cuidado 🧼</small></div>`;
  } else {
    lista.innerHTML = carrito.map((item, index) => `
      <div class="list-group-item rounded-4 mb-2 shadow-sm border">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong class="text-truncate pe-2">${item.nombre} ${item.esCombo ? '<small style="color:var(--rosa-principal)">(Kit)</small>' : ''}</strong>
          <span class="fw-bold" style="color: var(--rosa-oscuro);">${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3">
          <div class="stepper d-flex gap-3 align-items-center">
            <button type="button" onclick="cambiarCantidad(${index}, -1)"><i class="bi bi-dash"></i></button>
            <span class="fw-semibold">${item.cantidad}</span>
            <button type="button" onclick="cambiarCantidad(${index}, 1)"><i class="bi bi-plus"></i></button>
          </div>
          <button class="btn btn-sm btn-light rounded-circle text-danger" style="width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="eliminarDelCarrito(${index})"><i class="bi bi-trash3"></i></button>
        </div>
        ${!item.esCombo && item.permiteExtras ? `<input type="text" class="form-control form-control-sm mt-3 rounded-pill" placeholder="Nota/Aroma preferido..." value="${item.extras}" oninput="actualizarExtras(${index}, this.value)">` : ''}
      </div>`).join('');
  }

  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  document.getElementById('subtotal-carrito').textContent = subtotal.toFixed(2);

  const metodoPago = document.getElementById('metodo-pago').value;
  let recargo = (metodoPago === 'transferencia' && recargoTransferencia > 0) ? subtotal * (recargoTransferencia / 100) : 0;
  if (recargo > 0) {
    document.getElementById('recargo-aplicado').textContent = recargo.toFixed(2);
    document.getElementById('recargo-desglose').classList.remove('d-none');
  } else document.getElementById('recargo-desglose').classList.add('d-none');

  const precioEnvio = parseFloat(document.getElementById('reparto-precio').value) || 0;
  if (precioEnvio > 0) {
    document.getElementById('envio-aplicado').textContent = precioEnvio.toFixed(2);
    document.getElementById('envio-desglose').classList.remove('d-none');
  } else document.getElementById('envio-desglose').classList.add('d-none');

  const total = subtotal + recargo + precioEnvio;
  document.getElementById('total-pedido').textContent = total.toFixed(2) + ' CUP';

  const nuevoConteo = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  if (countBadge.textContent !== String(nuevoConteo)) { countBadge.style.transform = 'scale(1.3)'; setTimeout(() => countBadge.style.transform = 'scale(1)', 200); }
  countBadge.textContent = nuevoConteo;

  btnCheckout.disabled = carrito.length === 0 || !document.getElementById('reparto-id').value;
}

function actualizarExtras(index, valor) { if (index >= 0 && index < carrito.length) carrito[index].extras = valor; }
function eliminarDelCarrito(index) { carrito.splice(index, 1); actualizarCarrito(); }

document.getElementById('btn-checkout').addEventListener('click', () => { if (carrito.length > 0) checkoutModalInstance.show(); });

document.getElementById('confirmar-pedido').addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const direccion = document.getElementById('direccion').value.trim();
  const referencia = document.getElementById('referencia').value.trim();

  const errorDiv = document.getElementById('checkout-error');
  if (!nombre || !telefono || !direccion) {
    document.getElementById('error-text').textContent = 'Faltan datos de envío.';
    errorDiv.classList.remove('d-none'); return;
  }
  errorDiv.classList.add('d-none');

  const btnConfirmar = document.getElementById('confirmar-pedido');
  btnConfirmar.disabled = true;
  btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  const metodoPago = document.getElementById('metodo-pago').value;
  const zonaTexto = document.getElementById('reparto-seleccionado-texto').textContent || 'Envío';
  const totalPedido = parseFloat(document.getElementById('total-pedido').textContent);

  const { error: errorPedido } = await supabaseClient.from('pedidos').insert([{
    nombre, telefono, direccion, referencia: referencia || null, metodo_pago: metodoPago,
    zona: zonaTexto, total: totalPedido,
    items: carrito.map(item => ({ nombre: item.nombre, precio: item.precio, cantidad: item.cantidad, extras: item.extras || null, esCombo: item.esCombo || false })),
    estado: 'pendiente'
  }]);

  if (errorPedido) {
    document.getElementById('error-text').textContent = 'Fallo de conexión. Intenta de nuevo.';
    errorDiv.classList.remove('d-none');
    btnConfirmar.disabled = false; btnConfirmar.innerHTML = 'Confirmar <i class="bi bi-check2"></i>';
    return;
  }

  const productosTexto = carrito.map(item => `${item.cantidad}x ${item.nombre}${item.extras ? ' ('+item.extras+')' : ''} — ${(item.precio * item.cantidad).toFixed(2)} CUP`).join('\n');
  const mensajeNtfy = `🧼 NUEVO PEDIDO — Burbuja Aseo\n👤 ${nombre}\n📞 ${telefono}\n📍 ${direccion}${referencia ? '\n📌 Ref: ' + referencia : ''}\n🛵 Entrega: ${zonaTexto}\n💳 Pago: ${metodoPago}\n────────────────\n${productosTexto}\n────────────────\n💰 TOTAL: ${totalPedido.toFixed(2)} CUP`;
  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, { method: 'POST', body: mensajeNtfy }).catch(() => {});

  checkoutModalInstance.hide();
  bootstrap.Offcanvas.getInstance(document.getElementById('carritoOffcanvas'))?.hide();

  setTimeout(() => { new bootstrap.Toast(document.getElementById('toastPedido')).show(); }, 400);

  carrito = []; actualizarCarrito();
  document.getElementById('checkout-form').reset();
  btnConfirmar.disabled = false; btnConfirmar.innerHTML = 'Confirmar <i class="bi bi-check2"></i>';
});
