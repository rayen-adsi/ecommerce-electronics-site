// checkout.js (CLEANED AND OPTIMIZED)

// === Custom Alert ===
function showCustomAlert(message, type = 'success', onOkClick = null) {
    const container = document.getElementById('custom-alert-container');
    const alertBox = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('custom-alert-message');
    const okButton = document.getElementById('custom-alert-ok-btn');

    alertBox.className = 'custom-alert';
    alertBox.classList.add(type === 'success' ? 'success' : 'error');
    alertBox.querySelector('.icon').textContent = type === 'success' ? '✅' : '❌';

    alertMessage.textContent = message;
    container.classList.remove('hidden');
    okButton.style.display = 'inline-block';

    alertBox.style.animation = 'none';
    alertBox.style.opacity = '1';
    alertBox.style.transform = 'translateY(0)';

    okButton.onclick = () => {
        container.classList.add('hidden');
        if (typeof onOkClick === 'function') onOkClick();
    };
}

// === DOM Ready ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("checkout.js: DOM fully loaded.");

    const cartItemsSummaryElement = document.getElementById('cartItemsSummary');
    const orderTotalPriceElement = document.getElementById('orderTotalPrice');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const customerInfoForm = document.getElementById('customerInfoForm');
    const paymentNotification = document.getElementById('paymentNotification');
    const createAccountBtn = document.getElementById('createAccountBtn');
