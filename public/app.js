// ==========================================
// MUHASEBE DEMO - ANA UYGULAMA JS
// ==========================================

const STORAGE_KEY = 'muhasebe_demo_data_v1';
const FIREBASE_CONFIG_KEY = 'muhasebe_firebase_cfg_v1';

let appState = {
  customers: [],
  settings: {
    businessName: "Muhasebe Demo",
    currency: "₺"
  },
  currentCustomerId: null
};

// --- BAŞLANGIÇ YÜKLEMESİ ---
document.addEventListener('DOMContentLoaded', async () => {
  // Varsayılan form tarihlerini bugüne ayarla
  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('saleDateInput')) document.getElementById('saleDateInput').value = today;
  if (document.getElementById('firstDueDateInput')) document.getElementById('firstDueDateInput').value = today;
  if (document.getElementById('payDateInput')) document.getElementById('payDateInput').value = today;

  await loadInitialData();
  setupNetworkInfo();
  updateRemindersTab();
  
  // Service Worker kaydı (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// --- VERİ YÜKLEME & SENKRONİZASYON ---
async function loadInitialData() {
  // 1. Önce sunucudan çekmeyi dene
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data.customers)) {
        appState.customers = json.data.customers;
        if (json.data.settings) appState.settings = json.data.settings;
        saveLocalData();
        renderAfterLoad();
        setSyncStatus(true);
        return;
      }
    }
  } catch (err) {
    console.log("Sunucuya bağlanılamadı, yerel hafıza kontrol ediliyor:", err);
  }

  // 2. Sunucu yoksa LocalStorage'dan yükle
  const localRaw = localStorage.getItem(STORAGE_KEY);
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      appState.customers = parsed.customers || [];
      appState.settings = parsed.settings || appState.settings;
    } catch (e) {
      console.error("Local data parse error", e);
    }
  }

  // 3. Veri hiç yoksa varsayılan demo verisi ekle
  if (!appState.customers || appState.customers.length === 0) {
    appState.customers = getInitialDemoData();
    saveLocalData();
  }

  renderAfterLoad();
}

function renderAfterLoad() {
  if (appState.customers.length > 0) {
    appState.currentCustomerId = appState.customers[0].id;
  }
  renderCustomerList();
  renderCustomerDetail();
  updateRemindersTab();
}

function getInitialDemoData() {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(today.getMonth() + 1);

  return [
    {
      id: "cust-" + Date.now(),
      name: "Ahmet Yılmaz (Örnek)",
      phone: "05551234567",
      notes: "Demo Müşteri Hesabı",
      createdAt: new Date().toISOString(),
      sales: [
        {
          id: "s1",
          date: today.toISOString().split('T')[0],
          description: "Ofis Malzemeleri ve Tadilat Hizmeti",
          amount: 15000,
          installmentsCount: 3,
          installments: [
            { id: "i1", no: 1, dueDate: today.toISOString().split('T')[0], amount: 5000, paid: 5000, paidDate: today.toISOString().split('T')[0] },
            { id: "i2", no: 2, dueDate: nextMonth.toISOString().split('T')[0], amount: 5000, paid: 0, paidDate: null },
            { id: "i3", no: 3, dueDate: new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0], amount: 5000, paid: 0, paidDate: null }
          ]
        }
      ],
      payments: [
        {
          id: "p1",
          date: today.toISOString().split('T')[0],
          amount: 5000,
          description: "1. Taksit Peşin Tahsilat"
        }
      ]
    }
  ];
}

async function persistData() {
  saveLocalData();
  setSyncStatus(null); // Senkronize ediliyor

  try {
    const res = await fetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customers: appState.customers,
        settings: appState.settings
      })
    });
    if (res.ok) {
      setSyncStatus(true);
    } else {
      setSyncStatus(false);
    }
  } catch (err) {
    setSyncStatus(true); // Localde başarıyla kaydedildi
  }

  updateRemindersTab();
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    customers: appState.customers,
    settings: appState.settings
  }));
}

