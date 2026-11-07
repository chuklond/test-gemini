import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sparkles, Volume2, VolumeX, ChevronLeft, ChevronRight, 
  Wand2, RefreshCw, Play, Pause, RotateCcw, Image as ImageIcon, 
  Music, CheckCircle2, AlertCircle, Compass, Heart, Star
} from 'lucide-react';

// ==========================================
// KONFIGURASI API GEMINI (OTOMATIS TER-INJECT)
// ==========================================
const apiKey = ""; // Otomatis diisi oleh environment akun Anda saat runtime

// Helper: Buat SVG Ilustrasi 3D Cartoon Kontekstual jika sedang offline
const createCute3DFallbackSvg = (pageNumber, titleText = "") => {
  const palettes = [
    { bg1: "#38bdf8", bg2: "#818cf8", sun: "#fde047", hill1: "#4ade80", hill2: "#22c55e", char: "#fb7185" },
    { bg1: "#f472b6", bg2: "#c084fc", sun: "#fef08a", hill1: "#34d399", hill2: "#10b981", char: "#fbbf24" },
    { bg1: "#fb923c", bg2: "#f43f5e", sun: "#fef9c3", hill1: "#a3e635", hill2: "#65a30d", char: "#60a5fa" },
    { bg1: "#a78bfa", bg2: "#60a5fa", sun: "#fde047", hill1: "#2dd4bf", hill2: "#0d9488", char: "#f472b6" }
  ];
  const p = palettes[(pageNumber - 1) % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
    <defs>
      <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${p.bg1}"/>
        <stop offset="100%" stop-color="${p.bg2}"/>
      </linearGradient>
      <radialGradient id="sun" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="${p.sun}"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </radialGradient>
      <radialGradient id="charBody" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>
        <stop offset="25%" stop-color="${p.char}"/>
        <stop offset="100%" stop-color="#881337"/>
      </radialGradient>
      <linearGradient id="hillA" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${p.hill1}"/>
        <stop offset="100%" stop-color="${p.hill2}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#sky)"/>
    <circle cx="650" cy="130" r="75" fill="url(#sun)"/>
    <g fill="#ffffff" opacity="0.85">
      <circle cx="170" cy="140" r="45"/><circle cx="215" cy="130" r="55"/><circle cx="265" cy="145" r="40"/>
      <circle cx="450" cy="190" r="35"/><circle cx="490" cy="180" r="45"/><circle cx="530" cy="195" r="30"/>
    </g>
    <ellipse cx="220" cy="560" rx="420" ry="190" fill="url(#hillA)"/>
    <ellipse cx="640" cy="580" rx="420" ry="210" fill="${p.hill2}"/>
    <ellipse cx="400" cy="470" rx="95" ry="24" fill="#000000" opacity="0.2"/>
    <circle cx="400" cy="340" r="115" fill="url(#charBody)"/>
    <ellipse cx="355" cy="275" rx="35" ry="18" transform="rotate(-25 355 275)" fill="#ffffff" opacity="0.55"/>
    <circle cx="360" cy="325" r="18" fill="#1e1b4b"/>
    <circle cx="354" cy="318" r="7" fill="#ffffff"/>
    <circle cx="440" cy="325" r="18" fill="#1e1b4b"/>
    <circle cx="434" cy="318" r="7" fill="#ffffff"/>
    <ellipse cx="330" cy="350" rx="18" ry="10" fill="#fb7185" opacity="0.7"/>
    <ellipse cx="470" cy="350" rx="18" ry="10" fill="#fb7185" opacity="0.7"/>
    <path d="M 375 355 Q 400 385 425 355" stroke="#1e1b4b" stroke-width="8" stroke-linecap="round" fill="none"/>
    <polygon points="400,190 415,222 450,226 424,250 431,285 400,267 369,285 376,250 350,226 385,222" fill="#fde047" stroke="#ffffff" stroke-width="4"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Helper: Exponential Backoff untuk mengatasi rate limit
const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) {
        const errText = await res.text();
        throw new Error(`API Error (${res.status}): ${errText}`);
      }
    } catch (err) {
      if (i === retries - 1) throw err;
    }
    await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
  }
};

// Helper: Konversi Base64 ke ArrayBuffer untuk Audio TTS
const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Helper: Konversi PCM16 ke WAV Blob agar bisa diputar di elemen <audio> HTML5
const pcmToWav = (pcm16, sampleRate = 24000) => {
  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm16.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcm16.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }
  return new Blob([view], { type: 'audio/wav' });
};

// ==========================================
// DATA PRESET & PILIHAN
// ==========================================
const STORY_PRESETS = [
  {
    title: "Kancil & Robot Penjaga Hutan",
    emoji: "🦌🤖",
    bg: "from-emerald-400 to-teal-500",
    plot: "Seekor kancil cerdik bertemu dengan robot bulat lucu di hutan pelangi, lalu mereka bekerja sama menyelamatkan air terjun coklat.",
    voice: "Aoede"
  },
  {
    title: "Putri Bintang & Awan Permen",
    emoji: "👑☁️",
    bg: "from-pink-400 to-rose-500",
    plot: "Seorang putri kecil yang tinggal di istana awan permen kapas berpetualang bersama kunang-kunang raksasa yang ramah.",
    voice: "Leda"
  },
  {
    title: "Kucing Oren Penjelajah Dinosaurus",
    emoji: "🐱🦖",
    bg: "from-amber-400 to-orange-500",
    plot: "Seekor kucing oren gendut memakai ransel roket dan bertemu bayi T-Rex yang suka makan es krim.",
    voice: "Puck"
  }
];

