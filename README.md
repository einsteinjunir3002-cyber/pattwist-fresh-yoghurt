# Pattwist Fresh Yoghurt - Full-Stack E-Commerce Platform

A complete, production-ready, full-stack e-commerce website and business operating system for **Pattwist Fresh Yoghurt**. Built with an inspiring frontend, a robust Node.js/Express backend, and a real SQLite database.

---

## 🥛 Business & Contact Information
- **Brand:** Pattwist Fresh Yoghurt
- **Direct Phone:** [0504875191](tel:0504875191)
- **WhatsApp Line:** [0578330745](https://wa.me/233578330745)
- **Flavours & Pricing:**
  - 🍓 **Strawberry Fresh Yoghurt** — GH₵ 10.00
  - 🍦 **Vanilla Fresh Yoghurt** — GH₵ 10.00
  - 🎁 **Pattwist 6-Pack Combo** (3 Strawberry + 3 Vanilla) — GH₵ 60.00

---

## 🏛️ System Architecture

### 1. **Frontend (Storefront & Portals)**
- **Customer Storefront (`index.html`)**:
  - Hero presentation showcasing real photography and video clips of chilled product batches.
  - Dynamic products grid connected to `/api/products`.
  - Slide-out shopping cart with quantity controls and real-time total calculation in Ghana Cedis (`GH₵`).
  - Checkout form that saves orders directly to the backend database and generates one-click WhatsApp confirmation messages.
  - Dynamic customer reviews section with interactive review submission modal (`POST /api/reviews`).
- **Customer Order Tracker (`track.html`)**:
  - Live 4-step progress tracker: `Received` ➔ `Chilling & Preparing` ➔ `Out for Delivery` ➔ `Delivered`.
  - Itemized receipt breakdown and direct WhatsApp dispatcher link.
- **Admin Dashboard (`admin.html`)**:
  - Real-time KPI summary (Total Sales, Total Orders, Pending Deliveries, Active Inventory).
  - Order management table with search, status filter, and inline status updates.
  - One-click customer WhatsApp communication.
  - Product catalog manager (add new flavours, edit prices, update stock, toggle availability).
  - Inquiries & customer review moderation.
  - "+ Add Sample Order" button for testing and demonstrations.

### 2. **Backend & REST API (`server.js`)**
- Node.js & Express RESTful API.
- Endpoints:
  - `GET /api/products` & `GET /api/products/:id` (Active products)
  - `POST /api/products` & `PUT /api/products/:id` & `DELETE /api/products/:id` (Admin product CRUD)
  - `POST /api/orders` (Order placement with server-side price verification and stock decrement)
  - `GET /api/orders/track/:code` (Customer order lookup by code or phone)
  - `GET /api/admin/orders` (Admin filtered order list)
  - `PATCH /api/orders/:id/status` (Update order and payment status)
  - `GET /api/admin/analytics` (Sales metrics, top-selling flavours, order volumes)
  - `GET /api/reviews` & `POST /api/reviews` (Customer reviews)
  - `POST /api/inquiries` & `GET /api/admin/inquiries` (Contact & bulk event requests)
  - `POST /api/admin/seed-sample-order` (Testing helper)

### 3. **Database Layer (`database.js` & `data/pattwist.db`)**
- High-performance relational database powered by Node.js native `DatabaseSync` (`node:sqlite`).
- Tables:
  - `products`: SKU, name, flavour, price, stock, description, image, badge.
  - `orders`: Unique order code (`#PAT-XXXX`), customer name, phone, location, total, status.
  - `order_items`: Line items linked to orders with foreign keys.
  - `reviews`: Customer name, rating, comment, approval flag.
  - `inquiries`: Bulk and event inquiries.
  - `settings`: Business phone numbers, WhatsApp, announcement banners.

---

## 📁 Project Directory Structure

```
Pattwist/
│
├── server.js               # Express backend & REST API routes
├── database.js             # SQLite schema, tables, and seed data
├── package.json            # Node.js dependencies
│
├── index.html              # Customer storefront
├── track.html              # Customer live order tracking portal
├── admin.html              # Staff operations & order management dashboard
│
├── styles.css              # Custom styling, animations, and gradients
├── app.js                  # Storefront client logic & API integration
├── admin.js                # Admin dashboard operations & live updates
│
├── data/
│   └── pattwist.db         # Persistent SQLite database file
│
├── assets/
│   ├── images/
│   │   ├── hero-combo-bottles.jpeg
│   │   ├── strawberry-trio.jpeg
│   │   └── vanilla-trio.jpeg
│   └── videos/
│       ├── pattwist-fresh.mp4
│       └── pattwist-short.mp4
│
└── Media/                  # Original user photos and videos
```

---

## 🚀 Running the Application

### 1. Start Server
Run in your terminal:
```bash
npm start
# or
node server.js
```

### 2. Access the Applications
- **Customer Storefront:** [http://localhost:8080](http://localhost:8080)
- **Live Order Tracker:** [http://localhost:8080/track](http://localhost:8080/track)
- **Staff Admin Dashboard:** [http://localhost:8080/admin](http://localhost:8080/admin)
