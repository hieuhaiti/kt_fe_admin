# Ma trận Admin: tài khoản × sidebar × Network

**Ngày kiểm tra:** 09/10/2026, UTC+7. Lượt tracking chính: 15:15–15:39.
**Frontend:** `http://localhost:5174`. **Backend:** `https://apikontum.tourismpj.pro.vn/api/v1`.
**Công cụ:** Chrome DevTools MCP; đăng nhập thật tài khoản mẫu, click menu sidebar/mục con và đọc Network.
**Phạm vi:** 17 route nội bộ, tab Bản đồ của Phản ánh và URL tài liệu hệ thống; 4 tài khoản.
**Kết quả:** hoàn tất tracking phạm vi trên, có lỗi được ghi nhận. Không kết luận toàn bộ API hoặc quyền hệ thống đã hoàn hảo.

## 1. Cách đọc và giới hạn

- `200/304`: request thành công hoặc cache hợp lệ. Fetch JavaScript có thể thấy 200 trong khi Network thấy 304 do cache HTTP.
- Log per-page lấy từ wrapper fetch chỉ ghi URL, thời điểm, status, response lỗi; không thay đổi response và không lưu Authorization, mật khẩu hoặc token.
- Đối chiếu thêm bằng Network Chrome: log Quản trị, log Sở, các lượt tab Bản đồ và đăng nhập Người dân. Request tile trong map worker không đi qua window.fetch được bổ sung trực tiếp từ Network.
- Mục cha Lớp bản đồ/Tin tức/Đo đạc chỉ mở submenu; endpoint được gắn với mục con điều hướng thực tế.
- URL Tài liệu hệ thống được kiểm tra GET với phiên tương ứng; chưa kiểm tra thao tác mở PDF qua click/new-tab.
- Không submit import, chạy phân tích, gửi thông báo, tạo/sửa/xóa dữ liệu. Trang không gọi API lúc mở không chứng minh endpoint submit hoạt động.
- Chưa kiểm tra toàn bộ popup/form/tab trong dialog, mọi bộ lọc/phân trang, mobile, mọi tài khoản ngoài bốn tài khoản mẫu hoặc tải tất cả tile.
- Restart công cụ nhiều lần: dữ liệu phục hồi từ log đã lưu, không tự coi phần mất phiên là đã đạt.

## 2. Tài khoản

| Role | Tài khoản | Kết quả vào Admin |
|---|---|---|
| `system_admin` | `admin@kontum.gov.vn` | Vào được; mở 17 route, tab Bản đồ và GET PDF |
| `ubnd_tinh` | `ubnd@kontum.gov.vn` | Vào được; mở 15 route, 2 mục ẩn theo quyền, tab Bản đồ và GET PDF |
| `so_nnmt` | `sonn@kontum.gov.vn` | Vào được; mở 17 route, tab Bản đồ và GET PDF |
| `citizen` | `citizen@kontum.gov.vn` | Login/me 200 nhưng bị từ chối tại /login; không có sidebar |

## 3. Ma trận tổng hợp

| Mục / route | Quản trị hệ thống | UBND tỉnh | Sở NN&MT | Người dân |
|---|---|---|---|---|
| Tổng quan<br>`/dashboard` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Quản lý lớp dữ liệu<br>`/map-layers` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Nhập tệp GIS<br>`/map-layers/import-geojson` | Mở được; không gọi API nghiệp vụ | Ẩn theo quyền | Mở được; không gọi API nghiệp vụ | Không có sidebar |
| Ảnh theo thời gian<br>`/layer-series` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| API bản đồ<br>`/map-apis` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Ảnh bản đồ<br>`/map-images` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Phân loại rừng<br>`/forest-classification` | API 200; lỗi tile OSM | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Cảnh báo cháy rừng<br>`/fire-risk` | API 200; lỗi tile OSM | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Thời tiết<br>`/weather` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Bình luận<br>`/news-comments` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Báo cáo và văn bản<br>`/documents` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Tin tức<br>`/news` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Phản ánh hiện trường<br>`/feedbacks` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; request phụ 403 | Không có sidebar |
| Phiên đo thực địa<br>`/field-measurements` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Khu vực theo dõi<br>`/monitored-areas` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Gửi thông báo<br>`/notifications/send` | Mở được; không gọi API nghiệp vụ | Ẩn theo quyền | Mở được; không gọi API nghiệp vụ | Không có sidebar |
| Người dùng<br>`/users` | Mở được; API 200/304 | Mở được; API 200/304 | Mở được; API 200/304 | Không có sidebar |
| Phản ánh · Bản đồ<br>`/feedbacks#map` | Mở được; API 200/304 | API 200; lỗi tile OSM | Mở được; API 200/304 | Không có sidebar |
| Tài liệu hệ thống<br>`URL PDF` | GET PDF 200 | GET PDF 200 | GET PDF 200 | Không có sidebar |

