// API comes from config.js

let currentStoreId = null

function saveToken(token, role, userId) {
    localStorage.setItem("token", token)
    localStorage.setItem("role", role)
    localStorage.setItem("userId", userId)
}

function getToken() { return localStorage.getItem("token") }
function getRole()  { return localStorage.getItem("role") }
function getUserId(){ return localStorage.getItem("userId") }

function logout() {
    localStorage.clear()
    window.location.href = "login.html"
}

function checkAuth(requiredRole) {
    const token = getToken()
    const role  = getRole()
    if (!token) { window.location.href = "login.html"; return; }
    if (requiredRole && role !== requiredRole && requiredRole !== "user") {
        alert("Unauthorized")
        window.location.href = "login.html"
    }
}

// ============= AUTH =============

async function register() {
    try {
        const res = await fetch(`${API}/register`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: username.value,
                email: email.value,
                password: password.value
            })
        })
        if (res.ok) {
            alert("Registered successfully!")
            window.location.href = "login.html"
        } else {
            const data = await res.json()
            alert(data.detail || "Registration failed")
        }
    } catch (err) { alert("Error: " + err.message) }
}

async function login() {
    try {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: username.value,
                password: password.value
            })
        })
        const data = await res.json()
        if (res.ok) {
            saveToken(data.access_token, data.role, data.user_id)
            if (data.role === "admin")
                window.location.href = "admin.html"
            else
                window.location.href = "dashboard.html"
        } else {
            alert(data.detail || "Login failed")
        }
    } catch (err) { alert("Error: " + err.message) }
}

// ============= STORES =============

async function loadStores() {
    const res = await fetch(`${API}/stores`)
    const data = await res.json()

    stores.innerHTML = ""

    if (data.length === 0) {
        stores.innerHTML = "<p class='col-12 text-muted'>No stores yet. Create yours!</p>"
        return
    }

    data.forEach(store => {
        stores.innerHTML += `
        <div class="col-md-4 mb-3">
            <div class="card p-3 h-100">
                <h5>🏪 ${store.name}</h5>
                <p class="text-muted flex-grow-1">${store.description}</p>
                <small class="text-muted mb-2">Owner: ${store.owner_name}</small>
                <a href="store-view.html?store=${store.id}" target="_blank"
                   class="btn btn-primary btn-sm">
                    View Store & Services
                </a>
            </div>
        </div>
        `
    })
}

// Navigate to the store mini-page
function viewStoreServices(storeId) {
    window.location.href = `store-view.html?store=${storeId}`
}

async function loadMyStore() {
    const res = await fetch(`${API}/my-stores`, {
        headers: { "Authorization": "Bearer " + getToken() }
    })
    const data = await res.json()

    if (data.length === 0) {
        document.getElementById("createStoreSection").style.display = "block"
        document.getElementById("storeInfoSection").style.display   = "none"
    } else {
        currentStoreId = data[0].id
        localStorage.setItem('currentStoreId', currentStoreId)
        document.getElementById("createStoreSection").style.display = "none"
        document.getElementById("storeInfoSection").style.display   = "block"
        document.getElementById("storeTitle").innerText       = data[0].name
        document.getElementById("storeDescription").innerText = data[0].description
        loadMyServices()
        loadStoreOrders()
    }
}

function generateTableQRs() {
    window.location.href = 'table-qr.html'
}

async function createStore() {
    await fetch(`${API}/stores`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({
            name: storeName.value,
            description: storeDesc.value
        })
    })
    alert("Store created!")
    location.reload()
}

// ============= SERVICES =============

async function loadAllServices() {
    const res = await fetch(`${API}/services`)
    const data = await res.json()

    services.innerHTML = ""

    if (data.length === 0) {
        services.innerHTML = "<p class='col-12 text-muted'>No services available yet.</p>"
        return
    }

    data.forEach(s => {
        const imgHtml = s.image_url
            ? `<img src="${s.image_url}" style="width:100%;height:160px;object-fit:cover;border-radius:8px;" class="mb-2">`
            : ""
        services.innerHTML += `
        <div class="col-md-4 mb-3">
            <div class="card p-3 h-100">
                ${imgHtml}
                <h5>${s.name}</h5>
                <p>${s.description}</p>
                <p><strong>€${s.price}</strong></p>
                <small class="text-muted">from: ${s.store_name}</small>
                <a href="store-view.html?store=${s.store_id}" class="btn btn-outline-primary btn-sm mt-2">
                    View Store
                </a>
            </div>
        </div>
        `
    })
}

