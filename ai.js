/**
 * Pixora Pro — AI Edit Module
 * Powered by Google Gemini (gemini-1.5-flash via REST API)
 * Handles: API key management, canvas snapshot, Gemini call, response display,
 *           apply-to-canvas, mobile nav wiring, and hamburger menu.
 */

(function () {
    'use strict';

    // ── Storage key ──────────────────────────────────────────────────────────
    const STORAGE_KEY = 'pixora_gemini_api_key';
    const GEMINI_VISION_URL = (key) =>
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

    // ── State ─────────────────────────────────────────────────────────────────
    let currentResultDataUrl = null;   // Base64 data URL from Gemini (if image response)
    let currentApiKey = localStorage.getItem(STORAGE_KEY) || '';

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const $  = (id) => document.getElementById(id);
    const aiModal          = $('ai-modal');
    const aiApiKeySection  = $('ai-api-key-section');
    const aiMainSection    = $('ai-main-section');
    const apiKeyInput      = $('ai-api-key-input');
    const btnSaveKey       = $('btn-save-api-key');
    const btnChangeKey     = $('btn-ai-change-key');
    const aiPreviewCanvas  = $('ai-preview-canvas');
    const aiResultImg      = $('ai-result-img');
    const aiResultPH       = $('ai-result-placeholder');
    const aiPromptInput    = $('ai-prompt-input');
    const btnGenerate      = $('btn-ai-generate');
    const btnAnalyze       = $('btn-ai-analyze');
    const aiResponseArea   = $('ai-response-area');
    const aiResponseText   = $('ai-response-text');
    const aiResponseTitle  = $('ai-response-title');
    const aiResultActions  = $('ai-result-actions');
    const btnApply         = $('btn-ai-apply');
    const btnDiscard       = $('btn-ai-discard');
    const aiLoader         = $('ai-loader');
    const aiLoaderText     = $('ai-loader-text');

    // ── Helper: open / close modal ────────────────────────────────────────────
    function openAiModal() {
        aiModal.style.display = 'flex';
        requestAnimationFrame(() => aiModal.classList.add('active'));
        renderAiSection();
        if (aiApiKeySection.style.display !== 'block') {
            snapshotCanvas();   // always refresh preview when opening
        }
    }

    function closeAiModal() {
        aiModal.classList.remove('active');
        setTimeout(() => { aiModal.style.display = 'none'; }, 200);
    }

    function renderAiSection() {
        if (currentApiKey) {
            aiApiKeySection.style.display = 'none';
            aiMainSection.style.display   = 'block';
            snapshotCanvas();
        } else {
            aiApiKeySection.style.display = 'block';
            aiMainSection.style.display   = 'none';
        }
    }

    // ── Canvas snapshot for the preview ──────────────────────────────────────
    function snapshotCanvas() {
        const app = window.pixora;
        if (!app) return;

        // Composite all layers to a temp canvas, then draw scaled into preview
        const src = document.getElementById('viewport-canvas');
        if (!src) return;

        const ctx = aiPreviewCanvas.getContext('2d');
        const W   = aiPreviewCanvas.width;
        const H   = aiPreviewCanvas.height;
        ctx.clearRect(0, 0, W, H);

        // Draw checkerboard background
        const size = 10;
        for (let y = 0; y < H; y += size) {
            for (let x = 0; x < W; x += size) {
                ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#444' : '#333';
                ctx.fillRect(x, y, size, size);
            }
        }

        // Scale and draw
        const ratio = Math.min(W / app.width, H / app.height);
        const dw = app.width  * ratio;
        const dh = app.height * ratio;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.drawImage(src, dx, dy, dw, dh);
    }

    // ── Get the full-res canvas as base64 PNG ─────────────────────────────────
    function getCanvasBase64() {
        const app = window.pixora;
        if (!app) return null;

        const src = document.getElementById('viewport-canvas');
        if (!src) return null;

        // Create an export canvas at full resolution
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width  = app.width;
        exportCanvas.height = app.height;
        const ctx = exportCanvas.getContext('2d');
        ctx.drawImage(src, 0, 0);
        // Return base64 WITHOUT the data:image/png;base64, prefix
        return exportCanvas.toDataURL('image/png').split(',')[1];
    }

    // ── Show / hide loader ────────────────────────────────────────────────────
    function showLoader(text = 'Thinking with Gemini...') {
        aiLoader.style.display    = 'flex';
        aiLoaderText.textContent  = text;
        aiResponseArea.style.display = 'none';
        btnGenerate.disabled      = true;
        btnAnalyze.disabled       = true;
    }
    function hideLoader() {
        aiLoader.style.display = 'none';
        btnGenerate.disabled   = false;
        btnAnalyze.disabled    = false;
    }

    // ── Show Gemini text response ─────────────────────────────────────────────
    function showResponse(title, text, hasImage = false) {
        aiResponseArea.style.display = 'block';
        aiResponseTitle.textContent  = title;
        aiResponseText.textContent   = text;
        aiResultActions.style.display = hasImage ? 'flex' : 'none';
    }

    // ── Show result image ─────────────────────────────────────────────────────
    function showResultImage(dataUrl) {
        currentResultDataUrl       = dataUrl;
        aiResultPH.style.display   = 'none';
        aiResultImg.src            = dataUrl;
        aiResultImg.style.display  = 'block';
    }

    // ── Clear result state ────────────────────────────────────────────────────
    function clearResult() {
        currentResultDataUrl       = null;
        aiResultImg.style.display  = 'none';
        aiResultPH.style.display   = 'flex';
        aiResponseArea.style.display = 'none';
    }

    // ── Call Gemini REST API ──────────────────────────────────────────────────
    async function callGemini(prompt, includeImage = true) {
        const key = currentApiKey;
        if (!key) { alert('Please save your Gemini API key first.'); return null; }

        const parts = [];

        if (includeImage) {
            const b64 = getCanvasBase64();
            if (b64) {
                parts.push({ inlineData: { mimeType: 'image/png', data: b64 } });
            }
        }
        parts.push({ text: prompt });

        const body = {
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: 1024 }
        };

        const response = await fetch(GEMINI_VISION_URL(key), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err?.error?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error('No response from Gemini.');

        // Check if any part is an image
        const imagePart = candidate.content?.parts?.find(p => p.inlineData);
        const textPart  = candidate.content?.parts?.find(p => p.text);

        return {
            text:      textPart?.text   || '',
            imageData: imagePart?.inlineData?.data || null,
            imageMime: imagePart?.inlineData?.mimeType || 'image/png'
        };
    }

    // ── Analyze Image ─────────────────────────────────────────────────────────
    async function analyzeImage() {
        clearResult();
        showLoader('Analyzing your image...');
        try {
            const result = await callGemini(
                'Analyze this image as a professional photo editor. Describe: (1) what the image shows, (2) its composition, lighting, and color, (3) specific editing suggestions to improve it. Be concise and actionable.',
                true
            );
            hideLoader();
            showResponse('📸 Gemini Analysis', result.text, false);
        } catch (e) {
            hideLoader();
            showResponse('⚠️ Error', `Gemini error: ${e.message}`, false);
        }
    }

    // ── Generate AI Edit ──────────────────────────────────────────────────────
    async function generateEdit() {
        const prompt = aiPromptInput.value.trim();
        if (!prompt) { alert('Please enter a prompt or choose a preset.'); return; }

        clearResult();
        showLoader('Generating AI edit...');

        // We ask Gemini to describe exactly what CSS/canvas filters or
        // color-grading transforms to apply, then we implement them client-side.
        // (Gemini 1.5 Flash does not output images directly through the REST
        //  key-based API, so we translate its instructions into canvas filters.)
        const systemPrompt = `You are an expert photo editor AI assistant embedded in Pixora Pro.
The user wants to: "${prompt}"

Respond with ONLY a valid JSON object (no markdown, no explanation), like this:
{
  "description": "Brief human-readable description of what you are doing",
  "filters": {
    "brightness": <number 0-200, default 100>,
    "contrast":   <number 0-200, default 100>,
    "saturation": <number 0-200, default 100>,
    "hue":        <number 0-360, default 0>,
    "blur":       <number 0-20, default 0>,
    "sepia":      <number 0-100, default 0>,
    "grayscale":  <number 0-100, default 0>,
    "invert":     <number 0-100, default 0>
  },
  "tips": "Optional: one sentence of additional creative tip"
}`;

        try {
            const result = await callGemini(systemPrompt, true);
            hideLoader();

            let parsed;
            try {
                // Strip possible markdown code fences
                const clean = result.text.replace(/```json|```/g, '').trim();
                parsed = JSON.parse(clean);
            } catch {
                // Gemini didn't give us JSON — show raw text
                showResponse('✨ Gemini says', result.text, false);
                return;
            }

            // Apply filters to a preview canvas and display it
            applyFiltersToPreview(parsed.filters);
            const desc = parsed.description || 'AI-generated edit';
            const tips = parsed.tips ? `\n\n💡 Tip: ${parsed.tips}` : '';
            showResponse('✨ AI Edit Ready', `${desc}${tips}`, true);

        } catch (e) {
            hideLoader();
            showResponse('⚠️ Error', `Gemini error: ${e.message}`, false);
        }
    }

    // ── Apply Gemini filter params to a preview image ─────────────────────────
    function applyFiltersToPreview(filters) {
        const app = window.pixora;
        if (!app) return;

        const src = document.getElementById('viewport-canvas');
        if (!src) return;

        const offscreen = document.createElement('canvas');
        offscreen.width  = app.width;
        offscreen.height = app.height;
        const ctx = offscreen.getContext('2d');

        // Build CSS filter string
        const f = filters || {};
        const brightness  = f.brightness  ?? 100;
        const contrast    = f.contrast    ?? 100;
        const saturation  = f.saturation  ?? 100;
        const hue         = f.hue         ?? 0;
        const blur        = f.blur        ?? 0;
        const sepia       = f.sepia       ?? 0;
        const grayscale   = f.grayscale   ?? 0;
        const invert      = f.invert      ?? 0;

        ctx.filter = [
            `brightness(${brightness}%)`,
            `contrast(${contrast}%)`,
            `saturate(${saturation}%)`,
            `hue-rotate(${hue}deg)`,
            `blur(${blur}px)`,
            `sepia(${sepia}%)`,
            `grayscale(${grayscale}%)`,
            `invert(${invert}%)`
        ].join(' ');

        ctx.drawImage(src, 0, 0);

        // Store for apply
        const dataUrl = offscreen.toDataURL('image/png');
        showResultImage(dataUrl);

        // Store filter params for actual application
        window._pixoraAiFilters = { brightness, contrast, saturation, hue, blur, sepia, grayscale, invert };
    }

    // ── Apply result to the real canvas ──────────────────────────────────────
    function applyToCanvas() {
        const app = window.pixora;
        if (!app) return;

        const f = window._pixoraAiFilters;
        if (!f) return;

        // Apply to the app's adjustment sliders (they drive canvas re-render)
        const setSlider = (id, val, displayId, suffix) => {
            const el = document.getElementById(id);
            const display = document.getElementById(displayId);
            if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
            if (display) display.textContent = val + suffix;
        };

        setSlider('adj-brightness',  f.brightness, 'val-brightness', '%');
        setSlider('adj-contrast',    f.contrast,   'val-contrast',   '%');
        setSlider('adj-saturation',  f.saturation, 'val-saturation', '%');
        setSlider('adj-hue',         f.hue,        'val-hue',        '°');
        setSlider('adj-blur',        f.blur,       'val-blur',       'px');
        setSlider('adj-sepia',       f.sepia,      'val-sepia',      '%');
        setSlider('adj-grayscale',   f.grayscale,  'val-grayscale',  '%');
        setSlider('adj-invert',      f.invert,     'val-invert',     '%');

        closeAiModal();
    }

    // ── Preset button handling ────────────────────────────────────────────────
    function setupPresets() {
        document.querySelectorAll('.ai-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ai-preset-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                aiPromptInput.value = btn.dataset.prompt;
            });
        });
    }

    // ── API Key management ────────────────────────────────────────────────────
    function saveKey() {
        const key = apiKeyInput.value.trim();
        if (!key) { alert('Please enter your API key.'); return; }
        currentApiKey = key;
        localStorage.setItem(STORAGE_KEY, key);
        renderAiSection();
    }

    function changeKey() {
        currentApiKey = '';
        localStorage.removeItem(STORAGE_KEY);
        renderAiSection();
    }

    // ── Mobile nav (hamburger) ────────────────────────────────────────────────
    function setupMobileNav() {
        const overlay = $('mobile-nav-overlay');
        const btnOpen  = $('btn-mobile-menu');
        const btnClose = $('btn-close-mobile-menu');

        function openNav()  { overlay.style.display = 'block'; requestAnimationFrame(() => overlay.classList.add('open')); }
        function closeNav() { overlay.classList.remove('open'); setTimeout(() => { overlay.style.display = 'none'; }, 320); }

        if (btnOpen)  btnOpen.addEventListener('click', openNav);
        if (btnClose) btnClose.addEventListener('click', closeNav);
        if (overlay)  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeNav(); });

        // Wire mobile nav buttons to existing app actions
        const map = {
            'mobile-btn-new':         'btn-new-doc',
            'mobile-btn-export-png':  'btn-export-png',
            'mobile-btn-export-jpg':  'btn-export-jpg',
            'mobile-btn-undo':        'btn-undo',
            'mobile-btn-redo':        'btn-redo'
        };
        Object.entries(map).forEach(([mobileId, desktopId]) => {
            const mob  = $(mobileId);
            const desk = $(desktopId);
            if (mob && desk) mob.addEventListener('click', () => { closeNav(); desk.click(); });
        });

        // Mobile open-image
        const mobOpenInput = $('mobile-input-open');
        const deskOpenInput = $('input-open-image');
        if (mobOpenInput && deskOpenInput) {
            mobOpenInput.addEventListener('change', (e) => {
                // Transfer files to the desktop input and fire its change handler
                const dt = new DataTransfer();
                [...e.target.files].forEach(f => dt.items.add(f));
                deskOpenInput.files = dt.files;
                deskOpenInput.dispatchEvent(new Event('change'));
                closeNav();
            });
        }

        // Mobile AI button in nav
        const mobAiBtn = $('mobile-btn-ai');
        if (mobAiBtn) mobAiBtn.addEventListener('click', () => { closeNav(); openAiModal(); });
    }

    // ── Mobile bottom toolbar ─────────────────────────────────────────────────
    function setupMobileBottomBar() {
        const fabAi = $('mobile-fab-ai');
        if (fabAi) fabAi.addEventListener('click', openAiModal);

        document.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                // Click the matching desktop toolbar button
                const deskBtn = document.getElementById(`tool-${tool}`);
                if (deskBtn) deskBtn.click();

                document.querySelectorAll('.mobile-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // ── Wire everything on DOMContentLoaded ──────────────────────────────────
    function init() {
        // Open AI modal
        const btnAiHeader = $('btn-ai-edit');
        if (btnAiHeader) btnAiHeader.addEventListener('click', openAiModal);

        // Close AI modal
        const btnCloseAi = $('btn-close-ai-modal');
        if (btnCloseAi) btnCloseAi.addEventListener('click', closeAiModal);
        if (aiModal) aiModal.addEventListener('click', (e) => { if (e.target === aiModal) closeAiModal(); });

        // API Key
        if (btnSaveKey)   btnSaveKey.addEventListener('click', saveKey);
        if (btnChangeKey) btnChangeKey.addEventListener('click', changeKey);
        if (apiKeyInput) apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKey(); });

        // Generate / Analyze
        if (btnGenerate) btnGenerate.addEventListener('click', generateEdit);
        if (btnAnalyze)  btnAnalyze.addEventListener('click', analyzeImage);

        // Apply / Discard
        if (btnApply)   btnApply.addEventListener('click', applyToCanvas);
        if (btnDiscard) btnDiscard.addEventListener('click', () => { clearResult(); aiResponseArea.style.display = 'none'; });

        // Preset buttons
        setupPresets();

        // Mobile
        setupMobileNav();
        setupMobileBottomBar();

        // Keyboard shortcut: G to open AI
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'g' || e.key === 'G') openAiModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
