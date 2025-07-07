// js/cart.js

// API URL for fetching product details (needed to get full product info when adding by ID)
const API_URL = 'http://localhost:5000/api/products';

// --- NOUVELLES FONCTIONS POUR LA GESTION DE L'UTILISATEUR ET DE LA CLÉ DU PANIER ---

// Fonction pour récupérer l'utilisateur connecté depuis localStorage
function getCurrentUser() {
    try {
        const user = localStorage.getItem("currentUser");
        return user ? JSON.parse(user) : null;
    } catch (e) {
        console.error("Erreur lors de la lecture de currentUser depuis localStorage", e);
        return null;
    }
}

// Fonction pour obtenir la clé de stockage du panier spécifique à l'utilisateur
// Retourne null si l'utilisateur n'est pas connecté, empêchant le stockage persistant
function getCartStorageKey() {
    const user = getCurrentUser();
    if (user && user._id) { // Assurez-vous que l'ID de l'utilisateur est disponible
        console.log("getCartStorageKey: Utilisateur connecté. Clé:", `cart_${user._id}`); // LOG DE DÉBOGAGE
        return `cart_${user._id}`;
    }
    console.log("getCartStorageKey: Aucun utilisateur connecté. Pas de clé persistante."); // LOG DE DÉBOGAGE
    return null; // Si pas d'utilisateur connecté, pas de clé de stockage persistante.
}

// --- FIN DES NOUVELLES FONCTIONS ---


// Utility to get cart from localStorage for the current user
function getCart() {
    const storageKey = getCartStorageKey();
    if (!storageKey) {
        console.log("getCart: Pas de clé de stockage (utilisateur non connecté). Retourne panier vide."); // LOG DE DÉBOGAGE
        return []; // Retourne un panier vide si pas de clé (pas d'utilisateur connecté)
    }

    try {
        const cart = localStorage.getItem(storageKey);
        const parsedCart = cart ? JSON.parse(cart) : [];
        console.log("getCart: Panier lu depuis localStorage avec clé", storageKey, ":", parsedCart); // LOG DE DÉBOGAGE
        return parsedCart;
    } catch (e) {
        console.error("getCart: Erreur lors de la lecture du panier depuis localStorage", e);
        return [];
    }
}

// Utility to save cart to localStorage for the current user
function saveCart(cart) {
    const storageKey = getCartStorageKey();
    if (!storageKey) {
        console.warn("saveCart: Impossible de sauvegarder le panier: utilisateur non connecté ou ID manquant.");
        return; // Ne sauvegarde pas si pas de clé (pas d'utilisateur connecté)
    }

    try {
        localStorage.setItem(storageKey, JSON.stringify(cart));
        console.log("saveCart: Panier sauvegardé avec clé", storageKey, ":", cart); // LOG DE DÉBOGAGE
        updateCartBadge(); // Update badge whenever cart changes
    } catch (e) {
        console.error("saveCart: Erreur lors de la sauvegarde du panier dans localStorage", e);
    }
}

// Add a product to the cart
async function addToCart(productId, quantity = 1) {
    const user = getCurrentUser(); // Vérifie l'utilisateur au début de l'ajout
    console.log("addToCart: Appelée pour productId:", productId, "quantity:", quantity); // LOG DE DÉBOGAGE
    console.log("addToCart: Utilisateur actuel:", user); // LOG DE DÉBOGAGE

    if (!user) {
        showNotification("Veuillez vous connecter pour ajouter des articles au panier.", 'error');
        return false; // Empêche l'ajout si non connecté
    }

    let cart = getCart(); // Obtient le panier de l'utilisateur connecté

    try {
        // Fetch full product details from your backend API
        const response = await fetch(`${API_URL}/${productId}`);
        if (!response.ok) {
            throw new Error(`Produit non trouvé avec l'ID ${productId}. Statut: ${response.status}`);
        }
        const product = await response.json();
        console.log("addToCart: Détails du produit récupérés:", product); // LOG DE DÉBOGAGE

        // Check stock availability
        if (product.quantity < quantity) {
            showNotification(`Quantité insuffisante pour "${product.name}". Seulement ${product.quantity} disponible(s).`, 'error');
            return false;
        }

        const existingItemIndex = cart.findIndex(item => item._id === productId);

        if (existingItemIndex > -1) {
            // Product already in cart, update quantity
            const currentQuantityInCart = cart[existingItemIndex].cartQuantity; // Use cartQuantity for items in cart
            if (currentQuantityInCart + quantity > product.quantity) {
                showNotification(`Vous avez déjà ${currentQuantityInCart} de "${product.name}" dans le panier. Impossible d'ajouter ${quantity} de plus car seulement ${product.quantity} sont disponibles au total.`, 'error');
                return false;
            }
            cart[existingItemIndex].cartQuantity += quantity;
            console.log("addToCart: Produit existant, nouvelle quantité dans le panier:", cart[existingItemIndex].cartQuantity); // LOG DE DÉBOGAGE
        } else {
            // Add new product to cart
            product.cartQuantity = quantity; // Quantity specific to the cart item
            cart.push(product);
            console.log("addToCart: Nouveau produit ajouté au panier."); // LOG DE DÉBOGAGE
        }

        console.log("addToCart: Panier avant sauvegarde finale:", cart); // LOG DE DÉBOGAGE
        saveCart(cart); // Sauvegarde le panier mis à jour
        showNotification(`"${product.name}" (${quantity}x) ajouté au panier !`, 'success');
        return true;

    } catch (error) {
        console.error("addToCart: Erreur lors de l'ajout au panier :", error);
        showNotification(`Erreur lors de l'ajout au panier : ${error.message}`, 'error');
        return false;
    }
}

