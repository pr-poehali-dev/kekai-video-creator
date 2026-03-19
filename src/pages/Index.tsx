import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/3181eacc-97fb-4c58-8351-ee3586ad5028";

type Tab = "home" | "create" | "gallery" | "profile" | "faq";

const HERO_IMAGE = "https://cdn.poehali.dev/projects/13a937c0-146e-4ce9-a4d1-71909e34d902/files/ba2a0b27-81ce-41a1-9991-ffd4c3b3c497.jpg";
const GALLERY_IMAGE = "https://cdn.poehali.dev/projects/13a937c0-146e-4ce9-a4d1-71909e34d902/files/2178fcc7-4712-444b-856d-ba87e9b7cf0c.jpg";

const mockVideos = [
  { id: 1, title: "Закат над горами", author: "@maria_art", likes: 2847, comments: 134, duration: "15с", img: HERO_IMAGE, liked: false },
  { id: 2, title: "Городские огни", author: "@alex_creates", likes: 5621, comments: 298, duration: "20с", img: GALLERY_IMAGE, liked: true },
  { id: 3, title: "Волшебный лес", author: "@nature_ai", likes: 1203, comments: 67, duration: "10с", img: HERO_IMAGE, liked: false },
  { id: 4, title: "Морской рассвет", author: "@ocean_vibes", likes: 3410, comments: 189, duration: "15с", img: GALLERY_IMAGE, liked: false },
  { id: 5, title: "Неоновый город", author: "@cyber_art", likes: 8932, comments: 521, duration: "20с", img: HERO_IMAGE, liked: true },
  { id: 6, title: "Снежная буря", author: "@winter_ai", likes: 742, comments: 41, duration: "10с", img: GALLERY_IMAGE, liked: false },
];

