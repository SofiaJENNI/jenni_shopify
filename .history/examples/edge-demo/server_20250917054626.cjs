/* Mock demo API server for JENNi Edge overlay */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
app.use(express.json());
app.use(express.static(__dirname));

// Simple logger
app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });

// Removed fingerprint endpoint - now handled server-side only

// Match: pretend we matched catalog → returns a score
app.post('/match', (req, res) => {
  const score = 0.92;
  res.json({ matched: score > 0.7, matching_score: score, match_ms: 18 });
});

// Inventory: return nearby nodes based on ZIP prefix
app.get('/inventory', (req, res) => {
  const zip = String(req.query.zip || '10001');
  const nodes = [
    { id: 'store_nyc_001', name: 'Downtown', etaMinutes: 90, distanceMiles: 3.2, stock: 7 },
    { id: 'store_nyc_002', name: 'Midtown', etaMinutes: 120, distanceMiles: 5.1, stock: 4 },
    { id: 'store_nyc_003', name: 'Uptown', etaMinutes: 150, distanceMiles: 7.4, stock: 2 },
  ];
  const bay = [
    { id: 'store_sf_001', name: 'SoMa', etaMinutes: 75, distanceMiles: 2.1, stock: 6 },
    { id: 'store_sf_002', name: 'Mission', etaMinutes: 95, distanceMiles: 3.8, stock: 5 },
  ];
  const data = zip.startsWith('94') ? bay : nodes;
  res.json({ node_count: data.length, nodes: data, inventory_ms: 22 });
});

// Resolve orchestration: combines match + inventory + simple ProfitGuard
app.post('/resolve', (req, res) => {
  const { zip = '60612', url = '' } = req.body || {};
  const score = 0.93;
  const node_count = zip.startsWith('00') ? 0 : (zip.startsWith('94') ? 2 : 3);
  const eligible = node_count > 0 && score > 0.7;
  const etaMinutes = eligible ? (zip.startsWith('94') ? 80 : 110) : null;
  const profitGuardHit = false;

  // Mock product data based on URL or generate random
  const products = [
    { title: 'Premium Wireless Headphones', brand: 'TechPro', sku: 'TP-WH-001', gtin: '123456789012', styleCode: 'WH001', price: 89.99 },
    { title: 'Smart Fitness Tracker', brand: 'ActiveLife', sku: 'AL-FT-002', gtin: '234567890123', styleCode: 'FT002', price: 129.99 },
    { title: 'Bluetooth Speaker Pro', brand: 'SoundMax', sku: 'SM-SP-003', gtin: '345678901234', styleCode: 'SP003', price: 59.99 },
    { title: 'Wireless Phone Charger', brand: 'ChargeTech', sku: 'CT-WC-004', gtin: '456789012345', styleCode: 'WC004', price: 39.99 },
    { title: 'Organic Cotton T-Shirt', brand: 'EcoWear', sku: 'EW-TS-005', gtin: '567890123456', styleCode: 'TS005', price: 24.99 }
  ];
  const product = products[Math.floor(Math.random() * products.length)];

  // Mock nearby stores with enhanced data
  const nycStores = [
    { 
      id: 'store_nyc_001', name: 'Downtown', etaMinutes: 90, distanceMiles: 3.2, stock: 7,
      margin: 12.50, floor: 8.00, pgPass: true, productMatch: true,
      website: 'https://downtown-electronics.com', productUrl: `https://downtown-electronics.com/products/${product.sku.toLowerCase()}`
    },
    { 
      id: 'store_nyc_002', name: 'Midtown', etaMinutes: 120, distanceMiles: 5.1, stock: 4,
      margin: 15.75, floor: 8.00, pgPass: true, productMatch: true,
      website: 'https://midtown-tech.com', productUrl: `https://midtown-tech.com/shop/${product.styleCode}`
    },
    { 
      id: 'store_nyc_003', name: 'Uptown', etaMinutes: 150, distanceMiles: 7.4, stock: 2,
      margin: 6.25, floor: 8.00, pgPass: false, productMatch: false,
      website: 'https://uptown-store.com'
    }
  ];

  const bayStores = [
    { 
      id: 'store_sf_001', name: 'SoMa', etaMinutes: 75, distanceMiles: 2.1, stock: 6,
      margin: 18.50, floor: 8.00, pgPass: true, productMatch: true,
      website: 'https://soma-tech.com', productUrl: `https://soma-tech.com/products/${product.sku}`
    },
    { 
      id: 'store_sf_002', name: 'Mission', etaMinutes: 95, distanceMiles: 3.8, stock: 5,
      margin: 14.25, floor: 8.00, pgPass: true, productMatch: true,
      website: 'https://mission-electronics.com'
    }
  ];

  const nodes = zip.startsWith('94') ? bayStores : nycStores;

  // Mock ProfitGuard economics
  const profitGuard = {
    price: product.price,
    buy_cost: product.price * 0.65,
    courier_est: 8.50,
    fee: 2.25,
    margin: product.price * 0.65 - 8.50 - 2.25,
    floor: 8.00
  };

  res.json({
    eligible,
    etaMinutes,
    matching_score: score,
    node_count,
    profitGuardHit,
    resolve_ms: 42,
    product: {
      ...product,
      fingerprintQuality: 'high',
      matchConfidence: score,
      matchType: 'exact'
    },
    nodes: eligible ? nodes.slice(0, node_count) : [],
    profitGuard
  });
});

// Export: stub a report
app.post('/export', (_req, res) => {
  res.json({ ok: true, url: 'https://example.com/export/demo.csv' });
});

// Test-order: simulate a courier order
app.post('/test-order', (_req, res) => {
  res.json({ ok: true, orderId: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, trackingUrl: 'https://example.com/tracking/ABC123' });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 JENNi Edge Demo Server`);
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`🧪 Enhanced with product data and checkout modal`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   POST /resolve - Get eligibility with product data`);
  console.log(`   GET  /inventory - Get nearby stores`);
  console.log(`   POST /match - Product matching`);
  console.log(`   POST /test-order - Test order submission`);
  console.log(`\n🎯 Test the enhanced checkout modal with product extraction!\n`);
});

