// API comes from config.js

let storeId = null
let store = null
let cart = []
let cartModal = null
let successModal = null

// Get store ID and table number from URL
const urlParams = new URLSearchParams(window.location.search)
storeId = urlParams.get('store')
const tableFromUrl = urlParams.get('table')

document.addEventListener('DOMContentLoaded', function() {
    cartModal = new bootstrap.Modal(document.getElementById('cartModal'))
    successModal = new bootstrap.Modal(document.getElementById('successModal'))
    
    // Set table number if from URL
    if (tableFromUrl) {
        document.getElementById('tableNumber').value = tableFromUrl
    }
    
    loadStoreMenu()
})

// Dine-in when store category is Food & Drinks
function isDineInStore() {
    return store && store.category === 'food'
}

async function loadStoreMenu() {
    if (!storeId) {
        alert("Invalid store link!")
        return
    }

    const menuContainer = document.getElementById('menuItems')
    menuContainer.innerHTML = '<div class="menu-loading"><div class="spinner"></div><div>Loading menu…</div></div>'

    try {
        // Load store info
        const storesRes = await fetch(`${API}/stores`)
        const stores = await storesRes.json()
        store = stores.find(s => s.id === storeId)
        
        if (store) {
            document.getElementById('storeName').innerText = store.name
            document.getElementById('storeDesc').innerText = store.description
            // Order type from store category: Food & Drinks = dine-in, else delivery
            const dineIn = store.category === 'food'
            document.getElementById('orderTypeSelector').style.display = 'none'
            document.getElementById('tableSection').style.display = dineIn ? 'block' : 'none'
            document.getElementById('deliverySection').style.display = dineIn ? 'none' : 'block'
        }

        // Load menu items
        const menuRes = await fetch(`${API}/stores/${storeId}/services`)
        const menuItems = await menuRes.json()

        const menuContainer = document.getElementById('menuItems')
        menuContainer.innerHTML = ""

        if (menuItems.length === 0) {
            menuContainer.innerHTML = `
                <div class="col-12 menu-empty-state">
                    <div class="icon">📭</div>
                    <h4>No items yet</h4>
                    <p>This menu is empty. Check back later.</p>
                </div>
            `
            return
        }

        menuItems.forEach(item => {
            menuContainer.innerHTML += `
                <div class="col-md-4 col-sm-6 mb-4">
                    <div class="card menu-item h-100">
                        <div class="card-body">
                            <h5 class="card-title">${item.name}</h5>
                            <p class="card-text text-muted">${item.description}</p>
                            <h4 class="text-primary">€${item.price}</h4>
                        </div>
                        <div class="card-footer bg-white">
                            <div class="d-flex align-items-center">
                                <button onclick="decreaseQty('${item.id}')" class="btn btn-sm btn-outline-secondary" style="display:none;" id="dec-${item.id}">-</button>
                                <input type="number" id="qty-${item.id}" class="form-control form-control-sm mx-2" value="1" min="1" max="99" style="width:60px; display:none;">
                                <button onclick="increaseQty('${item.id}')" class="btn btn-sm btn-outline-secondary" style="display:none;" id="inc-${item.id}">+</button>
                                <button onclick="addToCart('${item.id}', '${item.name}', ${item.price})" class="btn btn-primary w-100" id="add-${item.id}">
                                    ➕ Add to Cart
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `
        })
    } catch (err) {
        console.error("Error loading menu:", err)
        alert("Error loading menu")
    }
}

function addToCart(itemId, itemName, itemPrice) {
    const qtyInput = document.getElementById(`qty-${itemId}`)
    const quantity = qtyInput ? parseInt(qtyInput.value) : 1

    // Check if item already in cart
    const existingItem = cart.find(item => item.id === itemId)
    
    if (existingItem) {
        existingItem.quantity += quantity
    } else {
        cart.push({
            id: itemId,
            name: itemName,
            price: itemPrice,
            quantity: quantity
        })
    }

    updateCartDisplay()
    
    // Visual feedback
    const btn = document.getElementById(`add-${itemId}`)
    btn.innerText = "✓ Added!"
    btn.classList.remove('btn-primary')
    btn.classList.add('btn-success')
    setTimeout(() => {
        btn.innerText = "➕ Add to Cart"
        btn.classList.remove('btn-success')
        btn.classList.add('btn-primary')
    }, 1000)
}

function increaseQty(itemId) {
    const input = document.getElementById(`qty-${itemId}`)
    if (input.value < 99) {
        input.value = parseInt(input.value) + 1
    }
}

