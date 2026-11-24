/**
 * Pattwist Fresh Yoghurt - Interactive Client & Backend API Integration
 */

const BUSINESS_CONFIG = {
  name: "Pattwist Fresh Yoghurt",
  phoneCall: "0504875191",
  phoneWhatsApp: "0578330745",
  whatsappInternational: "233578330745",
  currency: "GH₵"
};

let PRODUCTS = [];
let cart = [];

// Initialize Store
document.addEventListener("DOMContentLoaded", () => {
  fetchSettings();
  fetchProducts();
  fetchReviews();
  initCart();

  // Backdrop click closes cart
  const backdrop = document.getElementById("cart-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeCart);
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
});

// Fetch Settings from Backend
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      if (data.settings.phone_call) BUSINESS_CONFIG.phoneCall = data.settings.phone_call;
      if (data.settings.phone_whatsapp) BUSINESS_CONFIG.phoneWhatsApp = data.settings.phone_whatsapp;
      if (data.settings.whatsapp_international) BUSINESS_CONFIG.whatsappInternational = data.settings.whatsapp_international;
    }
  } catch (e) {
    console.warn("Using default business settings:", e);
  }
}

// Fetch Products from Backend Database
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success && data.products && data.products.length > 0) {
      PRODUCTS = data.products;
      renderProductsGrid();
    }
  } catch (err) {
    console.warn("Failed to fetch products from API, keeping static fallback:", err);
  }
}