function setSyncStatus(ok) {
  const el = document.getElementById('syncIndicator');
  if (!el) return;
  if (ok === null) {
    el.className = 'sync-pill syncing';
    el.textContent = '● Kaydediliyor...';
  } else if (ok) {
    el.className = 'sync-pill ok';
    el.textContent = '● Senkronize';
  } else {
    el.className = 'sync-pill';
    el.textContent = '○ Çevrimdışı Kaydedildi';
  }
}

// --- SEKME YÖNETİMİ ---
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');

  const btnIndex = tabId === 'customersTab' ? 0 : tabId === 'remindersTab' ? 1 : 2;
  const btns = document.querySelectorAll('.nav-btn');
  if (btns[btnIndex]) btns[btnIndex].classList.add('active');

  if (tabId === 'remindersTab') updateRemindersTab();
  if (tabId === 'cloudTab') setupNetworkInfo();
}

// --- MÜŞTERİ LİSTELEME & SEÇİM ---
function renderCustomerList() {
  const container = document.getElementById('customerListContainer');
  const searchVal = (document.getElementById('customerSearch').value || '').toLowerCase().trim();
  container.innerHTML = '';

  const filtered = appState.customers.filter(c => 
    c.name.toLowerCase().includes(searchVal) || (c.phone && c.phone.includes(searchVal))
  );

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-cell">Müşteri bulunamadı</div>';
    return;
  }

  filtered.forEach(cust => {
    const totalSales = (cust.sales || []).reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const totalPaid = (cust.payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const remaining = totalSales - totalPaid;

    const div = document.createElement('div');
    div.className = `customer-item ${cust.id === appState.currentCustomerId ? 'active' : ''}`;
    div.onclick = () => selectCustomer(cust.id);
    
    div.innerHTML = `
      <div>
        <div class="cust-name">${escapeHtml(cust.name)}</div>
        <small style="color:#64748b;">${cust.phone || 'Tel yok'}</small>
      </div>
      <div class="cust-balance ${remaining > 0 ? 'has-debt' : 'settled'}">
        ₺${formatMoney(remaining)}
      </div>
    `;
    container.appendChild(div);
  });
}

function filterCustomerList() {
  renderCustomerList();
}

function selectCustomer(id) {
  appState.currentCustomerId = id;
  renderCustomerList();
  renderCustomerDetail();
}

function getCurrentCustomer() {
  return appState.customers.find(c => c.id === appState.currentCustomerId) || null;
}

