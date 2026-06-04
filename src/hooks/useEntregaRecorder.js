import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const MAX_DURATION_SEC = 15 * 60; // hard cap so files never run away
const VIDEO_BITRATE = 2_500_000;

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function two(n) { return String(n).padStart(2, "0"); }

function formatClock(ms) {
  const d = new Date(ms);
  const date = `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
  const time = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  return { date, time };
}

function formatElapsed(sec) {
  return `${two(Math.floor(sec / 60))}:${two(sec % 60)}`;
}

/**
 * Manages camera preview, a canvas overlay with a burned-in (server-synced)
 * timestamp + receptor data, and MediaRecorder. Designed for the Entregas page.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled - feature flag (R2 configured server-side)
 * @param {React.MutableRefObject} opts.overlayRef - ref holding { nombre, apellido, dni, count }
 */
export function useEntregaRecorder({ enabled, overlayRef }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef("");
  const rafRef = useRef(null);
  const offsetRef = useRef(0);       // serverNow - Date.now()
  const elapsedRef = useRef(0);
  const timerRef = useRef(null);
  const resultRef = useRef(null);    // { blob, mimeType, durationSec }
  const stopResolveRef = useRef(null);
  const recordingRef = useRef(false);

  const [state, setState] = useState("idle"); // idle|starting|ready|recording|denied|error
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasAudio, setHasAudio] = useState(false);

  // --- Overlay drawing loop ---
  const drawOverlay = useCallback((ctx, w, h) => {
    const nowMs = Date.now() + offsetRef.current;
    const { date, time } = formatClock(nowMs);
    const data = overlayRef.current || {};

    const barH = Math.max(64, Math.round(h * 0.16));
    const grad = ctx.createLinearGradient(0, h - barH, 0, h);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.35, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - barH, w, barH);

    const pad = Math.round(w * 0.02);
    const big = Math.round(h * 0.045);
    const mid = Math.round(h * 0.034);
    const small = Math.round(h * 0.026);

    // Brand + receptor (left)
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `600 ${small}px Arial, sans-serif`;
    ctx.fillText("CONTROL DE STOCK · ENTREGA", pad, h - barH + small + Math.round(h * 0.015));

    const receptor = [data.nombre, data.apellido].filter(Boolean).join(" ") || "—";
    const dni = data.dni ? `DNI ${data.dni}` : "DNI —";
    const count = `${data.count || 0} prenda(s)`;
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${mid}px Arial, sans-serif`;
    ctx.fillText(`Receptor: ${receptor}`, pad, h - barH + small + mid + Math.round(h * 0.04));
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `500 ${small}px Arial, sans-serif`;
    ctx.fillText(`${dni}   ·   ${count}`, pad, h - barH + small + mid + small + Math.round(h * 0.06));

    // Clock (right)
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${big}px "Courier New", monospace`;
    ctx.fillText(time, w - pad, h - barH + big + Math.round(h * 0.02));
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `600 ${mid}px "Courier New", monospace`;
    ctx.fillText(date, w - pad, h - barH + big + mid + Math.round(h * 0.04));

    // Items escaneados — columna superior derecha (últimos 4, más reciente arriba)
    const its = Array.isArray(data.items) ? data.items.slice(0, 4) : [];
    if (its.length > 0) {
      const ipad = Math.round(w * 0.012);
      const itemH = Math.round(h * 0.05);
      const fs = Math.round(h * 0.024);
      const gap = Math.round(h * 0.008);
      ctx.font = `600 ${fs}px Arial, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const topY = ipad + (recordingRef.current ? Math.round(h * 0.075) : ipad);

      const labels = its.map((it) => {
        const sku = it.sku || "—";
        const name = (it.name || "").slice(0, 24);
        return `✓ ${sku}  ${name}`;
      });
      let maxW = 0;
      for (const l of labels) {
        const m = ctx.measureText(l).width;
        if (m > maxW) maxW = m;
      }
      const boxW = maxW + ipad * 2;
      const xCol = w - boxW - ipad;
      labels.forEach((label, i) => {
        const y = topY + i * (itemH + gap);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(xCol, y, boxW, itemH);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, xCol + ipad, y + itemH / 2);
      });
      const extra = (data.totalItemsCount || 0) - its.length;
      if (extra > 0) {
        const y = topY + its.length * (itemH + gap);
        const txt = `+ ${extra} más`;
        const m = ctx.measureText(txt).width;
        const w2 = m + ipad * 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(w - w2 - ipad, y, w2, itemH);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(txt, w - w2 - ipad + ipad, y + itemH / 2);
      }
    }

    // REC indicator (top-left) while recording
    if (recordingRef.current) {
      const blink = Math.floor(nowMs / 600) % 2 === 0;
      const r = Math.round(h * 0.018);
      const cx = pad + r;
      const cy = pad + r;
      if (blink) {
        ctx.beginPath();
        ctx.fillStyle = "#ef4444";
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(h * 0.03)}px Arial, sans-serif`;
      ctx.fillText(`REC  ${formatElapsed(elapsedRef.current)}`, cx + r * 1.6, cy + r * 0.7);
    }
  }, [overlayRef]);

  const startLoop = useCallback(() => {
    const draw = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      // self-heal: re-attach the live stream if the <video> was (re)mounted
      if (v && streamRef.current && v.srcObject !== streamRef.current) {
        try { v.srcObject = streamRef.current; v.muted = true; v.play().catch(() => {}); } catch { /* ignore */ }
      }
      if (c && v) {
        const w = v.videoWidth || 1280;
        const h = v.videoHeight || 720;
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        const ctx = c.getContext("2d");
        if (v.readyState >= 2) ctx.drawImage(v, 0, 0, w, h);
        else { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); }
        drawOverlay(ctx, w, h);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [drawOverlay]);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // --- Start / switch camera (preview only) ---
  const startCamera = useCallback(async (preferredId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setErrorMsg("Este navegador no soporta acceso a la cámara.");
      return false;
    }
    setState("starting");
    setErrorMsg("");
    try {
      // sync trusted clock
      try {
        const t = await base44.videoEntregas.serverTime();
        offsetRef.current = t.now - Date.now();
      } catch { offsetRef.current = 0; }

      stopTracks();
      const id = preferredId || deviceId;
      const videoConstr = id ? { deviceId: { exact: id } } : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } };

      // Estrategia: pedimos video y audio juntos. Si falla por audio (típico:
      // permiso de mic denegado o el dispositivo está ocupado), reintentamos
      // pidiendo SOLO video y dejamos marcado que no hay audio (en vez de caer
      // silenciosamente como antes).
      let stream;
      let gotAudio = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstr, audio: true });
        gotAudio = stream.getAudioTracks().length > 0;
      } catch (errAudio) {
        console.warn('getUserMedia con audio falló:', errAudio?.name, errAudio?.message);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: videoConstr, audio: false });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        gotAudio = false;
      }
      setHasAudio(gotAudio);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      // enumerate devices (labels available now that we have permission)
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        const active = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
        if (active) setDeviceId(active);
      } catch { /* ignore */ }

      startLoop();
      setState("ready");
      return true;
    } catch (err) {
      stopTracks();
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setState("denied");
        setErrorMsg("Permiso de cámara denegado.");
      } else {
        setState("error");
        setErrorMsg(err?.message || "No se pudo iniciar la cámara.");
      }
      return false;
    }
  }, [deviceId, startLoop, stopTracks]);

  // --- Start recording ---
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !streamRef.current || recordingRef.current) return false;
    if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
      setErrorMsg("Este navegador no soporta grabación de video.");
      return false;
    }
    const mime = pickMimeType();
    mimeRef.current = mime;
    chunksRef.current = [];
    resultRef.current = null;

    const canvasStream = canvas.captureStream(25);
    streamRef.current.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

    let rec;
    try {
      rec = new MediaRecorder(canvasStream, mime ? { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE } : { videoBitsPerSecond: VIDEO_BITRATE });
    } catch {
      rec = new MediaRecorder(canvasStream);
    }
    recorderRef.current = rec;

    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current || "video/webm" });
      resultRef.current = { blob, mimeType: mimeRef.current || "video/webm", durationSec: elapsedRef.current };
      recordingRef.current = false;
      setState("ready");
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (stopResolveRef.current) { stopResolveRef.current(resultRef.current); stopResolveRef.current = null; }
    };

    rec.start(1000);
    recordingRef.current = true;
    elapsedRef.current = 0;
    setElapsed(0);
    setState("recording");
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_DURATION_SEC && recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, 1000);
    return true;
  }, []);

  // --- Stop recording -> resolves with { blob, mimeType, durationSec } | null ---
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") { resolve(resultRef.current); return; }
      stopResolveRef.current = resolve;
      try { rec.stop(); } catch { resolve(resultRef.current); }
    });
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    stopTracks();
    recordingRef.current = false;
  }, [stopTracks]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    videoRef, canvasRef,
    state, devices, deviceId, setDeviceId,
    elapsed, errorMsg, enabled, hasAudio,
    isRecording: state === "recording",
    startCamera, startRecording, stopRecording, cleanup,
    maxDurationSec: MAX_DURATION_SEC,
  };
}