function decreaseQty(itemId) {
    const input = document.getElementById(`qty-${itemId}`)
    if (input.value > 1) {
        input.value = parseInt(input.value) - 1
    }
}

function updateCartDisplay() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    document.getElementById('cartCount').innerText = totalItems
    document.getElementById('cartTotal').innerText = totalPrice.toFixed(2)
    document.getElementById('cartButton').style.display = cart.length > 0 ? 'block' : 'none'
}

function showCart() {
    // Update cart items display
    const cartItemsContainer = document.getElementById('cartItems')
    cartItemsContainer.innerHTML = ""

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-muted">Your cart is empty</p>'
        return
    }

    cart.forEach((item, index) => {
        cartItemsContainer.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded">
                <div>
                    <h6 class="mb-0">${item.name}</h6>
                    <small class="text-muted">€${item.price} × ${item.quantity}</small>
                </div>
                <div class="d-flex align-items-center">
                    <strong class="me-3">€${(item.price * item.quantity).toFixed(2)}</strong>
                    <button onclick="removeFromCart(${index})" class="btn btn-sm btn-danger">
                        🗑️
                    </button>
                </div>
            </div>
        `
    })

    // Update summary (dine-in when store is Food & Drinks)
    const isDineIn = isDineInStore()
    const orderType = isDineIn ? 'Dine-In' : 'Takeout/Delivery'
    const tableNumber = document.getElementById('tableNumber').value
    const deliveryAddress = document.getElementById('deliveryAddress').value
    const customerName = document.getElementById('customerName').value
    const customerPhone = document.getElementById('customerPhone').value

    document.getElementById('summaryOrderType').innerText = orderType
    
    if (isDineIn) {
        document.getElementById('summaryTable').style.display = 'block'
        document.getElementById('summaryTable').querySelector('span').innerText = tableNumber || 'Not specified'
        document.getElementById('summaryDelivery').style.display = 'none'
    } else {
        document.getElementById('summaryTable').style.display = 'none'
        document.getElementById('summaryDelivery').style.display = 'block'
        document.getElementById('summaryDelivery').querySelector('span').innerText = deliveryAddress || 'Not specified'
    }

    document.getElementById('summaryName').innerText = customerName || 'Not provided'
    document.getElementById('summaryPhone').innerText = customerPhone || 'Not provided'

    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    document.getElementById('modalCartTotal').innerText = totalPrice.toFixed(2)

    cartModal.show()
}

function removeFromCart(index) {
    cart.splice(index, 1)
    updateCartDisplay()
    showCart()
}

async function placeOrder() {
    // Validate
    const customerName = document.getElementById('customerName').value
    const customerPhone = document.getElementById('customerPhone').value
    
    if (!customerName || !customerPhone) {
        alert("Please enter your name and phone number")
        return
    }

    const isDineIn = isDineInStore()
    const tableNumber = document.getElementById('tableNumber').value
    const deliveryAddress = document.getElementById('deliveryAddress').value

    if (isDineIn && !tableNumber) {
        alert("Please enter your table number")
        return
    }

    if (!isDineIn && !deliveryAddress) {
        alert("Please enter delivery address")
        return
    }

    if (cart.length === 0) {
        alert("Your cart is empty")
        return
    }

    // Place orders for each item in cart
    try {
        const orderPromises = cart.map(item => {
            return fetch(`${API}/orders`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    service_id: item.id,
                    order_type: isDineIn ? 'dine-in' : 'delivery',
                    table_number: tableNumber,
                    delivery_address: deliveryAddress,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    notes: document.getElementById('orderNotes').value,
                    quantity: item.quantity
                })
            })
        })

        await Promise.all(orderPromises)

        // Show success
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        document.getElementById('orderConfirmation').innerHTML = `
            <p><strong>Order Type:</strong> ${isDineIn ? 'Dine-In' : 'Delivery'}</p>
            ${isDineIn ? `<p><strong>Table:</strong> ${tableNumber}</p>` : `<p><strong>Delivery to:</strong> ${deliveryAddress}</p>`}
            <p><strong>Total:</strong> €${totalPrice.toFixed(2)}</p>
            <p class="text-muted mt-3">We'll have your order ready soon!</p>
        `

        cartModal.hide()
        successModal.show()

        // Clear cart
        cart = []
        updateCartDisplay()

    } catch (err) {
        alert("Error placing order: " + err.message)
    }
}
