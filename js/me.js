
/* PARALLASSE ORIGINALE (pagina2) */
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    document.querySelectorAll('.section').forEach(sec => {
        const bg = sec.querySelector('.parallax-bg');
        if (!bg) return;

        const speed = parseFloat(bg.getAttribute('data-speed')) || 0;
        if (speed <= 0) return;

        const sectionTop = sec.offsetTop;
        const relativeScroll = scrolled - sectionTop;
        bg.style.transform = `translate3d(0, ${relativeScroll * speed}px, 0)`;
    });
});



/* ============== INPUT DETECTION ============== */
let lastInputType = "unknown";

/* Touch → lo snap deve funzionare */
window.addEventListener("touchstart", () => {
    lastInputType = "touch";
}, {passive:true});

/* Wheel → distinguiamo mouse da trackpad */
window.addEventListener("wheel", (e) => {
    // Se deltaY è grande → è un mouse
    if (Math.abs(e.deltaY) > 30) {
        lastInputType = "mouse";
    } else {
        // delta piccolo e frequente → trackpad
        lastInputType = "trackpad";
    }
}, {passive:true});


/* START MENU */
const startBtn = document.getElementById('startBtn');
const startMenu = document.getElementById('startMenu');
startBtn.onclick = (e) => { e.stopPropagation(); startMenu.classList.toggle('show'); };
document.onclick = () => startMenu.classList.remove('show');

/* CLOCK */
function updateClock(){
    const d = new Date();
    document.getElementById('clock').innerText =
        d.getHours().toString().padStart(2,'0') + ":" +
        d.getMinutes().toString().padStart(2,'0');
}
setInterval(updateClock, 1000); updateClock();

/* =========================
   RETRO PIXEL TRANSITION (NES-style)
   - Canvas overlay per transizione “mosaico”
   - Alterna monkeyprince.png <-> dukedoom.png quando la sezione è in viewport
   ========================= */

/* =========================
   RETRO PIXEL TRANSITION — Canvas-only renderer (no <img> paint)
   ========================= */