## 4. Lỗi và phân loại

### F-01 — Sở NN&MT: request phụ tra cứu tên người gửi bị 403

- Trang: `/feedbacks`, mở bằng mục Phản ánh hiện trường.
- Request: `GET /api/v1/admin/users/3?lang=vi` → **403**.
- Thời điểm: **15:32:00**, tái hiện **15:39**; Network request 281 ở lượt Sở chính và 153 ở lượt cuối.
- Response: `{"success":false,"message":"Bạn không có quyền manage trên users","errors":[]}`.
- API danh sách phản ánh và API bản đồ vẫn thành công. Đây là request phụ lỗi, không phải toàn bộ trang bị từ chối.
- Trace source: `UserCell` gọi `userService.getById` khi có userId kể cả đã có inlineUser. `getUserById` backend gọi `_assertSoNnmtScope`, giới hạn Sở tra cứu chi tiết target citizen.
- Dữ liệu user 3 thuộc tài khoản Sở; UI gọi endpoint vượt scope. Không nên nới quyền backend chỉ để hiển thị tên.
- Có inline name thì UI có thể vẫn hiện đúng; fallback không biến request 403 thành thành công. Chưa sửa trong task tracking này.

### F-02 — Tile nền OpenStreetMap: lỗi kết nối gián đoạn

- Quản trị: Phân loại rừng **15:21:23–15:21:25** có 10 request lỗi; Cháy rừng **15:21:26** có 6 request lỗi.
- UBND: tab Bản đồ của Phản ánh **15:38:04** có 5 request lỗi.
- Ví dụ: `https://tile.openstreetmap.org/9/409/235.png` và `/8/204/117.png`.
- Chrome Network/Console: **net::ERR_CONNECTION_RESET**; fetch log: `TypeError: Failed to fetch`.
- Lượt sau nhiều tile trả 200. Không có bằng chứng đây là lỗi RBAC; nguyên nhân mạng/provider chưa xác định.
- API nghiệp vụ và các request WMS GeoServer đã quan sát trả thành công. HTTP 200 của WMS không chứng minh mọi tile/ảnh đều đúng.

### F-03 — Phiên Sở cũ: 401 được phục hồi

- Lúc khởi tạo lượt Sở: `/auth/me` 401 → `/auth/refresh` 200 → `/auth/me` 304, vào Admin thành công.
- Network IDs: 94, 95, 97. Ghi nhận là sự kiện phiên, không phải lỗi endpoint còn tồn tại sau refresh.

## 5. Log endpoint theo từng tài khoản

Thời điểm trong bảng là giờ địa phương UTC+7. URL đầy đủ/query và từng tile nằm trong JSON/CSV kèm theo.

### system_admin — admin@kontum.gov.vn

