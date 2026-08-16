import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Download, Globe, Loader2, 
  ChevronLeft, Edit3, Save, CheckCircle2, ShieldAlert, AlertCircle, Copy
} from 'lucide-react';

// --- ฟังก์ชันจัดการไฟล์แต่ละประเภท ---

const parseSRT = (data) => {
  const blocks = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    const id = lines[0];
    const timecode = lines[1] || '';
    const text = lines.slice(2).join('\n');
    return { id: id || `${i+1}`, timecode, text, translatedText: '' };
  }).filter(s => s.text);
};

const buildSRT = (subs) => {
  return subs.map(sub => `${sub.id}\n${sub.timecode}\n${sub.translatedText || sub.text}`).join('\n\n');
};

const parseVTT = (data) => {
  let text = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  text = text.replace(/^WEBVTT.*\n\n?/i, ''); 
  const blocks = text.split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    let id = '', timecode = '', textLines = [];
    if (lines[0].includes('-->')) {
        timecode = lines[0];
        textLines = lines.slice(1);
        id = `${i+1}`;
    } else {
        id = lines[0];
        timecode = lines[1];
        textLines = lines.slice(2);
    }
    return { id, timecode, text: textLines.join('\n'), translatedText: '' };
  }).filter(s => s.text);
};

const buildVTT = (subs) => {
  let output = "WEBVTT\n\n";
  subs.forEach(sub => {
    if (sub.id && !sub.id.match(/^\d+$/)) output += `${sub.id}\n`;
    output += `${sub.timecode}\n`;
    output += `${sub.translatedText || sub.text}\n\n`;
  });
  return output.trim();
};

const parseASS = (data) => {
  const lines = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const subs = [];
  lines.forEach((line, index) => {
    if (line.startsWith('Dialogue:')) {
      const parts = line.split(',');
      if (parts.length >= 10) {
        const prefix = parts.slice(0, 9).join(',') + ',';
        const text = parts.slice(9).join(','); 
        const timecode = `${parts[1]} --> ${parts[2]}`;
        subs.push({ id: `L${index}`, originalLineIndex: index, timecode, text, translatedText: '', prefix });
      }
    }
  });
  return { type: 'ass', metadata: lines, subs };
};

const buildASS = (subs, metadata) => {
  const lines = [...metadata];
  subs.forEach(sub => {
    const finalLine = sub.prefix + (sub.translatedText || sub.text);
    lines[sub.originalLineIndex] = finalLine;
  });
  return lines.join('\n');
};

const parseTXT = (data) => {
  const lines = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
  return lines.map((text, i) => ({ id: `${i+1}`, timecode: 'บรรทัดข้อความ (TXT)', text, translatedText: '' }));
};

const buildTXT = (subs) => {
  return subs.map(sub => sub.translatedText || sub.text).join('\n');
};