// Render Products Grid Dynamically
function renderProductsGrid() {
  const container = document.getElementById("dynamic-products-grid");
  if (!container || PRODUCTS.length === 0) return;

  container.innerHTML = PRODUCTS.map(p => `
    <div class="glass-card rounded-3xl overflow-hidden card-shadow card-shadow-hover flex flex-col border border-slate-100 group">
      <!-- Card Image -->
      <div class="relative aspect-[4/4] overflow-hidden bg-slate-50">
        <img 
          src="${p.image_url || 'assets/images/hero-combo-bottles.jpeg'}" 
          alt="${p.name}" 
          class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
        ${p.badge ? `
          <span class="absolute top-4 left-4 ${p.badge_color || 'bg-rose-500'} text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-md">
            ${p.badge}
          </span>
        ` : ''}
        <div class="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-md text-right border border-slate-100">
          <span class="text-[10px] text-slate-500 block leading-tight font-bold uppercase">Price</span>
          <span class="text-lg font-black text-rose-600 leading-tight">${BUSINESS_CONFIG.currency} ${parseFloat(p.price).toFixed(2)}</span>
        </div>
      </div>

      <!-- Card Body -->
      <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-rose-600 uppercase tracking-wider">${p.flavour}</span>
            <span class="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${p.stock > 0 ? `${p.stock} In Stock` : 'Pre-order'}
            </span>
          </div>
          <h3 class="text-xl font-black text-slate-900 mt-1">${p.name}</h3>
          <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            ${p.description || p.tagline}
          </p>

          <div class="flex flex-wrap gap-1.5 mt-4">
            <span class="text-[11px] font-semibold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg">100% Fresh Dairy</span>
            <span class="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">Chilled Quality</span>
            <span class="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg">Active Cultures</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="pt-4 border-t border-slate-100 space-y-2">
          <button 
            onclick="addToCart(${p.id}, 1)" 
            class="w-full py-3 px-4 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all active:scale-95">
            <i data-lucide="shopping-bag" class="w-4 h-4"></i>
            <span>Add to Cart (${BUSINESS_CONFIG.currency} ${p.price})</span>
          </button>
          
          <button 
            onclick="quickOrderWhatsApp(${p.id})" 
            class="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-2 transition-colors">
            <i data-lucide="message-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>Instant WhatsApp Order</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

// -------------------------------------------------------------
// CART SYSTEM
// -------------------------------------------------------------
function initCart() {
  try {
    const saved = localStorage.getItem("pattwist_cart");
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }
  updateCartUI();
}

function saveCart() {
  try {
    localStorage.setItem("pattwist_cart", JSON.stringify(cart));
  } catch (e) {
    console.error(e);
  }
  updateCartUI();
}

function addToCart(productId, quantity = 1) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url,
      quantity: quantity
    });
  }

  saveCart();
  showToast(`Added ${quantity}x ${product.name} to cart! 🍓🥛`);
  openCart();
}

function updateQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }
  saveCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

function getCartSummary() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return { totalItems, totalPrice };
}

function updateCartUI() {
  const { totalItems, totalPrice } = getCartSummary();
  
  const badges = document.querySelectorAll(".cart-count-badge");
  badges.forEach(b => {
    b.textContent = totalItems;
    if (totalItems > 0) b.classList.remove("hidden");
    else b.classList.add("hidden");
  });

  const cartItemsContainer = document.getElementById("cart-items-container");
  const cartEmptyState = document.getElementById("cart-empty-state");
  const cartFooter = document.getElementById("cart-footer");
  const cartSubtotalEl = document.getElementById("cart-subtotal");
  const cartTotalEl = document.getElementById("cart-total");

  if (!cartItemsContainer) return;

  if (cart.length === 0) {
    cartEmptyState.classList.remove("hidden");
    cartItemsContainer.classList.add("hidden");
    cartFooter.classList.add("hidden");
  } else {
    cartEmptyState.classList.add("hidden");
    cartItemsContainer.classList.remove("hidden");
    cartFooter.classList.remove("hidden");

    cartSubtotalEl.textContent = `${BUSINESS_CONFIG.currency} ${totalPrice.toFixed(2)}`;
    cartTotalEl.textContent = `${BUSINESS_CONFIG.currency} ${totalPrice.toFixed(2)}`;

    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
        <img src="${item.image || 'assets/images/hero-combo-bottles.jpeg'}" alt="${item.name}" class="w-14 h-14 object-cover rounded-lg border border-slate-100" />
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-slate-800 truncate">${item.name}</h4>
          <p class="text-xs text-rose-600 font-bold mt-0.5">${BUSINESS_CONFIG.currency} ${item.price} each</p>
          <div class="flex items-center gap-2 mt-2">
            <div class="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <button onclick="updateQuantity(${item.id}, -1)" class="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold text-xs">-</button>
              <span class="w-6 text-center text-xs font-semibold text-slate-800">${item.quantity}</span>
              <button onclick="updateQuantity(${item.id}, 1)" class="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold text-xs">+</button>
            </div>
            <span class="text-xs font-bold text-slate-700 ml-auto">
              ${BUSINESS_CONFIG.currency} ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        </div>
        <button onclick="removeFromCart(${item.id})" title="Remove" class="text-slate-400 hover:text-rose-500 p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join("");

    lucide.createIcons();
  }
}

function openCart() {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-backdrop");
  const panel = document.getElementById("cart-panel");
  if (!drawer) return;

  drawer.classList.remove("pointer-events-none");
  backdrop.classList.remove("opacity-0");
  backdrop.classList.add("opacity-100");
  panel.classList.remove("translate-x-full");
  panel.classList.add("translate-x-0");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-backdrop");
  const panel = document.getElementById("cart-panel");
  if (!drawer) return;

  backdrop.classList.remove("opacity-100");
  backdrop.classList.add("opacity-0");
  panel.classList.remove("translate-x-0");
  panel.classList.add("translate-x-full");
  drawer.classList.add("pointer-events-none");
  document.body.style.overflow = "";
}

// -------------------------------------------------------------
// CHECKOUT TO DATABASE & WHATSAPP
// -------------------------------------------------------------
async function processOrderCheckout() {
  if (cart.length === 0) {
    showToast("Please add at least one yogurt bottle to cart!");
    return;
  }

  const nameInput = document.getElementById("customer-name");
  const phoneInput = document.getElementById("customer-phone");
  const locationInput = document.getElementById("customer-location");
  const noteInput = document.getElementById("customer-note");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const location = locationInput ? locationInput.value.trim() : "";
  const note = noteInput ? noteInput.value.trim() : "";

  if (!name || !phone) {
    showToast("Please provide your Name and Phone Number to order!");
    if (!name && nameInput) nameInput.focus();
    else if (!phone && phoneInput) phoneInput.focus();
    return;
  }

  const payload = {
    customer_name: name,
    customer_phone: phone,
    customer_location: location,
    order_note: note,
    payment_method: "Cash/MoMo on Delivery",
    items: cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity
    }))
  };

  const btn = document.getElementById("checkout-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Processing Order...`;
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      alert(`Order submission error: ${data.error}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="message-circle" class="w-5 h-5"></i><span>Place Order via WhatsApp</span>`;
        lucide.createIcons();
      }
      return;
    }

    // Save order code in localStorage for easy customer tracking
    localStorage.setItem('pattwist_last_order', data.order_code);

    // Clear cart
    clearCart();
    closeCart();

    // Show Order Success Modal
    showOrderSuccessModal(data);

  } catch (err) {
    console.error("Order failed:", err);
    alert("Network error processing order. Please call 0504875191 directly.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="message-circle" class="w-5 h-5"></i><span>Place Order via WhatsApp</span>`;
      lucide.createIcons();
    }
  }
}

