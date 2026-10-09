# demo-muhasebe

Basit, hızlı ve modern Ön Muhasebe, Borç/Alacak ve Taksit Takip Web Uygulaması. Hem bilgisayardan hem de cep telefonundan kolayca kullanılabilir.

## 🌟 Özellikler

- **Müşteri & Cari Takibi**: Müşteri adı, telefon numarası ve bakiye durumu.
- **Hizmet / Malzeme & Taksitlendirme**: Verilen hizmet veya alınan malzemenin tutarını otomatik taksitlere bölme.
- **Tahsilat Kaydı**: Nakit/Banka ödemelerini genel veya taksite bağlı kaydetme.
- **3 Büyük Özet Kutusu**:
  - 🟢 **TOPLAM BORÇ**
  - 🟡 **TAHSİLAT**
  - 🔴 **KALAN BAKİYE**
- **Taksit Hatırlatıcı & WhatsApp Entegrasyonu**:
  - Geciken, bugünkü ve yaklaşan taksitleri listeleme.
  - Tek tıkla müşteriye profesyonel hazır WhatsApp hatırlatma mesajı gönderme.
- **Çoklu Cihaz Desteği (PC & Mobil)**:
  - Aynı Wi-Fi ağından telefon tarayıcısı ile anında erişim.
  - PWA (Telefonda "Ana Ekrana Ekle" ile mobil uygulama deneyimi).
- **Yedekleme**: Tek tıkla Excel (CSV) veya JSON yedek alma/yükleme.

## 🚀 Hızlı Başlangıç

### Gereksinimler
- [Node.js](https://nodejs.org/) (v16+)

### Kurulum ve Çalıştırma

1. Projeyi klonlayın veya indirin:
   ```bash
   git clone https://github.com/blackeker/demo-muhasebe.git
   cd demo-muhasebe
   ```

2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```

3. Uygulamayı başlatın:
   ```bash
   npm start
   ```
   *(Windows için `BASLAT.bat` dosyasına çift tıklayabilirsiniz)*

4. Tarayıcınızda açın:
   - **PC'den:** `http://localhost:3000`
   - **Telefondan:** `http://<BILGISAYAR_IP_ADRESI>:3000`
