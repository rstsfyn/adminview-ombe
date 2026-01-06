// API Configuration
const API_BASE = 'https://server-ombe.codingankuu.com/api';
let currentPage = 1;
let currentStatus = '';
let allOrders = [];

// Auto-refresh configuration
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
let autoRefreshTimer = null;
let lastOrderCount = 0;
let lastProductCount = 0;

// Get token from localStorage
function getToken() {
    return localStorage.getItem('adminToken');
}

// API Headers
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

// Start auto-refresh
function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    
    autoRefreshTimer = setInterval(async () => {
        const currentView = document.querySelector('.nav-link.active')?.dataset.target;
        
        if (currentView === 'dashboard') {
            await silentDashboardRefresh();
        } else if (currentView === 'products') {
            await silentProductsRefresh();
        }
    }, AUTO_REFRESH_INTERVAL);
    
    console.log('Auto-refresh started (every 30 seconds)');
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

// Silent dashboard refresh (no loading indicator)
async function silentDashboardRefresh() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            method: 'GET',
            headers: getHeaders(),
            mode: 'cors'
        });

        if (!response.ok) return;

        const data = await response.json();
        const dashboard = data.data;
        if (!dashboard) return;

        // Check for new orders
        const newOrderCount = dashboard.totalOrders || 0;
        if (lastOrderCount > 0 && newOrderCount > lastOrderCount) {
            showNotificationToast(`🆕 ${newOrderCount - lastOrderCount} new order(s) received!`);
        }
        lastOrderCount = newOrderCount;

        // Update stats silently
        document.getElementById('pendingCount').textContent = dashboard.pendingOrders || 0;
        document.getElementById('processingCount').textContent = dashboard.processingOrders || 0;
        document.getElementById('completedCount').textContent = dashboard.completedOrders || 0;
        document.getElementById('revenueCount').textContent = formatCurrency(dashboard.totalRevenue || 0);

        // Update orders table
        allOrders = dashboard.recentOrders || [];
        loadRecentOrders(allOrders);
        
        // Update last refresh time
        updateLastRefreshTime();
    } catch (error) {
        console.error('Silent refresh error:', error);
    }
}

