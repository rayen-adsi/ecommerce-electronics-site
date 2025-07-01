// js/admin_orders.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("admin_orders.js: DOMContentLoaded - Initializing admin orders page.");

    const ordersListDiv = document.getElementById('ordersList');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfoSpan = document.getElementById('pageInfo');

    const ordersPerPage = 10; // Number of orders to display per page
    let currentPage = 1;
    let allOrders = [];

    // --- Admin Authentication Check ---
    // Make sure getCurrentUser() and showNotification() are available from cart.js
    function isAdmin() {
        const user = getCurrentUser(); // Get current user (from cart.js)
        // For static admin login, check the hardcoded admin _id and role.
        // If your admin user comes from a database, its _id will be real.
        const isAdminUser = user && user._id === "admin_techhaven_id" && localStorage.getItem('role') === "admin";
        console.log("isAdmin check: User:", user, "Role:", localStorage.getItem('role'), "Is Admin:", isAdminUser);
        return isAdminUser;
    }

    // Redirect if not admin
    if (!isAdmin()) {
        alert("Accès refusé. Vous devez être connecté en tant qu'administrateur.");
        window.location.href = 'login.html'; // Redirect to login page
        return; // Stop execution if not admin
    }

    // Function to load orders from MongoDB via backend API
async function loadOrders() {
    console.log("loadOrders: Attempting to fetch orders from backend.");

    try {
        const response = await fetch('http://localhost:5000/api/orders');
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const fetchedOrders = await response.json();
        allOrders = fetchedOrders;

        // Sort orders by date, newest first
        allOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

        console.log("loadOrders: Orders loaded from server:", allOrders);
    } catch (e) {
        console.error("loadOrders: Error fetching orders from backend:", e);
        ordersListDiv.innerHTML = '<p class="notification-message error">Erreur lors du chargement des commandes depuis le serveur.</p>';
        allOrders = [];
    }
}


    // Function to render orders for the current page
    function renderOrders() {
        ordersListDiv.innerHTML = ''; // Clear previous content

        if (allOrders.length === 0) {
            ordersListDiv.innerHTML = '<p>Aucune commande n\'a été trouvée.</p>';
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
            pageInfoSpan.textContent = 'Page 0 de 0';
            console.log("renderOrders: No orders to display.");
            return;
        }

        const startIndex = (currentPage - 1) * ordersPerPage;
        const endIndex = startIndex + ordersPerPage;
        const ordersToDisplay = allOrders.slice(startIndex, endIndex);

        const table = document.createElement('table');
        table.classList.add('orders-table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID Commande</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Adresse</th>
                    <th>Articles</th>
                    <th>Total</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody id="ordersTableBody">
                </tbody>
        `;
        ordersListDiv.appendChild(table);
        const ordersTableBody = document.getElementById('ordersTableBody');

        ordersToDisplay.forEach(order => {
            const row = document.createElement('tr');
            // Data-label for responsive table headers on small screens
            row.innerHTML = `
                <td data-label="ID Commande">${order.orderId}</td>
                <td data-label="Date">${new Date(order.orderDate).toLocaleString('fr-FR')}</td>
                <td data-label="Client">${order.customerInfo.fullName}</td>
                <td data-label="Contact">${order.customerInfo.email}<br>${order.customerInfo.phone}</td>
                <td data-label="Adresse">${order.customerInfo.shippingAddress}</td>
                <td data-label="Articles">
                    <ul class="order-items-list">
                        ${order.items.map(item => `<li>${item.name} (${item.quantity}x) - ${item.price.toFixed(2)} DT</li>`).join('')}
                    </ul>
                </td>
                <td data-label="Total">${order.totalAmount.toFixed(2)} DT</td>
                <td data-label="Statut">
                    <select class="status-select ${order.status}" data-order-id="${order._id}">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>En attente</option>
                        <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>En traitement</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Livrée</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Annulée</option>
                    </select>
                </td>
            `;
            ordersTableBody.appendChild(row);
        });

        // Update pagination controls
        const totalPages = Math.ceil(allOrders.length / ordersPerPage);
        pageInfoSpan.textContent = `Page ${currentPage} de ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;

        // Add event listeners for status changes
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const orderId = e.target.dataset.orderId;
                const newStatus = e.target.value;
                updateOrderStatus(orderId, newStatus);
            });
        });

        console.log("renderOrders: Orders displayed for page", currentPage, "Total orders:", allOrders.length);
    }

    // Function to update order status (NO STOCK DECREMENT HERE ANYMORE)
async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Update failed');
    }

    const updated = await response.json();
    console.log("Updated from DB:", updated);

    // Update local array
    const index = allOrders.findIndex(order => order._id === orderId);
    if (index !== -1) {
      allOrders[index].status = updated.status;
      renderOrders();
    }

    showNotification(`Statut mis à jour: ${newStatus}`, 'success');
  } catch (err) {
    console.error("Update failed:", err);
    showNotification("Échec de mise à jour", 'error');
  }
}


    // Function to save all orders back to localStorage
    function saveOrdersToLocalStorage() {
        try {
            localStorage.setItem('orders', JSON.stringify(allOrders));
            console.log("saveOrdersToLocalStorage: Orders saved successfully.");
        } catch (e) {
            console.error("saveOrdersToLocalStorage: Error saving orders:", e);
        }
    }

    // Pagination Event Listeners
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderOrders();
            console.log("Pagination: Navigated to previous page.");
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allOrders.length / ordersPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderOrders();
            console.log("Pagination: Navigated to next page.");
        }
    });

    // Admin Logout Function (global, can be called from admin header)
    window.logoutAdmin = function() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('role');
        alert("Déconnexion administrateur réussie.");
        window.location.href = 'login.html';
    };

    // Initial load of orders and render
    loadOrders().then(renderOrders);

});