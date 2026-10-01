// API comes from config.js

async function loadAdminDashboard() {
    var allTbody = document.getElementById("allOrdersTable")
    if (allTbody) allTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Loading orders…</td></tr>'
    await loadStats()
    await loadAnalytics()
    await loadAllOrdersAdmin()
}

async function loadAnalytics() {
    try {
        const res = await fetch(`${API}/admin/analytics`, {
            headers: { "Authorization": "Bearer " + getToken() }
        })
        if (!res.ok) return
        const data = await res.json()

        document.getElementById("analyticsTotalRevenue").textContent = "€" + (data.total_revenue ?? 0).toFixed(2)
        document.getElementById("analyticsThisMonth").textContent = "€" + (data.revenue_this_month ?? 0).toFixed(2)
        document.getElementById("analyticsThisMonthOrders").textContent = (data.orders_this_month ?? 0) + " orders"
        document.getElementById("analyticsLastMonth").textContent = "€" + (data.revenue_last_month ?? 0).toFixed(2)
        document.getElementById("analyticsLastMonthOrders").textContent = (data.orders_last_month ?? 0) + " orders"

        const byMonth = data.by_month || []
        const byStore = data.by_store || []

        const maxMonthRev = byMonth.length ? Math.max(...byMonth.map(m => m.revenue)) : 1
        const maxStoreRev = byStore.length ? Math.max(...byStore.map(s => s.revenue)) : 1

        const monthChartEl = document.getElementById("analyticsByMonthChart")
        monthChartEl.innerHTML = byMonth.slice(0, 12).map(m => {
            const pct = maxMonthRev ? (100 * m.revenue / maxMonthRev) : 0
            return `<div class="d-flex align-items-center mb-2">
                <span class="text-nowrap me-2" style="width:72px">${m.month}</span>
                <div class="flex-grow-1" style="height:24px;background:#e9ecef;border-radius:6px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#0d6efd,#0a58ca);border-radius:6px;transition:width .4s"></div>
                </div>
                <span class="ms-2 fw-bold" style="min-width:70px;text-align:right">€${m.revenue.toFixed(2)}</span>
            </div>`
        }).join("") || '<p class="text-muted mb-0">No data yet</p>'

        const storeChartEl = document.getElementById("analyticsByStoreChart")
        storeChartEl.innerHTML = byStore.map(s => {
            const pct = maxStoreRev ? (100 * s.revenue / maxStoreRev) : 0
            const name = (s.store_name || "Unknown").length > 20 ? (s.store_name || "Unknown").slice(0, 18) + "…" : (s.store_name || "Unknown")
            return `<div class="d-flex align-items-center mb-2">
                <span class="text-truncate me-2" style="max-width:120px" title="${s.store_name || ""}">${name}</span>
                <div class="flex-grow-1" style="height:24px;background:#e9ecef;border-radius:6px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#198754,#146c43);border-radius:6px;transition:width .4s"></div>
                </div>
                <span class="ms-2 fw-bold" style="min-width:70px;text-align:right">€${s.revenue.toFixed(2)}</span>
            </div>`
        }).join("") || '<p class="text-muted mb-0">No data yet</p>'

        const monthTable = document.getElementById("analyticsByMonthTable")
        monthTable.innerHTML = byMonth.map(m => `
            <tr>
                <td>${m.month}</td>
                <td class="text-end">€${m.revenue.toFixed(2)}</td>
                <td class="text-end">${m.order_count}</td>
            </tr>
        `).join("") || '<tr><td colspan="3" class="text-center text-muted">No data</td></tr>'

        const storeTable = document.getElementById("analyticsByStoreTable")
        storeTable.innerHTML = byStore.map(s => `
            <tr>
                <td>${s.store_name || "—"}</td>
                <td class="text-end">€${s.revenue.toFixed(2)}</td>
                <td class="text-end">${s.order_count}</td>
            </tr>
        `).join("") || '<tr><td colspan="3" class="text-center text-muted">No data</td></tr>'
    } catch (err) {
        console.error("Error loading analytics:", err)
    }
}