// Silent products refresh
async function silentProductsRefresh() {
    try {
        const response = await fetch(`${API_BASE}/admin/products?page=1&limit=10`, {
            headers: getHeaders()
        });

        if (!response.ok) return;

        const data = await response.json();
        const products = data.data || [];
        
        // Check for product updates
        if (lastProductCount > 0 && products.length !== lastProductCount) {
            showNotificationToast('📦 Products have been updated!');
        }
        lastProductCount = products.length;
        
        // Update table
        const tbody = document.getElementById('productsTable');
        if (tbody && products.length > 0) {
            tbody.innerHTML = products.map(product => `
                <tr>
                    <td>${product.id}</td>
                    <td>
                        <img src="${product.image || 'https://via.placeholder.com/50'}" 
                             alt="${product.name}" 
                             style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">
                    </td>
                    <td><strong>${product.name}</strong></td>
                    <td>${product.category?.name || 'N/A'}</td>
                    <td>Rp ${formatNumber(product.price)}</td>
                    <td>${product.stock}</td>
                    <td><span class="status-badge status-${product.isActive ? 'completed' : 'cancelled'}">${product.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="openProductModal(${product.id})">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
        
        updateLastRefreshTime();
    } catch (error) {
        console.error('Silent products refresh error:', error);
    }
}

// Show notification toast
function showNotificationToast(message) {
    // Remove existing toast if any
    const existingToast = document.getElementById('admin-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1E6B4C, #2d9d6d);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    toast.innerHTML = `
        <span style="font-size: 18px;">🔔</span>
        <span>${message}</span>
    `;
    
    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Play notification sound (optional)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ4CLY3f6KeNHQUjd+jxrZkgABFs6fOxnSAAD2bq9bOdHwAPYur1s50fAA9i6vWynR8AD2Lq9bKdHwAPYur1sp0fAA9i6vWynR8AD2Lq9bKdHw==');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {}
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Update last refresh time indicator
function updateLastRefreshTime() {
    let indicator = document.getElementById('refresh-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'refresh-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(30, 107, 76, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(indicator);
    }
    
    const now = new Date();
    indicator.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite;"></span>
        Auto-refresh: ${now.toLocaleTimeString()}
    `;
    
    // Add pulse animation if not exists
    if (!document.getElementById('pulse-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-style';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Manual refresh function
async function manualRefresh() {
    const btn = event?.target?.closest('button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
    }
    
    const currentView = document.querySelector('.nav-link.active')?.dataset.target;
    
    try {
        if (currentView === 'dashboard') {
            await loadDashboard();
        } else if (currentView === 'products') {
            await loadAllProducts(1);
        } else if (currentView === 'users') {
            await loadAllUsers(1);
        }
        showNotificationToast('✅ Data refreshed successfully!');
    } catch (error) {
        showNotificationToast('❌ Failed to refresh data');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        }
    }
}

// Initialize date filter with max 3 months back
function initDateFilter() {
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput && endDateInput) {
        endDateInput.value = today.toISOString().split('T')[0];
        startDateInput.value = threeMonthsAgo.toISOString().split('T')[0];
        startDateInput.min = threeMonthsAgo.toISOString().split('T')[0];
        endDateInput.max = today.toISOString().split('T')[0];
    }
}

// Apply date filter
function applyDateFilter() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const filtered = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
    });
    
    loadRecentOrders(filtered);
}

// Reset date filter
function resetDateFilter() {
    initDateFilter();
    loadRecentOrders(allOrders);
}

// Load Dashboard
async function loadDashboard() {
    try {
        const token = getToken();
        console.log('Token from storage:', token ? 'Present' : 'Missing');
        console.log('API URL:', `${API_BASE}/admin/dashboard`);
        
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            method: 'GET',
            headers: getHeaders(),
            mode: 'cors'
        });

        console.log('Dashboard response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.message || `Failed to load dashboard (${response.status})`);
        }

        const data = await response.json();
        console.log('Dashboard data:', data);
        
        const dashboard = data.data;

        if (!dashboard) {
            throw new Error('No data received from API');
        }

        // Update stats
        document.getElementById('pendingCount').textContent = dashboard.pendingOrders || 0;
        document.getElementById('processingCount').textContent = dashboard.processingOrders || 0;
        document.getElementById('completedCount').textContent = dashboard.completedOrders || 0;
        document.getElementById('revenueCount').textContent = formatCurrency(dashboard.totalRevenue || 0);

        // Store orders for filtering and load
        allOrders = dashboard.recentOrders || [];
        initDateFilter();
        loadRecentOrders(allOrders);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        document.getElementById('pendingCount').textContent = '0';
        document.getElementById('processingCount').textContent = '0';
        document.getElementById('completedCount').textContent = '0';
        document.getElementById('revenueCount').textContent = 'Rp 0';
        
        let errorMsg = error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMsg = 'Cannot connect to server. Please check if the server is running and CORS is enabled.';
        }
        
        document.getElementById('recentOrdersTable').innerHTML = `<tr><td colspan="6" class="text-center" style="color: red; padding: 20px;">Error: ${errorMsg}</td></tr>`;
    }
}

