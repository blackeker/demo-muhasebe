const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'database.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder and file exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const defaultData = {
  customers: [
    {
      id: "demo-cust-1",
      name: "Ahmet Yılmaz",
      phone: "05551234567",
      notes: "Örnek Müşteri",
      createdAt: new Date().toISOString(),
      sales: [
        {
          id: "sale-1",
          date: new Date().toISOString().split('T')[0],
          description: "Ofis Tadilat ve Malzeme Hizmeti",
          amount: 15000,
          installmentsCount: 3,
          installments: [
            { id: "inst-1", no: 1, dueDate: new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0], amount: 5000, paid: 5000, paidDate: new Date().toISOString().split('T')[0] },
            { id: "inst-2", no: 2, dueDate: new Date(Date.now() + 35*24*60*60*1000).toISOString().split('T')[0], amount: 5000, paid: 0, paidDate: null },
            { id: "inst-3", no: 3, dueDate: new Date(Date.now() + 65*24*60*60*1000).toISOString().split('T')[0], amount: 5000, paid: 0, paidDate: null }
          ]
        }
      ],
      payments: [
        {
          id: "pay-1",
          date: new Date().toISOString().split('T')[0],
          amount: 5000,
          description: "1. Taksit Nakit Tahsilat"
        }
      ]
    }
  ],
  settings: {
    businessName: "Muhasebe Demo",
    currency: "₺",
    cloudSyncUrl: ""
  }
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("DB Load Error:", err);
    return defaultData;
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error("DB Save Error:", err);
    return false;
  }
}

// API Routes
app.get('/api/data', (req, res) => {
  const db = loadDatabase();
  res.json({ success: true, data: db });
});

app.post('/api/data/sync', (req, res) => {
  const incomingData = req.body;
  if (!incomingData || !Array.isArray(incomingData.customers)) {
    return res.status(400).json({ success: false, message: "Geçersiz veri formatı" });
  }
  const saved = saveDatabase(incomingData);
  if (saved) {
    res.json({ success: true, message: "Veriler başarıyla kaydedildi", data: incomingData });
  } else {
    res.status(500).json({ success: false, message: "Veri kaydedilemedi" });
  }
});

// Network IP helper to easily open on phone
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`=======================================================`);
  console.log(`🚀 Muhasebe Demo Sunucusu Başlatıldı!`);
  console.log(`💻 PC'den erişim:     http://localhost:${PORT}`);
  console.log(`📱 Telefondan erişim:  http://${localIp}:${PORT}`);
  console.log(`=======================================================`);
});