| Giờ | Trang/sidebar | Endpoint được gọi và status |
|---|---|---|
| 15:21:02 | Tổng quan | `GET /api/v1/notifications?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/notifications/unread-count?lang=vi → 200`<br>`GET /api/v1/stats/dashboard?force=false&lang=vi → 200` |
| 15:21:04 | Quản lý lớp dữ liệu | `GET /api/v1/map/layers?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:21:06 | Nhập tệp GIS | Không phát sinh request API nghiệp vụ trong cửa sổ quan sát |
| 15:21:09 | Ảnh theo thời gian | `GET /api/v1/map/layer-groups?lang=vi → 200` |
| 15:21:11 | API bản đồ | `GET /api/v1/map-apis?page=1&limit=10&lang=vi → 200` |
| 15:21:13 | Ảnh bản đồ | `GET /api/v1/admin/pdf-maps?page=1&limit=10&sortBy=id&sortOrder=DESC&lang=vi → 200` |
| 15:21:25 | Phân loại rừng | `GET /api/v1/forest-classification/latest?lang=vi → 200`<br>`GET /api/v1/forest-classification/history?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/forest-classification/snapshots/33/districts?lang=vi → 200`<br>OSM: 10 request; 10 lỗi kết nối<br>GeoServer WMS: 6 request; status 200 |
| 15:21:27 | Cảnh báo cháy rừng | `GET /api/v1/fire-risk/latest?minRiskLevel=1&lang=vi → 200`<br>`GET /api/v1/fire-risk/map?minRiskLevel=1&lang=vi → 200`<br>`GET /api/v1/fire-risk/history?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/fire-risk/snapshots/77/districts?lang=vi → 200`<br>OSM: 9 request; 6 lỗi kết nối |
| 15:21:30 | Thời tiết | `GET /api/v1/weather/layers?type=temp&lang=vi → 200` |
| 15:21:34 | Bình luận | `GET /api/v1/admin/comments?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/admin/users/4?lang=vi → 200` |
| 15:21:36 | Báo cáo và văn bản | `GET /api/v1/documents?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:22:23 | Tin tức | `GET /api/v1/notifications?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/notifications/unread-count?lang=vi → 200`<br>`GET /api/v1/admin/news?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:22:26 | Phản ánh hiện trường | `GET /api/v1/admin/feedback?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/admin/users/7?lang=vi → 200`<br>`GET /api/v1/admin/users/3?lang=vi → 200` |
| 15:22:28 | Phiên đo thực địa | `GET /api/v1/stats/administrative-units?level=district&lang=vi → 200`<br>`GET /api/v1/field-measurements?page=1&limit=10&lang=vi → 200` |
| 15:22:30 | Khu vực theo dõi | `GET /api/v1/monitored-areas?page=1&limit=10&lang=vi → 200` |
| 15:22:33 | Gửi thông báo | Không phát sinh request API nghiệp vụ trong cửa sổ quan sát |
| 15:22:35 | Người dùng | `GET /api/v1/admin/users?page=1&limit=10&sortBy=id&sortOrder=ASC&lang=vi → 200`<br>`GET /api/v1/auth/me?lang=vi → 200` |
| 15:23:40 | Phản ánh · Bản đồ | `GET /api/v1/admin/feedback/map?lang=vi → 200`<br>OSM: 11 request; 0 lỗi kết nối |
| 15:23:58 | Tài liệu hệ thống | `GET /uploads/HDSD_KONTUM_ADMIN.pdf → 200` |

### ubnd_tinh — ubnd@kontum.gov.vn

| Giờ | Trang/sidebar | Endpoint được gọi và status |
|---|---|---|
| 15:25:03 | Tổng quan | `GET /api/v1/stats/dashboard?force=false&lang=vi → 200` |
| 15:25:06 | Quản lý lớp dữ liệu | `GET /api/v1/map/layers?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:25:08 | Ảnh theo thời gian | `GET /api/v1/map/layer-groups?lang=vi → 200` |
| 15:25:10 | API bản đồ | `GET /api/v1/map-apis?page=1&limit=10&lang=vi → 200` |
| 15:25:12 | Ảnh bản đồ | `GET /api/v1/admin/pdf-maps?page=1&limit=10&sortBy=id&sortOrder=DESC&lang=vi → 200` |
| 15:25:55 | Phản ánh hiện trường | `GET /api/v1/notifications?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/notifications/unread-count?lang=vi → 200`<br>`GET /api/v1/admin/feedback?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/admin/users/7?lang=vi → 200`<br>`GET /api/v1/admin/users/3?lang=vi → 200` |
| 15:25:57 | Phiên đo thực địa | `GET /api/v1/stats/administrative-units?level=district&lang=vi → 200`<br>`GET /api/v1/field-measurements?page=1&limit=10&lang=vi → 200` |
| 15:25:59 | Khu vực theo dõi | `GET /api/v1/monitored-areas?page=1&limit=10&lang=vi → 200` |
| 15:26:02 | Người dùng | `GET /api/v1/admin/users?page=1&limit=10&sortBy=id&sortOrder=ASC&lang=vi → 200`<br>`GET /api/v1/auth/me?lang=vi → 200` |
| 15:25:26 | Phân loại rừng | `GET /api/v1/forest-classification/latest?lang=vi → 200`<br>`GET /api/v1/forest-classification/snapshots/33/districts?lang=vi → 200` |
| 15:25:29 | Cảnh báo cháy rừng | `GET /api/v1/fire-risk/latest?minRiskLevel=1&lang=vi → 200`<br>`GET /api/v1/fire-risk/map?minRiskLevel=1&lang=vi → 200`<br>`GET /api/v1/fire-risk/snapshots/77/districts?lang=vi → 200` |
| 15:25:31 | Thời tiết | `GET /api/v1/weather/layers?type=temp&lang=vi → 200` |
| 15:25:33 | Tin tức | `GET /api/v1/admin/news?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:25:35 | Bình luận | `GET /api/v1/admin/comments?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/admin/users/4?lang=vi → 200` |
| 15:25:38 | Báo cáo và văn bản | `GET /api/v1/documents?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:25–15:26 (menu ẩn) | Nhập tệp GIS | Ẩn đúng theo quyền API |
| 15:25–15:26 (menu ẩn) | Gửi thông báo | Ẩn đúng theo quyền API |
| 15:38:18 | Phản ánh · Bản đồ | `GET /api/v1/admin/feedback/map?lang=vi → 200`<br>OSM: 9 request; 5 lỗi kết nối |
| 15:38:18 | Tài liệu hệ thống | `GET /uploads/HDSD_KONTUM_ADMIN.pdf → 200` |

