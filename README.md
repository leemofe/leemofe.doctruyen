# Tủ truyện · Đọc chữ & Nghe bản thu

App miễn phí ưu tiên iPhone khổ dọc, một cột rộng tối đa 480px. Repository đích: https://github.com/leemofe/leemofe.doctruyen. Đường dẫn GitHub Pages: https://leemofe.github.io/leemofe.doctruyen/ (hoạt động sau khi workflow xuất bản thành công).

## Chạy app

Cài Python 3.12+ và chạy `python -m pip install -r requirements.txt` một lần. Mở `CHAY-APP.bat` hoặc `npm run dev`, rồi truy cập http://localhost:4173. Điện thoại cùng Wi-Fi dùng địa chỉ LAN của máy tính với cổng 4173 nếu tường lửa cho phép. Localhost trên iPhone là chính iPhone, không phải máy tính.

## Hai chế độ độc lập

- Đọc chữ: tự cuộn, tìm chương, thay cỡ chữ, đánh dấu và lưu đoạn đang đọc. Không gọi giọng đọc trình duyệt, không tô sáng hoặc tự cuộn theo bản thu. Bấm đoạn văn không điều khiển âm thanh.
- Nghe bản thu: phát MP3/M4A qua HTML audio. Thanh tua theo giây, nhập thời điểm mm:ss hoặc hh:mm:ss, lùi/tiến 15 giây, tốc độ, hẹn giờ và tự chuyển bản thu tiếp theo. Vị trí nghe lưu riêng với vị trí đọc. Âm thanh có thể tiếp tục khi người dùng mở phần chữ; chọn chương chữ không đổi bản thu đang phát.
- iPhone: dùng Safari và bấm Phát trước khi khóa màn hình. Đã tích hợp Media Session và khai báo audioSession playback khi trình duyệt hỗ trợ. Chưa thử khóa màn hình trên iPhone thật; chưa cam kết nghe nền hoặc tự chuyển bản thu hoạt động trên mọi phiên bản iOS. Hẹn giờ JavaScript có thể bị trễ khi iOS treo trang nền.

## Bản thu và giọng AI

Có bản nghe thử đoạn đầu chương 77 dài khoảng 64 giây, ghi rõ là nghe thử. Đây không phải bản thu toàn chương. Việc tạo toàn chương đã gặp NoAudioReceived từ dịch vụ giọng đọc, chưa công bố bản thu đầy đủ.

Bấm Tạo bản thu miễn phí trong chế độ Nghe để tạo MP3 cho một chương khi đang chạy máy chủ Python trên máy tính. Máy chủ dùng thư viện `edge-tts` kết nối dịch vụ giọng đọc online của Microsoft Edge, không khóa API. Đây không phải API dịch vụ chính thức được cam kết ổn định; có thể gián đoạn. Mặc định giọng nam vi-VN-NamMinhNeural, tốc độ -8%, pitch -8Hz; nếu yêu cầu có điều chỉnh thất bại sẽ thử thông số mặc định. Không cam kết độ trầm hoặc chất giọng vừa ý trước khi người dùng nghe thử.

File hoàn tất được lưu `dist/audio/<book-id>/<number>.mp3`, danh sách tại `catalog.json` cùng thư mục; chỉ thêm vào danh sách sau khi tạo xong. Tệp tạm không được đưa lên trang công khai. Có thể chạy `python scripts/generate_audio.py --chapter 77` cho thư viện Hoa Sơn. Trình phục vụ hỗ trợ HTTP Range 206 để iPhone tải/tua từng phần MP3.

Người dùng cũng có thể thêm MP3/M4A có sẵn (tối đa 150 MB mỗi file) và gắn số chương. File này lưu trong IndexedDB trên thiết bị, không tự tải lên máy chủ. Cần giữ file gốc để chuyển thiết bị.

## Tủ truyện và thư viện chữ

Thêm truyện bằng tên, link nguồn tùy chọn và file TXT/JSON. TXT có tiêu đề Chương 1, Chương 2… được tự chia chương. Cập nhật thêm chương mới hoặc thay chương cùng số; chương khác được giữ nguyên. Có Sao lưu JSON cho nội dung chữ tự thêm. Với Hoa Sơn, sao lưu chỉ chứa phần bổ sung, không gồm các chương có sẵn.

Thư viện Hoa Sơn có 1.689 mục nhận diện, 1.665 chương có chữ trong phạm vi 77–1768; 24 mục chưa trích được chữ có nút mở bản gốc. Nguồn không có chương 1–76; thư mục Chapter 1769 chứa ảnh chưa OCR. Nhãn 1700–2000 không có nghĩa có đủ đến 2000. Bộ nhập `scripts/import_library.py` ưu tiên Word khi trùng PDF, chuẩn hóa khoảng trắng và không thực thi chỉ dẫn trong nội dung truyện.

Truyện tự thêm và file âm thanh trên IndexedDB; tiến độ đọc/nghe và cài đặt trên localStorage của từng trình duyệt. Không tự đồng bộ giữa điện thoại/máy tính hoặc tên miền khác nhau. Link Drive là liên kết mở nguồn, chưa tự đồng bộ chữ.

## GitHub Pages sau khi duyệt

Workflow `.github/workflows/pages.yml` đưa riêng `dist` lên Pages. Phần đọc và phát MP3 có sẵn chạy trên hosting tĩnh. Chức năng Tạo bản thu cần máy chủ Python, không chạy trực tiếp trên GitHub Pages; cần tạo audio trước rồi đưa các MP3 đã hoàn tất lên hosting. Không chạy bộ tạo hàng loạt cho toàn thư viện trong bản demo này.

## Kiểm tra

`npm run check`: kiểm tra cú pháp JavaScript. `python scripts/check_library.py`: kiểm tra nội dung chữ. Đã thử HTTP Range 206, yêu cầu tạo bản thu qua API, tua file MP3 thực, phát/tạm dừng, giữ âm thanh khi đọc chương khác, khôi phục vị trí nghe sau tải lại, và xác nhận đoạn chữ giữ đúng vị trí khi chuyển sang tua rồi quay lại.