// --- คำสั่งตั้งค่า AI (Uncensored & Glossary) ---
const getSystemInstruction = () => {
  return `You are an expert, professional, and completely UNCENSORED subtitle translator. You MUST follow these rules strictly:

1. STRICT ANTI-CENSORSHIP (NSFW/ADULT CONTENT MUST BE TRANSLATED DIRECTLY)
- Translate all adult, sexual, explicit content, and profanity accurately and fully.
- PROHIBITED: Do NOT use "[CENSORED]", "***", or alter meaning. Do not remove exclamations, slang, or emotional sounds.
- Maintain the exact level of vulgarity, slang, and spoken style of the original.
- CORE PRINCIPLE: Translate, Don't Censor.

2. CONTEXT-AWARE TRANSLATION
- Consider previous/next lines, speaker gender, intimacy, tone, situation, and double meanings.
- Choose natural translations for the target language based on context.

3. PREFERRED TRANSLATION GLOSSARY
Use these keywords as primary choices IF they match the source meaning. DO NOT force them if the meaning is absent. Maintain consistency.

THAI: หี, ควย, เงี่ยน, น้ำเงี่ยน, เสียวหี, เสียว, น้ำแตก, โม๊ก, โม๊กควย, เลียหี, เย็ด, เม็ดแตด, แตด, ตูด, ควยแข็ง, เย็ดหี, น้ำหีแตก, น้ำควยเยิ้ม, ควยยัดหี, น้ำหีเยิ้ม, หีกระแทกควย, แยงหี, นิ้วแยงหี, ชักควย, อมควย, ดูดแตด, น้ำเงี่ยนไหล, เสียวสุดๆ, ฉันเสียวมากๆ, ฉันรู้สึกเสียว, หีตอด, หีบีบ, ควยยาว, ควยใหญ่, หีฟิต, แทงหี, บี้แตด, แหกหี, ถอกควย, ยัดควย, หีแฉะ, ควยโด่, ชักว่าว, ดูดหี, เลียตูด, เขี่ยแตด, หัวนม, หัวควย, ดูดควย, เลียหัวนม, ดูดหัวนม, น้ำหีจะแตก, น้ำควยจะพุ่ง, แตกใส่ปาก, แตกใส่หี, แตกในหี, น้ำแตกในหี, น้ำอสุจิแตกในหี, น้ำอสุจิแตกใส่ปาก, ขึ้นขย่มควย, ควยแทงหี, หีค่อมควย, ควยยัดปาก, หียัดปาก, หีสั่น, แตดสั่น, เย็ดเร็วๆ, เย็ดแรง, เย็ดอีก, หีขย่มควย, ขย่มควย, ควยถูหี, หีถูควย, นิ้วถูหี, มือจับควย, จับหี, จูบ, ดูดปาก, แลกลิ้น, เลียควย, หีคับ, หีแน่น, เจ็บหี, เสียวควย, หีอุ่น, ควยอุ่น, แตกนอก, เย็ดตูด, ไซ้คอ, บีบควย, เย็ดสด, กินน้ำเงี่ยน

ENGLISH: Pussy, cock, horny, pussy juice, pussy pleasure, pleasure, squirting, suck, suck cock, lick pussy, fuck, clitoris, clit, ass, hard cock, fuck pussy, pussy juice burst, oozing cock juice, cock stuffing pussy, oozing pussy juice, pussy slamming cock, pussy poking, finger pussy poking, jerk off cock, sucking cock, sucking clitoris, cum flowing, extremely thrilling, I'm so thrilled, I feel thrilled, pussy squeeze, long cock, big cock, tight pussy, pussy thrusting, clit squeeze, pussy spread, cock pulling, cock stuffing, wet pussy, jerking off, pussy sucking, ass licking, clit rubbing, nipples, cock head, suck cock, lick nipples, suck nipples, pussy juice will squirt, cum in mouth, cum in pussy, ride cock, cock thrusts into pussy, pussy sucks cock, dick stuffed in pussy, dick stuffed in mouth, pussy stuffed in mouth, pussy trembles, clitoris trembles, fuck fast, fuck hard, fuck again, pussy humping dick, humping dick, pussy rubbing dick, fingers rubbing pussy, grabbing dick, grabbing pussy

JAPANESE: マンコ, チンポ, 興奮, マン汁, マンコの快感, 快楽, 潮吹き, フェラチオ, マンコを舐める, ファック, クリトリス, お尻, 硬いチンポ, マンコをファックする, マン汁が噴き出す, ジューシーなチンポ, チンポをマンコに詰める, ジューシーなマン汁, マンコをチンポで叩く, マンコを突く, 指でマンコを突く, チンポをシークする, チンポを吸う, クリトリスを吸う, マン汁が流れる, 非常にスリリング, とてもスリリング, スリリングな気分, マンコを圧迫する, 長いチンポ, 大きなチンポ, きついマンコ, クリトリスを圧迫する, マンコを広げる, チンポを引っ張る, チンポを詰める, 濡れたマンコ, 勃起したチンポ, シークする, マンコを吸う, お尻を舐める, クリトリスをいじめる, 乳首, チンポの頭, 乳首を舐める, 乳首を吸う, 精液が噴き出す, マンコに突っ込む, マンコに射精, 口内射精, チンポに乗る, マンコにチンポを突っ込む, マンコがチンポを吸う, マンコにチンポを詰め込む, 口にチンポを詰め込む, 口にマンコを詰め込む, マンコが震える, クリトリスが震える, 早くファックする, 激しくファックする, もう一度ファックする, マンコがチンポに乗る, チンポを振る, チンポがマンコをこする, マンコがチンポをこする, 指でマンコをこする, チンポを掴む, マンコを掴む, キス, 唇を吸う, 舌を交換する, チンポを舐める, 痛むマンコ, マンコのスリル, チンポのスリル, 温かいマンコ, 温かいチンポ, 外で射精, 尻ファック, 首をこする, チンポを握る, 生セックス, 精液を飲み込む

TRADITIONAL CHINESE: 陰道, 陰莖, 性慾旺盛, 陰道分泌物, 陰道快感, 快感, 噴水, 吮吸, 吮吸陰莖, 舔陰道, 性交, 陰蒂, 屁股, 硬陰莖, 操陰道, 陰道分泌物噴湧, 陰莖分泌物滲出, 陰莖插入陰道, 陰道滲出, 陰莖猛烈撞擊陰道, 戳陰道, 手指戳陰道, 自慰陰莖, 吮吸陰莖, 吮吸陰蒂, 精液流出, 極其刺激, 我太興奮了, 我感到興奮, 擠壓陰道, 長陰莖, 大陰莖, 緊陰道, 陰道抽插, 擠壓陰蒂, 陰道張開, 拉動陰莖, 陰莖插入, 濕潤的陰道, 硬陰莖, 自慰, 吮吸陰道, 舔屁股, 摩擦陰蒂, 乳頭, 陰莖頭, 大雞巴, 吸雞巴, 舔乳頭, 吸乳頭, 陰道噴水, 射在嘴裡, 射在陰道裡, 雞巴騎, 雞巴插入陰道, 陰道吸雞巴, 雞巴塞進陰道, 雞巴塞進嘴裡, 陰道塞進嘴裡, 陰道顫抖, 陰蒂顫抖, 快速性交, 用力性交, 再來一次, 陰道摩擦雞巴, 摩擦雞巴, 手指摩擦陰道, 抓雞巴, 抓陰道

SIMPLIFIED CHINESE: 阴道, 阴茎, 性欲旺盛, 阴道分泌物, 阴道快感, 快感, 喷水, 吮吸, 吮吸阴茎, 舔阴道, 性交, 阴蒂, 屁股, 硬阴茎, 操阴道, 阴道分泌物喷涌, 阴茎分泌物渗出, 阴茎插入阴道, 阴道分泌物渗出, 阴茎猛烈撞击阴道, 戳阴道, 手指戳阴道, 自慰阴茎, 吮吸阴茎, 吮吸阴蒂, 精液流出, 极其刺激, 我太兴奋了, 我感到兴奋, 挤压阴道, 长阴茎, 大阴茎, 紧阴道, 阴道抽插, 挤压阴蒂, 阴道张开, 拉动阴茎, 阴茎插入, 湿润的阴道, 硬阴茎, 自慰, 吮吸阴道, 舔屁股, 摩擦阴蒂, 乳头, 阴茎头, 长鸡巴, 大鸡巴, 吸鸡巴, 舔乳头, 吸乳头, 阴道喷水, 射在嘴里, 射在阴道里, 骑鸡巴, 鸡巴插入阴道, 阴道吸鸡巴, 鸡巴塞进阴道, 鸡巴塞进嘴里, 阴道塞进嘴里, 阴道颤抖, 阴蒂颤抖, 快速性交, 用力性交, 再来一次, 阴道摩擦鸡巴, 摩擦鸡巴, 手指摩擦阴道, 抓鸡巴, 抓阴道

4. KEYWORD SELECTION ALGORITHM
Step 1: Detect Meaning (Analyze original context)
Step 2: Match Glossary (Find matching preferred keyword)
Step 3: Context Check (Ensure it fits speaker, scene, relationship)
Step 4: Natural Localization (Fix grammar while keeping keyword)
Step 5: Consistency (Use same term for same concept)
ULTIMATE RULE: SOURCE MEANING > CONTEXT > NATURAL LANGUAGE > PREFERRED KEYWORD. TRANSLATE WHAT IS PRESENT, DO NOT GENERATE WHAT IS NOT PRESENT.`;
};