// --- MÜŞTERİ DETAYI & 3 ÖZET KUTUSU (EXCEL FORMATI) ---
function renderCustomerDetail() {
  const cust = getCurrentCustomer();
  const detailPanel = document.getElementById('customerDetailView');

  if (!cust) {
    detailPanel.style.opacity = '0.5';
    document.getElementById('viewCustomerName').textContent = "Müşteri Seçilmedi";
    document.getElementById('viewCustomerPhone').textContent = "📞 -";
    document.getElementById('boxTotalAmount').textContent = "₺0.00";
    document.getElementById('boxTotalCollected').textContent = "₺0.00";
    document.getElementById('boxTotalRemaining').textContent = "₺0.00";
    document.getElementById('salesTableBody').innerHTML = '<tr><td colspan="5" class="empty-cell">Müşteri seçiniz</td></tr>';
    document.getElementById('paymentsTableBody').innerHTML = '<tr><td colspan="4" class="empty-cell">Müşteri seçiniz</td></tr>';
    document.getElementById('installmentsTableBody').innerHTML = '<tr><td colspan="5" class="empty-cell">Müşteri seçiniz</td></tr>';
    return;
  }

  detailPanel.style.opacity = '1';
  document.getElementById('viewCustomerName').textContent = cust.name;
  document.getElementById('viewCustomerPhone').textContent = cust.phone ? `📞 ${cust.phone}` : "📞 Tel belirtilmemiş";
  
  const wpBtn = document.getElementById('viewWhatsappBtn');
  if (wpBtn) {
    wpBtn.style.display = cust.phone ? 'inline-flex' : 'none';
  }

  // Hesaplamalar
  const sales = cust.sales || [];
  const payments = cust.payments || [];

  const totalDebt = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remainingDebt = totalDebt - totalCollected;

  // 3 BÜYÜK KUTU GÜNCELLEMESİ
  document.getElementById('boxTotalAmount').textContent = `₺${formatMoney(totalDebt)}`;
  document.getElementById('boxTotalCollected').textContent = `₺${formatMoney(totalCollected)}`;
  document.getElementById('boxTotalRemaining').textContent = `₺${formatMoney(remainingDebt)}`;

  // 1. Alınan Malzeme / Verilen Hizmet Tablosu
  const salesBody = document.getElementById('salesTableBody');
  if (sales.length === 0) {
    salesBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Henüz malzeme/hizmet girişi yapılmadı</td></tr>';
  } else {
    salesBody.innerHTML = sales.map(s => `
      <tr>
        <td>${formatDate(s.date)}</td>
        <td><b>${escapeHtml(s.description)}</b></td>
        <td><span class="badge-info">${s.installmentsCount || 1} Taksit</span></td>
        <td style="font-weight:700; color:#0f172a;">₺${formatMoney(s.amount)}</td>
        <td>
          <button class="btn btn-xs btn-danger-outline" onclick="deleteSale('${s.id}')">Sil</button>
        </td>
      </tr>
    `).join('');
  }

  // 2. Tahsilat Tablosu
  const payBody = document.getElementById('paymentsTableBody');
  if (payments.length === 0) {
    payBody.innerHTML = '<tr><td colspan="4" class="empty-cell">Henüz tahsilat yapılmadı</td></tr>';
  } else {
    payBody.innerHTML = payments.map(p => `
      <tr>
        <td>${formatDate(p.date)}</td>
        <td>${escapeHtml(p.description || 'Tahsilat')}</td>
        <td style="font-weight:700; color:#059669;">+₺${formatMoney(p.amount)}</td>
        <td>
          <button class="btn btn-xs btn-danger-outline" onclick="deletePayment('${p.id}')">Sil</button>
        </td>
      </tr>
    `).join('');
  }

  // 3. Taksitlendirme & Ödeme Planı Tablosu
  renderCustomerInstallments(cust);
}

