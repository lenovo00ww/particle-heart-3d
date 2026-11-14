# 3D Blue Particle Heart

ฉาก WebGL 2 พื้นดำ แสดงหัวใจสามมิติจากจุดแสงสีน้ำเงินและเส้นพลังงานจากฐาน หมุนรอบแกน Y ได้ 360° ลากด้วยเมาส์หรือนิ้วเพื่อปรับมุม คลิกหรือแตะบนหัวใจเพื่อกระจายประกาย หรือโฟกัสผืนภาพแล้วกด Space แผงควบคุมมี Play/Pause, Rotation, Glow, Hide/Show และ Fullscreen เมื่อเบราว์เซอร์รองรับ

## เริ่มพัฒนา

ใช้ Node.js 22.12+ ในสาย 22 หรือ Node.js 24 ขึ้นไป พร้อม npm, Git และ VS Code

```sh
npm ci
npm run dev
npm run build
npm run preview
```

เปิด URL ที่ Vite พิมพ์ใน Terminal โดยมี base path `/particle-heart-3d/` บน Windows เปิดโฟลเดอร์ด้วย `code C:\work\particle-heart-3d`

## โครงสร้างและการปรับค่า

| ไฟล์ | หน้าที่และค่าที่ปรับได้ |
| --- | --- |
| `index.html`, `src/style.css` | โครงหน้าจอ ข้อความควบคุม ขนาดแถบควบคุมและจอสัมผัส |
| `src/particles.js` | สมการหัวใจสามมิติ จุดลอย และ burst pool ปรับสีด้วย `BLUES` และจำนวนจุดด้วย `HEART_COUNTS` |
| `src/energy.js` | อนุภาคไหลขึ้นจากฐาน เส้นโค้งไหลวน จุดสว่างปลายเส้น และแสงฟุ้ง ปรับระดับฐานด้วย `BASE_Y` |
| `src/main.js` | กล้อง การหมุนและลาก ควบคุมการเล่น การจัดการ WebGL และ post-processing ปรับตัวคูณความเร็ว `0.43` (เรเดียน/วินาที) ค่า threshold/radius ใน `UnrealBloomPass` และเพดาน DPR ใน `resize` |
| `vite.config.js` | Base path สำหรับ GitHub Pages และการแยก bundle Three.js |
| `.github/workflows/deploy.yml` | ติดตั้งจาก lockfile, build, อัปโหลดและ deploy โฟลเดอร์ `dist` |

Three.js, ShaderMaterial, BufferGeometry, additive blending, UnrealBloomPass, Vite และ JavaScript แบบ ES modules ทำงานฝั่งเบราว์เซอร์ ตัวนับอนุภาค burst คงที่ 640 จุดและนำช่องกลับมาใช้ใหม่ ระดับคุณภาพจะลดจำนวนจุด ความละเอียด Bloom และ DPR ตามขนาดจอและเวลาที่ใช้เรนเดอร์

## GitHub Pages

ตั้ง Settings → Pages → Source เป็น GitHub Actions การ push เข้า `main` จะเรียก workflow อัตโนมัติ หรือรันจาก Actions → Deploy GitHub Pages → Run workflow เปิด URL ที่แสดงใน deployment environment แล้วตรวจการโหลด JavaScript/CSS และการแสดงผลจริง หากย้ายชื่อ repo เปลี่ยน `base` ให้ตรงด้วย

## แก้ไขผ่าน VS Code หรือ ChatGPT Work

Source หลักอยู่ที่ https://github.com/lenovo00ww/particle-heart-3d และ checkout อยู่ที่ `C:\work\particle-heart-3d` เมื่อ Windows ออนไลน์ ให้ตรวจเครื่อง `DESKTOP-EQQQE0L`, `git status --short --branch`, `git remote -v` และ `git fetch origin` ก่อนแก้ไข ตรวจความต่างของ local/remote ด้วย `git log --left-right --oneline HEAD...origin/main` ถ้า checkout สะอาดและ local ตามหลัง ใช้ `git pull --ff-only` ถ้ามีงานที่ยังไม่ commit ให้เก็บงานนั้นไว้และใช้ worktree แยกเมื่อจำเป็น

สั่งใน ChatGPT Work ได้ เช่น “แก้ฐานพลังงานใน repo lenovo00ww/particle-heart-3d ให้สว่างขึ้นเล็กน้อย ทดสอบ npm run build แล้วเช็กผล GitHub Pages” ใช้ checkout เดิมหรือ checkout แยกจาก GitHub เมื่อเครื่องออฟไลน์โดยใช้สิทธิ์ที่มี ทดสอบใน dev และ preview ก่อน commit/push ตรวจ Actions และหน้า production หลังเผยแพร่

## ข้อจำกัด

ต้องใช้เบราว์เซอร์ที่รองรับ WebGL 2 และเปิดการเร่งผลกราฟิกได้ FPS ขึ้นกับ GPU และความละเอียด จอที่เปิด Reduce Motion เริ่มในโหมดหยุดภาพโดยอัตโนมัติ ส่วน Fullscreen ขึ้นกับ API ของเบราว์เซอร์ รูปแบบการไหลและกระจายของอนุภาคสร้างขึ้นตามภาพอ้างอิงและข้อกำหนด
