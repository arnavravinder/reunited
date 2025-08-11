document.addEventListener('DOMContentLoaded', () => {
    const animationWrapper = document.getElementById('animation-wrapper');
    const playBtn = document.getElementById('play-btn');
    const downloadBtn = document.getElementById('download-btn');
    const timelineTrack = document.getElementById('timeline-track');
    const timelineProgress = document.getElementById('timeline-progress');
    const timeDisplay = document.getElementById('time-display');
    const recordingStatus = document.getElementById('recording-status');
    const recStatusText = recordingStatus.querySelector('span');

    const TOTAL_DURATION = 30;
    let isPlaying = false;
    let animationFrameId;
    let recorder;
    let recordedChunks = [];
    let startTime = 0;
    let elapsedTime = 0;
    let isRecording = false;

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    const timeline = [
        { time: 0, action: 'startScene', id: 'scene-1-intro' },
        { time: 0.2, action: 'animate', target: '#k-1', className: 'kinetic-enter', duration: 0.4 },
        { time: 0.4, action: 'animate', target: '#k-2', className: 'kinetic-enter', duration: 0.4 },
        { time: 0.6, action: 'animate', target: '#k-3', className: 'kinetic-enter', duration: 0.4 },
        { time: 0.8, action: 'animate', target: '#img-1', className: 'collage-1', duration: 0.6 },
        { time: 0.9, action: 'animate', target: '#img-2', className: 'collage-2', duration: 0.6 },
        { time: 1.0, action: 'animate', target: '#img-3', className: 'collage-3', duration: 0.6 },
        { time: 1.1, action: 'animate', target: '#img-4', className: 'collage-4', duration: 0.6 },
        { time: 1.2, action: 'animate', target: '#img-5', className: 'collage-5', duration: 0.6 },
        { time: 2.8, action: 'endScene', id: 'scene-1-intro' },
        { time: 3.0, action: 'startScene', id: 'scene-2-solution' },
        { time: 3.2, action: 'animate', target: '#solution-text-1', className: 'fade-in-anim', duration: 0.8 },
        { time: 4.5, action: 'animate', target: '#solution-text-1', className: 'fade-out-anim', duration: 0.5 },
        { time: 5.0, action: 'animate', target: '#solution-text-2', className: 'fade-in-anim', duration: 0.8 },
        { time: 6.8, action: 'endScene', id: 'scene-2-solution' },
        { time: 7.0, action: 'startScene', id: 'scene-3-product-search' },
        { time: 7.2, action: 'animate', target: '#scene-3-product-search .product-window', className: 'window-enter-anim', duration: 1.0 },
        { time: 8.2, action: 'typewriter', target: '#search-input-mock', text: 'Lost black earphones', duration: 1.5 },
        { time: 9.8, action: 'showSearchResults' },
        { time: 10.2, action: 'animate', target: '#search-overlay-text', className: 'overlay-text-anim', duration: 3 },
        { time: 13.0, action: 'endScene', id: 'scene-3-product-search' },
        { time: 13.2, action: 'startScene', id: 'scene-4-product-dashboard' },
        { time: 13.4, action: 'animate', target: '#scene-4-product-dashboard .product-window', className: 'window-pan-anim', duration: 6 },
        { time: 14.4, action: 'animate', target: '#dashboard-overlay-text', className: 'overlay-text-anim', duration: 3 },
        { time: 18.8, action: 'endScene', id: 'scene-4-product-dashboard' },
        { time: 19.0, action: 'startScene', id: 'scene-5-features' },
        { time: 19.2, action: 'animate', target: '#scene-5-features .product-window', className: 'window-zoom-anim', duration: 1.0 },
        { time: 20.2, action: 'showFeature', feature: 1 },
        { time: 21.7, action: 'showFeature', feature: 2 },
        { time: 23.2, action: 'showFeature', feature: 3 },
        { time: 24.5, action: 'endScene', id: 'scene-5-features' },
        { time: 24.7, action: 'startScene', id: 'scene-6-result' },
        { time: 24.9, action: 'animate', target: '#scene-6-result .result-text', className: 'result-text-anim', duration: 1.2 },
        { time: 25.5, action: 'animate', target: '.reunion-anim', className: 'reunion-effect-anim', duration: 2.0 },
        { time: 27.0, action: 'endScene', id: 'scene-6-result' },
        { time: 27.2, action: 'startScene', id: 'scene-7-vision' },
        { time: 27.4, action: 'animate', target: '#vision-collage', className: 'vision-collage-anim', duration: 8 },
        { time: 27.8, action: 'animate', target: '#vision-text-1', className: 'vision-text-anim', duration: 1.5 },
        { time: 28.3, action: 'animate', target: '#vision-text-2', className: 'vision-text-anim', duration: 1.5 },
        { time: 28.8, action: 'animate', target: '#vision-text-3', className: 'vision-text-anim', duration: 1.5 },
        { time: 29.5, action: 'animate', target: '#founder-text', className: 'founder-text-anim', duration: 1 },
        { time: 31.0, action: 'endScene', id: 'scene-7-vision' }, // Extended slightly to allow fade out
        { time: 31.2, action: 'startScene', id: 'scene-8-cta' },
        { time: 31.4, action: 'animate', target: '.reunited-logo-final', className: 'logo-final-anim', duration: 0.8 },
        { time: 32.0, action: 'animate', target: '.domain-text', className: 'domain-text-anim', duration: 0.8 },
        { time: 32.5, action: 'animate', target: '.cta-button', className: 'cta-button-anim', duration: 0.8 },
    ];
    
    function setInitialState() {
        document.querySelectorAll('.scene.active').forEach(s => s.classList.remove('active'));
        document.getElementById('scene-1-intro').classList.add('active');
        timeline.forEach(event => event.triggered = false);
        const elementsToReset = document.querySelectorAll('[style*="animation"]');
        elementsToReset.forEach(el => el.style.animation = 'none');
        document.querySelector('.search-results-mock')?.replaceChildren();
        const searchInput = document.querySelector('#search-input-mock');
        if (searchInput) {
            searchInput.textContent = '';
            searchInput.removeAttribute('data-typed');
        }
        document.querySelector('.feature-highlight')?.remove();
        updateUI(0);
    }
    
    const actions = {
        startScene: (params) => {
            if (isRecording) return;
            document.querySelectorAll('.scene.active').forEach(s => s.classList.remove('active'));
            const scene = document.getElementById(params.id);
            if (scene) scene.classList.add('active');
        },
        endScene: (params) => {
            if (isRecording) return;
            const scene = document.getElementById(params.id);
            if(scene) scene.classList.remove('active');
        },
        animate: (params) => {
            const el = document.querySelector(params.target);
            if (el) {
                el.style.animation = `${params.className} ${params.duration}s var(--ease-in-out-cubic) forwards`;
            }
        },
        typewriter: (params) => {
            const el = document.querySelector(params.target);
            if (!el || el.getAttribute('data-typed')) return;
            el.setAttribute('data-typed', 'true');
            let i = 0;
            el.textContent = '';
            const intervalTime = (params.duration * 1000) / params.text.length;
            const interval = setInterval(() => {
                if (i < params.text.length) {
                    el.textContent += params.text.charAt(i);
                    i++;
                } else {
                    el.classList.add('finished-typing');
                    clearInterval(interval);
                }
            }, intervalTime);
        },
        showSearchResults: () => {
            const container = document.querySelector('.search-results-mock');
            if (!container || container.children.length > 0) return;
            const items = [
                { name: 'Sony WH-1000XM4', loc: 'Central Park', img: 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=600' },
                { name: 'Apple AirPods Pro', loc: 'Main Library', img: 'https://images.pexels.com/photos/3825517/pexels-photo-3825517.jpeg?auto=compress&cs=tinysrgb&w=600' },
                { name: 'Bose QuietComfort', loc: 'Downtown Cafe', img: 'https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=600' },
            ];
            items.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'item-card-mock';
                card.innerHTML = `<div class="img" style="background-image: url('${item.img}')"></div><div class="name">${item.name}</div><div class="loc">${item.loc}</div>`;
                container.appendChild(card);
                card.style.animation = `fade-in-up-anim ${0.5 + index * 0.2}s var(--ease-out-cubic) forwards`;
            });
        },
        showFeature: (params) => {
            const windowBody = document.getElementById('features-body');
            document.querySelectorAll('.feature-text').forEach(ft => { ft.style.animation = 'none'; ft.style.opacity = '0'; });
            const highlight = windowBody.querySelector('.feature-highlight');
            if (highlight) highlight.style.opacity = '0';

            const featureText = document.getElementById(`feature-text-${params.feature}`);
            if (featureText) actions.animate({ target: `#feature-text-${params.feature}`, className: 'feature-text-enter-anim', duration: 0.5 });

            let newHighlight = windowBody.querySelector('.feature-highlight') || document.createElement('div');
            newHighlight.className = 'feature-highlight';
            windowBody.appendChild(newHighlight);
            
            newHighlight.style.opacity = '1';
            let styles = '';
            switch(params.feature) {
                case 1: styles = 'top: 615px; left: 40px; width: 730px; height: 110px;'; break;
                case 2: styles = 'top: 100px; left: 1200px; width: 350px; height: 260px;'; break;
                case 3: styles = 'top: 400px; left: 810px; width: 740px; height: 350px;'; break;
            }
            newHighlight.style.cssText += styles;
        }
    };

    function updateAnimation(currentTime) {
        timeline.forEach(event => {
            if (currentTime >= event.time && !event.triggered) {
                if (actions[event.action]) {
                    actions[event.action](event);
                    event.triggered = true;
                }
            }
        });
        updateUI(currentTime);
    }
    
    function tick() {
        if (!isPlaying) return;
        elapsedTime = (performance.now() - startTime) / 1000;
        if (elapsedTime >= TOTAL_DURATION) {
            elapsedTime = TOTAL_DURATION;
            updateAnimation(elapsedTime);
            pauseAnimation();
            playBtn.innerHTML = '<i class="fas fa-redo"></i>';
            return;
        }
        updateAnimation(elapsedTime);
        animationFrameId = requestAnimationFrame(tick);
    }

    function updateUI(currentTime) {
        const progress = (currentTime / TOTAL_DURATION) * 100;
        timelineProgress.style.width = `${progress}%`;
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(TOTAL_DURATION)}`;
    }

    function playAnimation() {
        if (isPlaying) return;
        if (elapsedTime >= TOTAL_DURATION) {
            elapsedTime = 0;
            setInitialState();
        }
        isPlaying = true;
        startTime = performance.now() - elapsedTime * 1000;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        tick();
    }

    function pauseAnimation() {
        if (!isPlaying) return;
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    function togglePlay() {
        if (isPlaying) pauseAnimation();
        else playAnimation();
    }

    function seek(e) {
        if (isRecording) return;
        const rect = timelineTrack.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        elapsedTime = TOTAL_DURATION * percent;
        if (isPlaying) {
            startTime = performance.now() - elapsedTime * 1000;
        }
        setInitialState();
        timeline.forEach(event => event.triggered = event.time < elapsedTime);
        updateAnimation(elapsedTime);
    }
    
    function setupInitialScale() {
        const containerHeight = window.innerHeight - document.getElementById('controls').offsetHeight;
        const scaleX = window.innerWidth / 1920;
        const scaleY = containerHeight / 1080;
        const scale = Math.min(scaleX, scaleY);
        animationWrapper.style.transform = `scale(${scale})`;
    }

    async function startRecording() {
        if (isRecording) return;
        isRecording = true;
        downloadBtn.disabled = true;
        playBtn.disabled = true;
        recordingStatus.classList.add('active');
        recStatusText.textContent = 'Preparing...';

        const canvas = document.getElementById('recording-canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const stream = canvas.captureStream(30);
        
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        recordedChunks = [];
        recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunks.push(event.data); };
        recorder.onstop = () => {
            recStatusText.textContent = 'Processing...';
            setTimeout(() => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'reunited-launch-video.mp4';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                recordingStatus.classList.remove('active');
                downloadBtn.disabled = false;
                playBtn.disabled = false;
                isRecording = false;
                setInitialState();
            }, 500);
        };

        setInitialState();
        recorder.start();
        recStatusText.textContent = 'Recording 0%';
        
        const recordStartTime = performance.now();
        function recordFrame() {
            const currentRecordTime = (performance.now() - recordStartTime) / 1000;
            if (currentRecordTime > TOTAL_DURATION) {
                if (recorder.state === 'recording') recorder.stop();
                return;
            }
            
            setInitialState();
            timeline.forEach(event => event.triggered = event.time < currentRecordTime);
            updateAnimation(currentRecordTime);
            
            recStatusText.textContent = `Recording ${Math.round((currentRecordTime/TOTAL_DURATION)*100)}%`;

            html2canvas(animationWrapper, {
                useCORS: true, logging: false, width: 1920, height: 1080
            }).then(() => {
                requestAnimationFrame(recordFrame);
            }).catch(err => {
                console.error("Recording frame failed:", err);
                if (recorder.state === 'recording') recorder.stop();
            });
        }
        requestAnimationFrame(recordFrame);
    }

    playBtn.addEventListener('click', togglePlay);
    timelineTrack.addEventListener('click', seek);
    downloadBtn.addEventListener('click', startRecording);
    window.addEventListener('resize', setupInitialScale);
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .kinetic-enter { animation-name: kinetic-enter; } @keyframes kinetic-enter { to { opacity: 1; } }
        .collage-1, .collage-2, .collage-3, .collage-4, .collage-5 { animation-fill-mode: forwards; animation-timing-function: var(--ease-out-cubic); }
        .collage-1 { animation-name: collage-1; } @keyframes collage-1 { from { opacity: 0; transform: rotate(-5deg) scale(0.8) translate(-50px, -50px); } to { opacity: 0.2; transform: rotate(-5deg) scale(1) translate(0,0); } }
        .collage-2 { animation-name: collage-2; } @keyframes collage-2 { from { opacity: 0; transform: rotate(8deg) scale(0.8) translate(50px, -50px); } to { opacity: 0.2; transform: rotate(8deg) scale(1) translate(0,0); } }
        .collage-3 { animation-name: collage-3; } @keyframes collage-3 { from { opacity: 0; transform: rotate(4deg) scale(0.8) translate(-50px, 50px); } to { opacity: 0.2; transform: rotate(4deg) scale(1) translate(0,0); } }
        .collage-4 { animation-name: collage-4; } @keyframes collage-4 { from { opacity: 0; transform: rotate(-10deg) scale(0.8) translate(50px, 50px); } to { opacity: 0.2; transform: rotate(-10deg) scale(1) translate(0,0); } }
        .collage-5 { animation-name: collage-5; } @keyframes collage-5 { from { opacity: 0; transform: translate(-50%, -50%) rotate(2deg) scale(0.8); } to { opacity: 0.2; transform: translate(-50%, -50%) rotate(2deg) scale(1); } }
        .fade-in-anim { animation-name: fadeIn; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-out-anim { animation-name: fadeOut; } @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        .window-enter-anim { animation-name: windowEnter; } @keyframes windowEnter { from { transform: scale(0.7) rotateX(30deg) rotateY(-25deg); opacity: 0; } to { transform: scale(1) rotateX(0deg) rotateY(0deg); opacity: 1; } }
        .fade-in-up-anim { animation-name: fadeInUp; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .overlay-text-anim { animation: overlay-enter 0.8s forwards, overlay-exit 0.8s 2.2s forwards; }
        @keyframes overlay-enter { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes overlay-exit { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, -20px); } }
        .window-pan-anim { animation-name: windowPan; animation-timing-function: linear; } @keyframes windowPan { 0% { transform: scale(1.1) translateX(-100px) translateY(50px); opacity: 0; } 15% { transform: scale(1.1) translateX(0) translateY(0); opacity: 1; } 85% { transform: scale(1.1) translateX(-150px) translateY(-50px); opacity: 1; } 100% { transform: scale(1.1) translateX(-250px) translateY(-100px); opacity: 0; } }
        .window-zoom-anim { animation-name: windowZoom; } @keyframes windowZoom { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .feature-text-enter-anim { animation-name: featureTextEnter; } @keyframes featureTextEnter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0px); } }
        .result-text-anim { animation-name: resultTextEnter; } @keyframes resultTextEnter { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        .reunion-effect-anim { animation-name: reunionEffect; } @keyframes reunionEffect { 0% { opacity: 0; transform: scale(0.5); } 20% { opacity: 1; transform: scale(1.1); } 40% { transform: scale(1); } 100% { opacity: 1; transform: scale(1); } }
        .reunion-effect-anim .fa-key { animation: keyMove 2s forwards; } @keyframes keyMove { from { transform: translate(-150px, -50%);} to { transform: translate(0, -50%);} }
        .reunion-effect-anim .fa-hand-sparkles { animation: handMove 2s forwards; } @keyframes handMove { from { transform: translate(150px, -50%);} to { transform: translate(0, -50%);} }
        .vision-collage-anim { animation: visionCollage 8s linear infinite, visionCollageFadeIn 1s forwards; } @keyframes visionCollage { from { transform: rotate(-15deg) translateX(0); } to { transform: rotate(-15deg) translateX(-1000px); } }
        @keyframes visionCollageFadeIn { from { opacity: 0; } to { opacity: 0.1; } }
        .vision-text-anim { animation: visionText 1.5s forwards; } @keyframes visionText { 0% { opacity: 0; transform: translateY(30px); } 20% { opacity: 1; transform: translateY(0px); } 80% { opacity: 1; transform: translateY(0px); } 100% { opacity: 0; transform: translateY(-30px); } }
        .founder-text-anim { animation-name: founderText; } @keyframes founderText { from { opacity: 0; } to { opacity: 1; } }
        .logo-final-anim, .domain-text-anim, .cta-button-anim { animation-timing-function: var(--ease-out-cubic); }
        .logo-final-anim { animation-name: logoFinal; } @keyframes logoFinal { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .domain-text-anim { animation-name: domainText; } @keyframes domainText { from { opacity: 0; } to { opacity: 1; } }
        .cta-button-anim { animation-name: ctaButton; } @keyframes ctaButton { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        [style*="animation"] { animation-fill-mode: forwards; }
    `;
    document.head.appendChild(styleSheet);
    
    setupInitialScale();
    setInitialState();
});