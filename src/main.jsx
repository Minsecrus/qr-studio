import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Circle,
  Download,
  Focus,
  Frame,
  ImagePlus,
  Layers,
  Maximize,
  Moon,
  RefreshCcw,
  ScanQrCode,
  Square,
  Sun,
  X,
} from "lucide-react";
import "./styles.css";

const shapeOptions = {
  dots: { icon: Circle, label: "圆形码点", scale: 0.72, rounded: true },
  blocks: { icon: Square, label: "方形码点", scale: 0.92, rounded: false },
};

const defaultSettings = {
  text: "https://example.com",
  shape: "dots",
  black: true,
  translucent: false,
  finderFrame: false,
  size: 800,
  margin: 56,
  dim: 10,
  scale: 72,
  backgroundUrl: null,
  logoUrl: null,
};

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getDownloadName(value) {
  try {
    const url = new URL(value.trim());
    const path = url.pathname.replace(/^\/|\/$/g, "").replace(/\//g, "-");
    const base = [url.hostname.replace(/^www\./, ""), path].filter(Boolean).join("-");
    const safe = base
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120);
    return `${safe || "qr-studio"}.png`;
  } catch {
    return "qr-studio.png";
  }
}

function coverImage(ctx, image, size) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawModule(ctx, x, y, moduleSize, scale, rounded) {
  const side = moduleSize * scale;
  const offset = (moduleSize - side) / 2;
  if (!rounded) {
    ctx.fillRect(x + offset, y + offset, side, side);
    return;
  }
  ctx.beginPath();
  ctx.arc(x + moduleSize / 2, y + moduleSize / 2, side / 2, 0, Math.PI * 2);
  ctx.fill();
}

function isFinderModule(row, col, count) {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= count - 7) ||
    (row >= count - 7 && col < 7)
  );
}

function isAlignmentModule(row, col, positions) {
  for (const centerRow of positions) {
    for (const centerCol of positions) {
      if (centerRow === 6 || centerCol === 6) continue;
      if (Math.abs(row - centerRow) <= 2 && Math.abs(col - centerCol) <= 2) {
        return true;
      }
    }
  }
  return false;
}

function drawFinderFrame(ctx, x, y, moduleSize) {
  const unit = moduleSize;
  ctx.fillRect(x, y, unit * 7, unit);
  ctx.fillRect(x, y + unit * 6, unit * 7, unit);
  ctx.fillRect(x, y, unit, unit * 7);
  ctx.fillRect(x + unit * 6, y, unit, unit * 7);
  ctx.fillRect(x + unit * 2, y + unit * 2, unit * 3, unit * 3);
}

function drawAlignmentFrame(ctx, x, y, moduleSize) {
  const unit = moduleSize;
  ctx.fillRect(x - unit * 2, y - unit * 2, unit * 5, unit);
  ctx.fillRect(x - unit * 2, y + unit * 2, unit * 5, unit);
  ctx.fillRect(x - unit * 2, y - unit * 2, unit, unit * 5);
  ctx.fillRect(x + unit * 2, y - unit * 2, unit, unit * 5);
  ctx.fillRect(x, y, unit, unit);
}

