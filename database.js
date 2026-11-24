/**
 * Database Module for Pattwist Fresh Yoghurt
 * Supports Node.js native SQLite (`node:sqlite`) with fallback for serverless/read-only hosts
 */

const path = require('node:path');
const fs = require('node:fs');

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn("Could not create data dir:", e);
  }
}

const DB_PATH = path.join(DATA_DIR, 'pattwist.db');

// If in serverless and seed database exists in project, copy it to /tmp
if (isVercel && !fs.existsSync(DB_PATH)) {
  const seedDb = path.join(__dirname, 'data', 'pattwist.db');
  if (fs.existsSync(seedDb)) {
    try {
      fs.copyFileSync(seedDb, DB_PATH);
    } catch (e) {
      console.warn("Could not copy seed DB:", e);
    }
  }
}

let db;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('✅ SQLite engine initialized at:', DB_PATH);
} catch (err) {
  console.warn('⚠️ Native node:sqlite not available, using high-compatibility JSON store:', err.message);
  // High-compatibility fallback store matching SQLite API
  db = createFallbackStore(DB_PATH);
}

/**
 * Initialize Database Tables
 */
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        flavour TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 100,
        tagline TEXT,
        description TEXT,
        image_url TEXT,
        badge TEXT,
        badge_color TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_location TEXT,
        order_note TEXT,
        total_amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'Cash/MoMo on Delivery',
        payment_status TEXT DEFAULT 'Pending',
        order_status TEXT DEFAULT 'Received',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        location TEXT,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        is_approved INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        inquiry_type TEXT DEFAULT 'General',
        message TEXT NOT NULL,
        status TEXT DEFAULT 'Unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    seedInitialData();
  } catch (e) {
    console.error("Init database error:", e);
  }
}

/**
 * Seed Initial Products & Default Settings if empty
 */