(function retroPixel(){
    const stage  = document.getElementById('retroStage');
    if (!stage) return;

    const imgAEl = document.getElementById('retroA');
    const imgBEl = document.getElementById('retroB');
    const cvs    = document.getElementById('retroCanvas');
    const ctx    = cvs.getContext('2d', { willReadFrequently:true });

    let current = 0;    // 0 -> A visibile (sul canvas), 1 -> B
    let running = false;
    let timer   = null;

    // High DPI sizing
    function resizeCanvas(){
        const rect = stage.getBoundingClientRect();
        const dpr  = Math.max(1, window.devicePixelRatio || 1);
        // Evita resize se non cambia
        if (cvs.__w === rect.width && cvs.__h === rect.height && cvs.__dpr === dpr) return;

        cvs.__w = rect.width; cvs.__h = rect.height; cvs.__dpr = dpr;
        cvs.width  = Math.max(1, Math.floor(rect.width  * dpr));
        cvs.height = Math.max(1, Math.floor(rect.height * dpr));
        // reset trasformazione e imposta scala DPI
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;

        // ridisegna l'immagine corrente a riposo
        drawCover(ctx, current === 0 ? imgAEl : imgBEl, rect.width, rect.height);
    }
    window.addEventListener('resize', resizeCanvas);

    // Draw "object-fit: cover" su canvas
    function drawCover(ctx, img, W, H){
        const iw = img.naturalWidth  || img.width;
        const ih = img.naturalHeight || img.height;
        const r  = Math.max(W/iw, H/ih);
        const nw = Math.ceil(iw * r), nh = Math.ceil(ih * r);
        const nx = Math.floor((W - nw)/2), ny = Math.floor((H - nh)/2);
        ctx.drawImage(img, nx, ny, nw, nh);
    }

    // Preload, poi primo draw sincrono sul canvas
    function preload(img){
        return new Promise(res => {
            if (img.complete) return res();
            img.addEventListener('load', res, { once:true });
            img.addEventListener('error', res, { once:true }); // fallback: consideralo "ok"
        });
    }

    Promise.all([preload(imgAEl), preload(imgBEl)]).then(() => {
        resizeCanvas(); // dimensiona + primo draw (A)
        // Avvia alternanza solo quando la sezione è visibile (come prima)
        const section = document.getElementById('retro');
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting){
                    timer = setInterval(() => {
                        if (!running) pixelTransition(current === 0); // A->B o B->A
                    }, 4500);
                } else {
                    clearInterval(timer); timer = null;
                }
            });
        }, { threshold: .5 });
        io.observe(section);
    });

    // Effetto NES: mosaico di blocchi dalla "next" sull'attuale canvas
    function pixelTransition(nextIsB){
        if (running) return;
        running = true;

        const rect = stage.getBoundingClientRect();
        const W = rect.width, H = rect.height;

        // Base: disegna lo stato attuale
        ctx.clearRect(0,0,W,H);
        drawCover(ctx, current === 0 ? imgAEl : imgBEl, W, H);

        // Prepara offscreen con la "next"
        const off = document.createElement('canvas');
        off.width = W; off.height = H;
        const offctx = off.getContext('2d', { willReadFrequently:true });
        offctx.imageSmoothingEnabled = false;
        drawCover(offctx, nextIsB ? imgBEl : imgAEl, W, H);

        // Griglia di blocchi
        const BLOCK = Math.floor(Math.max(8, Math.min(16, W/80)));
        const cols  = Math.ceil(W / BLOCK);
        const rows  = Math.ceil(H / BLOCK);

        const blocks = [];
        for (let y=0; y<rows; y++){
            for (let x=0; x<cols; x++) blocks.push([x,y]);
        }
        // Shuffle Fisher–Yates
        for (let i=blocks.length-1; i>0; i--){
            const j = (Math.random()*(i+1))|0;
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }

        const STEP = Math.max(Math.floor(blocks.length/28), 80);

        function step(){
            let n = STEP;
            while (n-- && blocks.length){
                const [bx, by] = blocks.pop();
                const sx = bx*BLOCK, sy = by*BLOCK;
                ctx.drawImage(off, sx, sy, BLOCK, BLOCK, sx, sy, BLOCK, BLOCK);
            }
            if (blocks.length){
                requestAnimationFrame(step);
            } else {
                // Fine: imposta nuovo "current" e lascia il canvas con la next a pieno
                current = nextIsB ? 1 : 0;
                running = false;
            }
        }

        // IMPORTANT: avvia il primo frame nel frame successivo, così il canvas è già dipinto
        requestAnimationFrame(step);
    }
})();


/* =========================
     TYPING EFFECT MS-DOS
     ========================= */