// Load Recent Orders
function loadRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersTable');
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>${order.orderNumber}</strong></td>
            <td>${order.user?.fullName || order.user?.email || 'N/A'}</td>
            <td>Rp ${formatNumber(order.finalTotal)}</td>
            <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>${formatDate(order.createdAt)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openOrderDetail(${order.id})">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

// Load All Orders
async function loadAllOrders(page = 1, status = '') {
    try {
        let url = `${API_BASE}/admin/orders?page=${page}&limit=10`;
        if (status) url += `&status=${status}`;

        console.log('Fetching orders from:', url);

        const response = await fetch(url, {
            headers: getHeaders()
        });

        console.log('Orders response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.message || `Failed to load orders (${response.status})`);
        }

        const data = await response.json();
        console.log('Orders data:', data);
        
        const orders = data.data || [];
        const pagination = data.pagination || {};

        // Load orders table
        const tbody = document.getElementById('ordersTable');
        
        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';
        } else {
            tbody.innerHTML = orders.map(order => `
                <tr>
                    <td><strong>${order.orderNumber}</strong></td>
                    <td>${order.user?.fullName || 'N/A'}</td>
                    <td>${order.user?.email || 'N/A'}</td>
                    <td>Rp ${formatNumber(order.finalTotal)}</td>
                    <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
                    <td>${formatDate(order.createdAt)}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="openOrderDetail(${order.id})">
                            Edit
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Load pagination
        loadPagination(pagination);
    } catch (error) {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('ordersTable');
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: red; padding: 20px;">Error: ${error.message}</td></tr>`;
    }
}

// Load Pagination
function loadPagination(pagination) {
    const paginationDiv = document.getElementById('pagination');
    
    if (pagination.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    if (pagination.currentPage > 1) {
        html += `<button onclick="goToPage(${pagination.currentPage - 1})">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.currentPage) {
            html += `<button class="active">${i}</button>`;
        } else {
            html += `<button onclick="goToPage(${i})">${i}</button>`;
        }
    }

    // Next button
    if (pagination.currentPage < pagination.totalPages) {
        html += `<button onclick="goToPage(${pagination.currentPage + 1})">Next</button>`;
    }

    paginationDiv.innerHTML = html;
}

// Go to page
function goToPage(page) {
    currentPage = page;
    loadAllOrders(page, currentStatus);
}

// Open Order Detail Modal
async function openOrderDetail(orderId) {
    try {
        console.log('Opening order detail for ID:', orderId);
        
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}`, {
            headers: getHeaders()
        });

        console.log('Order detail response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.message || `Failed to load order (${response.status})`);
        }

        const data = await response.json();
        console.log('Order detail data:', data);
        
        showOrderDetailModal(data);
    } catch (error) {
        console.error('Error loading order:', error);
        alert('Failed to load order details: ' + error.message);
    }
}

// Show Order Detail Modal
async function showOrderDetailModal(promise) {
    const data = await promise;
    const order = data.data;

    const modal = document.getElementById('orderModal');
    const content = document.getElementById('orderDetailContent');

    const itemsHTML = (order.items || []).map(item => `
        <tr>
            <td>${item.product?.name || 'N/A'}</td>
            <td>${item.quantity}</td>
            <td>Rp ${formatNumber(item.product?.price || 0)}</td>
            <td>Rp ${formatNumber((item.product?.price || 0) * item.quantity)}</td>
        </tr>
    `).join('');

    content.innerHTML = `
        <div class="order-detail">
            <div>
                <div class="detail-group">
                    <h3>Order Information</h3>
                    <div class="detail-row">
                        <span class="detail-label">Order Number:</span>
                        <span class="detail-value"><strong>${order.orderNumber}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Order Date:</span>
                        <span class="detail-value">${formatDate(order.createdAt)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Current Status:</span>
                        <span class="detail-value"><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></span>
                    </div>
                </div>

                <div class="detail-group">
                    <h3>Customer Information</h3>
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${order.user?.fullName || order.user?.name || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${order.user?.email || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${order.user?.phone || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Delivery Address:</span>
                        <span class="detail-value">${formatDeliveryAddress(order.deliveryAddress)}</span>
                    </div>
                </div>
            </div>

            <div>
                <div class="detail-group">
                    <h3>Payment & Amount</h3>
                    <div class="detail-row">
                        <span class="detail-label">Payment Method:</span>
                        <span class="detail-value">${order.paymentMethod || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Subtotal:</span>
                        <span class="detail-value">Rp ${formatNumber(order.totalAmount)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Discount:</span>
                        <span class="detail-value">- Rp ${formatNumber(order.discount || 0)}</span>
                    </div>
                    <div class="detail-row" style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                        <span class="detail-label"><strong>Final Total:</strong></span>
                        <span class="detail-value"><strong>Rp ${formatNumber(order.finalTotal)}</strong></span>
                    </div>
                </div>
            </div>

            <div class="detail-group" style="grid-column: 1 / -1;">
                <h3>Order Items</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
            </div>

            <div class="status-update-section">
                <h3>Update Order Status</h3>
                <p style="color: #666; margin-bottom: 15px;">Select the new status for this order:</p>
                <div class="status-options">
                    <button class="status-btn status-pending-btn" onclick="updateOrderStatus(${order.id}, 'pending')" ${order.status === 'pending' ? 'disabled' : ''}>
                        <i class="fas fa-clock"></i> Pending
                    </button>
                    <button class="status-btn status-processing-btn" onclick="updateOrderStatus(${order.id}, 'processing')" ${order.status === 'processing' ? 'disabled' : ''}>
                        <i class="fas fa-spinner"></i> Processing
                    </button>
                    <button class="status-btn status-completed-btn" onclick="updateOrderStatus(${order.id}, 'completed')" ${order.status === 'completed' ? 'disabled' : ''}>
                        <i class="fas fa-check-circle"></i> Completed
                    </button>
                    <button class="status-btn status-cancelled-btn" onclick="updateOrderStatus(${order.id}, 'cancelled')" ${order.status === 'cancelled' ? 'disabled' : ''}>
                        <i class="fas fa-times-circle"></i> Cancelled
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
    if (!confirm(`Are you sure you want to change the status to ${newStatus.toUpperCase()}?`)) {
        return;
    }

    try {
        console.log('Updating order', orderId, 'to status:', newStatus);

        const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ status: newStatus })
        });

        console.log('Update response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.message || `Failed to update status (${response.status})`);
        }

        const data = await response.json();
        console.log('Update response:', data);
        
        alert('Order status updated successfully!');

        // Reload the order detail
        openOrderDetail(orderId);

        // Reload dashboard
        const dashboardView = document.getElementById('dashboardView');
        if (dashboardView && dashboardView.style.display !== 'none') {
            loadDashboard();
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Failed to update order status: ' + error.message);
    }
}

// Conversion rate USD to IDR
const USD_TO_IDR = 16000;

// Format Currency (converts from USD to IDR)
function formatCurrency(value) {
    const idrValue = (value || 0) * USD_TO_IDR;
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(idrValue);
}

// Format Number (converts from USD to IDR)
function formatNumber(value) {
    const idrValue = (value || 0) * USD_TO_IDR;
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0
    }).format(idrValue);
}

// Format Delivery Address
function formatDeliveryAddress(address) {
    if (!address) return 'N/A';
    if (typeof address === 'string') {
        // Try to parse if it's a JSON string
        try {
            address = JSON.parse(address);
        } catch (e) {
            return address; // It's just a plain string
        }
    }
    if (typeof address === 'object') {
        // Format object address
        const parts = [];
        if (address.address || address.street) parts.push(address.address || address.street);
        if (address.city) parts.push(address.city);
        if (address.state || address.province) parts.push(address.state || address.province);
        if (address.postalCode || address.zipCode) parts.push(address.postalCode || address.zipCode);
        if (address.country) parts.push(address.country);
        
        if (parts.length > 0) return parts.join(', ');
        
        // If no known fields, try to stringify nicely
        const allValues = Object.values(address).filter(v => v && typeof v !== 'object');
        return allValues.length > 0 ? allValues.join(', ') : 'N/A';
    }
    return String(address);
}

// Format Date
function formatDate(dateString) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

// Load All Users
async function loadAllUsers(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/admin/users?page=${page}&limit=10`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to load users (${response.status})`);
        }

        const data = await response.json();
        const users = data.data || [];
        const pagination = data.pagination || {};

        const tbody = document.getElementById('usersTable');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>';
        } else {
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.email}</td>
                    <td>${user.fullName || 'N/A'}</td>
                    <td>${user.phone || 'N/A'}</td>
                    <td><span class="badge" style="background: ${user.role === 'admin' ? '#ff9800' : '#4caf50'}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${user.role.toUpperCase()}</span></td>
                    <td><span class="badge" style="background: ${user.isActive ? '#4caf50' : '#f44336'}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${user.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td>${formatDate(user.createdAt)}</td>
                </tr>
            `).join('');
        }

        // Load pagination
        loadPagination(pagination, 'loadAllUsers', 'usersPagination');
    } catch (error) {
        console.error('Error loading users:', error);
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: red; padding: 20px;">Error: ${error.message}</td></tr>`;
    }
}