function transferGuestCartToUser(userEmail) {
  const guestCart = JSON.parse(localStorage.getItem("guest_cart")) || [];
  const userCartKey = `cart_${userEmail}`;
  const userCart = JSON.parse(localStorage.getItem(userCartKey)) || [];

  // Merge items (avoid duplicates by ID)
  guestCart.forEach(guestItem => {
    const existing = userCart.find(item => item.id === guestItem.id);
    if (existing) {
      existing.quantity += guestItem.quantity;
    } else {
      userCart.push(guestItem);
    }
  });

  // Save new cart to user
  localStorage.setItem(userCartKey, JSON.stringify(userCart));
  // Remove guest cart
  localStorage.removeItem("guest_cart");
  localStorage.removeItem("guestId");
}
    // === Show Password Fields for Guest ===
    const currentUser = getCurrentUser();
    if (!currentUser) {
        const guestPasswordFields = document.getElementById('guestPasswordFields');
        if (guestPasswordFields) guestPasswordFields.style.display = 'block';
    }

    // === Handle Manual Account Creation ===
    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', async () => {
            console.log("✅ createAccountBtn clicked");
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('emailAddress').value;
            const phone = document.getElementById('phone').value;
            const password = document.getElementById('newPassword').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();
            const [prenom, ...rest] = fullName.trim().split(" ");
            const nom = rest.join(" ") || prenom;
            if (password.length < 8) {
    showCustomAlert("⚠️ Le mot de passe doit contenir au moins 8 caractères.", 'error');
    setTimeout(() => window.location.reload(), 3000);
    return false;
  }
            if (!password || !confirmPassword) return showCustomAlert("❌ Merci de saisir un mot de passe et sa confirmation.", 'error');
            if (password !== confirmPassword) return showCustomAlert("❌ Les mots de passe ne correspondent pas.", 'error');
  const userData = {
    nom, prenom, email, password, telephone: phone,
  };

  try {
    const response = await fetch('https://techaven.onrender.com/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const contentType = response.headers.get("content-type");
    let result = {};

    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    }

   if (response.ok) {
  showCustomAlert("✅ Inscription réussie !");
   document.getElementById("guestPasswordFields").style.display = "none";

localStorage.setItem("currentUser", JSON.stringify({
  prenom: userData.prenom,
  nom: userData.nom,
  email: userData.email,
  telephone: userData.telephone
}));
 // ✅ Transfer guest cart to user cart
  transferGuestCartToUser(userData.email);

    } else {
      showCustomAlert("❌ " + (result.message || "Erreur lors de l'inscription."), 'error');
      setTimeout(() => window.location.reload(), 3000);
    }

  } catch (error) {
    console.error("Erreur lors de la requête :", error);
    showCustomAlert("❌ Erreur de connexion au serveur.", 'error');
    setTimeout(() => window.location.reload(), 3000);
 }
})};
   

    // === Render Cart Items ===
    function renderCheckoutCartItems() {
        const cart = getCart();
        cartItemsSummaryElement.innerHTML = '';
        if (cart.length === 0) {
            cartItemsSummaryElement.innerHTML = '<li>Votre panier est vide.</li>';
            orderTotalPriceElement.textContent = '0.00 DT';
            placeOrderBtn.disabled = true;
            return;
        }

        let subtotal = 0;
        cart.forEach(item => {
            const effectivePrice = item.promotion_price || item.price;
            const itemTotal = effectivePrice * item.cartQuantity;
            subtotal += itemTotal;

            const li = document.createElement('li');
            li.classList.add('cart-item');
            li.innerHTML = `
                <span class="cart-item-name">${item.name} (${item.cartQuantity}x)</span>
                <span class="cart-item-price">${itemTotal.toFixed(2)} TND</span>
            `;
            cartItemsSummaryElement.appendChild(li);
        });

        orderTotalPriceElement.textContent = subtotal.toFixed(2) + ' DT';
        placeOrderBtn.disabled = false;
    }

    // === Pre-fill Customer Info ===
    function prefillCustomerInfo() {
        const user = getCurrentUser();
        if (!user) return;

        document.getElementById('fullName').value = user.prenom || '';
        document.getElementById('emailAddress').value = user.email || '';
        document.getElementById('phone').value = user.telephone || '';
        document.getElementById('shippingAddress').value = `${user.adresse || ''}, ${user.ville || ''}`;
    }
    
    // === Submit Order ===
    placeOrderBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        let user = getCurrentUser();

        

        const cart = getCart();
        if (!customerInfoForm.checkValidity() || cart.length === 0) return showCustomAlert("❌ Formulaire invalide ou panier vide.", 'error');

        const payment = document.querySelector('input[name="paymentMethod"]:checked');
        if (!payment || payment.disabled) return showCustomAlert("❌ Choisissez une méthode de paiement valide.", 'error');

        const items = cart.map(item => ({
            _id: item._id,
            name: item.name,
            price: item.promotion_price || item.price,
            quantity: item.cartQuantity,
            imageUrl: item.images?.[0] ? `https://techaven.onrender.com${item.images[0]}` : 'https://via.placeholder.com/50x50?text=No+Img'
        }));

        const orderData = {
            orderId: 'ORD-' + Date.now() + Math.floor(Math.random() * 1000),
            customerInfo: {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('emailAddress').value,
                phone: document.getElementById('phone').value,
                shippingAddress: document.getElementById('shippingAddress').value
            },
            items,
            totalAmount: parseFloat(orderTotalPriceElement.textContent),
            paymentMethod: payment.value,
            orderDate: new Date().toISOString(),
            status: 'Pending'
        };
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

        try {
            const response = await fetch('https://techaven.onrender.com/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            showCustomAlert("✅ Commande enregistrée avec succès.", 'success', () => {
                clearCart();
                window.location.href = 'index.html';
            });
        } catch (err) {
            showCustomAlert("❌ Erreur serveur: " + err.message, 'error');
        }
    });

    // === Payment Method Logic ===
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.disabled) {
                paymentNotification.textContent = "Cette méthode de paiement est indisponible.";
                paymentNotification.className = "notification-message error";
                placeOrderBtn.disabled = true;
            } else {
                paymentNotification.textContent = "";
                paymentNotification.className = "notification-message";
                if (getCart().length > 0) placeOrderBtn.disabled = false;
            }
        });
    });

    // === Init ===
    renderCheckoutCartItems();
    prefillCustomerInfo();
    updateCartBadge();
});