### so_nnmt — sonn@kontum.gov.vn

| Giờ | Trang/sidebar | Endpoint được gọi và status |
|---|---|---|
| 15:31:18 | Tổng quan | `GET /api/v1/stats/dashboard?force=false&lang=vi → 200` |
| 15:31:20 | Quản lý lớp dữ liệu | `GET /api/v1/map/layers?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:31:22 | Nhập tệp GIS | Không phát sinh request API nghiệp vụ trong cửa sổ quan sát |
| 15:31:25 | Ảnh theo thời gian | `GET /api/v1/map/layer-groups?lang=vi → 200` |
| 15:31:27 | API bản đồ | `GET /api/v1/map-apis?page=1&limit=10&lang=vi → 200` |
| 15:31:29 | Ảnh bản đồ | `GET /api/v1/notifications?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/notifications/unread-count?lang=vi → 200`<br>`GET /api/v1/admin/pdf-maps?page=1&limit=10&sortBy=id&sortOrder=DESC&lang=vi → 200` |
| 15:31:39 | Phân loại rừng | `GET /api/v1/forest-classification/latest?lang=vi → 200`<br>`GET /api/v1/forest-classification/history?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/forest-classification/snapshots/33/districts?lang=vi → 200`<br>OSM: 6 request; 0 lỗi kết nối<br>GeoServer WMS: 6 request; status 200 |
| 15:31:42 | Cảnh báo cháy rừng | `GET /api/v1/fire-risk/latest?minRiskLevel=1&lang=vi → 200`<br>`GET /api/v1/fire-risk/map?minRiskLevel=1&lang=vi → 200`<br>`GET /api/v1/fire-risk/history?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/fire-risk/snapshots/77/districts?lang=vi → 200`<br>OSM: 19 request; 0 lỗi kết nối |
| 15:31:44 | Thời tiết | `GET /api/v1/weather/layers?type=temp&lang=vi → 200` |
| 15:31:47 | Tin tức | `GET /api/v1/admin/news?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:31:49 | Bình luận | `GET /api/v1/admin/comments?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/admin/users/4?lang=vi → 200` |
| 15:31:51 | Báo cáo và văn bản | `GET /api/v1/documents?page=1&limit=10&sortBy=created_at&sortOrder=DESC&lang=vi → 200` |
| 15:32:01 | Phản ánh hiện trường | `GET /api/v1/admin/feedback?page=1&limit=10&lang=vi → 200`<br>`GET /api/v1/admin/users/7?lang=vi → 200`<br>`GET /api/v1/admin/users/3?lang=vi → 403` |
| 15:32:04 | Phiên đo thực địa | `GET /api/v1/stats/administrative-units?level=district&lang=vi → 200`<br>`GET /api/v1/field-measurements?page=1&limit=10&lang=vi → 200` |
| 15:32:06 | Khu vực theo dõi | `GET /api/v1/monitored-areas?page=1&limit=10&lang=vi → 200` |
| 15:32:09 | Gửi thông báo | Không phát sinh request API nghiệp vụ trong cửa sổ quan sát |
| 15:32:11 | Người dùng | `GET /api/v1/admin/users?page=1&limit=10&sortBy=id&sortOrder=ASC&lang=vi → 200`<br>`GET /api/v1/auth/me?lang=vi → 200` |
| 15:39:42 | Phản ánh · Bản đồ | `GET /api/v1/admin/feedback/map?lang=vi → 200`<br>OSM: 11 request; 0 lỗi kết nối |
| 15:39:42 | Tài liệu hệ thống | `GET /uploads/HDSD_KONTUM_ADMIN.pdf → 200` |

