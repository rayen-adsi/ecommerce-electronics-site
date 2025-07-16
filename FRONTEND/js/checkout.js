// js/checkout.js
function showCustomAlert(message, type = 'success', onOkClick = null) {
    const container = document.getElementById('custom-alert-container');
    const alertBox = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('custom-alert-message');
    const okButton = document.getElementById('custom-alert-ok-btn');

    // Set message and type
    alertBox.className = 'custom-alert';
    if (type === 'success') {
        alertBox.classList.add('success');
        alertBox.querySelector('.icon').textContent = '✅';
    } else {
        alertBox.classList.add('error');
        alertBox.querySelector('.icon').textContent = '❌';
    }

    alertMessage.textContent = message;
    container.classList.remove('hidden');
    okButton.style.display = 'inline-block';

    // Stop animation (optional if you want it static)
    alertBox.style.animation = 'none';
    alertBox.style.opacity = '1';
    alertBox.style.transform = 'translateY(0)';

    // OK button behavior
    okButton.onclick = () => {
        container.classList.add('hidden');
        if (typeof onOkClick === 'function') {
            onOkClick(); // Call what should happen after OK
        }
    };
}


// Make sure cart.js is loaded before this script in checkout.html,
// as we will be using getCart(), getCurrentUser(), showNotification(), clearCart(), and getProduct (if you have one in cart.js) from it.

document.addEventListener('DOMContentLoaded', () => {
    console.log("checkout.js: DOMContentLoaded - Initializing checkout page.");

    // Select elements
    const cartItemsSummaryElement = document.getElementById('cartItemsSummary');
    const orderTotalPriceElement = document.getElementById('orderTotalPrice');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const customerInfoForm = document.getElementById('customerInfoForm');
    const paymentNotification = document.getElementById('paymentNotification');

    // Function to render cart items on the checkout page
    function renderCheckoutCartItems() {
        console.log("renderCheckoutCartItems: Attempting to render cart.");
        const cart = getCart(); // Get the current user's cart (from cart.js)
        console.log("renderCheckoutCartItems: Cart fetched from getCart():", cart);

        cartItemsSummaryElement.innerHTML = ''; // Clear existing items

        if (cart.length === 0) {
            cartItemsSummaryElement.innerHTML = '<li>Votre panier est vide.</li>';
            orderTotalPriceElement.textContent = '0.00 DT';
            placeOrderBtn.disabled = true; // Disable button if cart is empty
            console.log("renderCheckoutCartItems: Cart is empty, button disabled.");
            return;
        }

        let subtotal = 0;

        cart.forEach(item => {
            const li = document.createElement('li');
            li.classList.add('cart-item');

            // Determine the actual price for this item (promo or regular)
            const effectivePrice = item.promotion_price ? item.promotion_price : item.price;

            // Calculate the total price for this specific item in the cart
            const itemTotalPrice = effectivePrice * item.cartQuantity;

            // Add to the running subtotal
            subtotal += itemTotalPrice;

            li.innerHTML = `
                <span class="cart-item-name">${item.name} (${item.cartQuantity}x)</span>
                <span class="cart-item-price">${itemTotalPrice.toFixed(2)} TND</span>
            `;
            cartItemsSummaryElement.appendChild(li);
        });

        // Display total
        orderTotalPriceElement.textContent = subtotal.toFixed(2) + ' DT';
        placeOrderBtn.disabled = false; // Enable button if cart has items
        console.log("renderCheckoutCartItems: Cart rendered successfully. Total:", subtotal.toFixed(2), "DT");
    }

    // Function to pre-fill customer info if user is logged in
    function prefillCustomerInfo() {
        console.log("prefillCustomerInfo: Attempting to pre-fill customer info.");
        const user = getCurrentUser(); // Get current user details from cart.js
        console.log("prefillCustomerInfo: Current user fetched:", user);
        if (user) {
            document.getElementById('fullName').value = `${user.prenom || ''} ${user.nom || ''}`;
            document.getElementById('emailAddress').value = user.email || '';
            document.getElementById('phone').value = user.telephone || '';
            document.getElementById('shippingAddress').value = `${user.adresse || ''}, ${user.ville || ''}`;
            console.log("prefillCustomerInfo: Customer info pre-filled.");
        } else {
            console.log("prefillCustomerInfo: No user logged in to pre-fill info.");
        }
    }

    // Function to handle placing the order
    placeOrderBtn.addEventListener('click', async (event) => { // Added 'async' keyword here
        event.preventDefault(); // Prevent default form submission

        console.log("placeOrderBtn: Clicked.");

        const user = getCurrentUser();
        if (!user || !user._id) { // Added !user._id check for robustness
            showNotification("Veuillez vous connecter pour passer une commande.", 'error');
            console.log("placeOrderBtn: Order failed - User not logged in or missing ID.");
            return;
        }

        const cart = getCart();
        if (cart.length === 0) {
            showNotification("Votre panier est vide. Ajoutez des articles avant de commander.", 'error');
            console.log("placeOrderBtn: Order failed - Cart is empty.");
            return;
        }

        // Basic form validation for required fields
        if (!customerInfoForm.checkValidity()) {
            showNotification("Veuillez remplir toutes les informations de livraison et de facturation requises.", 'error');
            customerInfoForm.reportValidity(); // Show browser validation messages
            console.log("placeOrderBtn: Order failed - Form validation failed.");
            return;
        }

        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selectedPaymentMethod) {
            showNotification("Veuillez sélectionner une méthode de paiement.", 'error');
            console.log("placeOrderBtn: Order failed - No payment method selected.");
            return;
        }
        if (selectedPaymentMethod.disabled) {
            showNotification("La méthode de paiement sélectionnée n'est pas disponible pour le moment.", 'error');
            console.log("placeOrderBtn: Order failed - Selected payment method is disabled.");
            return;
        }

        // --- Prepare Order Details ---
        // Ensure price in orderDetails is the actual price paid (promo or regular)
        const orderItemsForBackend = cart.map(item => {
            const effectivePrice = item.promotion_price ? item.promotion_price : item.price;
            console.log("📦 Cart item before sending:", item);
            return {
                _id: item._id, // Product ID
                name: item.name,
                price: effectivePrice, // Store the actual price paid
                quantity: item.cartQuantity, // This will be the quantity for the order
                imageUrl: item.images && item.images.length > 0 ? `https://techaven.onrender.com${item.images[0]}` : 'https://via.placeholder.com/50x50?text=No+Img' // Store image URL for admin
            };
        });

        const orderDetails = {
            userId: user._id,
            orderId: 'ORD-' + Date.now() + Math.floor(Math.random() * 1000), // Generate a unique client-side order ID
            customerInfo: {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('emailAddress').value,
                phone: document.getElementById('phone').value,
                shippingAddress: document.getElementById('shippingAddress').value
            },
            items: orderItemsForBackend, // Use the prepared items array
            totalAmount: parseFloat(orderTotalPriceElement.textContent), // This relies on the displayed total
            paymentMethod: selectedPaymentMethod.value,
            orderDate: new Date().toISOString(), // ISO string for easy sorting and display
            status: 'Pending' // Initial status for new orders
        };

        console.log("placeOrderBtn: Order details prepared for saving:", orderDetails);
        

        // --- IMPORTANT: BEGIN STOCK DECREMENT LOGIC ON CLIENT-SIDE (for demonstration) ---
        // In a real application, this part should be done on the SERVER/BACKEND after payment confirmation.
for (const cartItem of cart) {
    const productId = cartItem._id || (cartItem.product && cartItem.product._id);
    if (!productId) {
        console.error("❌ Missing productId for", cartItem);
        continue;
    }

    try {
        const res = await fetch(`https://techaven.onrender.com/api/products/${productId}/decrement`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: cartItem.cartQuantity })
        });

        if (!res.ok) {
            throw new Error(`Stock update failed for ${cartItem.name}`);
        }

        console.log(`✅ Stock updated for ${cartItem.name}`);
    } catch (error) {
        console.error(error);
    }
}

        console.log("checkout.js: Products stock updated and saved to localStorage after order placement.");

        // --- END CLIENT-SIDE STOCK DECREMENT ---

        // --- Save the order to localStorage ---
