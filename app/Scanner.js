'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

const normalize = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function matchWanted(text, wantedItems) {
  const n = normalize(text);
  if (n.length < 4) return null;
  let best = null;
  let bestScore = 0;
  for (const item of wantedItems) {
    const w = normalize(item);
    if (w.length < 3) continue;
    if (n.includes(w) || w.includes(n)) return item;
    const words = w.split(/\s+/).filter(x => x.length > 1);
    const hits = words.filter(x => n.includes(x)).length;
    const score = words.length ? hits / words.length : 0;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 0.6 ? best : null;
}

export default function Scanner({ wantedItems = [], media = 'book' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const ocrBusyRef = useRef(false);
  const lastAlertRef = useRef({ item: '', at: 0 });
  const lastCandidateRef = useRef('');
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Ready to scan.');
  const [match, setMatch] = useState(null);
  const [candidate, setCandidate] = useState(null);

  const hapticWanted = () => {
    if (navigator.vibrate) navigator.vibrate([90, 45, 90, 45, 180]);
  };
  const hapticCandidate = () => {
    if (navigator.vibrate) navigator.vibrate([35, 35, 35]);
  };

  useEffect(() => () => stop(), []);

  async function start() {
    if (!wantedItems.length) {
      setStatus('Add at least one wanted item first.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera access is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      scanningRef.current = true;
      setActive(true);
      setMatch(null);
      setCandidate(null);
      setStatus('📷 Live scanning — move slowly across the shelf.');
      scanLoop();
    } catch {
      setStatus('Camera permission was blocked. Allow camera access and try again.');
    }
  }

  function stop() {
    scanningRef.current = false;
    ocrBusyRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }

  async function scanLoop() {
    while (scanningRef.current) {
      if (!ocrBusyRef.current && window.Tesseract) await scanFrame();
      await new Promise(r => setTimeout(r, 900));
    }
  }

  async function scanFrame() {
    ocrBusyRef.current = true;
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const canvas = document.createElement('canvas');
      const width = Math.min(1000, video.videoWidth);
      const scale = width / video.videoWidth;
      canvas.width = width;
      canvas.height = Math.floor(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

      const { data } = await window.Tesseract.recognize(canvas, 'eng', { logger: () => {} });
      if (!scanningRef.current) return;
      const text = data.text.replace(/[^a-zA-Z0-9'’:&\- ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length < 4) return;

      const wanted = matchWanted(text, wantedItems);
      if (wanted) {
        setMatch(wanted);
        setCandidate(null);
        setStatus('🎯 Wanted item detected');
        const now = Date.now();
        if (lastAlertRef.current.item !== wanted || now - lastAlertRef.current.at > 3500) {
          hapticWanted();
          lastAlertRef.current = { item: wanted, at: now };
        }
      } else if (text.length >= 8) {
        const candidateKey = normalize(text).slice(0, 80);
        if (candidateKey !== lastCandidateRef.current) {
          lastCandidateRef.current = candidateKey;
          setCandidate(text.slice(0, 100));
          setMatch(null);
          setStatus('🔎 Potential item detected');
          hapticCandidate();
        }
      }
    } catch {
      // Keep the camera running; transient OCR failures should not stop the scanner.
    } finally {
      ocrBusyRef.current = false;
    }
  }

  return <>
    <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" strategy="afterInteractive" />
    <div className="card">
      <h2>📷 Live Shelf Scanner</h2>
      <p className="small">Move across the shelf. ShelfHunt continuously reads visible spine text and checks it against your wanted list.</p>
      <div className="scanner" style={{ display: active ? 'block' : 'none' }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', minHeight: 360, objectFit: 'cover', display: 'block' }} />
        <div className="scanHint">Move across the shelf • scanning automatically</div>
        <div className="scanBox" />
      </div>
      {!active ? <button className="scanBtn" onClick={start}>📷 Start Live Scan</button> : <button className="stopBtn" onClick={stop}>Stop Scanning</button>}
      <div className="status">{status}</div>
      {match && <div className="scannerMatch">🎯 <b>WANTED: {match}</b><span> — phone haptic alert sent</span></div>}
      {candidate && <div className="scannerCandidate">✨ <b>Potential find:</b> {candidate}<small> Not confirmed rare — verify before buying.</small></div>}
      <p className="small">Wanted matches use a stronger haptic pattern. Potential unlisted items use a lighter pulse. The scanner does not claim an item is rare without verification.</p>
    </div>
  </>;
}