### citizen — citizen@kontum.gov.vn

15:35:16–15:35:38: login 200 (reqid 106), me 200 (reqid 107); UI ở `/login`, thông báo “Tài khoản không có quyền quản trị.” Không mở được mục sidebar vì không được cấp phiên Admin.

## 6. Kết luận đúng phạm vi

- Không thấy route/sidebar đã mở bị phân bố sai so với quyền API đang trả về cho ba role quản trị.
- **Có endpoint lỗi:** lookup người gửi phản ánh của Sở trả 403; một số tile OSM lỗi kết nối.
- UBND không có Nhập tệp GIS và Gửi thông báo. Sở/Quản trị có hai mục này; mở form không phát sinh request submit.
- UBND không gọi history phân tích rừng/cháy ở lượt tracking; Sở/Quản trị có gọi và trả thành công.
- Không chỉnh sửa source hoặc thay đổi hợp đồng/quyền/database trong task này.

## 7. File bằng chứng

- [Log JSON đã loại thông tin nhạy cảm](./network-log.json)
- [Log CSV từng request](./network-log.csv)
- [Network Quản trị](./network-system-admin.txt)
- [Network Sở](./network-so-nnmt.txt)

## 8. Điểm triển khai liên quan F-01

- [UserCell.tsx](file:///D:/Code/@kt_web_GIS/admin/src/components/common/UserCell.tsx#L18-L25)
- [Feedback/index.tsx](file:///D:/Code/@kt_web_GIS/admin/src/pages/Feedback/index.tsx#L346-L350)
- [user.service.js](file:///D:/Code/@kt_web_GIS/server/src/services/user.service.js#L10-L15)
- [getUserById](file:///D:/Code/@kt_web_GIS/server/src/services/user.service.js#L143-L146)
- [user.routes.js](file:///D:/Code/@kt_web_GIS/server/src/routes/user.routes.js#L34-L42)