const ART_STYLE_DEFAULT = "3D Pixar & Disney Animation Style, cute chubby characters, vibrant candy colors, soft global illumination, Toy Story aesthetic";

const VOICE_OPTIONS = [
  { id: "Aoede", label: "🧚‍♀️ Kak Aoede (Ramah & Ceria)", desc: "Cocok untuk dongeng pengantar tidur" },
  { id: "Puck", label: "🚀 Kak Puck (Semangat & Seru)", desc: "Cocok untuk cerita petualangan seru" },
  { id: "Leda", label: "🌸 Kak Leda (Manis & Lembut)", desc: "Cocok untuk cerita fabel & persahabatan" },
  { id: "Charon", label: "🦉 Kakek Charon (Bijaksana)", desc: "Cocok untuk legenda dan kisah moral" }
];

// Komponen Dekorasi Karakter 3D SVG Mengambang
const Cute3DBookMascot = () => (
  <svg viewBox="0 0 120 120" className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-xl">
    <defs>
      <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF9EBB" />
        <stop offset="50%" stopColor="#FF5E8E" />
        <stop offset="100%" stopColor="#D81B60" />
      </linearGradient>
      <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF59D" />
        <stop offset="50%" stopColor="#FFCA28" />
        <stop offset="100%" stopColor="#FF8F00" />
      </linearGradient>
      <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FF4081" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#FF4081" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="60" cy="108" rx="34" ry="7" fill="#000000" opacity="0.15" />
    <circle cx="60" cy="62" r="38" fill="url(#bodyGrad)" />
    <ellipse cx="45" cy="40" rx="14" ry="8" transform="rotate(-25 45 40)" fill="#FFFFFF" opacity="0.45" />
    <circle cx="46" cy="58" r="7" fill="#2D1B4E" />
    <circle cx="44" cy="55" r="2.5" fill="#FFFFFF" />
    <circle cx="74" cy="58" r="7" fill="#2D1B4E" />
    <circle cx="72" cy="55" r="2.5" fill="#FFFFFF" />
    <circle cx="35" cy="65" r="8" fill="url(#cheekGrad)" />
    <circle cx="85" cy="65" r="8" fill="url(#cheekGrad)" />
    <path d="M 52 66 Q 60 76 68 66" stroke="#2D1B4E" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M60 10 L66 22 L79 24 L69 33 L72 46 L60 39 L48 46 L51 33 L41 24 L54 22 Z" fill="url(#starGrad)" stroke="#FFFFFF" strokeWidth="2" />
  </svg>
);

export default function App() {
  const [plot, setPlot] = useState("");
  const [voiceName, setVoiceName] = useState(VOICE_OPTIONS[0].id);
  const [pageCount, setPageCount] = useState(4);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    step: "",
    readyCount: 0,
    totalCount: 0
  });
  const [storyData, setStoryData] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  const [pageImages, setPageImages] = useState({});
  const [loadingImages, setLoadingImages] = useState({});
  const [pageAudios, setPageAudios] = useState({});
  const [loadingAudios, setLoadingAudios] = useState({});

  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const lastPlayedPageRef = useRef(null);
  const currentPageRef = useRef(0);

  const [touchStartX, setTouchStartX] = useState(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    return () => {
      Object.values(pageAudios).forEach(url => {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!storyData) return;

    if (currentPage >= 1 && currentPage <= storyData.pages.length) {
      const pageIdx = currentPage - 1;
      if (!pageImages[pageIdx] || !pageAudios[pageIdx]) {
        loadPageAssets(pageIdx);
      }
    } else {
      stopAudio();
      lastPlayedPageRef.current = null;
    }
  }, [currentPage, storyData]);

  useEffect(() => {
    if (!storyData || currentPage < 1 || currentPage > storyData.pages.length) return;
    const pageIdx = currentPage - 1;
    const audioUrl = pageAudios[pageIdx];
    if (!audioUrl) return;

    const playKey = `${currentPage}_${audioUrl}`;
    if (lastPlayedPageRef.current === playKey) return;
    lastPlayedPageRef.current = playKey;

    if (!autoPlay) return;

    if (audioUrl === "WEB_SPEECH_FALLBACK") {
      speakWithBrowserTTS(storyData.pages[pageIdx].text, pageIdx);
    } else if (audioRef.current) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      audioRef.current.pause();
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          speakWithBrowserTTS(storyData.pages[pageIdx].text, pageIdx);
        });
    }
  }, [currentPage, pageAudios, autoPlay, storyData]);

  const speakWithBrowserTTS = (text, pageIdx = currentPageRef.current - 1) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();

    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let currentSentenceIdx = 0;

    const speakNextSentence = () => {
      if (currentPageRef.current - 1 !== pageIdx) {
        setIsPlaying(false);
        return;
      }

      if (currentSentenceIdx >= sentences.length) {
        utteranceRef.current = null;
        handleAudioEnded();
        return;
      }

      const sentenceText = sentences[currentSentenceIdx].trim();
      if (!sentenceText) {
        currentSentenceIdx++;
        speakNextSentence();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentenceText);
      utteranceRef.current = utterance;
      utterance.lang = 'id-ID';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang && v.lang.toLowerCase().includes('id'));
      if (idVoice) utterance.voice = idVoice;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        currentSentenceIdx++;
        speakNextSentence();
      };
      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        currentSentenceIdx++;
        speakNextSentence();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextSentence();
  };

  const handleCreateStory = async (e) => {
    if (e) e.preventDefault();
    if (!plot.trim()) {
      setErrorMsg("Silakan tuliskan alur atau ide cerita terlebih dahulu ya!");
      return;
    }

    setErrorMsg(null);
    setIsGeneratingStory(true);
    setGenerationProgress({
      step: "Sedang merangkai naskah cerita dongeng...",
      readyCount: 0,
      totalCount: pageCount * 2
    });
    stopAudio();
    lastPlayedPageRef.current = null;
    setStoryData(null);
    setPageImages({});
    setPageAudios({});
    setLoadingImages({});
    setLoadingAudios({});
    setCurrentPage(0);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const systemInstruction = `Kamu adalah penulis buku dongeng anak-anak dan sutradara animasi 3D profesional terbaik di Indonesia.
Tugasmu adalah membuat cerita dongeng anak yang memikat dan memastikan deskripsi gambar (imagePrompt) di setiap halaman SANGAT SESUAI dan menggambarkan secara akurat adegan yang sedang diceritakan pada teks halaman tersebut.`;

      const userPrompt = `Buatlah buku dongeng anak-anak yang sangat ceria, penuh warna, dan terdiri dari tepat ${pageCount} halaman berdasarkan alur berikut: "${plot}".
Pastikan:
1. "characterDesign": deskripsi fisik detail karakter utama dalam Bahasa Inggris (warna tubuh/baju, bentuk 3D yang menggemaskan, ciri khas) agar konsisten di semua halaman.
2. Setiap halaman memiliki:
   - "pageNumber": nomor urut halaman (1 sampai ${pageCount}).
   - "sceneTitle": judul singkat adegan halaman tersebut dalam Bahasa Indonesia (3-5 kata).
   - "text": narasi cerita untuk halaman tersebut (2 hingga 4 kalimat yang ceria, ekspresif, dan sesuai dengan kejadian di halaman itu).
   - "imagePrompt": deskripsi visual detail dalam Bahasa Inggris dengan komposisi wide-shot/full-shot terpusat (centered full-body composition with breathing room around the edges so nothing is cropped) yang menggambarkan PERSIS aksi, latar tempat, dan emosi yang terjadi pada "text" halaman tersebut, lengkap dengan deskripsi fisik karakter utama ("characterDesign"). Jangan sertakan teks/tulisan di dalam gambar.`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Judul dongeng yang menarik" },
              moral: { type: "STRING", description: "Pesan moral singkat dari dongeng ini" },
              characterDesign: { type: "STRING", description: "Deskripsi konsisten karakter utama dalam Bahasa Inggris" },
              pages: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    pageNumber: { type: "INTEGER" },
                    sceneTitle: { type: "STRING" },
                    text: { type: "STRING" },
                    imagePrompt: { type: "STRING" }
                  },
                  required: ["pageNumber", "sceneTitle", "text", "imagePrompt"]
                }
              }
            },
            required: ["title", "moral", "characterDesign", "pages"]
          }
        }
      };

      const data = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) throw new Error("Gagal membuat naskah cerita.");

      const parsedStory = JSON.parse(rawJson);
      const totalPages = parsedStory.pages.length;
      const totalAssets = totalPages * 2;
      let completedAssets = 0;

      const markAssetReady = (label) => {
        completedAssets += 1;
        setGenerationProgress({
          step: label,
          readyCount: completedAssets,
          totalCount: totalAssets
        });
      };

      const CONCURRENCY_BATCH_SIZE = 2;
      setGenerationProgress({
        step: `Melukis Gambar 3D & Merekam Suara Sesuai Alur Cerita...`,
        readyCount: 0,
        totalCount: totalAssets
      });

      for (let i = 0; i < totalPages; i += CONCURRENCY_BATCH_SIZE) {
        const batchPages = parsedStory.pages.slice(i, i + CONCURRENCY_BATCH_SIZE);
        await Promise.all(
          batchPages.flatMap((pageObj, batchIdx) => {
            const pageIndex = i + batchIdx;
            const staggerDelay = batchIdx * 250;
            return [
              new Promise(r => setTimeout(r, staggerDelay))
                .then(() => generateImageForPage(pageIndex, pageObj, parsedStory.characterDesign, true))
                .then(() => markAssetReady(`🎨 Gambar 3D Halaman ${pageIndex + 1} (${pageObj.sceneTitle}) selesai!`)),
              new Promise(r => setTimeout(r, staggerDelay + 100))
                .then(() => generateAudioForPage(pageIndex, pageObj.text, true))
                .then(() => markAssetReady(`🔊 Suara Halaman ${pageIndex + 1} siap!`))
            ];
          })
        );
      }

      setStoryData(parsedStory);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setErrorMsg("Maaf, terjadi kendala saat merangkai cerita. Silakan coba klik tombol buat cerita sekali lagi ya!");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const generateImageForPage = async (pageIdx, pageObj, characterDesign = "", force = false) => {
    if (!force && (pageImages[pageIdx] || loadingImages[pageIdx])) return;

    setLoadingImages(prev => ({ ...prev, [pageIdx]: true }));
    const fullPrompt = `Create a 3D animated children's storybook illustration for Page ${pageIdx + 1}.
Scene Title: "${pageObj.sceneTitle}".
Story Context on this page: "${pageObj.text}".
Exact Visual Scene to Depict: ${pageObj.imagePrompt}.
Main Character Consistent Appearance: ${characterDesign}.
Art Style: ${ART_STYLE_DEFAULT}.
Composition: Wide-angle full-body shot, subject centered with comfortable margin around edges so heads and bodies are never cropped. Pure visual illustration only, no text, no watermarks, no letters.`;

    try {
      let imgUrl = null;

      try {
        const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${apiKey}`;
        const response = await fetchWithRetry(imageApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          })
        }, 3, 700);

        const parts = response?.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p?.inlineData?.data);
        if (imagePart?.inlineData?.data) {
          const mime = imagePart.inlineData.mimeType || 'image/png';
          imgUrl = `data:${mime};base64,${imagePart.inlineData.data}`;
        }
      } catch (primaryErr) {
        console.warn(`Mencoba model cadangan untuk halaman ${pageIdx + 1}...`);
      }

      if (!imgUrl) {
        const backupApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`;
        const backupRes = await fetchWithRetry(backupApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          })
        }, 3, 800);

        const backupParts = backupRes?.candidates?.[0]?.content?.parts || [];
        const backupPart = backupParts.find(p => p?.inlineData?.data);
        if (backupPart?.inlineData?.data) {
          const mime = backupPart.inlineData.mimeType || 'image/png';
          imgUrl = `data:${mime};base64,${backupPart.inlineData.data}`;
        }
      }

      if (imgUrl) {
        setPageImages(prev => ({ ...prev, [pageIdx]: imgUrl }));
      } else {
        throw new Error("Empty image response");
      }
    } catch (err) {
      const fallbackSvg = createCute3DFallbackSvg(pageIdx + 1, pageObj.sceneTitle);
      setPageImages(prev => ({ ...prev, [pageIdx]: fallbackSvg }));
    } finally {
      setLoadingImages(prev => ({ ...prev, [pageIdx]: false }));
    }
  };

  const generateAudioForPage = async (pageIdx, storyText, force = false) => {
    if (!force && (pageAudios[pageIdx] || loadingAudios[pageIdx])) return;

    setLoadingAudios(prev => ({ ...prev, [pageIdx]: true }));
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const ttsPrompt = `Bacakan cerita anak ini dalam Bahasa Indonesia yang ceria:\n"${storyText}"`;

      const payload = {
        contents: [{ parts: [{ text: ttsPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName }
            }
          }
        },
        model: "gemini-2.5-flash-preview-tts"
      };

      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 2, 400);

      const parts = result?.candidates?.[0]?.content?.parts || [];
      const audioParts = parts.filter(p => p?.inlineData?.data);

      if (audioParts.length > 0) {
        const mimeType = audioParts[0]?.inlineData?.mimeType || "audio/L16;rate=24000";
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

        const pcmArrays = audioParts.map(p => {
          const buf = base64ToArrayBuffer(p.inlineData.data);
          return new Int16Array(buf);
        });

        const totalLength = pcmArrays.reduce((acc, arr) => acc + arr.length, 0);
        const combinedPcm16 = new Int16Array(totalLength);
        let offset = 0;
        for (const arr of pcmArrays) {
          combinedPcm16.set(arr, offset);
          offset += arr.length;
        }

        const wavBlob = pcmToWav(combinedPcm16, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);

        setPageAudios(prev => ({ ...prev, [pageIdx]: audioUrl }));
      } else {
        throw new Error("No audio data");
      }
    } catch (err) {
      setPageAudios(prev => ({ ...prev, [pageIdx]: "WEB_SPEECH_FALLBACK" }));
    } finally {
      setLoadingAudios(prev => ({ ...prev, [pageIdx]: false }));
    }
  };

  const loadPageAssets = (pageIdx) => {
    if (!storyData || !storyData.pages[pageIdx]) return;
    const page = storyData.pages[pageIdx];
    generateImageForPage(pageIdx, page, storyData.characterDesign);
    generateAudioForPage(pageIdx, page.text);
  };

  const retryCurrentPageAssets = () => {
    if (!storyData || currentPage < 1 || currentPage > storyData.pages.length) return;
    const pageIdx = currentPage - 1;
    const page = storyData.pages[pageIdx];

    stopAudio();
    lastPlayedPageRef.current = null;

    setPageAudios(prev => {
      const next = { ...prev };
      delete next[pageIdx];
      return next;
    });
    generateAudioForPage(pageIdx, page.text, true);
    generateImageForPage(pageIdx, page, storyData.characterDesign, true);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    const pageIdx = currentPage - 1;
    const audioUrl = pageAudios[pageIdx];
    if (!audioUrl) {
      if (storyData?.pages?.[pageIdx]) {
        speakWithBrowserTTS(storyData.pages[pageIdx].text, pageIdx);
      }
      return;
    }

    if (audioUrl === "WEB_SPEECH_FALLBACK") {
      if (isPlaying) {
        stopAudio();
      } else if (storyData?.pages?.[pageIdx]) {
        speakWithBrowserTTS(storyData.pages[pageIdx].text, pageIdx);
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src || audioRef.current.src !== audioUrl) {
        audioRef.current.src = audioUrl;
      }
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          if (storyData?.pages?.[pageIdx]) {
            speakWithBrowserTTS(storyData.pages[pageIdx].text, pageIdx);
          }
        });
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    const nextIdx = currentPageRef.current;
    if (storyData && storyData.pages[nextIdx]) {
      generateAudioForPage(nextIdx, storyData.pages[nextIdx].text);
    }
    if (autoPlay && storyData && currentPageRef.current <= storyData.pages.length) {
      const targetPage = currentPageRef.current;
      setTimeout(() => {
        if (currentPageRef.current === targetPage) {
          setCurrentPage(prev => Math.min(prev + 1, storyData.pages.length + 1));
        }
      }, 1200);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      stopAudio();
      lastPlayedPageRef.current = null;
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToNextPage = () => {
    if (storyData && currentPage <= storyData.pages.length) {
      stopAudio();
      lastPlayedPageRef.current = null;
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 60) {
      if (diff > 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
    setTouchStartX(null);
  };

  const applyPreset = (preset) => {
    setPlot(preset.plot);
    setVoiceName(preset.voice);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-teal-100 to-yellow-200 text-slate-800 font-sans selection:bg-pink-400 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
      
      {/* Dekorasi Latar Belakang */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-10 -left-10 w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-400 shadow-[0_0_60px_rgba(251,191,36,0.7)] border-4 border-white/60" />
        <div className="absolute top-12 right-6 sm:right-20 w-28 h-12 bg-white/80 rounded-full shadow-[0_8px_0_rgba(186,230,253,0.8)]" />
        <div className="absolute top-6 right-12 sm:right-28 w-16 h-16 bg-white/90 rounded-full" />
        <div className="absolute bottom-24 left-6 w-20 h-20 rounded-full bg-gradient-to-tr from-pink-300/50 to-purple-200/50 backdrop-blur-sm border-2 border-white/60 shadow-lg" />
        <div className="absolute top-1/3 left-8 hidden lg:block text-5xl drop-shadow-md animate-bounce">🎈</div>
        <div className="absolute bottom-1/4 right-8 hidden lg:block text-5xl drop-shadow-md animate-pulse">🌈</div>
      </div>

      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-3xl border-4 border-white shadow-[0_6px_0_rgba(14,165,233,0.25)]">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-b from-pink-400 to-rose-500 flex items-center justify-center shadow-[0_4px_0_#be123c] text-white transform -rotate-6">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600">
              Buku Dongeng Gema ✨
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-sky-600 hidden sm:block">
              Dunia Buku Cerita 3D & Suara Ajaib Anak!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {storyData && (
            <button
              onClick={() => {
                stopAudio();
                setStoryData(null);
              }}
              className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-amber-950 font-black text-xs sm:text-sm border-2 border-white shadow-[0_5px_0_#d97706] active:translate-y-1 transition"
            >
              <Wand2 className="w-4 h-4 stroke-[2.5]" />
              <span>Cerita Baru</span>
            </button>
          )}
        </div>
      </header>

      {/* Konten Utama */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-3 flex flex-col justify-center">
        {errorMsg && (
          <div className="mb-3 p-3.5 rounded-3xl bg-rose-100 border-4 border-rose-400 text-rose-800 shadow-[0_6px_0_#fb7185] flex items-center justify-between gap-3 animate-bounce">
            <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
              <span className="text-xl">🙈</span>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs font-black px-3 py-1.5 rounded-xl bg-rose-500 text-white shadow-[0_3px_0_#9f1239]"
            >
              Oke!
            </button>
          </div>
        )}

        {/* STATE 1: FORM INPUT */}
        {!storyData && !isGeneratingStory && (
          <div className="w-full max-w-2xl mx-auto bg-white/95 backdrop-blur-xl border-4 border-sky-300 rounded-[2.5rem] p-4 sm:p-8 shadow-[0_12px_0_rgba(56,189,248,0.35)]">
            <div className="flex flex-col items-center text-center mb-4 sm:mb-6">
              <div className="mb-1 transform hover:scale-110 transition duration-300">
                <Cute3DBookMascot />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-yellow-300 to-amber-300 text-amber-950 border-2 border-white shadow-sm mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" /> Studio Kartun 3D Otomatis
              </span>
              <h2 className="text-xl sm:text-3xl font-black text-indigo-950 leading-tight">
                Ayo Buat Buku Kartun 3D-mu! 🎨
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 max-w-md">
                Ketik ide ceritamu atau pilih kartu di bawah, gambar 3D & suaranya siap otomatis!
              </p>
            </div>

            <div className="mb-4 sm:mb-6">
              <label className="block text-xs font-black uppercase tracking-wider text-indigo-900 mb-2 flex items-center gap-1.5">
                <span>🎁</span> Pilih Petualangan Seru Instan:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {STORY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`text-left p-3 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${preset.bg} text-white border-4 border-white shadow-[0_5px_0_rgba(0,0,0,0.15)] hover:-translate-y-1 active:translate-y-0.5 transition`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl sm:text-2xl">{preset.emoji}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/30 backdrop-blur-sm">
                        Pilih
                      </span>
                    </div>
                    <div className="font-black text-xs sm:text-sm leading-snug">
                      {preset.title}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-white/90 font-medium line-clamp-2 mt-1">
                      {preset.plot}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateStory} className="space-y-4">
              <div className="bg-sky-50 p-3.5 rounded-3xl border-2 border-sky-200">
                <label className="block text-xs sm:text-sm font-black text-indigo-950 mb-1.5 flex items-center gap-2">
                  <span className="text-base">✏️</span> Ceritakan Ide Dongengmu di Sini:
                </label>
                <textarea
                  rows={3}
                  value={plot}
                  onChange={(e) => setPlot(e.target.value)}
                  placeholder="Contoh: Seekor bayi naga warna biru yang suka makan es krim stroberi belajar terbang bersama kelinci astronot..."
                  className="w-full rounded-2xl bg-white border-3 border-sky-300 focus:border-pink-400 focus:ring-4 focus:ring-pink-200 p-3 text-xs sm:text-base font-bold text-slate-700 placeholder-slate-400 outline-none transition resize-none shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-amber-50 p-3 rounded-3xl border-2 border-amber-200">
                  <label className="block text-[11px] sm:text-xs font-black text-amber-950 mb-1 flex items-center gap-1.5">
                    <span>🎤</span> Suara Pendongeng
                  </label>
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="w-full rounded-2xl bg-white border-2 border-amber-300 px-3 py-2 text-xs sm:text-sm font-bold text-indigo-950 outline-none cursor-pointer"
                  >
                    {VOICE_OPTIONS.map((v, i) => (
                      <option key={i} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-emerald-50 p-3 rounded-3xl border-2 border-emerald-200 flex flex-col justify-between">
                  <span className="text-[11px] sm:text-xs font-black text-emerald-950 flex items-center gap-1.5 mb-1">
                    <span>📖</span> Ketebalan Buku:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[3, 4, 5, 10].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPageCount(num)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-black transition border-2 ${
                          pageCount === num
                            ? 'bg-emerald-500 text-white border-white shadow-[0_3px_0_#047857]'
                            : 'bg-white text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {num}H
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 sm:py-4 px-6 rounded-3xl bg-gradient-to-b from-pink-400 via-rose-500 to-pink-600 hover:from-pink-300 hover:to-rose-500 text-white font-black text-base sm:text-lg border-4 border-white shadow-[0_8px_0_#be123c] active:translate-y-1.5 transition flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 fill-yellow-300 text-yellow-200 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Sulap Jadi Buku Dongeng 3D! 🚀</span>
              </button>
            </form>
          </div>
        )}

        {/* STATE 2: LOADING PERSIAPAN */}
        {isGeneratingStory && (
          <div className="w-full max-w-md mx-auto bg-white border-4 border-pink-300 rounded-[2.5rem] p-6 sm:p-8 text-center shadow-[0_12px_0_rgba(244,114,182,0.35)]">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-gradient-to-tr from-yellow-200 to-pink-200 border-4 border-white shadow-lg flex items-center justify-center animate-bounce">
              <span className="text-4xl sm:text-5xl">🪄</span>
            </div>
            <h3 className="text-lg sm:text-2xl font-black text-indigo-950 mb-1">
              Bim Salabim! Menyiapkan Isi Buku...
            </h3>
            <p className="text-xs sm:text-sm font-bold text-pink-600 mb-4">
              {generationProgress.step || "Sedang melukis ilustrasi 3D dan merekam suara..."}
            </p>

            {generationProgress.totalCount > 0 && (
              <div className="w-full mb-3">
                <div className="w-full h-4 bg-sky-100 rounded-full overflow-hidden border-2 border-sky-300 p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(8, Math.round((generationProgress.readyCount / generationProgress.totalCount) * 100))
                      )}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-black text-indigo-900 mt-1.5 px-1">
                  <span>🎨 Gambar & 🔊 Suara</span>
                  <span>
                    {Math.min(
                      100,
                      Math.round((generationProgress.readyCount / generationProgress.totalCount) * 100)
                    )}% ({generationProgress.readyCount}/{generationProgress.totalCount})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATE 3: BUKU DONGENG GEMA (RESPONSIF PORTRAIT & LANDSCAPE) */}
        {storyData && !isGeneratingStory && (
          <div
            className="w-full flex flex-col items-center"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header Judul Buku */}
            <div className="text-center mb-3 px-4 py-1.5 rounded-3xl bg-white/90 border-3 border-amber-300 shadow-[0_4px_0_rgba(251,191,36,0.3)]">
              <h2 className="text-base sm:text-xl font-black text-indigo-950 flex items-center justify-center gap-2">
                <span>🌟</span> {storyData.title} <span>🌟</span>
              </h2>
            </div>

            {/* Container Buku Utama: Flex adaptif landscape/portrait */}
            <div className="w-full max-w-4xl bg-[#FFFDF7] text-slate-800 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_12px_0_#f59e0b,0_16px_24px_rgba(0,0,0,0.15)] border-6 sm:border-8 border-amber-400 overflow-hidden relative">
              
              {/* HALAMAN ISI (1 s/d N) */}
              {currentPage >= 1 && currentPage <= storyData.pages.length && (() => {
                const pageIdx = currentPage - 1;
                const pageObj = storyData.pages[pageIdx];
                const imgUrl = pageImages[pageIdx];
                const isImgLoading = loadingImages[pageIdx];
                const audioUrl = pageAudios[pageIdx];
                const isAudioLoading = loadingAudios[pageIdx];

                return (
                  <div className="flex flex-col md:flex-row w-full">
                    {/* Bagian Gambar 3D (Fleksibel: Di atas pada portrait, di kiri pada landscape) */}
                    <div className="w-full md:w-1/2 bg-gradient-to-br from-sky-200 via-indigo-100 to-pink-100 p-3 sm:p-5 flex flex-col justify-center items-center border-b md:border-b-0 md:border-r-4 border-amber-300">
                      <div className="w-full flex items-center justify-between gap-2 mb-2">
                        <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-black border-2 border-white shadow-sm">
                          Halaman {currentPage} / {storyData.pages.length}
                        </span>
                        {pageObj.sceneTitle && (
                          <span className="px-3 py-1 rounded-full bg-white/95 text-indigo-950 text-xs font-black border-2 border-amber-300 shadow-sm truncate max-w-[200px]">
                            🎬 {pageObj.sceneTitle}
                          </span>
                        )}
                      </div>

                      {/* Bingkai Gambar Responsif (Tinggi dinamis menyesuaikan orientasi portrait/landscape) */}
                      <div className="w-full h-[240px] sm:h-[320px] md:h-[360px] lg:h-[400px] rounded-2xl sm:rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-gradient-to-b from-sky-950 to-indigo-950 flex items-center justify-center relative p-1">
                        {imgUrl && !isImgLoading ? (
                          <img
                            src={imgUrl}
                            alt={`Ilustrasi 3D halaman ${currentPage}`}
                            className="w-full h-full object-contain rounded-2xl animate-fade-in"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 text-center bg-sky-100 w-full h-full rounded-2xl">
                            {isImgLoading ? (
                              <>
                                <div className="text-4xl animate-bounce mb-2">🎨</div>
                                <p className="text-xs sm:text-sm font-black text-indigo-900">
                                  Melukis Kartun 3D...
                                </p>
                              </>
                            ) : (
                              <button
                                onClick={() => generateImageForPage(pageIdx, pageObj, storyData.characterDesign, true)}
                                className="px-3 py-2 rounded-xl bg-amber-400 text-indigo-950 text-xs font-black border-2 border-white"
                              >
                                Muat Ulang Gambar 🔄
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bagian Teks & Audio (Fleksibel: Di bawah pada portrait, di kanan pada landscape) */}
                    <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col justify-between bg-gradient-to-b from-[#FFFDF7] to-amber-50/70">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-2 bg-amber-100/90 px-3 py-1 rounded-xl border border-amber-200 inline-block">
                          🎈 {pageObj.sceneTitle || `Halaman ${currentPage}`}
                        </div>

                        <p className="text-base sm:text-xl lg:text-2xl leading-relaxed font-extrabold text-indigo-950 tracking-wide mt-1">
                          {pageObj.text}
                        </p>
                      </div>

                      {/* Kontrol Audio */}
                      <div className="mt-4 pt-3 border-t-2 border-amber-200 flex flex-wrap items-center justify-between gap-2">
                        {isAudioLoading ? (
                          <div className="flex items-center gap-2 text-xs font-black text-indigo-900 bg-sky-200 border-2 border-white px-3.5 py-2.5 rounded-2xl">
                            <RefreshCw className="w-4 h-4 animate-spin text-sky-700" />
                            <span>Menyiapkan Suara... 🎤</span>
                          </div>
                        ) : audioUrl ? (
                          <button
                            onClick={togglePlayPause}
                            className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm border-2 border-white transition active:translate-y-1 ${
                              isPlaying
                                ? 'bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_4px_0_#9f1239]'
                                : 'bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-white shadow-[0_4px_0_#047857]'
                            }`}
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="w-4 h-4 fill-current" />
                                <span>Berhenti ⏸️</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 fill-current" />
                                <span>Dengarkan 🔊</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={retryCurrentPageAssets}
                            className="px-3.5 py-2 rounded-2xl bg-amber-300 text-amber-950 text-xs font-black border-2 border-white"
                          >
                            Panggil Suara 🔊
                          </button>
                        )}

                        <button
                          onClick={() => setAutoPlay(!autoPlay)}
                          className={`flex items-center gap-1 px-3 py-2 rounded-2xl text-[11px] font-black border-2 transition ${
                            autoPlay
                              ? 'bg-purple-100 border-purple-400 text-purple-900 shadow-[0_2px_0_#c084fc]'
                              : 'bg-slate-100 border-slate-300 text-slate-600'
                          }`}
                        >
                          {autoPlay ? <Volume2 className="w-3.5 h-3.5 text-purple-600" /> : <VolumeX className="w-3.5 h-3.5" />}
                          <span>Auto: {autoPlay ? 'On' : 'Off'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* HALAMAN PENUTUP & PESAN MORAL (N + 1) */}
              {currentPage > storyData.pages.length && (
                <div className="p-6 sm:p-10 text-center min-h-[360px] sm:min-h-[420px] flex flex-col items-center justify-center bg-gradient-to-b from-yellow-50 via-pink-50 to-sky-50">
                  <div className="text-5xl sm:text-6xl mb-2 animate-bounce">🏆</div>
                  <span className="px-4 py-1 rounded-full bg-amber-300 text-amber-950 text-xs font-black uppercase tracking-widest mb-2 border-2 border-white shadow-sm">
                    Hore! Selesai Membaca 🎉
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-indigo-950 mb-3">
                    Pesan Baik dari Dongeng Ini:
                  </h3>
                  <div className="max-w-md mx-auto p-5 rounded-3xl bg-white border-4 border-pink-300 shadow-[0_6px_0_rgba(244,114,182,0.3)] mb-6">
                    <p className="text-sm sm:text-lg font-black text-pink-700 leading-relaxed">
                      "{storyData.moral}"
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 text-white font-black text-xs sm:text-sm border-2 border-white shadow-[0_5px_0_#0284c7]"
                    >
                      <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                      <span>Baca Lagi 🔄</span>
                    </button>
                    <button
                      onClick={() => {
                        stopAudio();
                        setStoryData(null);
                      }}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-b from-pink-400 to-rose-500 text-white font-black text-xs sm:text-sm border-2 border-white shadow-[0_5px_0_#be123c]"
                    >
                      <Wand2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Cerita Baru ✨</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigasi Bawah */}
            <div className="w-full max-w-4xl mt-3 sm:mt-4 flex items-center justify-between gap-2 px-1">
              <button
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 px-4 py-3 rounded-2xl bg-gradient-to-b from-sky-400 to-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm border-2 border-white shadow-[0_5px_0_#1d4ed8]"
              >
                <ChevronLeft className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border-2 border-white shadow-md overflow-x-auto max-w-[200px] sm:max-w-none">
                {storyData.pages.map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = currentPage === pNum;
                  const isReady = pageImages[idx] && pageAudios[idx];
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        stopAudio();
                        setCurrentPage(pNum);
                      }}
                      className={`h-3 rounded-full transition-all shrink-0 ${
                        isCurrent
                          ? 'w-7 bg-gradient-to-r from-pink-500 to-amber-400'
                          : isReady
                          ? 'w-3 bg-emerald-400'
                          : 'w-3 bg-sky-200'
                      }`}
                      title={`Halaman ${pNum}`}
                    />
                  );
                })}
                <button
                  onClick={() => {
                    stopAudio();
                    setCurrentPage(storyData.pages.length + 1);
                  }}
                  className={`h-3 rounded-full transition-all shrink-0 ${
                    currentPage > storyData.pages.length
                      ? 'w-7 bg-gradient-to-r from-pink-500 to-amber-400'
                      : 'w-3 bg-amber-300'
                  }`}
                  title="Pesan Moral"
                />
              </div>

              <button
                onClick={goToNextPage}
                disabled={currentPage > storyData.pages.length}
                className="flex items-center gap-1 px-4 py-3 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-400 disabled:opacity-40 disabled:pointer-events-none text-indigo-950 font-black text-xs sm:text-sm border-2 border-white shadow-[0_5px_0_#d97706]"
              >
                <span className="hidden sm:inline">{currentPage === storyData.pages.length ? 'Pesan' : 'Selanjutnya'}</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 w-full text-center py-2.5 text-[11px] font-bold text-indigo-900/60">
        🌟 Buku Dongeng Gema • Responsif Portrait & Landscape 🌟
      </footer>
    </div>
  );
}