// Load All Products
async function loadAllProducts(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/admin/products?page=${page}&limit=10`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to load products (${response.status})`);
        }

        const data = await response.json();
        const products = data.data || [];
        const pagination = data.pagination || {};

        const tbody = document.getElementById('productsTable');
        
        if (!products || products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No products found</td></tr>';
        } else {
            tbody.innerHTML = products.map(product => `
                <tr>
                    <td>${product.id}</td>
                    <td><img src="${product.image || 'https://via.placeholder.com/50'}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                    <td><strong>${product.name}</strong></td>
                    <td>${product.category?.name || 'N/A'}</td>
                    <td>Rp ${formatNumber(product.price)}</td>
                    <td>${product.stock}</td>
                    <td><span class="badge" style="background: ${product.isFeatured ? '#2196f3' : '#ccc'}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${product.isFeatured ? 'YES' : 'NO'}</span></td>
                    <td><span class="badge" style="background: ${product.isActive ? '#4caf50' : '#f44336'}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${product.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editProduct(${product.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }

        loadPagination(pagination, 'loadAllProducts', 'productsPagination');
    } catch (error) {
        console.error('Error loading products:', error);
        const tbody = document.getElementById('productsTable');
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: red; padding: 20px;">Error: ${error.message}</td></tr>`;
    }
}

