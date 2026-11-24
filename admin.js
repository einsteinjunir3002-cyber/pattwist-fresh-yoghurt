/**
 * Pattwist Admin Dashboard Operations JavaScript
 * Includes Protected Authentication & Mobile Photo Upload Support
 */

let allOrders = [];
let allProducts = [];

// -------------------------------------------------------------
// 1. AUTHENTICATION & SESSION MANAGEMENT
// -------------------------------------------------------------
function getAdminToken() {
  return sessionStorage.getItem('pattwist_admin_token') || localStorage.getItem('pattwist_admin_token');
}

function getAuthHeaders() {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
});

async function checkAdminAuth() {
  const token = getAdminToken();
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboard = document.getElementById('admin-dashboard-container');

  if (!token) {
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/admin/verify-token', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.valid) {
      unlockDashboard();
    } else {
      handleAdminLogout();
    }
  } catch (err) {
    // If offline or network error, verify locally or show login
    unlockDashboard();
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const username = document.getElementById('admin-user-input').value.trim();
  const password = document.getElementById('admin-pass-input').value.trim();
  const btn = document.getElementById('login-submit-btn');
  const errorAlert = document.getElementById('login-error-alert');
  const errorText = document.getElementById('login-error-text');

  errorAlert.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = `Verifying credentials...`;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success && data.token) {
      sessionStorage.setItem('pattwist_admin_token', data.token);
      localStorage.setItem('pattwist_admin_token', data.token);
      sessionStorage.setItem('pattwist_admin_user', data.username);
      unlockDashboard(data.username);
    } else {
      errorAlert.classList.remove('hidden');
      errorText.textContent = data.error || 'Invalid username or password.';
    }
  } catch (err) {
    errorAlert.classList.remove('hidden');
    errorText.textContent = 'Connection error. Please try again.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-rose-400"></i><span>Access Admin Operations</span>`;
    lucide.createIcons();
  }
}

function unlockDashboard(username) {
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboard = document.getElementById('admin-dashboard-container');
  const activeUser = username || sessionStorage.getItem('pattwist_admin_user') || 'Pattwist_Ekura_Nkwan';

  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  document.getElementById('active-admin-name').textContent = activeUser;

  loadAllData();
  lucide.createIcons();
}

function handleAdminLogout() {
  sessionStorage.removeItem('pattwist_admin_token');
  localStorage.removeItem('pattwist_admin_token');
  sessionStorage.removeItem('pattwist_admin_user');

  document.getElementById('admin-dashboard-container').classList.add('hidden');
  document.getElementById('admin-login-screen').classList.remove('hidden');
  document.getElementById('admin-user-input').value = '';
  document.getElementById('admin-pass-input').value = '';
}