function seedInitialData() {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (!countRow || countRow.count === 0) {
      const insertProduct = db.prepare(`
        INSERT INTO products (sku, name, category, flavour, price, stock, tagline, description, image_url, badge, badge_color, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      insertProduct.run(
        'YOG-STR-01',
        'Strawberry Fresh Yoghurt',
        'Flavoured Yoghurt',
        'Strawberry',
        10.0,
        120,
        'Sweet & Fruity Berry Delight',
        'Wholesome, naturally creamy yogurt with an irresistible, rich strawberry infusion. Cold, thick, and utterly refreshing.',
        'assets/images/strawberry-trio.jpeg',
        'Bestseller',
        'bg-rose-500'
      );

      insertProduct.run(
        'YOG-VAN-01',
        'Vanilla Fresh Yoghurt',
        'Flavoured Yoghurt',
        'Vanilla',
        10.0,
        140,
        'Velvety Smooth Classic',
        'Soothing natural vanilla aroma swirled into velvety, thick yogurt cream. The comforting classic that never disappoints.',
        'assets/images/vanilla-trio.jpeg',
        'Fan Favorite',
        'bg-amber-500'
      );

      insertProduct.run(
        'YOG-COM-06',
        'Pattwist 6-Pack Combo (3 Strawberry + 3 Vanilla)',
        'Value Bundle',
        'Mixed (Strawberry & Vanilla)',
        60.0,
        45,
        'Best of Both Worlds',
        'Can\'t decide? Treat yourself or your family to 3 bottles of Strawberry and 3 bottles of Vanilla. Ideal for sharing or stocking up.',
        'assets/images/hero-combo-bottles.jpeg',
        'Special Pack',
        'bg-emerald-600'
      );
    }

    const reviewCount = db.prepare('SELECT COUNT(*) as count FROM reviews').get();
    if (!reviewCount || reviewCount.count === 0) {
      const insertReview = db.prepare(`
        INSERT INTO reviews (customer_name, location, rating, comment)
        VALUES (?, ?, ?, ?)
      `);

      insertReview.run(
        'Abena K.',
        'Accra',
        5,
        'The thickness is incredible! Most yoghurts on the market feel like milk with sugar, but Pattwist has that genuine rich yogurt texture. The strawberry is my absolute favorite.'
      );

      insertReview.run(
        'Michael O.',
        'East Legon',
        5,
        'Ordered 12 bottles for my office team and everyone was asking where I got it from. Delivered super cold and right on time. At 10 cedis, it\'s a steal!'
      );

      insertReview.run(
        'Felicia A.',
        'Kumasi',
        5,
        'The vanilla flavor is so soothing and gentle. Not overly sweet, just natural and creamy. My kids won\'t drink any other brand now.'
      );
    }

    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    if (!settingsCount || settingsCount.count === 0) {
      const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
      insertSetting.run('business_name', 'Pattwist Fresh Yoghurt');
      insertSetting.run('phone_call', '0504875191');
      insertSetting.run('phone_whatsapp', '0578330745');
      insertSetting.run('whatsapp_international', '233578330745');
      insertSetting.run('currency', 'GH₵');
      insertSetting.run('banner_announcement', '✨ Fresh batch chilled & ready today! Only GH₵ 10 per bottle');
    }
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

/**
 * Fallback In-Memory / JSON Store implementation if native sqlite is unavailable
 */
function createFallbackStore(filePath) {
  let store = {
    products: [],
    orders: [],
    order_items: [],
    reviews: [],
    inquiries: [],
    settings: {}
  };

  const jsonPath = filePath.replace('.db', '.json');
  if (fs.existsSync(jsonPath)) {
    try {
      store = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {}
  }

  const save = () => {
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(store, null, 2));
    } catch (e) {}
  };

  return {
    exec: () => {},
    prepare: (sql) => {
      const cleanSql = sql.trim().toLowerCase();
      return {
        all: (...params) => {
          if (cleanSql.includes('from products')) {
            if (cleanSql.includes('is_active = 1')) return store.products.filter(p => p.is_active);
            return [...store.products];
          }
          if (cleanSql.includes('from orders')) {
            return [...store.orders].reverse();
          }
          if (cleanSql.includes('from order_items')) {
            const orderId = params[0];
            return store.order_items.filter(i => i.order_id === orderId);
          }
          if (cleanSql.includes('from reviews')) {
            return store.reviews.filter(r => r.is_approved).reverse();
          }
          if (cleanSql.includes('from inquiries')) {
            return [...store.inquiries].reverse();
          }
          if (cleanSql.includes('from settings')) {
            return Object.entries(store.settings).map(([key, value]) => ({ key, value }));
          }
          return [];
        },
        get: (...params) => {
          if (cleanSql.includes('count(*) as count from products')) {
            return { count: store.products.length };
          }
          if (cleanSql.includes('count(*) as count from reviews')) {
            return { count: store.reviews.length };
          }
          if (cleanSql.includes('count(*) as count from settings')) {
            return { count: Object.keys(store.settings).length };
          }
          if (cleanSql.includes('from products where id =')) {
            const id = params[0];
            return store.products.find(p => p.id === parseInt(id, 10)) || null;
          }
          if (cleanSql.includes('from orders where upper(order_code) =')) {
            const code = String(params[0]).toUpperCase();
            return store.orders.find(o => o.order_code === code || o.customer_phone === params[1]) || null;
          }
          if (cleanSql.includes('sum(total_amount)')) {
            const total = store.orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
            return { total_revenue: total, total_orders: store.orders.length };
          }
          if (cleanSql.includes('pending_orders')) {
            const count = store.orders.filter(o => o.order_status === 'Received' || o.order_status === 'Preparing').length;
            return { count };
          }
          return null;
        },
        run: (...params) => {
          if (cleanSql.startsWith('insert into products')) {
            const id = store.products.length + 1;
            store.products.push({
              id, sku: params[0], name: params[1], category: params[2], flavour: params[3],
              price: params[4], stock: params[5], tagline: params[6], description: params[7],
              image_url: params[8], badge: params[9], badge_color: params[10], is_active: 1, created_at: new Date().toISOString()
            });
            save();
            return { lastInsertRowid: id };
          }
          if (cleanSql.startsWith('insert into orders')) {
            const id = store.orders.length + 1;
            store.orders.push({
              id, order_code: params[0], customer_name: params[1], customer_phone: params[2],
              customer_location: params[3], order_note: params[4], total_amount: params[5],
              payment_method: params[6], payment_status: 'Pending', order_status: 'Received',
              created_at: new Date().toISOString()
            });
            save();
            return { lastInsertRowid: id };
          }
          if (cleanSql.startsWith('insert into order_items')) {
            const id = store.order_items.length + 1;
            store.order_items.push({
              id, order_id: params[0], product_id: params[1], product_name: params[2],
              unit_price: params[3], quantity: params[4], subtotal: params[5]
            });
            save();
            return { lastInsertRowid: id };
          }
          if (cleanSql.startsWith('insert into reviews')) {
            const id = store.reviews.length + 1;
            store.reviews.push({
              id, customer_name: params[0], location: params[1], rating: params[2],
              comment: params[3], is_approved: 1, created_at: new Date().toISOString()
            });
            save();
            return { lastInsertRowid: id };
          }
          if (cleanSql.startsWith('insert into inquiries')) {
            const id = store.inquiries.length + 1;
            store.inquiries.push({
              id, name: params[0], phone: params[1], inquiry_type: params[2],
              message: params[3], status: 'Unread', created_at: new Date().toISOString()
            });
            save();
            return { lastInsertRowid: id };
          }
          if (cleanSql.includes('insert or replace into settings')) {
            store.settings[params[0]] = params[1];
            save();
            return {};
          }
          if (cleanSql.startsWith('update orders')) {
            const order = store.orders.find(o => o.id === parseInt(params[2], 10));
            if (order) {
              if (params[0]) order.order_status = params[0];
              if (params[1]) order.payment_status = params[1];
              save();
            }
            return {};
          }
          return {};
        }
      };
    }
  };
}

initDatabase();

module.exports = {
  db,
  initDatabase
};