// --- Submit the order to MongoDB via API ---
try {
    await submitOrderToServer(orderDetails);
    console.log("placeOrderBtn: Order successfully submitted to server.");
} catch (error) {
    console.error("placeOrderBtn: Error during order submission:", error);
    showNotification("Erreur lors de l'enregistrement de la commande sur le serveur.", 'error');
    return;
}

    });
    

    // Handle payment method selection
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.disabled) {
                paymentNotification.textContent = "Cette méthode de paiement est indisponible.";
                paymentNotification.className = "notification-message error";
                placeOrderBtn.disabled = true; // Disable if an unavailable method is somehow selected
            } else {
                paymentNotification.textContent = ""; // Clear message
                paymentNotification.className = "notification-message";
                // Re-enable button if cart is not empty (already handled by renderCheckoutCartItems on load)
                if (getCart().length > 0) { // Check cart again to ensure it's not empty
                    placeOrderBtn.disabled = false;
                }
            }
        });
    });

    async function submitOrderToServer(orderData) {
    try {
        console.log("Sending order:", orderData);
        const response = await fetch('https://techaven.onrender.com/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

const result = await response.json();
if (response.ok) {
    showCustomAlert(
        "✅ Commande enregistrée avec succès ! Cliquez sur OK pour revenir à l'accueil.",
        'success',
        () => {
            clearCart(); // Only clears after OK
            window.location.href = "index.html"; // Redirects after OK
        }
    );
} else {
    showCustomAlert("❌ Erreur: " + result.message, 'error');
}


} catch (error) {
    console.error("Erreur de soumission:", error);
    showCustomAlert("❌ Erreur serveur", 'error');
}
    }

    // Initial load: Render cart items and pre-fill customer info
    renderCheckoutCartItems();
    prefillCustomerInfo();
    updateCartBadge(); // Ensure badge is updated on this page too
});