# AI Translator Pro (AI Subtitle Pro)

**Context-Aware & Uncensored Subtitle Translator**

รองรับไฟล์: **SRT, VTT, ASS, TXT**

## Features
- แปลคำบรรยายด้วย Gemini AI (Uncensored Mode)
- รองรับ Context-aware translation
- แก้ไขคำแปลด้วยตัวเองได้
- Export ไฟล์กลับในรูปแบบเดิม
- Copy to clipboard

## Setup

1. Clone repo
2. `npm install`
3. ใส่ Gemini API Key ในไฟล์ `src/App.jsx` (บรรทัด `const apiKey = "";`)  
   หรือใช้ Environment Variable `VITE_GEMINI_API_KEY`
4. `npm run dev`

## Deploy บน Cloudflare Pages

1. ไปที่ [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. เลือก repository `ai-translator-pro`
3. ตั้งค่า:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. (แนะนำ) เพิ่ม Environment Variable: `VITE_GEMINI_API_KEY` = API Key ของคุณ
5. Deploy!

## License
MIT