(function initDosTyping() {
    const container = document.getElementById('dosOutput');
    if (!container) return;

    // Testo da digitare (puoi personalizzarlo facilmente)
    const lines = [
        "Microsoft(R) MS-DOS(R) Version 6.22",
        "Copyright (C) 1981-1994 Microsoft Corp.",
        "",
        "C:\\>dir",
        " Volume in drive C is NICOL-OS",
        " Directory of C:\\PORTFOLIO",
        " 03/17/2026  12:00    <DIR>     SYSTEM",
        "C:\\>type README.TXT",
        " Service Manager: Francesco Nicolosi",
        " Focus: performance, reliability, service design",
        " Stack: Jira/Confluence, OMS, SAP<>Hybris, monitoring & automation",
        " Motto: \"If it moves, measure it. If it breaks, fix the process.\"",
        "",
        "C:\\>launch GUCCI_SERVICES.EXE /stability /perf /automation",
        " Initializing.................. OK",
        " Subsystems.................... OK",
        " Ready."
    ];

    // Parametri di digitazione
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const charDelay = prefersReducedMotion ? 0 : 1;     // velocità caratteri
    const lineDelay = prefersReducedMotion ? 0 : 25;    // pausa fra linee

    // Crea cursore lampeggiante
    const cursor = document.createElement('span');
    cursor.className = 'dos-cursor';
    // Inseriamo una prima riga
    const firstLine = document.createElement('div');
    firstLine.className = 'dos-line';
    container.appendChild(firstLine);
    container.appendChild(cursor);

    // Funzione per digitare una singola riga
    function typeLine(text, cb) {
        let i = 0;
        const lineEl = document.createElement('div');
        lineEl.className = 'dos-line';
        container.insertBefore(lineEl, cursor);

        if (charDelay === 0) { // modalità istantanea
            lineEl.textContent = text;
            return void cb();
        }

        const iv = setInterval(() => {
            lineEl.textContent += text.charAt(i++);
            if (i >= text.length) {
                clearInterval(iv);
                setTimeout(cb, lineDelay);
            }
            // scrolla per mantenere il cursore visibile su mobile
            container.scrollTop = container.scrollHeight;
        }, charDelay);
    }

    // Digita tutte le linee in sequenza
    (function typeAll(idx = 0) {
        if (idx >= lines.length) {
            // prompt finale con cursore a fine riga
            const final = document.createElement('div');
            final.className = 'dos-line';
            final.textContent = "C:\\>";
            container.insertBefore(final, cursor);
            return;
        }
        typeLine(lines[idx], () => typeAll(idx + 1));
    })();
})();
(function taskbarAppear(){
    const taskbar = document.querySelector('.taskbar');
    const retroSection = document.getElementById('retro');

    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                taskbar.classList.add('visible');
            } else {
                taskbar.classList.remove('visible');
            }
        });
    }, { threshold: 0.55 });

    obs.observe(retroSection);
})();

/* ======================================================
   Go blue! → Activate full BSOD style for the section
   ====================================================== */
(function(){
    const btn = document.getElementById("goBlueBtn");
    const section = document.getElementById("from-early-days");

    if (!btn || !section) return;

    btn.addEventListener("click", () => {
        section.classList.toggle("bsod-true");
    });
})();
/* ================================
   BACK FROM BSOD → restore Win95
   ================================ */
(function(){
    const exitBtn = document.getElementById("exitBlueBtn");
    const section = document.getElementById("from-early-days");
    if (!exitBtn || !section) return;

    exitBtn.addEventListener("click", () => {
        section.classList.remove("bsod-true");  // ripristina stile Win95
    });
})();

/* =========================
   GLOBAL SECTION NAVIGATOR (DOTS)
   - Creates dots for ALL sections on the site
   - Highlights active section on scroll
   - Hides when Win95 taskbar becomes visible
   ========================= */
