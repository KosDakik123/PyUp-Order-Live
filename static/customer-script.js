// API comes from config.js

const CATEGORY_META = {
  all:           { label: "All Stores",       icon: "🏠" },
  food:          { label: "Food & Drinks",     icon: "🍕" },
  fashion:       { label: "Fashion",           icon: "👗" },
  services:      { label: "Services",          icon: "💼" },
  beauty:        { label: "Beauty & Wellness", icon: "💄" },
  electronics:   { label: "Electronics",       icon: "📱" },
  home:          { label: "Home & Living",     icon: "🏠" },
  health:        { label: "Health & Fitness",  icon: "💪" },
  groceries:     { label: "Groceries",         icon: "🛒" },
  entertainment: { label: "Entertainment",     icon: "🎮" },
  pets:          { label: "Pets",              icon: "🐾" },
};

// ── State ─────────────────────────────────────────────────────
let ALL_STORES = [];        // master list, fetched once
let activeCategory = "all";
let searchQuery = "";
let debounceTimer = null;

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────
function getToken()    { return localStorage.getItem("customerToken"); }
function getUsername() { return localStorage.getItem("customerName"); }

function initNav() {
  const token   = getToken();
  const actions = document.getElementById("navActions");

  if (token) {
    const name    = getUsername() || "User";
    const initial = name[0].toUpperCase();

    // Show inline search bar, hide the big hero
    const ns = document.getElementById("navSearch");
    if (ns) ns.classList.add("visible");
    const hero = document.getElementById("heroSection");
    if (hero) hero.style.display = "none";

    actions.innerHTML = `
      <div class="user-pill" id="userPill" onclick="toggleDD(event)">
        <div class="user-avatar">${initial}</div>
        <span>${name}</span>
        <span style="font-size:.7rem;opacity:.5;margin-left:2px">▾</span>
        <div class="settings-dropdown" id="settingsDropdown">
          <div class="sd-header">
            <div class="sd-name">${name}</div>
            <div class="sd-role">Customer Account</div>
          </div>
          <button class="di" onclick="stopProp(event);openModal('settingsModal')">
            <span class="dii">⚙️</span> Settings
          </button>
          <button class="di" onclick="stopProp(event);showMyOrders()">
            <span class="dii">📦</span> My Orders
          </button>
          <div class="dd-sep"></div>
          <button class="di red" onclick="stopProp(event);logoutCustomer()">
            <span class="dii">🚪</span> Sign Out
          </button>
        </div>
      </div>`;

    const su = document.getElementById("settingsUser");
    if (su) su.textContent = name;
  }
}

function stopProp(e) { e.stopPropagation(); }
function toggleDD(e) {
  e.stopPropagation();
  document.getElementById("settingsDropdown")?.classList.toggle("open");
}
document.addEventListener("click", () => {
  document.getElementById("settingsDropdown")?.classList.remove("open");
});

function logoutCustomer() {
  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerName");
  location.reload();
}

// ─────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function switchModal(a, b) { closeModal(a); openModal(b); }

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

// Close on backdrop click
document.querySelectorAll(".modal-overlay").forEach(el =>
  el.addEventListener("click", e => { if (e.target === el) el.classList.remove("open"); })
);

