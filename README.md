# YGO-Tool

Ứng dụng web tra cứu thông tin thẻ bài Yu-Gi-Oh! từ nhiều nguồn khác nhau với khả năng tự động phát hiện độ hiếm và xuất file Excel.

## ✨ Tính năng chính

### 🔍 Tra cứu thẻ bài
- **Hỗ trợ 2 tab riêng biệt**: 
  - **AE Cards**: Tra cứu thẻ AE qua TCG Corner API
  - **TCG Cards**: Tra cứu thẻ TCG qua JustTCG API
- **Tự động chuyển đổi API**: Dựa trên mã thẻ (AE vs TCG)
- **Hỗ trợ nhiều mã**: Có thể nhập nhiều mã thẻ cùng lúc, phân cách bằng dấu phẩy
- **Tự động chuẩn hóa**: Xử lý các ký tự đặc biệt và định dạng mã in

### 🎨 Phát hiện độ hiếm tự động
- **Phân tích tự động**: Trích xuất độ hiếm từ tên thẻ trong ngoặc đơn `()`
- **Bản đồ độ hiếm đầy đủ**: Hỗ trợ tất cả các loại độ hiếm chính:
  - `N` → Common
  - `R` → Rare  
  - `SR` → Super Rare
  - `UR` → Ultra Rare
  - `SER` → Secret Rare
  - `CR` → Collector Rare
  - `PSER` → Prismatic Secret Rare
  - `UL` → Ultimate Rare
  - `P-N` → Normal Parallel
  - `QCSR` → Quartet Century Secret Rare

### 📊 Hiển thị dữ liệu phong phú
- **Thông tin chi tiết**: Hiển thị tên sản phẩm, mô tả, hình ảnh và giá
- **Hỗ trợ đa tiền tệ**:
  - TCG Corner: VND (Việt Nam Đồng)
  - JustTCG: USD (Đô la Mỹ)
- **Hình ảnh thẻ**: Hiển thị hình ảnh thẻ từ các nguồn khác nhau
- **Xử lý lỗi thông minh**: Hiển thị lỗi một cách rõ ràng khi tra cứu thất bại

### 📈 Xuất Excel nâng cao
- **Xuất một click**: Xuất tất cả kết quả ra file Excel
- **Dữ liệu có cấu trúc**: Bao gồm tất cả thông tin thẻ bài được định dạng
- **Tự động đặt tên**: File được đặt tên theo ngày hiện tại
- **Định dạng chuyên nghiệp**: Cột rộng phù hợp, dữ liệu được sắp xếp rõ ràng

### 💰 Tính năng giá cả
- **Cập nhật giá hàng loạt**: Thêm/sửa giá cho nhiều thẻ cùng lúc (AE Cards)
- **Chuyển đổi tỷ giá**: Tự động chuyển đổi USD sang VND (TCG Cards)
- **Tỷ giá tùy chỉnh**: Có thể điều chỉnh tỷ giá chuyển đổi

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 18** với functional components và hooks
- **Vite** cho phát triển và build nhanh chóng
- **XLSX** library cho chức năng xuất Excel
- **CSS** cho styling hiện đại

### Backend
- **Node.js** với Express.js
- **CORS** được bật cho cross-origin requests
- **Fetch API** cho các API calls bên ngoài
- **dotenv** cho quản lý environment variables

## 📦 Cài đặt

### Yêu cầu hệ thống
- Node.js (v14 trở lên)
- npm hoặc yarn

### Hướng dẫn cài đặt

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd YGO-Tool
   ```

2. **Cài đặt dependencies cho server**
   ```bash
   cd server
   npm install
   ```

3. **Cài đặt dependencies cho client**
   ```bash
   cd ../client
   npm install
   ```

4. **Tạo file .env cho server** (tùy chọn)
   ```bash
   cd ../server
   echo "JUSTTCG_KEY=your_api_key_here" > .env
   echo "PORT=3001" >> .env
   ```

## 🚀 Sử dụng

### Chế độ phát triển

1. **Khởi động server**
   ```bash
   cd server
   npm run dev
   ```
   Server sẽ chạy tại `http://localhost:3001`