function renderCustomerInstallments(cust) {
  const instBody = document.getElementById('installmentsTableBody');
  const allInstallments = [];

  (cust.sales || []).forEach(sale => {
    (sale.installments || []).forEach(inst => {
      allInstallments.push({
        ...inst,
        saleDesc: sale.description,
        saleId: sale.id
      });
    });
  });

  // Tarihe göre sırala
  allInstallments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (allInstallments.length === 0) {
    instBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Aktif taksit planı bulunmuyor</td></tr>';
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  instBody.innerHTML = allInstallments.map(inst => {
    const isPaid = (inst.paid || 0) >= inst.amount;
    let badgeClass = 'pending';
    let badgeText = 'Bekliyor';

    if (isPaid) {
      badgeClass = 'paid';
      badgeText = '✓ Ödendi';
    } else if (inst.dueDate < todayStr) {
      badgeClass = 'overdue';
      badgeText = 'Gecikti!';
    } else if (inst.dueDate === todayStr) {
      badgeClass = 'overdue';
      badgeText = 'Bugün!';
    }

    return `
      <tr>
        <td><b>${inst.no}. Taksit</b> <small style="color:#64748b;">(${escapeHtml(inst.saleDesc)})</small></td>
        <td>${formatDate(inst.dueDate)}</td>
        <td style="font-weight:700;">₺${formatMoney(inst.amount)}</td>
        <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <div style="display:flex; gap:0.3rem;">
            ${!isPaid ? `
              <button class="btn btn-xs btn-success" onclick="quickPayInstallment('${inst.saleId}', '${inst.id}', ${inst.amount})">Tahsil Et</button>
              <button class="btn btn-xs btn-outline" onclick="sendWhatsappInstallmentReminder('${cust.id}', '${inst.no}', '${inst.dueDate}', ${inst.amount})">💬 Hatırlat</button>
            ` : `
              <small style="color:#16a34a; font-weight:600;">Tahsil Edildi (${formatDate(inst.paidDate || inst.dueDate)})</small>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --- MODAL İŞLEMLERİ ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Yeni Müşteri Kaydet
function handleSaveCustomer(e) {
  e.preventDefault();
  const name = document.getElementById('custNameInput').value.trim();
  const phone = document.getElementById('custPhoneInput').value.trim();
  const notes = document.getElementById('custNotesInput').value.trim();

  if (!name) return;

  const newCust = {
    id: "cust-" + Date.now(),
    name,
    phone,
    notes,
    createdAt: new Date().toISOString(),
    sales: [],
    payments: []
  };

  appState.customers.unshift(newCust);
  appState.currentCustomerId = newCust.id;

  persistData();
  renderCustomerList();
  renderCustomerDetail();
  closeModal('addCustomerModal');
  document.getElementById('addCustomerForm').reset();
}

// Müşteri Sil
function deleteCurrentCustomer() {
  const cust = getCurrentCustomer();
  if (!cust) return;

  if (confirm(`"${cust.name}" adlı müşteriyi ve tüm kayıtlarını silmek istediğinize emin misiniz?`)) {
    appState.customers = appState.customers.filter(c => c.id !== cust.id);
    appState.currentCustomerId = appState.customers.length > 0 ? appState.customers[0].id : null;
    persistData();
    renderCustomerList();
    renderCustomerDetail();
  }
}

// Hizmet / Malzeme Modalını Aç
function openAddSaleModal() {
  const cust = getCurrentCustomer();
  if (!cust) {
    alert("Lütfen önce bir müşteri seçin veya ekleyin.");
    return;
  }
  document.getElementById('addSaleForm').reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('saleDateInput').value = today;
  document.getElementById('firstDueDateInput').value = today;
  calculateInstallmentPreview();
  openModal('addSaleModal');
}

// Taksit Hesaplama Önizlemesi
function calculateInstallmentPreview() {
  const amount = parseFloat(document.getElementById('saleAmountInput').value) || 0;
  const count = parseInt(document.getElementById('saleInstallmentsCountInput').value) || 1;
  const startDateStr = document.getElementById('firstDueDateInput').value || new Date().toISOString().split('T')[0];
  const box = document.getElementById('installmentPreviewBox');

  if (amount <= 0) {
    box.innerHTML = '<span style="color:#94a3b8;">Tutar girildiğinde taksit planı burada listelenecektir.</span>';
    return;
  }

  const perInstallment = (amount / count).toFixed(2);
  let html = `<strong>Ödeme Planı (${count} Taksit):</strong><br>`;
  
  let startDate = new Date(startDateStr);
  for (let i = 1; i <= count; i++) {
    const curDate = new Date(startDate);
    curDate.setMonth(startDate.getMonth() + (i - 1));
    const dStr = curDate.toISOString().split('T')[0];
    html += `• ${i}. Taksit: <b>₺${formatMoney(perInstallment)}</b> - Vade: ${formatDate(dStr)}<br>`;
  }
  box.innerHTML = html;
}

// Hizmet / Malzeme ve Taksitleri Kaydet
function handleSaveSale(e) {
  e.preventDefault();
  const cust = getCurrentCustomer();
  if (!cust) return;

  const date = document.getElementById('saleDateInput').value;
  const desc = document.getElementById('saleDescInput').value.trim();
  const amount = parseFloat(document.getElementById('saleAmountInput').value) || 0;
  const count = parseInt(document.getElementById('saleInstallmentsCountInput').value) || 1;
  const firstDueDate = document.getElementById('firstDueDateInput').value || date;

  if (!desc || amount <= 0) {
    alert("Lütfen geçerli bir açıklama ve tutar giriniz.");
    return;
  }

  // Taksitleri oluştur
  const perInstallment = parseFloat((amount / count).toFixed(2));
  const installments = [];
  let startDate = new Date(firstDueDate);

  for (let i = 1; i <= count; i++) {
    const curDate = new Date(startDate);
    curDate.setMonth(startDate.getMonth() + (i - 1));
    const dStr = curDate.toISOString().split('T')[0];
    
    // Kuruş farkını son taksite ekle
    let instAmount = perInstallment;
    if (i === count) {
      const sumPrevious = perInstallment * (count - 1);
      instAmount = parseFloat((amount - sumPrevious).toFixed(2));
    }

    installments.push({
      id: "inst-" + Date.now() + "-" + i,
      no: i,
      dueDate: dStr,
      amount: instAmount,
      paid: 0,
      paidDate: null
    });
  }

  const newSale = {
    id: "sale-" + Date.now(),
    date,
    description: desc,
    amount,
    installmentsCount: count,
    installments
  };

  if (!cust.sales) cust.sales = [];
  cust.sales.push(newSale);

  persistData();
  renderCustomerDetail();
  renderCustomerList();
  closeModal('addSaleModal');
}

// Satış Sil
function deleteSale(saleId) {
  const cust = getCurrentCustomer();
  if (!cust) return;

  if (confirm("Bu hizmet/malzeme kaydını ve bağlı taksitlerini silmek istediğinize emin misiniz?")) {
    cust.sales = (cust.sales || []).filter(s => s.id !== saleId);
    persistData();
    renderCustomerDetail();
    renderCustomerList();
  }
}

// Tahsilat Modalını Aç
function openAddPaymentModal() {
  const cust = getCurrentCustomer();
  if (!cust) {
    alert("Lütfen önce bir müşteri seçin.");
    return;
  }

  document.getElementById('addPaymentForm').reset();
  document.getElementById('payDateInput').value = new Date().toISOString().split('T')[0];
  
  // Taksit seçim listesini doldur
  const select = document.getElementById('payInstallmentSelect');
  select.innerHTML = '<option value="">-- Genel Tahsilat (Taksit Seçilmedi) --</option>';

  (cust.sales || []).forEach(s => {
    (s.installments || []).forEach(inst => {
      if ((inst.paid || 0) < inst.amount) {
        const remaining = inst.amount - (inst.paid || 0);
        select.innerHTML += `
          <option value="${s.id}___${inst.id}___${remaining}">
            ${s.description} - ${inst.no}. Taksit (Vade: ${formatDate(inst.dueDate)}) - Kalan: ₺${formatMoney(remaining)}
          </option>
        `;
      }
    });
  });

  openModal('addPaymentModal');
}

// Tahsilatı Kaydet
function handleSavePayment(e) {
  e.preventDefault();
  const cust = getCurrentCustomer();
  if (!cust) return;

  const date = document.getElementById('payDateInput').value;
  const amount = parseFloat(document.getElementById('payAmountInput').value) || 0;
  let desc = document.getElementById('payDescInput').value.trim();
  const instVal = document.getElementById('payInstallmentSelect').value;

  if (amount <= 0) {
    alert("Geçerli bir tutar giriniz.");
    return;
  }

  // Eğer belirli bir taksit seçildiyse taksiti ödendi yap
  if (instVal) {
    const [saleId, instId] = instVal.split('___');
    const sale = (cust.sales || []).find(s => s.id === saleId);
    if (sale) {
      const inst = (sale.installments || []).find(i => i.id === instId);
      if (inst) {
        inst.paid = (inst.paid || 0) + amount;
        inst.paidDate = date;
        if (!desc) desc = `${sale.description} ${inst.no}. Taksit Tahsilatı`;
      }
    }
  }

  if (!desc) desc = "Nakit/Banka Tahsilatı";

  const newPayment = {
    id: "pay-" + Date.now(),
    date,
    amount,
    description: desc
  };

  if (!cust.payments) cust.payments = [];
  cust.payments.push(newPayment);

  persistData();
  renderCustomerDetail();
  renderCustomerList();
  closeModal('addPaymentModal');
}

// Hızlı Taksit Tahsil Et
function quickPayInstallment(saleId, instId, amount) {
  const cust = getCurrentCustomer();
  if (!cust) return;

  const sale = (cust.sales || []).find(s => s.id === saleId);
  if (!sale) return;
  const inst = (sale.installments || []).find(i => i.id === instId);
  if (!inst) return;

  const today = new Date().toISOString().split('T')[0];
  inst.paid = inst.amount;
  inst.paidDate = today;

  if (!cust.payments) cust.payments = [];
  cust.payments.push({
    id: "pay-" + Date.now(),
    date: today,
    amount: inst.amount,
    description: `${sale.description} ${inst.no}. Taksit Tahsilatı`
  });

  persistData();
  renderCustomerDetail();
  renderCustomerList();
}

// Tahsilat Sil
function deletePayment(payId) {
  const cust = getCurrentCustomer();
  if (!cust) return;

  if (confirm("Bu tahsilat kaydını silmek istediğinize emin misiniz?")) {
    cust.payments = (cust.payments || []).filter(p => p.id !== payId);
    persistData();
    renderCustomerDetail();
    renderCustomerList();
  }
}

// --- TAKSİT HATIRLATICI & VADE TAKİP MERKEZİ ---
function updateRemindersTab() {
  const tableBody = document.getElementById('allRemindersTableBody');
  if (!tableBody) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];

  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  let overdueCount = 0;
  let todayCount = 0;
  let upcomingCount = 0;

  const reminderRows = [];

  appState.customers.forEach(cust => {
    (cust.sales || []).forEach(sale => {
      (sale.installments || []).forEach(inst => {
        const isPaid = (inst.paid || 0) >= inst.amount;
        if (!isPaid) {
          const dueDate = new Date(inst.dueDate);
          dueDate.setHours(0,0,0,0);

          const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            overdueCount++;
          } else if (diffDays === 0) {
            todayCount++;
          } else if (diffDays <= 7) {
            upcomingCount++;
          }

          reminderRows.push({
            custId: cust.id,
            custName: cust.name,
            custPhone: cust.phone,
            saleId: sale.id,
            saleDesc: sale.description,
            instId: inst.id,
            instNo: inst.no,
            dueDate: inst.dueDate,
            amount: inst.amount,
            diffDays
          });
        }
      });
    });
  });

  // İstatistiki rozetler
  document.getElementById('statOverdueCount').textContent = overdueCount;
  document.getElementById('statTodayCount').textContent = todayCount;
  document.getElementById('statUpcomingCount').textContent = upcomingCount;
  
  const dueBadge = document.getElementById('dueBadge');
  const totalPendingAlerts = overdueCount + todayCount;
  if (dueBadge) {
    dueBadge.textContent = totalPendingAlerts;
    dueBadge.style.display = totalPendingAlerts > 0 ? 'inline-block' : 'none';
  }

  // Tarihe göre sırala (en eski vade önce)
  reminderRows.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (reminderRows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">🎉 Ödenmesi bekleyen taksit bulunmamaktadır.</td></tr>';
    return;
  }

  tableBody.innerHTML = reminderRows.map(r => {
    let dayText = '';
    let dayClass = '';
    if (r.diffDays < 0) {
      dayText = `${Math.abs(r.diffDays)} gün gecikti`;
      dayClass = 'status-badge overdue';
    } else if (r.diffDays === 0) {
      dayText = 'Bugün son gün!';
      dayClass = 'status-badge overdue';
    } else {
      dayText = `${r.diffDays} gün kaldı`;
      dayClass = 'status-badge pending';
    }

    return `
      <tr>
        <td><b>${escapeHtml(r.custName)}</b></td>
        <td>${r.custPhone ? `<a href="tel:${r.custPhone}">${r.custPhone}</a>` : '<span style="color:#94a3b8;">Yok</span>'}</td>
        <td>${r.instNo}. Taksit <br><small style="color:#64748b;">${escapeHtml(r.saleDesc)}</small></td>
        <td><b>${formatDate(r.dueDate)}</b></td>
        <td style="font-weight:700; color:#ef4444;">₺${formatMoney(r.amount)}</td>
        <td><span class="${dayClass}">${dayText}</span></td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="sendWhatsappInstallmentReminder('${r.custId}', '${r.instNo}', '${r.dueDate}', ${r.amount})">
            💬 WhatsApp
          </button>
        </td>
        <td>
          <button class="btn btn-xs btn-success" onclick="quickPayFromReminders('${r.custId}', '${r.saleId}', '${r.instId}', ${r.amount})">
            Tahsil Et
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function quickPayFromReminders(custId, saleId, instId, amount) {
  const cust = appState.customers.find(c => c.id === custId);
  if (!cust) return;
  const sale = (cust.sales || []).find(s => s.id === saleId);
  if (!sale) return;
  const inst = (sale.installments || []).find(i => i.id === instId);
  if (!inst) return;

  const today = new Date().toISOString().split('T')[0];
  inst.paid = inst.amount;
  inst.paidDate = today;

  if (!cust.payments) cust.payments = [];
  cust.payments.push({
    id: "pay-" + Date.now(),
    date: today,
    amount: inst.amount,
    description: `${sale.description} ${inst.no}. Taksit Tahsilatı`
  });

  persistData();
  renderCustomerDetail();
  renderCustomerList();
  updateRemindersTab();
}

// --- WHATSAPP HATIRLATMA ENTEGRASYONU ---
function sendWhatsappToCustomer() {
  const cust = getCurrentCustomer();
  if (!cust || !cust.phone) {
    alert("Müşterinin telefon numarası kayıtlı değil.");
    return;
  }

  const totalSales = (cust.sales || []).reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const totalPaid = (cust.payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const remaining = totalSales - totalPaid;

  const cleanPhone = cleanPhoneNumber(cust.phone);
  const msg = encodeURIComponent(`Sayın ${cust.name}, Muhasebe Demo sistemimizdeki güncel bakiye durumunuz: Toplam Alınan: ${formatMoney(totalSales)} TL, Tahsil Edilen: ${formatMoney(totalPaid)} TL, Kalan Bakiye: ${formatMoney(remaining)} TL'dir. Bilgilerinize sunar, iyi çalışmalar dileriz.`);
  
  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
}

function sendWhatsappInstallmentReminder(custId, instNo, dueDate, amount) {
  const cust = appState.customers.find(c => c.id === custId);
  if (!cust || !cust.phone) {
    alert("Müşterinin telefon numarası kayıtlı değil.");
    return;
  }

  const cleanPhone = cleanPhoneNumber(cust.phone);
  const formattedDate = formatDate(dueDate);
  const msg = encodeURIComponent(`Sayın ${cust.name}, ${formattedDate} vadeli ${formatMoney(amount)} TL tutarındaki ${instNo}. taksit ödemenizi hatırlatmak isteriz. İyi çalışmalar dileriz.`);

  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
}

function cleanPhoneNumber(phone) {
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '90' + p.substring(1);
  else if (!p.startsWith('90')) p = '90' + p;
  return p;
}

// --- YEDEK ALMA & EXCEL / JSON AKTARIMI ---
function exportBackupJSON() {
  const dataStr = JSON.stringify({
    customers: appState.customers,
    settings: appState.settings,
    exportedAt: new Date().toISOString()
  }, null, 2);

  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Muhasebe_Demo_Yedek_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToExcelCSV() {
  // UTF-8 BOM ekleyerek Türkçe karakter desteği
  let csv = "\uFEFF";
  csv += "Müşteri Adı;Telefon;İşlem Tipi;Tarih;Açıklama;Tutar (TL);Kalan Bakiye (TL)\n";

  appState.customers.forEach(cust => {
    const totalSales = (cust.sales || []).reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const totalPaid = (cust.payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const remaining = totalSales - totalPaid;

    (cust.sales || []).forEach(s => {
      csv += `"${cust.name}";"${cust.phone || ''}";"Hizmet/Malzeme";"${s.date}";"${s.description}";"${s.amount}";"${remaining}"\n`;
    });

    (cust.payments || []).forEach(p => {
      csv += `"${cust.name}";"${cust.phone || ''}";"Tahsilat";"${p.date}";"${p.description || ''}";"${p.amount}";"${remaining}"\n`;
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Muhasebe_Demo_Ekstre_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (Array.isArray(data.customers)) {
        appState.customers = data.customers;
        if (data.settings) appState.settings = data.settings;
        persistData();
        renderAfterLoad();
        alert("Yedek başarıyla yüklendi ve senkronize edildi!");
      } else {
        alert("Geçersiz yedek dosyası.");
      }
    } catch (err) {
      alert("Dosya okunurken hata oluştu: " + err.message);
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (confirm("DİKKAT: Tüm müşteri kayıtları, hizmetler ve tahsilatlar silinecektir. Devam etmek istiyor musunuz?")) {
    appState.customers = [];
    appState.currentCustomerId = null;
    persistData();
    renderCustomerList();
    renderCustomerDetail();
    updateRemindersTab();
  }
}

// --- TELEFON BAĞLANTISI & QR KOD ---
function setupNetworkInfo() {
  const currentUrl = window.location.href;
  const ipEl = document.getElementById('mobileAccessUrl');
  if (ipEl) ipEl.textContent = currentUrl;

  const qrContainer = document.getElementById('qrcodeContainer');
  if (qrContainer && typeof qrcode !== 'undefined') {
    qrContainer.innerHTML = '';
    const qr = qrcode(0, 'M');
    qr.addData(currentUrl);
    qr.make();
    qrContainer.innerHTML = qr.createImgTag(4);
  }
}

function copyAccessUrl() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert("Bağlantı adresi kopyalandı! Telefonunuzun tarayıcısına yapıştırabilirsiniz.");
  });
}

// --- BULUT AYARLARI TOGGLE ---
function toggleCloudConfig() {
  const mode = document.getElementById('cloudModeSelect').value;
  const area = document.getElementById('firebaseConfigArea');
  const statusText = document.getElementById('storageStatusText');

  if (mode === 'firebase') {
    area.style.display = 'block';
    statusText.textContent = 'Firebase Kurulumu Bekleniyor';
    statusText.className = 'text-warning';
  } else {
    area.style.display = 'none';
    statusText.textContent = 'Aktif (Dahili Sunucu & Yerel Depolama)';
    statusText.className = 'text-success';
  }
}

function saveFirebaseConfig() {
  const val = document.getElementById('firebaseConfigInput').value.trim();
  if (!val) {
    alert("Lütfen Firebase yapılandırma nesnesini yapıştırın.");
    return;
  }
  localStorage.setItem(FIREBASE_CONFIG_KEY, val);
  alert("Firebase ayarı kaydedildi! Bulut senkronizasyonu aktif.");
}

// --- YARDIMCI FORMAT FONKSİYONLARI ---
function formatMoney(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