// Enter key submits open modal
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (document.getElementById("loginModal")?.classList.contains("open"))    loginCustomer();
  if (document.getElementById("registerModal")?.classList.contains("open")) registerCustomer();
});

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────
async function registerCustomer() {
  const name  = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass  = document.getElementById("regPassword").value;
  if (!name || !email || !pass) return showErr("regError", "Please fill in all fields");
  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, email, password: pass })
    });
    if (res.ok) {
      closeModal("registerModal");
      showToast("✅ Account created! Please sign in.");
      openModal("loginModal");
    } else {
      const d = await res.json();
      showErr("regError", d.detail || "Registration failed");
    }
  } catch { showErr("regError", "⚠️ Cannot connect to server"); }
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
async function loginCustomer() {
  const username = document.getElementById("loginUser").value.trim();
  const pass     = document.getElementById("loginPass").value;
  if (!username || !pass) return showErr("loginError", "Enter your username and password");
  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass })
    });
    if (res.ok) {
      const d = await res.json();
      if (d.role === "admin") return showErr("loginError", "Admin accounts use the admin panel.");
      localStorage.setItem("customerToken", d.access_token);
      localStorage.setItem("customerName", username);
      closeModal("loginModal");
      showToast(`Welcome back, ${username}! 👋`);
      setTimeout(() => location.reload(), 600);
    } else {
      const d = await res.json();
      showErr("loginError", d.detail || "Invalid username or password");
    }
  } catch { showErr("loginError", "⚠️ Cannot connect to server"); }
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ─────────────────────────────────────────────────────────────
// MY ORDERS
// ─────────────────────────────────────────────────────────────
async function showMyOrders() {
  if (!getToken()) { openModal("loginModal"); return; }
  const content = document.getElementById("ordersContent");
  content.innerHTML = `<p style="text-align:center;padding:24px;color:var(--muted)">Loading…</p>`;
  openModal("ordersModal");
  try {
    const res = await fetch(`${API}/orders`, { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) { content.innerHTML = `<p style="color:#e53e3e;padding:12px">Could not load orders.</p>`; return; }
    const orders = await res.json();
    if (!orders.length) {
      content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">
        <div style="font-size:3rem;margin-bottom:12px">📦</div>
        <h3 style="color:var(--text);margin-bottom:6px">No orders yet</h3>
        <p>Browse stores and place your first order!</p></div>`;
      return;
    }
    content.innerHTML = orders.map(o => `
      <div class="order-row">
        <div style="flex:1">
          <div style="font-weight:700;font-size:.9rem">${o.service_name}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">${o.store_name} · €${o.price}</div>
          <div style="font-size:.76rem;color:var(--muted)">${new Date(o.created_at).toLocaleDateString()}</div>
        </div>
        <span class="order-badge ${o.status === 'Completed' ? 'badge-completed' : 'badge-pending'}">${o.status}</span>
      </div>`).join("");
  } catch { content.innerHTML = `<p style="color:#e53e3e;padding:12px">⚠️ Connection error.</p>`; }
}

// ─────────────────────────────────────────────────────────────
// STORES  — fetch ALL once, filter client-side
// ─────────────────────────────────────────────────────────────
function showSkeletons() {
  const grid = document.getElementById("storesGrid");
  if (!grid) return;
  grid.innerHTML = Array(6).fill(`
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line" style="width:70%"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line" style="width:40%;height:8px;margin-top:16px"></div>
      </div>
    </div>`).join("");
}

async function fetchAllStores() {
  showSkeletons();
  try {
    const res = await fetch(`${API}/stores`);   // fetch ALL, no params
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ALL_STORES = await res.json();
    console.log(`✅ Loaded ${ALL_STORES.length} stores from server`);
  } catch (err) {
    console.error("Failed to load stores:", err);
    ALL_STORES = [];
    const grid = document.getElementById("storesGrid");
    if (grid) grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <span class="emoji">⚠️</span>
        <h3>Could not connect to server</h3>
        <p>Make sure the backend is running at <strong>${API}</strong></p>
      </div>`;
    return;
  }
  applyFilters(); // render whatever is currently active
}

// Apply activeCategory + searchQuery to ALL_STORES and render
function applyFilters() {
  let filtered = ALL_STORES;

  // Category filter
  if (activeCategory !== "all") {
    filtered = filtered.filter(s => s.category === activeCategory);
  }

  // Search filter (name OR description, case-insensitive)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(s =>
      (s.name        || "").toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q) ||
      (s.owner_name  || "").toLowerCase().includes(q)
    );
  }

  renderStores(filtered);
}

function renderStores(stores) {
  const grid  = document.getElementById("storesGrid");
  const title = document.getElementById("sectionTitle");
  const count = document.getElementById("sectionCount");
  if (!grid) return;

  // Update title
  const meta = CATEGORY_META[activeCategory] || CATEGORY_META.all;
  title.textContent = searchQuery ? `Results for "${searchQuery}"` : meta.label;
  count.textContent = stores.length
    ? `${stores.length} store${stores.length !== 1 ? "s" : ""}`
    : "";

  if (!stores.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <span class="emoji">🔍</span>
        <h3>${searchQuery ? "No results found" : "No stores in this category"}</h3>
        <p>${searchQuery ? `Nothing matched "${searchQuery}" — try different keywords` : `No ${meta.label} stores yet`}</p>
      </div>`;
    return;
  }

  grid.innerHTML = stores.map(store => {
    const catMeta = CATEGORY_META[store.category] || CATEGORY_META.services;
    const imgHtml = store.banner_image_url
      ? `<div class="store-card-img">
           <img src="${store.banner_image_url}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy">
           <div class="store-cat-badge">${catMeta.icon} ${catMeta.label}</div>
         </div>`
      : `<div class="store-card-img-placeholder cat-${store.category || "services"}">
           <span>${catMeta.icon}</span>
           <div class="store-cat-badge">${catMeta.label}</div>
         </div>`;

    return `
      <a href="store-view.html?store=${store.id}" class="store-card">
        ${imgHtml}
        <div class="store-card-body">
          <div class="store-card-name">${store.name}</div>
          <div class="store-card-desc">${store.description || "Browse our selection"}</div>
          <div class="store-card-footer">
            <span class="store-card-owner">by ${store.owner_name}</span>
            <button class="store-open-btn"
              onclick="event.preventDefault();window.location.href='store-view.html?store=${store.id}'">
              Open →
            </button>
          </div>
        </div>
      </a>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────
// CATEGORY FILTER  (client-side, instant)
// ─────────────────────────────────────────────────────────────
function filterCategory(cat) {
  activeCategory = cat;
  // Update pill highlight
  document.querySelectorAll(".cat-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.cat === cat)
  );
  applyFilters();
}

// ─────────────────────────────────────────────────────────────
// SEARCH  (client-side, debounced 200 ms)
// ─────────────────────────────────────────────────────────────
function handleSearch(val) {
  searchQuery = val.trim();
  // Keep both inputs in sync
  ["searchHero", "searchInline"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== searchQuery) el.value = searchQuery;
  });
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 200);
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
function init() {
  initNav();
  fetchAllStores();   // single network call, then all filtering is local
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
