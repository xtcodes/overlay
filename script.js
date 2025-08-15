(() => {
  // ====== ELEMENTS ======
  const d = document;
  const box = d.getElementById('canvasBox');
  const canvas = d.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const ph = d.getElementById('ph');
  const pickerFab = d.getElementById('pickerFab');
  const fileInput = d.getElementById('fileInput');
  const twibbonInput = d.getElementById('twibbonInput');
  const processBtn = d.getElementById('processBtn');
  const mask = d.getElementById('mask');
  const countNum = d.getElementById('countNum');
  const afterBar = d.getElementById('afterBar');
  const dlBtn = d.getElementById('dlBtn');
  const shareBtn = d.getElementById('shareBtn');
  const resetAllTop = d.getElementById('resetAllTop');

  // ====== STATE ======
  let hasImage = false;
  let img = null; // foto pengguna
  let gesturesEnabled = true; // 🔹 kontrol geser & zoom

  // Transform state (pan & zoom)
  let scale = 1, minScale = 0.2, maxScale = 5;
  let tx = 0, ty = 0; // translation

  // Pointer tracking untuk gestur halus
  const pointers = new Map();
  let raf = null;
  let dirty = true; // re-draw flag

  // Twibbon (overlay)
  const TWIBBON_DEFAULT_URL = 'twibbon.png';
  let twibbon = null;
  (function preloadTwibbon(){
    const im = new Image();
    im.onload = ()=>{ twibbon = im; scheduleDraw(); };
    im.src = TWIBBON_DEFAULT_URL;
  })();

  // ====== HELPERS ======
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  function resizeCanvasToBox(){
    const rect = box.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.width); // square
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    dirty = true; scheduleDraw();
  }
  window.addEventListener('resize', resizeCanvasToBox);

  function clear(){
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR);
  }

  function draw(){
    if (!dirty) return;
    dirty = false;
    clear();
    const W = canvas.width / DPR, H = canvas.height / DPR;
    if (hasImage && img){
      ctx.save();
      ctx.translate(W/2 + tx, H/2 + ty);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -img.width/2, -img.height/2);
      ctx.restore();
    }
    if (hasImage && twibbon && twibbon.complete && twibbon.naturalWidth) {
      const r = Math.max(W / twibbon.width, H / twibbon.height);
      const twW = twibbon.width * r, twH = twibbon.height * r;
      ctx.drawImage(twibbon, (W - twW)/2, (H - twH)/2, twW, twH);
    }
    if (!hasImage) {
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      const step = 24;
      for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    }
  }

  function scheduleDraw(){ if (!raf){ raf = requestAnimationFrame(()=>{ raf=null; draw(); }); } dirty = true; }

  function fitImage(){
    const W = canvas.width / DPR, H = canvas.height / DPR;
    const sr = Math.min(W / img.width, H / img.height);
    scale = sr; tx = 0; ty = 0;
  }

  function enableEditing(){ processBtn.disabled = !hasImage; }
  function disableEditing(){ processBtn.disabled = true; }

  // ====== LOADERS ======
  function loadUserImage(file){
    if (!file) return;
    const url = URL.createObjectURL(file);
    const _img = new Image();
    _img.onload = () => {
      img = _img;
      hasImage = true;
      ph.style.display = 'none';
      fitImage();
      scheduleDraw();
      enableEditing();
      pickerMode = 'twibbon';
      updatePickerFab();
      URL.revokeObjectURL(url);
    };
    _img.src = url;
  }

  // 🔹 Validasi Twibbon punya transparansi
  function loadTwibbonImage(file){
    if (!file) return;
    const url = URL.createObjectURL(file);
    const _tw = new Image();
    _tw.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = _tw.width;
      tempCanvas.height = _tw.height;
      const tctx = tempCanvas.getContext('2d');
      tctx.drawImage(_tw, 0, 0);
      const imgData = tctx.getImageData(0, 0, _tw.width, _tw.height).data;

      let hasTransparency = false;
      for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] < 255) {
          hasTransparency = true;
          break;
        }
      }

      if (!hasTransparency) {
        alert('Twibbon harus memiliki area transparan!');
        URL.revokeObjectURL(url);
        return;
      }

      twibbon = _tw;
      scheduleDraw();
      URL.revokeObjectURL(url);
    };
    _tw.src = url;
  }

  // ====== PICKER FAB MODES ======
  let pickerMode = 'photo';
  function updatePickerFab(){
    pickerFab.textContent = pickerMode === 'photo' ? 'Pilih Gambar' : 'Ganti Twibbon';
  }
  updatePickerFab();

  pickerFab.addEventListener('click', () => {
    (pickerMode === 'photo' ? fileInput : twibbonInput).click();
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadUserImage(f);
    fileInput.value = '';
  });
  twibbonInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadTwibbonImage(f);
    twibbonInput.value = '';
  });

  box.addEventListener('click', (e) => { if (!hasImage) fileInput.click(); });

  ['dragenter','dragover'].forEach(ev=>{
    box.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); box.classList.add('dragover'); });
  });
  ['dragleave','drop'].forEach(ev=>{
    box.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); box.classList.remove('dragover'); });
  });
  box.addEventListener('drop', (e)=>{
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadUserImage(f);
  });

  // ====== GESTURES ======
  canvas.style.touchAction = 'none';
  let last = {x:0, y:0};
  let pinch = null;
  function getCenter(){
    const pts = Array.from(pointers.values());
    const c = {x:0, y:0};
    for(const p of pts){ c.x += p.x; c.y += p.y; }
    c.x /= pts.length; c.y /= pts.length;
    return c;
  }
  function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

  canvas.addEventListener('pointerdown', (e)=>{
    if (!hasImage || !gesturesEnabled) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x:e.offsetX, y:e.offsetY});
    if (pointers.size === 1){ last = {x:e.offsetX, y:e.offsetY}; }
    if (pointers.size === 2){
      const [p1,p2] = Array.from(pointers.values());
      pinch = { startDist: distance(p1,p2), startScale: scale, startTx: tx, startTy: ty };
    }
  });

  canvas.addEventListener('pointermove', (e)=>{
    if (!hasImage || !gesturesEnabled || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x:e.offsetX, y:e.offsetY});
    if (pointers.size === 1){
      const p = pointers.get(e.pointerId);
      const dx = p.x - last.x; const dy = p.y - last.y;
      last = {x:p.x, y:p.y};
      tx += dx; ty += dy; scheduleDraw();
    } else if (pointers.size === 2){
      const [p1,p2] = Array.from(pointers.values());
      const dist = distance(p1,p2);
      if (pinch){
        const scaleRaw = pinch.startScale * (dist / Math.max(10, pinch.startDist));
        const newScale = Math.min(maxScale, Math.max(minScale, scaleRaw));
        const center = getCenter();
        const W = canvas.clientWidth, H = canvas.clientHeight;
        const cx = center.x - W/2, cy = center.y - H/2;
        tx = pinch.startTx + cx * (1) - cx * (newScale / pinch.startScale);
        ty = pinch.startTy + cy * (1) - cy * (newScale / pinch.startScale);
        scale = newScale; scheduleDraw();
      }
    }
  });

  function endPointer(e){ if (pointers.has(e.pointerId)) pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);

  // ====== PROSES 15 DETIK ======
  const PROCESS_SECONDS = 15;
  let processing = false;
  processBtn.addEventListener('click', async ()=>{
    if (!hasImage || processing) return;
    processing = true; disableEditing();
    gesturesEnabled = false; // 🔹 matikan geser & zoom saat proses
    mask.classList.add('active');
    afterBar.classList.remove('show');

    const tick = () => new Promise(r => setTimeout(r, 1000));
    for (let remain = PROCESS_SECONDS; remain > 0; remain--){
      countNum.textContent = remain;
      await tick();
    }
    countNum.textContent = '0';

    mask.classList.remove('active');
    afterBar.classList.add('show');
    processing = false; enableEditing();
  });

  // ====== UNDUH & BAGIKAN ======
  dlBtn.addEventListener('click', ()=>{
    const link = d.createElement('a');
    link.download = 'twibbon.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  shareBtn.addEventListener('click', ()=>{
    canvas.toBlob(async (blob)=>{
      if (!blob) return;
      const file = new File([blob], 'twibbon.png', {type:'image/png'});
      if (navigator.canShare && navigator.canShare({ files:[file] }) && navigator.share){
        try{ await navigator.share({ files:[file], title:'Twibbon', text:'Hasil twibbon saya' }); }
        catch(e){ /* user cancel */ }
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(()=>URL.revokeObjectURL(url), 15000);
      }
    });
  });

  // ====== RESET ======
  function resetAll(){
    hasImage = false;
    img = null;
    gesturesEnabled = true; // 🔹 aktifkan kembali geser & zoom
    const defaultTw = new Image();
    defaultTw.onload = () => { twibbon = defaultTw; scheduleDraw(); };
    defaultTw.src = TWIBBON_DEFAULT_URL;
    ph.style.display = '';
    afterBar.classList.remove('show');
    enableEditing();
    scale = 1; tx = 0; ty = 0; pointers.clear();
    pickerMode = 'photo'; updatePickerFab();
  }
  resetAllTop.addEventListener('click', resetAll);

  // ====== INIT ======
  resizeCanvasToBox();
  scheduleDraw();
})();