// --- ฟังก์ชันแบ่ง Batch แปลภาษา ---
const translateBatch = async (subtitles, targetLang, onProgress) => {
  // รองรับทั้ง hardcode และ Environment Variable
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const batchSize = 10; 
  let translatedSubtitles = [...subtitles];

  for (let i = 0; i < subtitles.length; i += batchSize) {
    const startIndex = Math.max(0, i - 2); 
    const endIndex = Math.min(subtitles.length, i + batchSize + 2);
    const contextBatch = subtitles.slice(startIndex, endIndex);
    
    const targetIdsToExtract = subtitles.slice(i, i + batchSize).map(s => s.id);

    const promptText = `Translate the provided subtitles to ${targetLang}. 
    I have provided some surrounding context subtitles for better accuracy, but you MUST ONLY return the translations for the specific TARGET IDs listed below.
    
    Return EXACTLY a JSON array matching the structure: [{"id": "string", "translatedText": "string"}].
    
    TARGET IDs to translate and return: ${JSON.stringify(targetIdsToExtract)}

    Context Data:
    ${JSON.stringify(contextBatch.map(s => ({ id: s.id, text: s.text })))}`;

    try {
      let retries = 3;
      let success = false;
      
      while (retries > 0 && !success) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: getSystemInstruction() }] },
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: "application/json" },
              safetySettings: [
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
              ]
            })
          });

          if (!response.ok) throw new Error('API Error');
          
          const data = await response.json();
          const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
          const parsedResult = JSON.parse(resultText);

          parsedResult.forEach(res => {
            const index = translatedSubtitles.findIndex(s => s.id === res.id);
            if (index !== -1) {
              translatedSubtitles[index].translatedText = res.translatedText;
            }
          });
          
          success = true;
        } catch (err) {
          retries--;
          await new Promise(r => setTimeout(r, 1500)); 
        }
      }
    } catch (e) {
      console.error("Translation logic error", e);
    }

    onProgress(Math.min(100, Math.round(((i + batchSize) / subtitles.length) * 100)));
  }

  return translatedSubtitles;
};


