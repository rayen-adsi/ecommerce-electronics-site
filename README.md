# ⚡ ElectroMart – E-Commerce Website for Electronic Products

ElectroMart is a fully functional e-commerce platform built during my internship to showcase the purchase and management of electronic products including PCs, smartphones, and smart devices.

This project covers everything from product display to order processing, admin management, and review systems.

## 📦 Features

### 👨‍💻 Frontend
- Responsive UI with HTML, CSS, JavaScript
- Product listing and detail pages
- Shopping cart with quantity management
- Review submission with media preview
- Order placement with payment summary
- Password reset & user authentication

### 🔧 Backend (Node.js + Express)
- RESTful API structure
- MongoDB for database management
- User registration and login (with password hashing)
- Order management (status updates)
- Admin panel to manage products, users, orders
- Review system with media uploads
- Email-based password reset functionality

## 🛠 Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Security**: bcrypt, JWT
- **Media Uploads**: Multer
- **Templating & Layouts**: HTML templates
- **Other**: GitHub, REST API

## 📂 Folder Structure
.
├── backend/
│ ├── models/ # Mongoose schemas (Users, Products, Orders, Reviews)
│ ├── routes/ # API routes
│ ├── uploads/ # Uploaded images/reviews
│ └── server.js # Main Express app
├── frontend/
│ ├── index.html # Homepage
│ ├── pc.html
│ ├── smarthones.html
│ ├── smarthings.html
| ├──product-detail.html
│ ├── cart.html # Cart page
│ └── js/ # JavaScript files
├── README.md
└── .gitignore
## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/rayen-adsi/ecommerce-electronics-site
cd electromart