async function loadMyServices() {
    const res = await fetch(`${API}/stores/${currentStoreId}/services`)
    const data = await res.json()

    myServices.innerHTML = ""

    if (data.length === 0) {
        myServices.innerHTML = "<p class='col-12 text-muted'>No services yet. Add your first one!</p>"
        return
    }

    data.forEach(s => {
        const imgHtml = s.image_url
            ? `<img src="${s.image_url}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;">`
            : ""
        myServices.innerHTML += `
        <div class="col-md-4 mb-3">
            <div class="card h-100">
                ${imgHtml}
                <div class="card-body">
                    <h5>${s.name}</h5>
                    <p>${s.description}</p>
                    <p><strong>€${s.price}</strong></p>
                </div>
            </div>
        </div>
        `
    })
}

async function addService() {
    // uploadedUrls.product is set in my-store.html inline script
    const imageUrl = (typeof uploadedUrls !== "undefined" && uploadedUrls.product) || null

    await fetch(`${API}/stores/${currentStoreId}/services`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({
            name:        serviceName.value,
            description: serviceDesc.value,
            price:       parseInt(servicePrice.value),
            image_url:   imageUrl
        })
    })

    alert("Service added!")
    serviceName.value  = ""
    serviceDesc.value  = ""
    servicePrice.value = ""

    // Reset product image state
    if (typeof uploadedUrls !== "undefined") uploadedUrls.product = null
    const pp = document.getElementById("productPreview")
    const ph = document.getElementById("productImgPlaceholder")
    if (pp) { pp.style.display = "none"; pp.src = "" }
    if (ph) ph.style.display = "block"

    loadMyServices()
}

// ============= ORDERS =============

async function createOrder(serviceId) {
    await fetch(`${API}/orders`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({ service_id: serviceId })
    })
    alert("Order placed successfully!")
    loadMyOrders()
}

async function loadMyOrders() {
    const res = await fetch(`${API}/orders`, {
        headers: { "Authorization": "Bearer " + getToken() }
    })
    const data = await res.json()
    orders.innerHTML = ""

    if (data.length === 0) {
        orders.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>No orders yet</td></tr>"
        return
    }

    data.forEach(o => {
        orders.innerHTML += `
        <tr>
            <td>${o.id.substring(0, 8)}…</td>
            <td>${o.store_name}</td>
            <td>${o.service_name}</td>
            <td>€${o.price}</td>
            <td><span class="badge bg-${o.status === 'Completed' ? 'success' : 'warning'}">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
        `
    })
}

async function loadStoreOrders() {
    const res = await fetch(`${API}/store-orders/${currentStoreId}`, {
        headers: { "Authorization": "Bearer " + getToken() }
    })
    const data = await res.json()
    storeOrders.innerHTML = ""

    if (data.length === 0) {
        storeOrders.innerHTML = "<tr><td colspan='11' class='text-center text-muted'>No orders yet</td></tr>"
        return
    }

    data.forEach(o => {
        const icon = o.order_type === 'dine-in' ? '🍽' : '🚗'
        const loc  = o.order_type === 'dine-in'
            ? `Table ${o.table_number}`
            : (o.delivery_address ? o.delivery_address.substring(0, 30) + '…' : 'N/A')

        storeOrders.innerHTML += `
        <tr>
            <td>${o.id.substring(0, 8)}…</td>
            <td>${icon} ${o.order_type}</td>
            <td>${loc}</td>
            <td>${o.customer_name}</td>
            <td>${o.customer_phone || 'N/A'}</td>
            <td>${o.service_name}</td>
            <td>${o.quantity}</td>
            <td>€${o.price * o.quantity}</td>
            <td><span class="badge bg-${o.status === 'Completed' ? 'success' : 'warning'}">${o.status}</span></td>
            <td>${o.notes ? '<small>' + o.notes + '</small>' : '–'}</td>
            <td>
                ${o.status !== 'Completed'
                    ? `<button onclick="updateOrderStatus('${o.id}', 'Completed')"
                           class="btn btn-success btn-sm">Complete</button>`
                    : 'Done ✓'}
            </td>
        </tr>
        `
    })
}

async function updateOrderStatus(orderId, status) {
    await fetch(`${API}/orders/${orderId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({ status })
    })
    alert("Order updated!")
    loadStoreOrders()
}

// ============= ADMIN =============

async function loadAllOrders() {
    const res = await fetch(`${API}/admin/orders`, {
        headers: { "Authorization": "Bearer " + getToken() }
    })
    const data = await res.json()
    adminOrders.innerHTML = ""

    data.forEach(o => {
        adminOrders.innerHTML += `
        <tr>
            <td>${o.id.substring(0, 8)}…</td>
            <td>${o.customer_name}</td>
            <td>${o.store_name}</td>
            <td>${o.service_name}</td>
            <td>${o.status}</td>
        </tr>
        `
    })
}