// Update quantity of an item in the cart
function updateCartItemQuantity(productId, newQuantity) {
    let cart = getCart(); // getCart() gère déjà l'utilisateur connecté
    console.log("updateCartItemQuantity: Appelée pour productId:", productId, "nouvelle quantité:", newQuantity); // LOG DE DÉBOGAGE
    const itemIndex = cart.findIndex(item => item._id === productId);

    if (itemIndex > -1) {
        const productInCart = cart[itemIndex];
        
        if (newQuantity <= 0) {
            console.log("updateCartItemQuantity: Nouvelle quantité <= 0, suppression du produit."); // LOG DE DÉBOGAGE
            removeFromCart(productId);
            return;
        }
        
        // Check against original product's total stock
        if (newQuantity > productInCart.quantity) { // 'productInCart.quantity' is the original stock
            showNotification(`Impossible de définir la quantité à ${newQuantity} pour "${productInCart.name}". Seulement ${productInCart.quantity} disponible(s).`, 'error');
            console.warn("updateCartItemQuantity: Quantité dépasse le stock."); // LOG DE DÉBOGAGE
            // La quantité dans le champ de saisie devra être corrigée par la fonction appelante (par ex., renderCartItems)
            return; // Indicate failure
        }
        
        productInCart.cartQuantity = newQuantity;
        saveCart(cart); // saveCart() gère déjà l'utilisateur connecté
        showNotification(`Quantité de "${productInCart.name}" mise à jour à ${newQuantity}.`, 'info');
        console.log("updateCartItemQuantity: Quantité mise à jour pour", productInCart.name, "à", newQuantity); // LOG DE DÉBOGAGE
    } else {
        console.warn("updateCartItemQuantity: Produit non trouvé dans le panier pour l'ID", productId); // LOG DE DÉBOGAGE
    }
}

// Remove a product from the cart
function removeFromCart(productId) {
    let cart = getCart(); // getCart() gère déjà l'utilisateur connecté
    console.log("removeFromCart: Appelée pour productId:", productId); // LOG DE DÉBOGAGE
    const initialLength = cart.length;
    cart = cart.filter(item => item._id !== productId);
    if (cart.length < initialLength) {
        saveCart(cart); // saveCart() gère déjà l'utilisateur connecté
        showNotification("Produit retiré du panier.", 'info');
        console.log("removeFromCart: Produit", productId, "retiré. Nouveau panier:", cart); // LOG DE DÉBOGAGE
    } else {
        console.warn("removeFromCart: Produit", productId, "non trouvé dans le panier pour suppression."); // LOG DE DÉBOGAGE
    }
}
// --- NEW FUNCTION: Clear the current user's cart ---
function clearCart() {
    const storageKey = getCartStorageKey(); // Get the user-specific cart key
    if (storageKey) {
        localStorage.removeItem(storageKey); // Remove the entire cart for this user
        updateCartBadge(); // Update the cart badge to 0
        showNotification("Votre panier a été vidé.", 'info'); // Optional notification
        console.log("clearCart: Panier de l'utilisateur vidé pour la clé:", storageKey); // LOG DE DÉBOGAGE
    } else {
        console.warn("clearCart: Impossible de vider le panier: utilisateur non connecté ou clé manquante.");
    }
}


// Get total number of items (quantities) in the cart for the badge
function getCartTotalItems() {
    const totalItems = getCart().reduce((total, item) => total + item.cartQuantity, 0);
    console.log("getCartTotalItems: Total des articles dans le panier:", totalItems); // LOG DE DÉBOGAGE
    return totalItems;
}

// Update the cart badge in the header
function updateCartBadge() {
    const totalItems = getCartTotalItems();

    // Update desktop badge
    const desktopBadge = document.querySelector('.main-header .badge');
    if (desktopBadge) {
        desktopBadge.textContent = totalItems;
        console.log("updateCartBadge: Desktop badge updated to:", totalItems);
    }

    // Update mobile badge
    const mobileBadge = document.getElementById('mobile-cart-count');
    if (mobileBadge) {
        mobileBadge.textContent = totalItems;
        console.log("updateCartBadge: Mobile badge updated to:", totalItems);
    }
}


// Show notification messages (success, error, info)
function showNotification(message, type = 'info') {
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        document.body.appendChild(notificationContainer);

        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '10000';
        notificationContainer.style.display = 'flex';
        notificationContainer.style.flexDirection = 'column';
        notificationContainer.style.gap = '10px';
    }

    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;

    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.fontWeight = 'bold';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else { // info
        notification.style.backgroundColor = '#007bff';
    }

    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        notification.addEventListener('transitionend', () => notification.remove(), { once: true });
    }, 3000);
}


// Initialize cart badge on page load
document.addEventListener('DOMContentLoaded', updateCartBadge);