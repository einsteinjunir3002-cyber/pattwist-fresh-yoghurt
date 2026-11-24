/**
 * Pattwist Fresh Yoghurt - Backend Server & REST API
 */

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db } = require('./database.js');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public folder and project root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Helper: Get Settings as Object
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// Generate human-friendly unique order code (e.g. PAT-9482)
function generateOrderCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PAT-${num}`;
}

// -------------------------------------------------------------
// 1. SETTINGS API
// -------------------------------------------------------------
app.get('/api/settings', (req, res) => {
  try {
    const settings = getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings object' });
    }

    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) {
      updateStmt.run(key, String(value));
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. PRODUCTS API
// -------------------------------------------------------------
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, sku, name, category, flavour, price, stock, tagline, description, image_url, badge, badge_color, is_active, created_at
      FROM products
      WHERE is_active = 1
      ORDER BY id ASC
    `).all();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { name, category, flavour, price, stock, tagline, description, image_url, badge, badge_color } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const sku = `YOG-${Date.now().toString().slice(-4)}`;
    const insert = db.prepare(`
      INSERT INTO products (sku, name, category, flavour, price, stock, tagline, description, image_url, badge, badge_color, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = insert.run(
      sku,
      name,
      category || 'Flavoured Yoghurt',
      flavour || 'Fresh',
      parseFloat(price),
      parseInt(stock || 100, 10),
      tagline || '',
      description || '',
      image_url || 'assets/images/hero-combo-bottles.jpeg',
      badge || 'Fresh',
      badge_color || 'bg-rose-500'
    );

    res.json({ success: true, id: result.lastInsertRowid, sku });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const { name, category, flavour, price, stock, tagline, description, image_url, badge, badge_color, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const update = db.prepare(`
      UPDATE products
      SET name = ?, category = ?, flavour = ?, price = ?, stock = ?, tagline = ?, description = ?, image_url = ?, badge = ?, badge_color = ?, is_active = ?
      WHERE id = ?
    `);

    update.run(
      name != null ? name : existing.name,
      category != null ? category : existing.category,
      flavour != null ? flavour : existing.flavour,
      price != null ? parseFloat(price) : existing.price,
      stock != null ? parseInt(stock, 10) : existing.stock,
      tagline != null ? tagline : existing.tagline,
      description != null ? description : existing.description,
      image_url != null ? image_url : existing.image_url,
      badge != null ? badge : existing.badge,
      badge_color != null ? badge_color : existing.badge_color,
      is_active != null ? parseInt(is_active, 10) : existing.is_active,
      req.params.id
    );

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    // Soft delete product by setting is_active = 0
    const stmt = db.prepare('UPDATE products SET is_active = 0 WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. ORDERS API
// -------------------------------------------------------------

// Place New Order (Customer)
app.post('/api/orders', (req, res) => {
  try {
    const { customer_name, customer_phone, customer_location, order_note, payment_method, items } = req.body;

    if (!customer_name || !customer_phone) {
      return res.status(400).json({ success: false, error: 'Customer name and phone number are required.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one item.' });
    }

    // Prepare products map
    const productRows = db.prepare('SELECT id, name, price, stock FROM products').all();
    const productMap = {};
    for (const p of productRows) {
      productMap[p.id] = p;
    }

    // Verify items and calculate server-side total
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = productMap[item.product_id];
      if (!product) {
        return res.status(400).json({ success: false, error: `Invalid product ID: ${item.product_id}` });
      }
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, error: `Invalid quantity for ${product.name}` });
      }
      const subtotal = product.price * qty;
      totalAmount += subtotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity: qty,
        subtotal
      });
    }

    const orderCode = generateOrderCode();

    // Insert Order in SQLite
    const insertOrder = db.prepare(`
      INSERT INTO orders (order_code, customer_name, customer_phone, customer_location, order_note, total_amount, payment_method, payment_status, order_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', 'Received')
    `);

    const orderResult = insertOrder.run(
      orderCode,
      customer_name.trim(),
      customer_phone.trim(),
      customer_location ? customer_location.trim() : '',
      order_note ? order_note.trim() : '',
      totalAmount,
      payment_method || 'Cash/MoMo on Delivery'
    );

    const orderId = orderResult.lastInsertRowid;

    // Insert Order Items & Update Stock
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?
    `);

    for (const vItem of validatedItems) {
      insertItem.run(orderId, vItem.product_id, vItem.product_name, vItem.unit_price, vItem.quantity, vItem.subtotal);
      updateStock.run(vItem.quantity, vItem.product_id);
    }

    // Settings for WhatsApp URL
    const settings = getSettings();
    const whatsappNum = settings.whatsapp_international || '233578330745';
    const currency = settings.currency || 'GH₵';

    // Format WhatsApp message
    let waText = `🥛 *CONFIRMED ORDER - PATTWIST FRESH YOGHURT* 🍓\n`;
    waText += `*Order Code:* #${orderCode}\n`;
    waText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `*Items Ordered:*\n`;
    validatedItems.forEach((it, idx) => {
      waText += `${idx + 1}. *${it.product_name}*\n   ${it.quantity}x @ ${currency}${it.unit_price} = *${currency}${it.subtotal.toFixed(2)}*\n`;
    });
    waText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `💰 *TOTAL: ${currency}${totalAmount.toFixed(2)}*\n\n`;
    waText += `📍 *Delivery Information:*\n`;
    waText += `• Name: ${customer_name}\n`;
    waText += `• Phone: ${customer_phone}\n`;
    if (customer_location) waText += `• Location: ${customer_location}\n`;
    if (order_note) waText += `• Note: ${order_note}\n`;
    waText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `Track online at: ${req.protocol}://${req.get('host')}/track?code=${orderCode}\n`;
    waText += `Please acknowledge and confirm delivery dispatch. Thank you!`;

    const whatsappUrl = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(waText)}`;

    res.json({
      success: true,
      message: 'Order placed successfully!',
      order_id: orderId,
      order_code: orderCode,
      total_amount: totalAmount,
      items: validatedItems,
      whatsapp_url: whatsappUrl,
      order_status: 'Received'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer Track Order by Code or Phone
app.get('/api/orders/track/:query', (req, res) => {
  try {
    const query = req.params.query.trim().toUpperCase();

    // Search by order_code or customer_phone
    const order = db.prepare(`
      SELECT * FROM orders
      WHERE UPPER(order_code) = ? OR customer_phone = ?
      ORDER BY id DESC LIMIT 1
    `).get(query, req.params.query.trim());

    if (!order) {
      return res.status(404).json({ success: false, error: 'No order found matching that code or phone number.' });
    }

    const items = db.prepare(`
      SELECT id, product_name, unit_price, quantity, subtotal
      FROM order_items
      WHERE order_id = ?
    `).all(order.id);

    res.json({
      success: true,
      order: {
        ...order,
        items
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: List all orders with filters
app.get('/api/admin/orders', (req, res) => {
  try {
    const { status, q } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND order_status = ?';
      params.push(status);
    }

    if (q) {
      sql += ' AND (order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY id DESC';

    const orders = db.prepare(sql).all(...params);

    // Attach items to each order
    const getItems = db.prepare('SELECT product_name, quantity, unit_price, subtotal FROM order_items WHERE order_id = ?');
    for (const order of orders) {
      order.items = getItems.all(order.id);
    }

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update Order Status
app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const { order_status, payment_status } = req.body;
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const update = db.prepare(`
      UPDATE orders
      SET order_status = COALESCE(?, order_status),
          payment_status = COALESCE(?, payment_status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(order_status || null, payment_status || null, req.params.id);

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. REVIEWS & RATINGS API
// -------------------------------------------------------------
app.get('/api/reviews', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT id, customer_name, location, rating, comment, created_at
      FROM reviews
      WHERE is_approved = 1
      ORDER BY id DESC
    `).all();
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const { customer_name, location, rating, comment } = req.body;
    if (!customer_name || !comment || !rating) {
      return res.status(400).json({ success: false, error: 'Name, rating, and comment are required.' });
    }

    const insert = db.prepare(`
      INSERT INTO reviews (customer_name, location, rating, comment, is_approved)
      VALUES (?, ?, ?, ?, 1)
    `);

    const result = insert.run(
      customer_name.trim(),
      location ? location.trim() : 'Verified Customer',
      Math.min(5, Math.max(1, parseInt(rating, 10))),
      comment.trim()
    );

    res.json({ success: true, message: 'Review submitted successfully!', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. INQUIRIES & BULK ORDERS API
// -------------------------------------------------------------
app.post('/api/inquiries', (req, res) => {
  try {
    const { name, phone, inquiry_type, message } = req.body;
    if (!name || !phone || !message) {
      return res.status(400).json({ success: false, error: 'Name, phone, and message are required.' });
    }

    const insert = db.prepare(`
      INSERT INTO inquiries (name, phone, inquiry_type, message, status)
      VALUES (?, ?, ?, ?, 'Unread')
    `);

    insert.run(name.trim(), phone.trim(), inquiry_type || 'General', message.trim());
    res.json({ success: true, message: 'Inquiry received! We will reach out shortly.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/inquiries', (req, res) => {
  try {
    const inquiries = db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all();
    res.json({ success: true, inquiries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6. ADMIN ANALYTICS API
// -------------------------------------------------------------
app.get('/api/admin/analytics', (req, res) => {
  try {
    const revenueRow = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders FROM orders').get();
    const pendingOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE order_status IN (\'Received\', \'Preparing\')').get();
    const deliveredOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE order_status = \'Delivered\'').get();
    const productsCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get();

    // Top selling items
    const topItems = db.prepare(`
      SELECT product_name, SUM(quantity) as total_qty, SUM(subtotal) as total_sales
      FROM order_items
      GROUP BY product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `).all();

    // Recent 5 orders
    const recentOrders = db.prepare(`
      SELECT id, order_code, customer_name, total_amount, order_status, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      analytics: {
        total_revenue: revenueRow.total_revenue,
        total_orders: revenueRow.total_orders,
        pending_orders: pendingOrders.count,
        delivered_orders: deliveredOrders.count,
        active_products: productsCount.count,
        top_items: topItems,
        recent_orders: recentOrders
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. DEV/DEMO HELPER: SEED SAMPLE ORDER
// -------------------------------------------------------------
app.post('/api/admin/seed-sample-order', (req, res) => {
  try {
    const sampleNames = ['Kofi Mensah', 'Akosua Darko', 'Yaw Boateng', 'Esi Osei', 'Emmanuel Ansah'];
    const sampleLocations = ['East Legon, Near ANC Mall', 'Osu, Oxford Street', 'Spintex Road', 'Airport Residential', 'Tema Community 1'];
    const samplePhone = '024' + Math.floor(1000000 + Math.random() * 9000000);

    const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const location = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
    const code = generateOrderCode();

    const orderResult = db.prepare(`
      INSERT INTO orders (order_code, customer_name, customer_phone, customer_location, order_note, total_amount, payment_method, payment_status, order_status)
      VALUES (?, ?, ?, ?, 'Chilled bottles please', 40.0, 'Cash/MoMo on Delivery', 'Pending', 'Received')
    `).run(code, name, samplePhone, location);

    const orderId = orderResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
      VALUES (?, 1, 'Strawberry Fresh Yoghurt', 10.0, 2, 20.0),
             (?, 2, 'Vanilla Fresh Yoghurt', 10.0, 2, 20.0)
    `).run(orderId, orderId);

    res.json({ success: true, message: `Sample order ${code} generated!`, order_code: code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PAGE ROUTES
// -------------------------------------------------------------
function resolvePage(filename) {
  const pubPath = path.join(__dirname, 'public', filename);
  if (require('node:fs').existsSync(pubPath)) return pubPath;
  return path.join(__dirname, filename);
}

app.get('/', (req, res) => {
  res.sendFile(resolvePage('index.html'));
});

app.get('/track', (req, res) => {
  res.sendFile(resolvePage('track.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(resolvePage('admin.html'));
});

// Export app for serverless platforms (e.g. Vercel)
module.exports = app;

// Start Server locally
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🥛 Pattwist Fresh Yoghurt Server running at http://localhost:${PORT}`);
    console.log(`   - Storefront: http://localhost:${PORT}`);
    console.log(`   - Order Tracking: http://localhost:${PORT}/track`);
    console.log(`   - Admin Dashboard: http://localhost:${PORT}/admin`);
  });
}