async function loadStats() {
    try {
        // Load stores count
        const storesRes = await fetch(`${API}/stores`)
        const stores = await storesRes.json()
        document.getElementById("totalStores").innerText = stores.length

        // Load services count
        const servicesRes = await fetch(`${API}/services`)
        const services = await servicesRes.json()
        document.getElementById("totalServices").innerText = services.length

        // Load orders and calculate stats
        const ordersRes = await fetch(`${API}/admin/orders`, {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        })
        const orders = await ordersRes.json()
        
        const pendingCount = orders.filter(o => o.status === "Pending").length
        
        document.getElementById("totalOrders").innerText = orders.length
        document.getElementById("pendingOrders").innerText = pendingCount

    } catch (err) {
        console.error("Error loading stats:", err)
    }
}

async function loadAllOrdersAdmin() {
    try {
        const res = await fetch(`${API}/admin/orders`, {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        })

        const orders = await res.json()

        // Separate orders by status
        const allOrders = orders
        const pendingOrders = orders.filter(o => o.status === "Pending")
        const completedOrders = orders.filter(o => o.status === "Completed")

        // Update counts
        document.getElementById("countAll").innerText = allOrders.length
        document.getElementById("countPending").innerText = pendingOrders.length
        document.getElementById("countCompleted").innerText = completedOrders.length

        // Render tables
        renderOrderTable("allOrdersTable", allOrders, true)
        renderOrderTable("pendingOrdersTable", pendingOrders, true)
        renderOrderTable("completedOrdersTable", completedOrders, false)

    } catch (err) {
        console.error("Error loading orders:", err)
    }
}

function renderOrderTable(tableId, orders, showActions) {
    const tbody = document.getElementById(tableId)
    tbody.innerHTML = ""

    if (orders.length === 0) {
        const colspan = showActions ? 8 : 6
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center py-5">
                    <div class="text-muted">📦</div>
                    <div class="fw-bold mt-2">No orders in this category</div>
                    <div class="small text-muted mt-1">Orders will appear here when customers place them.</div>
                </td>
            </tr>
        `
        return
    }

    orders.forEach(order => {
        const statusBadge = order.status === "Completed"
            ? '<span class="badge bg-success">Completed ✓</span>'
            : '<span class="badge bg-warning text-dark">Pending</span>'

        const actionButton = order.status === "Pending"
            ? `<button onclick="completeOrder('${order.id}')" class="btn btn-success btn-sm">
                   Mark Complete
               </button>`
            : '<span class="text-success">Completed ✓</span>'

        let row = `
            <tr>
                <td>${order.id.substring(0, 8)}...</td>
                <td><strong>${order.customer_name}</strong></td>
                <td>${order.store_name}</td>
                <td>${order.service_name}</td>
        `

        if (tableId === "allOrdersTable") {
            row += `
                <td>€${order.price || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${new Date(order.created_at || Date.now()).toLocaleDateString()}</td>
            `
        } else {
            row += `
                <td>€${order.price || 'N/A'}</td>
                <td>${new Date(order.created_at || Date.now()).toLocaleDateString()}</td>
            `
        }

        if (showActions) {
            row += `<td>${actionButton}</td>`
        }

        row += `</tr>`
        tbody.innerHTML += row
    })
}

async function completeOrder(orderId) {
    if (!confirm("Mark this order as completed?")) {
        return
    }

    try {
        const res = await fetch(`${API}/orders/${orderId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({
                status: "Completed"
            })
        })

        if (res.ok) {
            alert("✅ Order marked as completed!")
            loadAdminDashboard() // Reload all data
        } else {
            alert("❌ Failed to update order")
        }
    } catch (err) {
        alert("❌ Error: " + err.message)
    }
}

function getToken() {
    return localStorage.getItem("token")
}