(function initSectionNavigator() {
    function prettifyId(id) {
        return (id || "")
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    // Friendly labels (override where needed)
    const LABELS = {
        introduction: "Introduction",
        "domino-experiment": "AI Powered Visual Service Catalog",
        "solitaire-experiment": "AI Powered Visual People Database",
        "music-experiment": "Music & Technology",
        retro: "Gaming",
        video: "Video",
        about: "About",
        dos: "MS‑DOS",
        error: "BSOD"
    };

    function ensureNavigator() {
        let nav = document.querySelector(".section-navigator");
        if (!nav) {
            nav = document.createElement("nav");
            nav.className = "section-navigator";
            nav.setAttribute("aria-label", "Section navigation");
            document.body.appendChild(nav);
        }
        return nav;
    }

    function buildDots(nav, sectionIds) {
        nav.innerHTML = ""; // rebuild cleanly

        sectionIds.forEach((id, idx) => {
            const a = document.createElement("a");
            a.className = "nav-dot";
            a.href = `#${id}`;
            a.setAttribute("data-label", LABELS[id] || prettifyId(id));
            a.setAttribute("aria-label", `${LABELS[id] || prettifyId(id)} (section ${idx + 1}/${sectionIds.length})`);
            nav.appendChild(a);
        });
    }

    function observeActiveDots(sectionIds) {
        const dots = Array.from(document.querySelectorAll(".nav-dot"));
        const sections = sectionIds
            .map(id => document.getElementById(id))
            .filter(Boolean);

        if (!sections.length || !dots.length) return;

        const io = new IntersectionObserver((entries) => {
            // pick the most visible intersecting entry
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];

            if (!visible) return;

            const idx = sectionIds.indexOf(visible.target.id);
            if (idx === -1) return;

            dots.forEach(d => d.classList.remove("active"));
            if (dots[idx]) dots[idx].classList.add("active");
        }, { threshold: [0.35, 0.5, 0.65] });

        sections.forEach(sec => io.observe(sec));
    }

    function wireTaskbarHide(nav) {
        const taskbar = document.querySelector(".taskbar");
        if (!taskbar) return;

        const apply = () => {
            const visible = taskbar.classList.contains("visible");
            nav.style.opacity = visible ? "0" : "1";
            nav.style.pointerEvents = visible ? "none" : "auto";
        };

        apply();

        const mo = new MutationObserver(apply);
        mo.observe(taskbar, { attributes: true, attributeFilter: ["class"] });
    }

    function boot() {
        const allSections = Array.from(document.querySelectorAll("section.section[id]"));
        const sectionIds = allSections
            .map(s => s.id)
            .filter(Boolean);

        if (!sectionIds.length) return;

        const nav = ensureNavigator();
        buildDots(nav, sectionIds);
        observeActiveDots(sectionIds);
        wireTaskbarHide(nav);
    }

    // Run when DOM is ready (safe even if script is loaded in <head>)
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();

/* =========================
   GAMING BSOD EASTER EGG
   ========================= */
(function gamingBsodEasterEgg(){
    const section = document.getElementById("retro");
    const closeBtn = document.getElementById("gamingCloseBtn");
    const restartBtn = document.getElementById("restartGamingBtn");

    if (!section || !closeBtn) return;

    // Click sulla X → BSOD
    closeBtn.addEventListener("click", () => {
        section.classList.add("bsod-true");
    });

    // Stop & Restart → ritorna alla sezione gaming
    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            section.classList.remove("bsod-true");
        });
    }
})();

/* =========================
   UNLOCK AUDIO ON FIRST USER INTERACTION
   (required by browser autoplay policy)
   ========================= */
let audioUnlocked = false;


function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    const section = document.getElementById('music-experiment');
    if (section) section.classList.add('audio-unlocked'); // 👈 questa

    document.querySelectorAll('#music-experiment video').forEach(v => {
        v.muted = true;
        v.play().catch(() => {});
    });
}

// Qualsiasi vera interazione utente va bene
document.addEventListener('click', unlockAudioOnce, { once: true });
document.addEventListener('touchstart', unlockAudioOnce, { once: true });
document.addEventListener('keydown', unlockAudioOnce, { once: true });


/* =========================
   MUSIC & TECHNOLOGY — HOVER AUDIO
   ========================= */
(function initMusicHoverAudio(){
    const section = document.getElementById("music-experiment");
    if (!section) return;

    const cards = section.querySelectorAll(".music-card");

    cards.forEach(card => {
        const video = card.querySelector("video");
        if (!video) return;

        // sicurezza: parte sempre muto
        video.muted = true;
        video.volume = 0.8;


        card.addEventListener("mouseenter", () => {
                if (!audioUnlocked) return;   // ⬅️ fondamentale
                video.muted = false;
                video.play().catch(() => {});
                card.classList.add("audio-on");
            }
        );

        card.addEventListener("mouseleave", () => {
            video.muted = true;
            card.classList.remove("audio-on");
        });
    });
})();