let categories = [];

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`, {
            headers: getHeaders()
        });
        if (response.ok) {
            const data = await response.json();
            categories = data.data || [];
            const select = document.getElementById('productCategory');
            if (select) {
                select.innerHTML = '<option value="">Select Category</option>' +
                    categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function openProductModal(product = null) {
    loadCategories();
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');
    
    form.reset();
    document.getElementById('productId').value = '';
    document.getElementById('currentImage').innerHTML = '';
    
    if (product) {
        title.textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name || '';
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price || 0;
        document.getElementById('productStock').value = product.stock || 0;
        document.getElementById('productCategory').value = product.categoryId || '';
        document.getElementById('productRating').value = product.rating || '';
        document.getElementById('productFeatured').checked = product.isFeatured || false;
        document.getElementById('productActive').checked = product.isActive !== false;
        if (product.image) {
            document.getElementById('currentImage').innerHTML = `<img src="${product.image}" alt="Current" style="max-width: 100px; max-height: 100px; border-radius: 4px;">`;
        }
    } else {
        title.textContent = 'Add Product';
    }
    
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

async function editProduct(id) {
    try {
        const response = await fetch(`${API_BASE}/products/${id}`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to load product');
        const data = await response.json();
        openProductModal(data.data);
    } catch (error) {
        alert('Failed to load product: ' + error.message);
    }
}

async function saveProduct(event) {
    event.preventDefault();
    
    const id = document.getElementById('productId').value;
    const isEdit = !!id;
    
    const formData = new FormData();
    formData.append('name', document.getElementById('productName').value);
    formData.append('description', document.getElementById('productDescription').value);
    formData.append('price', document.getElementById('productPrice').value);
    formData.append('stock', document.getElementById('productStock').value);
    formData.append('categoryId', document.getElementById('productCategory').value);
    formData.append('rating', document.getElementById('productRating').value || 0);
    formData.append('isFeatured', document.getElementById('productFeatured').checked);
    formData.append('isActive', document.getElementById('productActive').checked);
    
    const imageFile = document.getElementById('productImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const url = isEdit ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save product');
        }
        
        alert(isEdit ? 'Product updated successfully!' : 'Product created successfully!');
        closeProductModal();
        loadAllProducts();
    } catch (error) {
        alert('Failed to save product: ' + error.message);
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/products/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete product');
        }
        
        alert('Product deleted successfully!');
        loadAllProducts();
    } catch (error) {
        alert('Failed to delete product: ' + error.message);
    }
}

// Load Pagination with dynamic callback
function loadPagination(pagination, callback, elementId) {
    const paginationDiv = document.getElementById(elementId);
    
    if (pagination.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    if (pagination.currentPage > 1) {
        html += `<button onclick="${callback}(${pagination.currentPage - 1})">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.currentPage) {
            html += `<button class="active">${i}</button>`;
        } else {
            html += `<button onclick="${callback}(${i})">${i}</button>`;
        }
    }

    // Next button
    if (pagination.currentPage < pagination.totalPages) {
        html += `<button onclick="${callback}(${pagination.currentPage + 1})">Next</button>`;
    }

    paginationDiv.innerHTML = html;
}

// Navigation
document.addEventListener('DOMContentLoaded', function() {
    // Load dashboard by default
    loadDashboard();

    // Sidebar navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            // Remove active class from all links
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');

            // Hide all views
            document.getElementById('dashboardView').style.display = 'none';
            document.getElementById('usersView').style.display = 'none';
            document.getElementById('productsView').style.display = 'none';

            // Show selected view
            const target = this.dataset.target;
            if (target === 'dashboard') {
                document.getElementById('dashboardView').style.display = 'block';
                loadDashboard();
            } else if (target === 'users') {
                document.getElementById('usersView').style.display = 'block';
                loadAllUsers(1);
            } else if (target === 'products') {
                document.getElementById('productsView').style.display = 'block';
                loadAllProducts(1);
            }
        });
    });

    // Search filter
    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const searchTerm = this.value.trim();
        
        if (searchTerm.length === 0) {
            currentPage = 1;
            loadAllOrders(1, currentStatus);
            return;
        }

        // If you want to implement search, you would need to add a search endpoint
        // For now, just filter client-side or reload with current filters
    });

    // Modal close button
    document.querySelector('.modal-close')?.addEventListener('click', function() {
        document.getElementById('orderModal').classList.remove('active');
    });

    // Close modal when clicking outside
    document.getElementById('orderModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', function() {
        if (confirm('Are you sure you want to logout?')) {
            stopAutoRefresh();
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'login.html';
        }
    });

    // Start auto-refresh after page loads
    startAutoRefresh();
    
    // Handle visibility change (pause when tab is hidden)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
            // Immediate refresh when tab becomes visible
            const currentView = document.querySelector('.nav-link.active')?.dataset.target;
            if (currentView === 'dashboard') {
                silentDashboardRefresh();
            } else if (currentView === 'products') {
                silentProductsRefresh();
            }
        }
    });
});