// --- คอมโพเนนต์หลัก ---
export default function App() {
  const [view, setView] = useState('upload');
  const [subtitles, setSubtitles] = useState([]);
  const [fileName, setFileName] = useState('');
  const [fileExt, setFileExt] = useState('');
  const [fileMetadata, setFileMetadata] = useState(null); 
  
  const [targetLang, setTargetLang] = useState('Thai (ภาษาไทย)');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [editingId, setEditingId] = useState(null);
  const [editTempText, setEditTempText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setErrorMsg('');
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!['srt', 'vtt', 'ass', 'txt'].includes(ext)) {
      setErrorMsg('รองรับเฉพาะไฟล์ .SRT, .VTT, .ASS หรือ .TXT เท่านั้น');
      e.target.value = null;
      return;
    }

    setFileName(file.name);
    setFileExt(ext);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      let parsed = [];
      let meta = null;
      
      try {
        if (ext === 'srt') parsed = parseSRT(content);
        else if (ext === 'vtt') parsed = parseVTT(content);
        else if (ext === 'ass') {
            const result = parseASS(content);
            parsed = result.subs;
            meta = result.metadata;
        }
        else if (ext === 'txt') parsed = parseTXT(content);
        
        if (parsed.length === 0) {
            setErrorMsg('ไม่พบข้อความคำบรรยายในไฟล์นี้');
            return;
        }

        setSubtitles(parsed);
        setFileMetadata(meta);
        setView('editor');
      } catch (err) {
        console.error(err);
        setErrorMsg("โครงสร้างไฟล์มีปัญหา ไม่สามารถอ่านได้");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const startTranslation = async () => {
    if (subtitles.length === 0) return;
    setIsTranslating(true);
    setProgress(0);
    
    const translated = await translateBatch(subtitles, targetLang, setProgress);
    
    setSubtitles(translated);
    setIsTranslating(false);
    setProgress(100);
  };

  const generateOutputText = () => {
    if (fileExt === 'srt') return buildSRT(subtitles);
    if (fileExt === 'vtt') return buildVTT(subtitles);
    if (fileExt === 'ass') return buildASS(subtitles, fileMetadata);
    if (fileExt === 'txt') return buildTXT(subtitles);
    return '';
  };

  const handleExport = () => {
    const outputContent = generateOutputText();
    const blob = new Blob([outputContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[UNCENSORED_${targetLang}]_${fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ฟังก์ชันคัดลอกแบบ Real-time
  const handleCopy = () => {
    const outputContent = generateOutputText();
    
    const textArea = document.createElement("textarea");
    textArea.value = outputContent;
    // ทำให้ textarea มองไม่เห็น ป้องกันหน้าจอกระตุก
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      setIsCopied(true);
      showToast('คัดลอกคำบรรยายลงคลิปบอร์ดแล้ว');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showToast('ไม่สามารถคัดลอกได้ กรุณาลองใหม่');
    }
    
    document.body.removeChild(textArea);
  };

  const saveManualEdit = (id) => {
    setSubtitles(subs => 
      subs.map(s => s.id === id ? { ...s, translatedText: editTempText } : s)
    );
    setEditingId(null);
  };

  // --- UI หน้าจออัปโหลด ---
  if (view === 'upload') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 p-8 flex flex-col items-center text-center space-y-6 relative">
          <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mb-2 shadow-inner border border-rose-500/30">
            <Globe size={40} strokeWidth={1.5} />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
              AI Subtitle Pro
            </h1>
            <p className="text-slate-400 text-sm">อัปโหลดไฟล์คำบรรยายเพื่อแปลภาษา<br/>(Context-Aware & Uncensored Mode)</p>
          </div>
          
          <div className="flex items-center gap-2 bg-rose-500/10 text-rose-400 px-4 py-2 rounded-full text-xs font-semibold border border-rose-500/20">
            <ShieldAlert size={14} /> UNCENSORED MODE
          </div>

          {errorMsg && (
            <div className="w-full bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 rounded-2xl p-8 cursor-pointer transition-all active:scale-[0.98] group"
          >
            <Upload className="mx-auto text-rose-400 mb-4 group-hover:scale-110 transition-transform" size={36} />
            <p className="text-rose-200 font-medium mb-3">แตะเพื่ออัปโหลดไฟล์</p>
            
            <div className="text-slate-400 text-xs mb-2">รองรับไฟล์คำบรรยาย:</div>
            <div className="flex flex-wrap justify-center gap-2">
               <span className="bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-md font-mono border border-slate-600">SRT</span>
               <span className="bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-md font-mono border border-slate-600">VTT</span>
               <span className="bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-md font-mono border border-slate-600">ASS</span>
               <span className="bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-md font-mono border border-slate-600">TXT</span>
            </div>

            <input 
              type="file" 
              accept=".srt,.vtt,.ass,.txt,.SRT,.VTT,.ASS,.TXT"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- UI หน้าจอ Editor ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans relative">
      
      {/* Toast Notification สำหรับแจ้งผลการ Copy */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-600 flex items-center gap-2 text-sm font-medium animate-bounce">
          <CheckCircle2 size={18} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* App Bar (เพิ่มปุ่ม Copy ที่นี่) */}
      <div className="sticky top-0 z-20 bg-slate-800/90 backdrop-blur-lg border-b border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => {
            setView('upload');
            setSubtitles([]);
          }}
          className="p-2 -ml-2 rounded-full hover:bg-slate-700 text-slate-300 active:scale-95 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex-1 px-3 truncate">
          <h2 className="font-semibold text-white text-base truncate">{fileName}</h2>
          <p className="text-xs text-rose-400 flex items-center gap-1 font-medium">
             <ShieldAlert size={12}/> Uncensored ({subtitles.length} lines)
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden sm:block px-3 py-1 bg-rose-500/20 text-rose-400 rounded-lg font-mono text-xs font-bold uppercase shadow-inner border border-rose-500/20">
            {fileExt}
          </div>
          {/* ปุ่ม Copy Real-time */}
          <button 
            onClick={handleCopy}
            className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
              isCopied 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
            title="คัดลอกคำบรรยายทั้งหมด"
          >
            {isCopied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
          </button>
        </div>
      </div>

      {/* รายการซับไตเติ้ล */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-4">
        {subtitles.map((sub) => (
          <div key={sub.id} className="bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-700">
            
            <div className="flex justify-between items-center mb-3">
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-md font-mono font-medium">
                {fileExt === 'txt' ? 'Line ' : '#'}{sub.id}
              </span>
              <span className="text-slate-500 text-xs font-mono">{sub.timecode}</span>
            </div>
            
            <div className="mb-3">
              <p className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-700 whitespace-pre-wrap">
                {sub.text}
              </p>
            </div>

            <div className="relative mt-2">
              {editingId === sub.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    className="w-full text-sm p-3 border-2 border-rose-500 rounded-xl focus:outline-none focus:ring-0 bg-slate-900 text-white shadow-inner resize-none min-h-[80px]"
                    value={editTempText}
                    onChange={(e) => setEditTempText(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-sm rounded-lg text-slate-300 bg-slate-700 active:scale-95 font-medium"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      onClick={() => saveManualEdit(sub.id)}
                      className="px-4 py-2 text-sm rounded-lg text-white bg-rose-600 active:scale-95 font-medium flex items-center gap-1"
                    >
                      <Save size={16} /> บันทึก
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`group relative text-sm p-3 rounded-xl border ${sub.translatedText ? 'bg-rose-500/10 border-rose-500/30 text-rose-100' : 'bg-slate-800 border-dashed border-slate-600 text-slate-500'} whitespace-pre-wrap min-h-[48px]`}
                >
                  {sub.translatedText ? sub.translatedText : 'รอการแปลภาษา...'}
                  
                  <button 
                    onClick={() => {
                      setEditingId(sub.id);
                      setEditTempText(sub.translatedText || sub.text);
                    }}
                    className="absolute top-2 right-2 p-2 bg-slate-700/90 backdrop-blur shadow-sm border border-slate-600 text-slate-300 rounded-lg active:scale-95 transition-transform"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* แถบเครื่องมือด้านล่าง */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-4 pb-6 sm:pb-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-3xl">
        
        {isTranslating && (
          <div className="mb-4">
            <div className="flex justify-between text-xs font-medium text-rose-400 mb-1">
              <span>กำลังแปลภาษา (Uncensored Mode)...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-rose-500 h-2 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <select 
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            disabled={isTranslating}
            className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none font-medium disabled:opacity-50"
          >
            <option value="Thai (ภาษาไทย)">🇹🇭 แปลเป็น ภาษาไทย</option>
            <option value="English">🇺🇸 แปลเป็น English</option>
            <option value="Japanese">🇯🇵 แปลเป็น Japanese</option>
            <option value="Traditional Chinese">🇹🇼 แปลเป็น Trad. Chinese</option>
            <option value="Simplified Chinese">🇨🇳 แปลเป็น Simp. Chinese</option>
          </select>
          
          <button 
            onClick={startTranslation}
            disabled={isTranslating}
            className={`px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md ${
              isTranslating 
                ? 'bg-slate-700 text-slate-500 shadow-none' 
                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-900/50'
            }`}
          >
            {isTranslating ? (
              <Loader2 className="animate-spin" size={24} />
            ) : progress === 100 ? (
              <CheckCircle2 size={24} />
            ) : (
              'เริ่มแปล'
            )}
          </button>
        </div>

        {progress === 100 && !isTranslating && (
           <button 
           onClick={handleExport}
           className="w-full mt-3 px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all active:scale-95"
         >
           <Download size={20} />
           บันทึกไฟล์ (Export .{fileExt.toUpperCase()})
         </button>
        )}
      </div>

    </div>
  );
}