function togglePasswordVisibility() {
  const passInput = document.getElementById('admin-pass-input');
  const eyeIcon = document.getElementById('pass-eye-icon');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.setAttribute('data-lucide', 'eye-off');
  } else {
    passInput.type = 'password';
    eyeIcon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

function loadAllData() {
  loadAnalytics();
  loadOrders();
  loadProducts();
  loadInquiriesAndReviews();
}

// -------------------------------------------------------------
// 2. ANALYTICS & STATS
// -------------------------------------------------------------
async function loadAnalytics() {
  try {
    const res = await fetch('/api/admin/analytics', { headers: getAuthHeaders() });
    if (res.status === 401) return handleAdminLogout();
    const data = await res.json();
    if (data.success) {
      const a = data.analytics;
      document.getElementById('stat-revenue').textContent = `GH₵ ${parseFloat(a.total_revenue).toFixed(2)}`;
      document.getElementById('stat-orders').textContent = a.total_orders;
      document.getElementById('stat-pending').textContent = a.pending_orders;
      document.getElementById('stat-products').textContent = a.active_products;
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

// -------------------------------------------------------------
// 3. ORDERS MANAGEMENT
// -------------------------------------------------------------
async function loadOrders() {
  const tbody = document.getElementById('orders-table-body');
  const filter = document.getElementById('order-status-filter').value;
  const search = document.getElementById('order-search').value.trim();

  try {
    let url = `/api/admin/orders?status=${encodeURIComponent(filter)}`;
    if (search) url += `&q=${encodeURIComponent(search)}`;

    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.status === 401) return handleAdminLogout();
    const data = await res.json();

    if (!data.success || !data.orders || data.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-slate-400">
            No orders found. Tap <strong>"Sample Order"</strong> above to generate test orders!
          </td>
        </tr>
      `;
      return;
    }

    allOrders = data.orders;

    tbody.innerHTML = allOrders.map(order => {
      const itemsText = order.items ? order.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ') : 'No items';
      const formattedDate = new Date(order.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      const cleanPhone = order.customer_phone.replace(/\D/g, '');
      const intlPhone = cleanPhone.startsWith('0') ? '233' + cleanPhone.slice(1) : cleanPhone;
      const waMsg = `Hello ${order.customer_name}! This is Pattwist Fresh Yoghurt regarding your order #${order.order_code}.`;
      const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(waMsg)}`;

      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-4 font-mono font-bold text-rose-600">
            #${order.order_code}
          </td>
          <td class="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
            ${formattedDate}
          </td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${order.customer_name}</div>
            <div class="text-[11px] text-slate-500">${order.customer_phone}</div>
          </td>
          <td class="py-3 px-4 text-slate-600 max-w-[140px] truncate" title="${order.customer_location || 'Not provided'}">
            ${order.customer_location || '<span class="text-slate-400">Not specified</span>'}
          </td>
          <td class="py-3 px-4 max-w-[200px] truncate text-slate-600" title="${itemsText}">
            ${itemsText}
          </td>
          <td class="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
            GH₵ ${parseFloat(order.total_amount).toFixed(2)}
          </td>
          <td class="py-3 px-4">
            <select 
              onchange="updateOrderStatus(${order.id}, this.value)"
              class="text-xs p-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer ${getStatusSelectColor(order.order_status)}">
              <option value="Received" ${order.order_status === 'Received' ? 'selected' : ''}>Received</option>
              <option value="Preparing" ${order.order_status === 'Preparing' ? 'selected' : ''}>Preparing</option>
              <option value="Out for Delivery" ${order.order_status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
              <option value="Delivered" ${order.order_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.order_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
            <a href="${waUrl}" target="_blank" title="Chat with Customer on WhatsApp" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px]">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
              <span>WhatsApp</span>
            </a>
            <a href="/track?code=${order.order_code}" target="_blank" title="View Customer Tracking View" class="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px]">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load orders:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-rose-500">Failed to load orders: ${err.message}</td></tr>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ order_status: newStatus })
    });
    if (res.status === 401) return handleAdminLogout();
    const data = await res.json();
    if (data.success) {
      loadAnalytics();
      loadOrders();
    } else {
      alert(`Error updating status: ${data.error}`);
    }
  } catch (err) {
    console.error('Status update failed:', err);
  }
}

function getStatusSelectColor(status) {
  switch (status) {
    case 'Received': return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'Preparing': return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'Out for Delivery': return 'bg-purple-50 text-purple-900 border-purple-200';
    case 'Delivered': return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    default: return 'bg-slate-50 text-slate-700';
  }
}

// -------------------------------------------------------------
// 4. PRODUCT CATALOG MANAGEMENT & MOBILE PHOTO UPLOAD
// -------------------------------------------------------------
async function loadProducts() {
  const tbody = document.getElementById('products-table-body');
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      allProducts = data.products;
      tbody.innerHTML = allProducts.map(p => `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-4">
            <img src="${p.image_url}" alt="${p.name}" class="w-12 h-12 object-cover rounded-xl border border-slate-200" />
          </td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${p.name}</div>
            <div class="text-[11px] text-slate-500">${p.sku} | ${p.category}</div>
          </td>
          <td class="py-3 px-4 font-semibold text-slate-700">${p.flavour}</td>
          <td class="py-3 px-4 font-bold text-rose-600">GH₵ ${parseFloat(p.price).toFixed(2)}</td>
          <td class="py-3 px-4 font-semibold text-slate-700">${p.stock} units</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold text-white ${p.badge_color || 'bg-slate-700'}">
              ${p.badge || 'None'}
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1 text-[11px] font-bold ${p.is_active ? 'text-emerald-600' : 'text-slate-400'}">
              <span class="w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
              ${p.is_active ? 'Active' : 'Disabled'}
            </span>
          </td>
          <td class="py-3 px-4 text-right space-x-1">
            <button onclick="editProduct(${p.id})" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]">
              Edit
            </button>
            <button onclick="deleteProduct(${p.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px]">
              Deactivate
            </button>
          </td>
        </tr>
      `).join('');
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

// MOBILE PHOTO UPLOAD & CANVAS OPTIMIZATION
function handleImageFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Downscale phone camera photos (e.g. 12-48 megapixels) to clean web-ready 800x800
      const maxDim = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG data URL (~60KB to ~90KB)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

      // Update Preview
      document.getElementById('image-preview-img').src = compressedDataUrl;
      document.getElementById('image-preview-wrapper').classList.remove('hidden');
      document.getElementById('upload-prompt').classList.add('hidden');

      // Update Form Value
      document.getElementById('prod-image').value = compressedDataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeSelectedImage() {
  document.getElementById('prod-file-input').value = '';
  document.getElementById('prod-image').value = 'assets/images/hero-combo-bottles.jpeg';
  document.getElementById('image-preview-img').src = '';
  document.getElementById('image-preview-wrapper').classList.add('hidden');
  document.getElementById('upload-prompt').classList.remove('hidden');
}

function toggleUrlInput() {
  const el = document.getElementById('url-input-container');
  if (el) el.classList.toggle('hidden');
}

function openNewProductModal() {
  document.getElementById('modal-product-title').textContent = 'Add New Flavour / Product';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-flavour').value = '';
  document.getElementById('prod-price').value = '10';
  document.getElementById('prod-stock').value = '100';
  document.getElementById('prod-badge').value = 'New';
  document.getElementById('prod-tagline').value = '';
  document.getElementById('prod-desc').value = '';
  document.getElementById('prod-image').value = 'assets/images/hero-combo-bottles.jpeg';

  removeSelectedImage();

  const modal = document.getElementById('product-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function editProduct(id) {
  const p = allProducts.find(item => item.id === id);
  if (!p) return;

  document.getElementById('modal-product-title').textContent = 'Edit Product';
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-flavour').value = p.flavour;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-stock').value = p.stock;
  document.getElementById('prod-badge').value = p.badge || '';
  document.getElementById('prod-tagline').value = p.tagline || '';
  document.getElementById('prod-desc').value = p.description || '';
  document.getElementById('prod-image').value = p.image_url || '';

  // Show existing photo in preview
  if (p.image_url) {
    document.getElementById('image-preview-img').src = p.image_url;
    document.getElementById('image-preview-wrapper').classList.remove('hidden');
    document.getElementById('upload-prompt').classList.add('hidden');
  } else {
    removeSelectedImage();
  }

  const modal = document.getElementById('product-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function saveProduct(event) {
  event.preventDefault();
  const id = document.getElementById('prod-id').value;
  const saveBtn = document.getElementById('save-product-btn');

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const payload = {
    name: document.getElementById('prod-name').value,
    flavour: document.getElementById('prod-flavour').value,
    price: parseFloat(document.getElementById('prod-price').value),
    stock: parseInt(document.getElementById('prod-stock').value, 10),
    badge: document.getElementById('prod-badge').value,
    tagline: document.getElementById('prod-tagline').value,
    description: document.getElementById('prod-desc').value,
    image_url: document.getElementById('prod-image').value || 'assets/images/hero-combo-bottles.jpeg'
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/products', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    }

    if (res.status === 401) return handleAdminLogout();

    const data = await res.json();
    if (data.success) {
      closeProductModal();
      loadProducts();
      loadAnalytics();
    } else {
      alert(`Error saving product: ${data.error}`);
    }
  } catch (err) {
    console.error('Failed to save product:', err);
    alert('Network error while saving product.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Product';
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to deactivate this product from the storefront?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.status === 401) return handleAdminLogout();
    const data = await res.json();
    if (data.success) {
      loadProducts();
      loadAnalytics();
    }
  } catch (err) {
    console.error('Failed to deactivate product:', err);
  }
}

// -------------------------------------------------------------
// 5. INQUIRIES & REVIEWS
// -------------------------------------------------------------
async function loadInquiriesAndReviews() {
  try {
    // Inquiries
    const inqRes = await fetch('/api/admin/inquiries', { headers: getAuthHeaders() });
    if (inqRes.status === 401) return handleAdminLogout();
    const inqData = await inqRes.json();
    const inqContainer = document.getElementById('inquiries-container');
    const inqBadge = document.getElementById('inquiry-count-badge');

    if (inqData.success && inqData.inquiries.length > 0) {
      inqBadge.textContent = inqData.inquiries.length;
      inqContainer.innerHTML = inqData.inquiries.map(inq => `
        <div class="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800">${inq.name} (${inq.phone})</span>
            <span class="text-[10px] font-semibold text-slate-400">${new Date(inq.created_at).toLocaleDateString()}</span>
          </div>
          <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">${inq.inquiry_type}</span>
          <p class="text-xs text-slate-600 mt-1">${inq.message}</p>
        </div>
      `).join('');
    } else {
      inqContainer.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No customer inquiries yet.</p>';
    }

    // Reviews
    const revRes = await fetch('/api/reviews');
    const revData = await revRes.json();
    const revContainer = document.getElementById('reviews-container');
    const revBadge = document.getElementById('review-count-badge');

    if (revData.success && revData.reviews.length > 0) {
      revBadge.textContent = revData.reviews.length;
      revContainer.innerHTML = revData.reviews.map(r => `
        <div class="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800">${r.customer_name}</span>
            <span class="text-amber-500 font-bold">★ ${r.rating}/5</span>
          </div>
          <p class="text-xs text-slate-600 italic">"${r.comment}"</p>
          <div class="text-[10px] text-slate-400">${r.location || 'Customer'} • ${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
      `).join('');
    } else {
      revContainer.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No reviews in database.</p>';
    }
  } catch (err) {
    console.error('Failed to load inquiries/reviews:', err);
  }
}

// -------------------------------------------------------------
// 6. SAMPLE ORDER SEEDER (TESTING HELPER)
// -------------------------------------------------------------
async function seedSampleOrder() {
  try {
    const res = await fetch('/api/admin/seed-sample-order', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.status === 401) return handleAdminLogout();
    const data = await res.json();
    if (data.success) {
      loadAllData();
      alert(`Success! Generated sample order #${data.order_code}. It is now saved in the database.`);
    }
  } catch (err) {
    console.error('Sample order failed:', err);
  }
}

// -------------------------------------------------------------
// TAB SWITCHER
// -------------------------------------------------------------
function switchTab(tab) {
  const tabs = ['orders', 'products', 'inquiries'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tab) {
      el.classList.remove('hidden');
      btn.classList.add('border-rose-600', 'text-rose-600');
      btn.classList.remove('border-transparent', 'text-slate-500');
    } else {
      el.classList.add('hidden');
      btn.classList.remove('border-rose-600', 'text-rose-600');
      btn.classList.add('border-transparent', 'text-slate-500');
    }
  });
}