function showOrderSuccessModal(orderData) {
  const modal = document.getElementById("order-success-modal");
  if (!modal) {
    // If modal element doesn't exist, open WhatsApp directly
    window.open(orderData.whatsapp_url, '_blank');
    return;
  }

  document.getElementById("success-order-code").textContent = `#${orderData.order_code}`;
  document.getElementById("success-order-total").textContent = `${BUSINESS_CONFIG.currency} ${parseFloat(orderData.total_amount).toFixed(2)}`;

  const trackBtn = document.getElementById("success-track-btn");
  if (trackBtn) {
    trackBtn.href = `/track?code=${orderData.order_code}`;
  }

  const waBtn = document.getElementById("success-whatsapp-btn");
  if (waBtn) {
    waBtn.href = orderData.whatsapp_url;
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  lucide.createIcons();
}

function closeOrderSuccessModal() {
  const modal = document.getElementById("order-success-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

// Quick 1-click WhatsApp Order
function quickOrderWhatsApp(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  let message = `Hello Pattwist Fresh Yoghurt! 👋\n\nI want to order:\n• *1x ${product.name}* (${BUSINESS_CONFIG.currency} ${product.price})\n\nPlease let me know availability and delivery to my location. Thank you!`;
  const encodedUrl = `https://wa.me/${BUSINESS_CONFIG.whatsappInternational}?text=${encodeURIComponent(message)}`;
  window.open(encodedUrl, "_blank");
}

function triggerCall() {
  window.location.href = `tel:${BUSINESS_CONFIG.phoneCall}`;
}

// -------------------------------------------------------------
// REVIEWS & RATINGS SYSTEM
// -------------------------------------------------------------
async function fetchReviews() {
  try {
    const res = await fetch('/api/reviews');
    const data = await res.json();
    if (data.success && data.reviews && data.reviews.length > 0) {
      renderReviews(data.reviews);
    }
  } catch (err) {
    console.warn("Reviews load fallback:", err);
  }
}

function renderReviews(reviews) {
  const container = document.getElementById("dynamic-reviews-container");
  if (!container) return;

  container.innerHTML = reviews.map(r => `
    <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div class="space-y-3">
        <div class="flex text-amber-400 gap-1">
          ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
        </div>
        <p class="text-xs sm:text-sm text-slate-700 italic leading-relaxed">
          "${r.comment}"
        </p>
      </div>
      <div class="pt-4 border-t border-slate-100 flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-xs">
          ${r.customer_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p class="text-xs font-bold text-slate-900">${r.customer_name}</p>
          <p class="text-[11px] text-slate-500">${r.location || 'Verified Buyer'}</p>
        </div>
      </div>
    </div>
  `).join('');
}

async function submitReview(event) {
  event.preventDefault();
  const name = document.getElementById("rev-name").value;
  const location = document.getElementById("rev-location").value;
  const rating = document.getElementById("rev-rating").value;
  const comment = document.getElementById("rev-comment").value;

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, location, rating, comment })
    });
    const data = await res.json();
    if (data.success) {
      alert("Thank you for your review! It has been recorded into the database.");
      closeReviewModal();
      fetchReviews();
    }
  } catch (e) {
    alert("Error submitting review: " + e.message);
  }
}

function openReviewModal() {
  const modal = document.getElementById("review-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function closeReviewModal() {
  const modal = document.getElementById("review-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

// -------------------------------------------------------------
// INQUIRY FORM (BULK / EVENT ORDERS)
// -------------------------------------------------------------
async function submitInquiry(event) {
  event.preventDefault();
  const name = document.getElementById("inq-name").value;
  const phone = document.getElementById("inq-phone").value;
  const type = document.getElementById("inq-type").value;
  const message = document.getElementById("inq-message").value;

  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, inquiry_type: type, message })
    });
    const data = await res.json();
    if (data.success) {
      alert("Thank you! Your inquiry has been sent to the Pattwist team. We will call you back shortly.");
      document.getElementById("inquiry-form").reset();
    }
  } catch (err) {
    alert("Error sending message: " + err.message);
  }
}

// Toast
function showToast(message) {
  const toast = document.getElementById("toast-notification");
  const toastMessage = document.getElementById("toast-message");
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.classList.remove("translate-y-24", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-24", "opacity-0");
  }, 3200);
}