function IconButton({ active, children, title, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md transition ${
        active ? "bg-black text-white" : "text-black hover:bg-black/5"
      }`}
    >
      {children}
    </button>
  );
}

function IconRadio({ checked, children, name, title, value, onChange }) {
  return (
    <label
      title={title}
      className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md transition ${
        checked ? "bg-black text-white" : "text-black hover:bg-black/5"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
        aria-label={title}
      />
      {children}
    </label>
  );
}

function IconCheckbox({ checked, children, title, onChange }) {
  return (
    <label
      title={title}
      className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md transition ${
        checked ? "bg-black text-white" : "text-black hover:bg-black/5"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        aria-label={title}
      />
      {children}
    </label>
  );
}

function Range({ icon: Icon, value, min, max, step = 1, onChange, title }) {
  return (
    <label className="grid grid-cols-[40px_1fr_52px] items-center gap-3">
      <span className="grid h-10 w-10 place-items-center text-black/70" title={title}>
        <Icon size={18} />
      </span>
      <input
        aria-label={title}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="tabular-nums text-right text-xs text-black/55">{value}</span>
    </label>
  );
}

function App() {
  const canvasRef = useRef(null);
  const backgroundFileRef = useRef(null);
  const logoFileRef = useRef(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [status, setStatus] = useState("ready");
  const [showInfo, setShowInfo] = useState(false);

  const shape = useMemo(() => shapeOptions[settings.shape], [settings.shape]);
  const moduleColor = settings.black
    ? settings.translucent
      ? "rgba(17,17,17,.78)"
      : "#111111"
    : settings.translucent
      ? "rgba(255,255,255,.78)"
      : "#ffffff";

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      setStatus("drawing");
      try {
        const canvas = canvasRef.current;
        const size = settings.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);

        if (settings.backgroundUrl) {
          const background = await loadImage(settings.backgroundUrl);
          if (cancelled) return;
          coverImage(ctx, background, size);

          ctx.fillStyle = `rgba(0,0,0,${settings.dim / 100})`;
          ctx.fillRect(0, 0, size, size);
        }

        const qr = new window.AwesomeQR.QRCodeModel(-1, window.AwesomeQR.QRErrorCorrectLevel.H);
        qr.addData(settings.text.trim() || " ");
        qr.make();

        const count = qr.getModuleCount();
        const margin = Math.min(settings.margin, size / 4);
        const moduleSize = (size - margin * 2) / count;
        const alignmentPositions = window.AwesomeQR.QRUtil.getPatternPosition(qr.typeNumber);
        const scale = Math.max(0.52, Math.min(0.96, settings.scale / 100)) * (shape.scale / 0.72);

        ctx.fillStyle = moduleColor;
        for (let row = 0; row < count; row += 1) {
          for (let col = 0; col < count; col += 1) {
            if (!qr.isDark(row, col)) continue;
            const x = margin + col * moduleSize;
            const y = margin + row * moduleSize;
            const finder = isFinderModule(row, col, count);
            const alignment = isAlignmentModule(row, col, alignmentPositions);
            if (settings.finderFrame && (finder || alignment)) continue;
            drawModule(
              ctx,
              x,
              y,
              moduleSize,
              finder ? Math.max(0.86, scale) : scale,
              shape.rounded
            );
          }
        }

        if (settings.finderFrame) {
          drawFinderFrame(ctx, margin, margin, moduleSize);
          drawFinderFrame(ctx, margin + (count - 7) * moduleSize, margin, moduleSize);
          drawFinderFrame(ctx, margin, margin + (count - 7) * moduleSize, moduleSize);

          for (const centerRow of alignmentPositions) {
            for (const centerCol of alignmentPositions) {
              if (centerRow === 6 || centerCol === 6) continue;
              drawAlignmentFrame(
                ctx,
                margin + centerCol * moduleSize,
                margin + centerRow * moduleSize,
                moduleSize
              );
            }
          }
        }

        if (settings.logoUrl) {
          const logoSize = size * 0.15;
          const logoPad = size * 0.016;
          const logoX = (size - logoSize) / 2;
          const logoY = (size - logoSize) / 2;
          ctx.fillStyle = "rgba(255,255,255,.94)";
          roundRect(
            ctx,
            logoX - logoPad,
            logoY - logoPad,
            logoSize + logoPad * 2,
            logoSize + logoPad * 2,
            size * 0.035
          );
          ctx.fill();

          const logo = await loadImage(settings.logoUrl);
          if (cancelled) return;
          roundRect(ctx, logoX, logoY, logoSize, logoSize, size * 0.025);
          ctx.save();
          ctx.clip();
          ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
          ctx.restore();
        }

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }

    const timer = window.setTimeout(draw, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [settings, shape, moduleColor]);

  useEffect(() => {
    if (!showInfo) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setShowInfo(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfo]);

  async function handleBackgroundUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSettings((current) => ({ ...current, backgroundUrl: dataUrl }));
    event.target.value = "";
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSettings((current) => ({ ...current, logoUrl: dataUrl }));
    event.target.value = "";
  }

  function download() {
    const link = document.createElement("a");
    link.download = getDownloadName(settings.text);
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <main className="grid h-dvh overflow-hidden grid-cols-[88px_minmax(0,1fr)] bg-white text-black max-md:grid-cols-1 max-md:grid-rows-[72px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col items-center gap-4 border-r border-black/10 px-4 py-5 max-md:grid max-md:grid-cols-[44px_minmax(0,1fr)_88px] max-md:overflow-hidden max-md:border-b max-md:border-r-0 max-md:px-4 max-md:py-3">
        <button
          type="button"
          title="项目信息"
          aria-label="项目信息"
          onClick={() => setShowInfo(true)}
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-md bg-black text-white"
        >
          <ScanQrCode size={22} />
        </button>

        <div className="toolbar-scroll flex flex-col gap-2 max-md:min-w-0 max-md:flex-row max-md:overflow-x-auto max-md:overscroll-x-contain">
          <IconButton
            title={settings.backgroundUrl ? "清除背景" : "上传背景"}
            active={Boolean(settings.backgroundUrl)}
            onClick={() => {
              if (settings.backgroundUrl) {
                setSettings((current) => ({ ...current, backgroundUrl: null }));
                return;
              }
              backgroundFileRef.current?.click();
            }}
          >
            <ImagePlus size={20} />
          </IconButton>
          <input
            ref={backgroundFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBackgroundUpload}
          />

          <IconButton
            title={settings.logoUrl ? "清除 Logo" : "上传 Logo"}
            active={Boolean(settings.logoUrl)}
            onClick={() => {
              if (settings.logoUrl) {
                setSettings((current) => ({ ...current, logoUrl: null }));
                return;
              }
              logoFileRef.current?.click();
            }}
          >
            <Frame size={19} />
          </IconButton>
          <input
            ref={logoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />

          {Object.entries(shapeOptions).map(([key, option]) => {
            const ShapeIcon = option.icon;
            return (
              <IconRadio
                key={key}
                title={
                  settings.shape === key
                    ? `当前：${option.label}`
                    : `切换为${option.label}`
                }
                name="qr-shape"
                value={key}
                checked={settings.shape === key}
                onChange={() => setSettings((current) => ({ ...current, shape: key }))}
              >
                <ShapeIcon size={19} />
              </IconRadio>
            );
          })}

          <IconCheckbox
            title={settings.finderFrame ? "当前：角标框状，点击切换为跟随码点" : "当前：角标跟随码点，点击切换为框状"}
            checked={settings.finderFrame}
            onChange={(event) =>
              setSettings((current) => ({ ...current, finderFrame: event.target.checked }))
            }
          >
            <Focus size={19} />
          </IconCheckbox>

          <IconCheckbox
            title={settings.black ? "当前：黑色码点，点击切换为白色" : "当前：白色码点，点击切换为黑色"}
            checked={settings.black}
            onChange={(event) =>
              setSettings((current) => ({ ...current, black: event.target.checked }))
            }
          >
            <Moon size={19} />
          </IconCheckbox>

          <IconCheckbox
            title={settings.translucent ? "当前：半透明，点击切换为不透明" : "当前：不透明，点击切换为半透明"}
            checked={settings.translucent}
            onChange={(event) =>
              setSettings((current) => ({ ...current, translucent: event.target.checked }))
            }
          >
            <Sun size={19} />
          </IconCheckbox>
        </div>

        <div className="mt-auto flex flex-col gap-2 max-md:mt-0 max-md:flex-row">
          <IconButton title="重置为默认状态" onClick={() => setSettings(defaultSettings)}>
            <RefreshCcw size={19} />
          </IconButton>
          <IconButton title="下载 PNG" onClick={download}>
            <Download size={20} />
          </IconButton>
        </div>
      </aside>

      <section className="grid min-h-0 grid-cols-[minmax(280px,360px)_1fr] max-lg:grid-cols-1 max-lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto border-r border-black/10 p-6 max-lg:max-h-[38dvh] max-lg:border-b max-lg:border-r-0">
          <textarea
            aria-label="二维码内容"
            value={settings.text}
            onChange={(event) => setSettings((current) => ({ ...current, text: event.target.value }))}
            className="min-h-24 resize-none rounded-md bg-black/[.03] p-3 text-sm leading-6 outline-none focus:bg-black/[.05]"
          />

          <div className="grid gap-4">
            <Range
              icon={Maximize}
              title="尺寸"
              min={320}
              max={1600}
              step={40}
              value={settings.size}
              onChange={(size) => setSettings((current) => ({ ...current, size }))}
            />
            <Range
              icon={Frame}
              title="边距"
              min={12}
              max={120}
              value={settings.margin}
              onChange={(margin) => setSettings((current) => ({ ...current, margin }))}
            />
            <Range
              icon={Layers}
              title="明暗"
              min={0}
              max={70}
              value={settings.dim}
              onChange={(dim) => setSettings((current) => ({ ...current, dim }))}
            />
            <Range
              icon={Circle}
              title="密度"
              min={52}
              max={96}
              value={settings.scale}
              onChange={(scale) => setSettings((current) => ({ ...current, scale }))}
            />
          </div>
        </div>

        <div className="grid min-h-0 place-items-center overflow-hidden p-6">
          <div className="grid h-full min-h-0 w-full max-w-[820px] grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="flex items-center justify-between text-xs text-black/50">
              <span>{status}</span>
              <span>{settings.size} PNG</span>
            </div>
            <div className="qr-preview-stage grid min-h-0 min-w-0 place-items-center">
              <canvas
                ref={canvasRef}
                className="qr-preview-canvas block aspect-square rounded-md bg-black/[.03] shadow-[0_24px_80px_rgba(0,0,0,.14)]"
              />
            </div>
          </div>
        </div>
      </section>

      {showInfo ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-white/80 p-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowInfo(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-title"
            className="grid w-full max-w-md gap-5 rounded-md bg-white p-6 shadow-[0_24px_90px_rgba(0,0,0,.18)] ring-1 ring-black/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <h2 id="info-title" className="text-base font-medium">
                  QR Studio
                </h2>
                <p className="text-sm text-black/55">Monochrome QR design tool</p>
              </div>
              <button
                type="button"
                title="关闭"
                aria-label="关闭"
                onClick={() => setShowInfo(false)}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-md text-black hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 text-sm leading-6 text-black/70">
              <p>用于生成带背景图和自定义 Logo 的二维码，支持圆形/方形码点、黑白、透明度和角标框切换。</p>
              <p>背景图和 Logo 都只来自本地上传；默认不会加载内置素材。</p>
              <p>Built with Vite, React, Tailwind CSS, lucide-react, Awesome QR.</p>
              <a
                href="https://github.com/Minsecrus/qr-studio"
                target="_blank"
                rel="noreferrer"
                className="w-fit border-b border-black text-black"
              >
                github.com/Minsecrus/qr-studio
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