const faqItems = [
  { q: "Как работает создание видео?", a: "Загрузите фотографию, введите текстовое описание желаемой сцены и выберите длительность. ИИ обработает запрос и создаст уникальное видео на основе ваших данных." },
  { q: "Какие форматы фото поддерживаются?", a: "Поддерживаются форматы JPG, PNG, WebP и HEIC. Максимальный размер файла — 20 МБ. Для лучшего результата используйте фото с хорошим освещением." },
  { q: "Сколько времени занимает генерация?", a: "Обычно от 30 секунд до 2 минут в зависимости от сложности запроса и выбранной длительности видео." },
  { q: "Можно ли скачать готовое видео?", a: "Да, все созданные видео доступны для скачивания в разделе профиля. Также можно поделиться ссылкой с друзьями." },
  { q: "Как поделиться видео в соцсетях?", a: "Нажмите кнопку 'Поделиться' под видео и выберите платформу: VK, Telegram, Instagram или скопируйте ссылку." },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedDuration, setSelectedDuration] = useState<10 | 15 | 20>(15);
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateStatus, setGenerateStatus] = useState("");
  const [generatedDone, setGeneratedDone] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [videos, setVideos] = useState(mockVideos);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [likedHearts, setLikedHearts] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setUploadedImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileUpload(file);
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleGenerate = async () => {
    if (!uploadedImage || !prompt) return;
    setIsGenerating(true);
    setGenerateProgress(5);
    setGenerateStatus("Загружаем фотографию...");
    setGeneratedDone(false);
    setGeneratedVideoUrl(null);
    setGenerateError(null);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedImage, prompt, duration: selectedDuration }),
      });
      const data = await res.json();
      if (!res.ok || !data.job_id) throw new Error(data.error || "Ошибка запуска");

      const jobId = data.job_id;
      setGenerateProgress(15);
      setGenerateStatus("ИИ анализирует фотографию...");

      let elapsed = 0;
      pollRef.current = setInterval(async () => {
        elapsed += 3;
        const maxSecs = selectedDuration * 12 + 60;
        const fakeProgress = Math.min(15 + (elapsed / maxSecs) * 80, 92);
        setGenerateProgress(fakeProgress);
        if (elapsed < 20) setGenerateStatus("Генерируем движение...");
        else if (elapsed < 50) setGenerateStatus("Рендерим кадры...");
        else setGenerateStatus("Финальная обработка...");

        try {
          const sr = await fetch(`${API_URL}?id=${jobId}`);
          const sd = await sr.json();
          if (sd.status === "succeeded" && sd.video_url) {
            clearInterval(pollRef.current!);
            setGenerateProgress(100);
            setGenerateStatus("Готово!");
            setTimeout(() => {
              setIsGenerating(false);
              setGeneratedDone(true);
              setGeneratedVideoUrl(sd.video_url);
            }, 500);
          } else if (sd.status === "failed") {
            clearInterval(pollRef.current!);
            setIsGenerating(false);
            setGenerateError("Не удалось создать видео. Попробуй другое фото или промт.");
          }
        } catch (pollErr) { console.warn("poll error", pollErr); }
      }, 3000);
    } catch (e: unknown) {
      setIsGenerating(false);
      setGenerateError(e instanceof Error ? e.message : "Произошла ошибка");
    }
  };

  const toggleLike = (id: number) => {
    setLikedHearts(prev => [...prev, id]);
    setTimeout(() => setLikedHearts(prev => prev.filter(x => x !== id)), 300);
    setVideos(prev => prev.map(v =>
      v.id === id ? { ...v, liked: !v.liked, likes: v.liked ? v.likes - 1 : v.likes + 1 } : v
    ));
  };

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full animate-float-slow animate-pulse-glow"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full animate-float-med animate-pulse-glow"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)", animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full animate-float-slow"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", animationDelay: "3s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col">

        {/* TOP NAV */}
        <header className="glass sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg btn-primary flex items-center justify-center">
              <span className="text-white text-sm font-bold font-display">K</span>
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">Kek<span className="gradient-text">AI</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost rounded-full w-9 h-9 flex items-center justify-center">
              <Icon name="Bell" size={16} className="text-muted-foreground" />
            </button>
            <button onClick={() => setActiveTab("profile")}
              className="w-8 h-8 rounded-full overflow-hidden border-2"
              style={{ borderColor: "rgba(168,85,247,0.5)" }}>
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">А</span>
              </div>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto pb-24">

          {/* HOME TAB */}
          {activeTab === "home" && (
            <div className="animate-fade-in">
              {/* Hero */}
              <div className="relative overflow-hidden" style={{ height: 320 }}>
                <img src={HERO_IMAGE} alt="hero" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 20%, rgba(10,9,15,0.9) 80%, hsl(240,10%,4%) 100%)" }} />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
                    style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)" }}>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-purple-300 font-medium">ИИ онлайн</span>
                  </div>
                  <h1 className="font-display font-black text-3xl text-white leading-tight mb-2">
                    Оживи своё<br /><span className="shimmer-text">фото за секунды</span>
                  </h1>
                  <p className="text-sm text-muted-foreground">Загрузи фото → введи промт → получи видео</p>
                </div>
              </div>

              {/* Quick create CTA */}
              <div className="p-4">
                <button onClick={() => setActiveTab("create")}
                  className="btn-primary w-full rounded-2xl py-4 flex items-center justify-center gap-3 text-white font-display font-bold text-lg neon-glow">
                  <Icon name="Wand2" size={22} />
                  Создать видео
                </button>
              </div>

              {/* Stats row */}
              <div className="px-4 grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: "Video", value: "2.1M", label: "видео создано" },
                  { icon: "Users", value: "340K", label: "пользователей" },
                  { icon: "Star", value: "4.9", label: "рейтинг" },
                ].map((s) => (
                  <div key={s.label} className="glass rounded-2xl p-3 text-center card-hover">
                    <Icon name={s.icon as "Video"} size={20} className="mx-auto mb-1" style={{ color: "var(--neon-purple)" }} />
                    <div className="font-display font-bold text-white text-lg">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Trending section */}
              <div className="px-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-bold text-white text-lg">🔥 В тренде</h2>
                  <button onClick={() => setActiveTab("gallery")} className="text-xs text-purple-400 font-medium">Все →</button>
                </div>
                <div className="space-y-3">
                  {videos.slice(0, 3).map((v, i) => (
                    <div key={v.id} className="glass rounded-2xl overflow-hidden flex gap-3 p-3 card-hover"
                      style={{ animationDelay: `${i * 0.1}s` }}>
                      <div className="relative rounded-xl overflow-hidden flex-shrink-0" style={{ width: 72, height: 72 }}>
                        <img src={v.img} alt={v.title} className="w-full h-full object-cover" />
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-white font-bold"
                          style={{ background: "rgba(0,0,0,0.7)", fontSize: 10 }}>{v.duration}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">{v.title}</div>
                        <div className="text-xs text-muted-foreground mb-2">{v.author}</div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleLike(v.id)} className="flex items-center gap-1 text-xs">
                            <Icon name="Heart" size={14}
                              className={`${likedHearts.includes(v.id) ? "heart-pop" : ""} transition-colors`}
                              style={{ color: v.liked ? "#ec4899" : "rgba(255,255,255,0.4)" }} />
                            <span style={{ color: v.liked ? "#ec4899" : "rgba(255,255,255,0.5)" }}>{v.likes.toLocaleString()}</span>
                          </button>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Icon name="MessageCircle" size={14} />
                            {v.comments}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center">
                        <div className="text-2xl font-display font-black text-muted-foreground opacity-30">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div className="px-4 mb-6">
                <h2 className="font-display font-bold text-white text-lg mb-3">Как это работает</h2>
                <div className="space-y-3">
                  {[
                    { step: "01", icon: "Upload", title: "Загрузи фото", desc: "JPG, PNG, HEIC — любой формат", color: "var(--neon-purple)" },
                    { step: "02", icon: "PenLine", title: "Опиши сцену", desc: "Расскажи ИИ что должно происходить", color: "var(--neon-pink)" },
                    { step: "03", icon: "Play", title: "Получи видео", desc: "Готово за 30–120 секунд", color: "var(--neon-cyan)" },
                  ].map((f) => (
                    <div key={f.step} className="glass rounded-2xl p-4 flex items-center gap-4 card-hover">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${f.color}22`, border: `1px solid ${f.color}44` }}>
                        <Icon name={f.icon as "Upload"} size={20} style={{ color: f.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">{f.title}</div>
                        <div className="text-xs text-muted-foreground">{f.desc}</div>
                      </div>
                      <div className="font-display font-black text-2xl opacity-20" style={{ color: f.color }}>{f.step}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CREATE TAB */}
          {activeTab === "create" && (
            <div className="p-4 space-y-4 animate-fade-in">
              <div>
                <h2 className="font-display font-bold text-white text-2xl mb-1">Создать видео</h2>
                <p className="text-sm text-muted-foreground">Три шага до магии ✨</p>
              </div>

              {/* Step 1: Upload */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full btn-primary flex items-center justify-center text-white text-xs font-bold">1</div>
                  <span className="font-semibold text-white">Загрузите фотографию</span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                {uploadedImage ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ height: 200 }}>
                    <img src={uploadedImage} alt="uploaded" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.5)" }}>
                      <button onClick={() => { setUploadedImage(null); setGeneratedDone(false); setGeneratedVideoUrl(null); setGenerateError(null); }}
                        className="btn-ghost rounded-full px-4 py-2 text-white text-sm flex items-center gap-2">
                        <Icon name="Trash2" size={14} /> Удалить
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 rounded-full px-2 py-1 text-xs text-white flex items-center gap-1"
                      style={{ background: "rgba(34,197,94,0.8)" }}>
                      <Icon name="Check" size={12} /> Загружено
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`upload-zone w-full rounded-xl py-10 flex flex-col items-center gap-3 ${dragOver ? "drag-over" : ""}`}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(168,85,247,0.15)" }}>
                      <Icon name="ImagePlus" size={24} style={{ color: "var(--neon-purple)" }} />
                    </div>
                    <div className="text-center">
                      <div className="text-white font-medium text-sm">Нажмите или перетащите фото</div>
                      <div className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC · до 20 МБ</div>
                    </div>
                  </button>
                )}
              </div>

              {/* Step 2: Prompt */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full btn-primary flex items-center justify-center text-white text-xs font-bold">2</div>
                  <span className="font-semibold text-white">Опишите сцену</span>
                </div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Например: камера медленно облетает вокруг человека, на фоне звёздного неба, атмосфера тайны и волшебства..."
                  className="w-full rounded-xl p-3 text-sm text-white placeholder:text-muted-foreground resize-none focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 100 }} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Кинематографично", "Мечтательно", "Динамично", "Медитативно"].map((tag) => (
                    <button key={tag} onClick={() => setPrompt(p => p ? `${p}, ${tag.toLowerCase()}` : tag.toLowerCase())}
                      className="px-3 py-1 rounded-full text-xs text-purple-300"
                      style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Duration */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full btn-primary flex items-center justify-center text-white text-xs font-bold">3</div>
                  <span className="font-semibold text-white">Длительность</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([10, 15, 20] as const).map((d) => (
                    <button key={d} onClick={() => setSelectedDuration(d)}
                      className={`duration-btn rounded-xl py-4 flex flex-col items-center gap-1 ${selectedDuration === d ? "active" : ""}`}>
                      <span className="font-display font-bold text-white text-xl">{d}</span>
                      <span className="text-xs text-white opacity-70">секунд</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              {!isGenerating && !generatedDone && (
                <button onClick={handleGenerate} disabled={!uploadedImage || !prompt}
                  className={`w-full rounded-2xl py-4 flex items-center justify-center gap-3 font-display font-bold text-lg text-white transition-all
                    ${uploadedImage && prompt ? "btn-primary neon-glow" : "opacity-40 cursor-not-allowed"}`}
                  style={uploadedImage && prompt ? {} : { background: "rgba(255,255,255,0.1)" }}>
                  <Icon name="Sparkles" size={22} />
                  Создать видео · {selectedDuration}с
                </button>
              )}

              {/* Error */}
              {generateError && (
                <div className="glass rounded-2xl p-4 animate-scale-in flex items-start gap-3"
                  style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Icon name="AlertCircle" size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="text-white text-sm font-semibold mb-1">Не удалось создать видео</div>
                    <div className="text-xs text-muted-foreground">{generateError}</div>
                    <button onClick={() => setGenerateError(null)} className="text-xs text-purple-400 mt-2 underline">
                      Попробовать снова
                    </button>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isGenerating && (
                <div className="glass rounded-2xl p-6 animate-scale-in">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="animate-spin-slow">
                      <Icon name="Loader2" size={24} style={{ color: "var(--neon-purple)" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">ИИ создаёт ваше видео...</div>
                      <div className="text-xs text-muted-foreground">{Math.round(generateProgress)}% завершено</div>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full progress-bar rounded-full transition-all duration-1000"
                      style={{ width: `${generateProgress}%` }} />
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground text-center">{generateStatus}</div>
                </div>
              )}

              {/* Result */}
              {generatedDone && generatedVideoUrl && (
                <div className="glass rounded-2xl overflow-hidden animate-scale-in" style={{ border: "1px solid rgba(168,85,247,0.3)" }}>
                  <div className="relative bg-black">
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full"
                      style={{ maxHeight: 320, display: "block" }}
                    />
                    <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs text-white flex items-center gap-1"
                      style={{ background: "rgba(168,85,247,0.8)" }}>
                      ✨ Готово!
                    </div>
                  </div>
                  <div className="p-4 flex gap-2">
                    <a href={generatedVideoUrl} download={`kekai-video.mp4`} target="_blank" rel="noreferrer"
                      className="flex-1 btn-primary rounded-xl py-3 flex items-center justify-center gap-2 text-white font-semibold text-sm">
                      <Icon name="Download" size={16} /> Скачать
                    </a>
                    <button onClick={() => navigator.share?.({ url: generatedVideoUrl }).catch(() => navigator.clipboard.writeText(generatedVideoUrl))}
                      className="flex-1 btn-ghost rounded-xl py-3 flex items-center justify-center gap-2 text-white text-sm">
                      <Icon name="Share2" size={16} /> Поделиться
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GALLERY TAB */}
          {activeTab === "gallery" && (
            <div className="animate-fade-in">
              <div className="p-4 pb-2">
                <h2 className="font-display font-bold text-white text-2xl mb-1">Галерея</h2>
                <p className="text-sm text-muted-foreground mb-4">Лучшие работы сообщества</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {["Все", "🔥 Топ", "✨ Новые", "💜 Мои"].map((f, i) => (
                    <button key={f} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${i === 0 ? "text-white neon-glow" : "btn-ghost text-muted-foreground"}`}
                      style={i === 0 ? { background: "linear-gradient(135deg, #a855f7, #ec4899)" } : {}}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-4 grid grid-cols-2 gap-3">
                {videos.map((v, i) => (
                  <div key={v.id} className="glass rounded-2xl overflow-hidden card-hover animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.07}s` }}>
                    <div className="relative" style={{ height: 140 }}>
                      <img src={v.img} alt={v.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
                      <div className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-white text-xs font-bold"
                        style={{ background: "rgba(0,0,0,0.6)" }}>{v.duration}</div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-white text-xs font-semibold truncate">{v.title}</div>
                      </div>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground truncate">{v.author}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleLike(v.id)} className="flex items-center gap-1">
                          <Icon name="Heart" size={13} className={likedHearts.includes(v.id) ? "heart-pop" : ""}
                            style={{ color: v.liked ? "#ec4899" : "rgba(255,255,255,0.4)" }} />
                          <span className="text-xs" style={{ color: v.liked ? "#ec4899" : "rgba(255,255,255,0.5)" }}>
                            {v.likes > 999 ? `${(v.likes / 1000).toFixed(1)}K` : v.likes}
                          </span>
                        </button>
                        <button className="flex items-center gap-1 text-muted-foreground">
                          <Icon name="Share2" size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-4" />
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="animate-fade-in">
              <div className="relative overflow-hidden" style={{ height: 180 }}>
                <img src={GALLERY_IMAGE} alt="bg" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3), hsl(240,10%,4%))" }} />
                <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 neon-glow"
                    style={{ borderColor: "rgba(168,85,247,0.6)" }}>
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold font-display">А</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-white text-xl">Анна К.</div>
                    <div className="text-sm text-purple-300">@anna_creates</div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4 grid grid-cols-3 gap-3">
                {[
                  { value: "47", label: "Видео" },
                  { value: "12.4K", label: "Лайков" },
                  { value: "834", label: "Подписчиков" },
                ].map((s) => (
                  <div key={s.label} className="glass rounded-2xl p-4 text-center">
                    <div className="font-display font-bold text-white text-xl gradient-text">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="px-4 space-y-2 mb-4">
                <h3 className="font-display font-bold text-white mb-3">Настройки</h3>
                {[
                  { icon: "User", label: "Редактировать профиль" },
                  { icon: "Bell", label: "Уведомления" },
                  { icon: "Shield", label: "Конфиденциальность" },
                  { icon: "CreditCard", label: "Подписка и оплата" },
                  { icon: "Globe", label: "Язык" },
                  { icon: "Palette", label: "Тема оформления" },
                ].map((item) => (
                  <button key={item.label} className="w-full glass rounded-xl px-4 py-3.5 flex items-center gap-3 card-hover text-left">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(168,85,247,0.15)" }}>
                      <Icon name={item.icon as "User"} size={16} style={{ color: "var(--neon-purple)" }} />
                    </div>
                    <span className="text-white text-sm flex-1">{item.label}</span>
                    <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                  </button>
                ))}
              </div>

              <div className="mx-4 mb-4 gradient-border">
                <div className="gradient-border-inner p-4 flex items-center gap-4">
                  <div className="text-3xl">👑</div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-white text-sm">KekAI Pro</div>
                    <div className="text-xs text-muted-foreground">Безлимитные видео + приоритет</div>
                  </div>
                  <button className="btn-primary rounded-xl px-4 py-2 text-white text-sm font-bold">
                    499₽/мес
                  </button>
                </div>
              </div>

              <div className="px-4 mb-6">
                <button className="w-full btn-ghost rounded-xl py-3 flex items-center justify-center gap-2 text-red-400 text-sm">
                  <Icon name="LogOut" size={16} />
                  Выйти
                </button>
              </div>
            </div>
          )}

          {/* FAQ TAB */}
          {activeTab === "faq" && (
            <div className="p-4 animate-fade-in">
              <h2 className="font-display font-bold text-white text-2xl mb-1">Помощь</h2>
              <p className="text-sm text-muted-foreground mb-6">Ответы на частые вопросы</p>

              <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-4"
                style={{ border: "1px solid rgba(6,182,212,0.2)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(6,182,212,0.15)" }}>
                  <Icon name="MessageSquare" size={22} style={{ color: "var(--neon-cyan)" }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">Служба поддержки</div>
                  <div className="text-xs text-muted-foreground">Отвечаем за 5 минут</div>
                </div>
                <button className="rounded-xl px-4 py-2 text-white text-sm font-semibold"
                  style={{ background: "rgba(6,182,212,0.2)", border: "1px solid rgba(6,182,212,0.3)" }}>
                  Написать
                </button>
              </div>

              <div className="space-y-2">
                {faqItems.map((item, i) => (
                  <div key={i} className="glass rounded-2xl overflow-hidden card-hover">
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full px-4 py-4 flex items-center gap-3 text-left">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(168,85,247,0.2)" }}>
                        <span className="text-xs font-bold" style={{ color: "var(--neon-purple)" }}>{i + 1}</span>
                      </div>
                      <span className="text-white text-sm font-medium flex-1">{item.q}</span>
                      <Icon name={openFaq === i ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-4 animate-fade-in">
                        <div className="text-sm text-muted-foreground leading-relaxed pl-9">{item.a}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <p className="text-xs text-muted-foreground text-center mb-3">Доступно на</p>
                <div className="flex gap-3">
                  <button className="flex-1 btn-ghost rounded-xl py-3 flex items-center justify-center gap-2 text-white text-sm">
                    🍎 App Store
                  </button>
                  <button className="flex-1 btn-ghost rounded-xl py-3 flex items-center justify-center gap-2 text-white text-sm">
                    🤖 Google Play
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* BOTTOM NAV */}
        <nav className="glass fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 py-3 z-50"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-around">
            {([
              { tab: "home", icon: "Home", label: "Главная" },
              { tab: "gallery", icon: "LayoutGrid", label: "Галерея" },
              { tab: "create", icon: "Plus", label: "", special: true },
              { tab: "profile", icon: "User", label: "Профиль" },
              { tab: "faq", icon: "HelpCircle", label: "FAQ" },
            ] as const).map((item) => {
              const isActive = activeTab === item.tab;
              if (item.special) {
                return (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    className="btn-primary w-14 h-14 -mt-6 rounded-2xl flex items-center justify-center neon-glow shadow-2xl">
                    <Icon name="Plus" size={24} className="text-white" />
                  </button>
                );
              }
              return (
                <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                  className={`nav-tab flex flex-col items-center gap-1 px-3 py-1 ${isActive ? "active" : ""}`}>
                  <Icon name={item.icon as "Home"} size={20}
                    style={{ color: isActive ? "var(--neon-purple)" : "rgba(255,255,255,0.4)" }} />
                  <span className="text-xs" style={{ color: isActive ? "var(--neon-purple)" : "rgba(255,255,255,0.4)" }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

      </div>
    </div>
  );
}