2. **Khởi động client**
   ```bash
   cd client
   npm run dev
   ```
   Client sẽ chạy tại `http://localhost:5173`

### Chế độ production

1. **Build client**
   ```bash
   cd client
   npm run build
   ```

2. **Khởi động server**
   ```bash
   cd server
   npm start
   ```

## 🔌 API Endpoints

### `GET /api/health`
Kiểm tra trạng thái server

### `GET /api/cardsetsinfo?setcode=<codes>`
Endpoint tra cứu thẻ chính
- **Parameters**: `setcode` - danh sách mã thẻ phân cách bằng dấu phẩy
- **Response**: Thông tin thẻ từ nguồn API phù hợp

### `GET /api/printcode/resolve?code=<code>`
Giải quyết mã in thành tên thẻ
- **Parameters**: `code` - mã in thẻ (ví dụ: MP25-EN021)
- **Response**: ID và tên thẻ từ YGOResources

### `GET /api/justtcg/cards?name=<name>`
Tra cứu thẻ qua JustTCG API
- **Parameters**: `name` - tên thẻ
- **Response**: Kết quả tìm kiếm từ JustTCG

### `GET /api/tcg/search?q=<query>`
Tra cứu trực tiếp qua TCG Corner
- **Parameters**: `q` - từ khóa tìm kiếm
- **Response**: Kết quả tìm kiếm từ TCG Corner

## 📝 Ví dụ sử dụng

### Thẻ AE (TCG Corner)
```
Input: ALIN-AE002, DUAD-AE001
Kết quả: Sử dụng TCG Corner API, hiển thị giá VND, hỗ trợ nhiều độ hiếm
```

### Thẻ TCG (JustTCG)
```
Input: MP25-EN021, MP25-EN025
Kết quả: Sử dụng JustTCG API, hiển thị giá USD, có thể chuyển đổi sang VND
```

### Tìm kiếm hỗn hợp
```
Input: ALIN-AE002, MP25-EN021
Kết quả: Thẻ AE từ TCG Corner, thẻ TCG từ JustTCG
```

## 📁 Cấu trúc dự án

```
YGO-Tool/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Component chính
│   │   ├── main.jsx       # Entry point React
│   │   └── style.css      # Styles ứng dụng
│   ├── package.json       # Dependencies frontend
│   └── vite.config.js     # Cấu hình Vite
├── server/                # Node.js backend
│   ├── index.js          # Express server
│   ├── package.json      # Dependencies backend
│   └── .env              # Environment variables (tùy chọn)
└── README.md             # File này
```

## 🔧 Chi tiết kỹ thuật

### Tự động chọn API
Ứng dụng tự động xác định API nào sử dụng dựa trên định dạng mã thẻ:
- Thẻ có pattern `XXX-AE###` → TCG Corner API
- Thẻ có pattern `XXX-EN###` → JustTCG API (qua YGOResources)

### Xử lý độ hiếm
Khi tìm thấy nhiều độ hiếm cho cùng một thẻ (ví dụ: "Blue-Eyes White Dragon (UR)" và "Blue-Eyes White Dragon (SR)"), ứng dụng:
1. Nhóm chúng theo tên thẻ cơ bản
2. Tạo các hàng riêng biệt cho mỗi độ hiếm
3. Hiển thị tên độ hiếm phù hợp

### Xuất Excel
Chức năng xuất tạo file Excel toàn diện với:
- Đánh số thứ tự
- Tên sản phẩm
- Mô tả chi tiết
- URL hình ảnh
- Giá với đơn vị tiền tệ đúng
- Định dạng cột chuyên nghiệp

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch
3. Thực hiện thay đổi
4. Test kỹ lưỡng
5. Submit pull request

## 📄 License

Dự án này được cấp phép dưới ISC License.

## 🆘 Hỗ trợ

Để báo lỗi và đặt câu hỏi, vui lòng tạo issue trong repository.

---

**Lưu ý**: Để sử dụng đầy đủ tính năng JustTCG, bạn cần có API key và cấu hình trong file `.env` của server.