/**
 * Main Web Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const detector = new EdgeDetector();
    let currentImage = null;
    let currentResults = null;
    let activeEngine = 'opencv_js'; // 'opencv_js' or 'python_api'
    let isProcessing = false;
    let debounceTimer = null;

    // DOM Elements - Webcam
    const webcamModal = document.getElementById('webcamModal');
    const webcamVideo = document.getElementById('webcamVideo');
    const webcamLiveCanvas = document.getElementById('webcamLiveCanvas');
    const btnOpenWebcam = document.getElementById('btnOpenWebcam');
    const btnCaptureWebcam = document.getElementById('btnCaptureWebcam');
    const btnCloseWebcam = document.getElementById('btnCloseWebcam');
    const btnRestartCam = document.getElementById('btnRestartCam');
    const btnToggleLiveDetect = document.getElementById('btnToggleLiveDetect');
    const cameraSelect = document.getElementById('cameraSelect');
    const cameraErrorBanner = document.getElementById('cameraErrorBanner');
    const cameraErrorMessage = document.getElementById('cameraErrorMessage');
    const cameraLoadingSpinner = document.getElementById('cameraLoadingSpinner');
    const liveStatusBadge = document.getElementById('liveStatusBadge');
    const liveOverlayInfo = document.getElementById('liveOverlayInfo');
    const liveObjCount = document.getElementById('liveObjCount');
    const liveFpsCount = document.getElementById('liveFpsCount');

    // Controls
    const engineSelect = document.getElementById('engineSelect');
    const edgeMethodSelect = document.getElementById('edgeMethod');
    const blurKsize = document.getElementById('blurKsize');
    const enableClahe = document.getElementById('enableClahe');
    const cannyLow = document.getElementById('cannyLow');
    const cannyHigh = document.getElementById('cannyHigh');
    const sobelKsize = document.getElementById('sobelKsize');
    const morphDilation = document.getElementById('morphDilation');
    const minArea = document.getElementById('minArea');
    const approxEpsPct = document.getElementById('approxEpsPct');
    const lineThickness = document.getElementById('lineThickness');
    const boundaryColor = document.getElementById('boundaryColor');
    const drawBbox = document.getElementById('drawBbox');
    const drawLabels = document.getElementById('drawLabels');
    const drawCentroids = document.getElementById('drawCentroids');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabViews = {
        pipeline: document.getElementById('tabPipelineView'),
        single: document.getElementById('tabSingleView'),
        comparison: document.getElementById('tabComparisonView'),
        data: document.getElementById('tabDataView')
    };

    // Images display elements
    const imgStep1 = document.getElementById('imgStep1');
    const imgStep2 = document.getElementById('imgStep2');
    const imgStep3 = document.getElementById('imgStep3');
    const imgStep4 = document.getElementById('imgStep4');
    const imgSingle = document.getElementById('imgSingle');
    const compBefore = document.getElementById('compBefore');
    const compAfter = document.getElementById('compAfter');
    const compSlider = document.getElementById('compSlider');
    const compOverlay = document.getElementById('compOverlay');

    // Stats and Table
    const statTotalObjects = document.getElementById('statTotalObjects');
    const statAvgArea = document.getElementById('statAvgArea');
    const statAvgPerimeter = document.getElementById('statAvgPerimeter');
    const statDominantShape = document.getElementById('statDominantShape');
    const objectsTableBody = document.getElementById('objectsTableBody');

    // Toast
    const toast = document.getElementById('toast');

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    // Check if Python Flask backend is reachable
    let apiBaseUrl = '';

    async function checkBackend() {
        const endpoints = ['/api/health', 'http://127.0.0.1:5000/api/health', 'http://localhost:5000/api/health'];
        for (const ep of endpoints) {
            try {
                const res = await fetch(ep);
                if (res.ok) {
                    apiBaseUrl = ep.replace('/api/health', '');
                    console.log('Python Flask backend active at:', apiBaseUrl || 'current origin');
                    activeEngine = 'python_api';
                    if (engineSelect) engineSelect.value = 'python_api';
                    updateEngineBadge('Python OpenCV Backend (cv2)');
                    return;
                }
            } catch (e) {
                // Try next
            }
        }
        console.log('Using browser engine.');
        activeEngine = 'opencv_js';
        if (engineSelect) engineSelect.value = 'opencv_js';
        updateEngineBadge('Browser Engine (Active)');
    }

    function updateEngineBadge(text) {
        const badge = document.getElementById('engineBadgeText');
        if (badge) badge.textContent = text;
    }

    if (engineSelect) {
        engineSelect.addEventListener('change', (e) => {
            activeEngine = e.target.value;
            updateEngineBadge(activeEngine === 'python_api' ? 'Python OpenCV Backend (cv2)' : 'Browser OpenCV.js Engine');
            triggerProcessing();
        });
    }

    // Helper: update value label for ranges
    document.querySelectorAll('input[type="range"]').forEach(input => {
        const displayId = input.id + 'Val';
        const display = document.getElementById(displayId);
        if (display) {
            input.addEventListener('input', () => {
                display.textContent = input.value;
                triggerProcessing();
            });
        }
    });

    [edgeMethodSelect, enableClahe, drawBbox, drawLabels, drawCentroids, boundaryColor].forEach(ctrl => {
        if (ctrl) {
            ctrl.addEventListener('change', () => triggerProcessing());
        }
    });

    // Scene Presets
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            applyPreset(preset);
        });
    });

    function applyPreset(presetName) {
        if (presetName === 'clean') {
            blurKsize.value = 5;
            cannyLow.value = 50;
            cannyHigh.value = 150;
            morphDilation.value = 2;
            minArea.value = 150;
            if (enableClahe) enableClahe.checked = false;
            showToast('Applied Preset: Clean / Studio Background');
        } else if (presetName === 'complex') {
            // For vehicles on grass, outdoor cluttered scenes
            blurKsize.value = 9;
            cannyLow.value = 25;
            cannyHigh.value = 100;
            morphDilation.value = 4;
            minArea.value = 100;
            if (enableClahe) enableClahe.checked = true;
            showToast('Applied Preset: Complex / Grass Scene');
        } else if (presetName === 'faint') {
            // Low contrast / shadowed objects
            blurKsize.value = 5;
            cannyLow.value = 15;
            cannyHigh.value = 75;
            morphDilation.value = 3;
            minArea.value = 80;
            if (enableClahe) enableClahe.checked = true;
            showToast('Applied Preset: Faint Shadows & Edges');
        } else if (presetName === 'coins') {
            blurKsize.value = 5;
            cannyLow.value = 40;
            cannyHigh.value = 120;
            morphDilation.value = 2;
            minArea.value = 150;
            if (enableClahe) enableClahe.checked = false;
            showToast('Applied Preset: Coins & Shapes');
        }

        // Update UI badge numbers
        ['blurKsize', 'cannyLow', 'cannyHigh', 'morphDilation', 'minArea'].forEach(id => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(id + 'Val');
            if (el && valEl) valEl.textContent = el.value;
        });

        triggerProcessing();
    }

    // Swatches
    document.querySelectorAll('.swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            boundaryColor.value = sw.getAttribute('data-color');
            triggerProcessing();
        });
    });

    // Tabs logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');

            Object.keys(tabViews).forEach(key => {
                if (tabViews[key]) {
                    tabViews[key].style.display = (key === target) ? 'block' : 'none';
                }
            });
        });
    });

    // Comparison slider logic
    let isDraggingSlider = false;
    if (compSlider && compOverlay) {
        const updateSlider = (clientX) => {
            const rect = compSlider.parentElement.getBoundingClientRect();
            let x = clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            const pct = (x / rect.width) * 100;
            compSlider.style.left = pct + '%';
            compOverlay.style.width = pct + '%';
        };

        compSlider.addEventListener('mousedown', () => { isDraggingSlider = true; });
        window.addEventListener('mouseup', () => { isDraggingSlider = false; });
        window.addEventListener('mousemove', (e) => {
            if (isDraggingSlider) updateSlider(e.clientX);
        });

        // Touch support
        compSlider.addEventListener('touchstart', () => { isDraggingSlider = true; });
        window.addEventListener('touchend', () => { isDraggingSlider = false; });
        window.addEventListener('touchmove', (e) => {
            if (isDraggingSlider && e.touches[0]) updateSlider(e.touches[0].clientX);
        });
    }

    // File Drag & Drop
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
        dropzone.addEventListener('click', () => fileInput && fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
            }
        });
    }

    // Sample buttons
    document.querySelectorAll('.btn-sample').forEach(btn => {
        btn.addEventListener('click', () => {
            const sampleName = btn.getAttribute('data-sample');
            loadSampleImage(sampleName);
        });
    });

    function loadSampleImage(filename) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            currentImage = img;
            triggerProcessing();
            showToast(`Loaded sample: ${filename}`);
        };
        img.onerror = () => {
            showToast(`Error loading ${filename}`);
        };
        const prefix = (window.location.protocol === 'file:' && apiBaseUrl) ? (apiBaseUrl + '/') : '';
        img.src = `${prefix}test_samples/${filename}`;
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, WebP).');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                triggerProcessing();
                showToast(`Loaded ${file.name}`);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Robust Webcam Management & Live Boundary Detection
    let mediaStream = null;
    let isLiveDetecting = false;
    let liveAnimationId = null;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    const liveOffCanvas = document.createElement('canvas');
    const liveOffCtx = liveOffCanvas.getContext('2d');

    function stopCameraStream() {
        stopLiveDetection();
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.stop();
            });
            mediaStream = null;
        }
        if (webcamVideo) {
            webcamVideo.srcObject = null;
        }
    }

    function showCameraError(message) {
        if (cameraErrorBanner && cameraErrorMessage) {
            cameraErrorMessage.innerHTML = message;
            cameraErrorBanner.style.display = 'block';
        } else {
            alert(message);
        }
    }

    async function populateCameraDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !cameraSelect) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            // Keep default option
            cameraSelect.innerHTML = '<option value="">Default Camera</option>';
            videoDevices.forEach((device, index) => {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.textContent = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(opt);
            });
        } catch (err) {
            console.warn('Could not enumerate cameras:', err);
        }
    }

    async function startCamera(deviceId = null) {
        if (cameraErrorBanner) cameraErrorBanner.style.display = 'none';
        if (cameraLoadingSpinner) cameraLoadingSpinner.style.display = 'flex';

        stopCameraStream();

        // 1. Verify Browser Support & Context
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (cameraLoadingSpinner) cameraLoadingSpinner.style.display = 'none';
            if (window.location.protocol === 'file:') {
                showCameraError(
                    '⚠️ <strong>Browser Security Restriction:</strong> Webcams are blocked on local <code>file://</code> URLs.<br>' +
                    'Please open the app via the local web server at: <a href="http://localhost:5000" style="color:#00e5ff; text-decoration:underline;">http://localhost:5000</a> (run <code>.\\run.bat</code> or <code>python app.py</code> in VS Code).'
                );
            } else {
                showCameraError('Your browser does not support camera access or media devices API.');
            }
            return;
        }

        // 2. Cascade through flexible constraints to avoid OverconstrainedError
        const constraintTiers = [
            deviceId 
                ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
                : { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } },
            deviceId
                ? { video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } } }
                : { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
            deviceId
                ? { video: { deviceId: { exact: deviceId } } }
                : { video: true }
        ];

        let stream = null;
        let caughtError = null;

        for (const constraints of constraintTiers) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) break;
            } catch (err) {
                caughtError = err;
                console.warn('Camera tier failed, trying next fallback:', err.name, err.message);
            }
        }

        if (cameraLoadingSpinner) cameraLoadingSpinner.style.display = 'none';

        if (!stream) {
            let errorText = 'Unable to open camera: ';
            if (caughtError) {
                if (caughtError.name === 'NotAllowedError' || caughtError.name === 'PermissionDeniedError') {
                    errorText += '<strong>Camera permission denied.</strong> Please click the camera/lock icon in your browser address bar and choose <em>Allow</em>.';
                } else if (caughtError.name === 'NotFoundError' || caughtError.name === 'DevicesNotFoundError') {
                    errorText += '<strong>No camera hardware detected.</strong> Please ensure your webcam is plugged in or enabled.';
                } else if (caughtError.name === 'NotReadableError' || caughtError.name === 'TrackStartError') {
                    errorText += '<strong>Camera in use.</strong> Another application (Teams, Zoom, Discord, or another browser tab) is currently using your webcam.';
                } else {
                    errorText += caughtError.message || caughtError.name;
                }
            } else {
                errorText += 'No valid video stream returned.';
            }
            showCameraError(errorText);
            return;
        }

        mediaStream = stream;
        webcamVideo.srcObject = mediaStream;
        webcamVideo.muted = true;

        try {
            await webcamVideo.play();
        } catch (playErr) {
            console.warn('Video play warning:', playErr);
        }

        // Populate device selector list
        populateCameraDevices();
    }

    function startLiveDetection() {
        if (!mediaStream) return;
        isLiveDetecting = true;
        if (btnToggleLiveDetect) {
            btnToggleLiveDetect.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Live Detection';
            btnToggleLiveDetect.classList.add('btn-primary');
            btnToggleLiveDetect.classList.remove('btn-secondary');
        }
        if (liveStatusBadge) liveStatusBadge.style.display = 'inline-flex';
        if (webcamLiveCanvas) webcamLiveCanvas.style.display = 'block';
        if (liveOverlayInfo) liveOverlayInfo.style.display = 'flex';

        lastFpsUpdate = performance.now();
        frameCount = 0;
        liveDetectionLoop();
    }

    function stopLiveDetection() {
        isLiveDetecting = false;
        if (liveAnimationId) {
            cancelAnimationFrame(liveAnimationId);
            liveAnimationId = null;
        }
        if (btnToggleLiveDetect) {
            btnToggleLiveDetect.innerHTML = '<i class="fa-solid fa-play"></i> Start Live Detection';
            btnToggleLiveDetect.classList.remove('btn-primary');
            btnToggleLiveDetect.classList.add('btn-secondary');
        }
        if (liveStatusBadge) liveStatusBadge.style.display = 'none';
        if (webcamLiveCanvas) {
            webcamLiveCanvas.style.display = 'none';
            const ctx = webcamLiveCanvas.getContext('2d');
            ctx.clearRect(0, 0, webcamLiveCanvas.width, webcamLiveCanvas.height);
        }
        if (liveOverlayInfo) liveOverlayInfo.style.display = 'none';
    }

    function liveDetectionLoop() {
        if (!isLiveDetecting) return;

        if (webcamVideo.readyState >= 2 && webcamVideo.videoWidth > 0) {
            const vw = webcamVideo.videoWidth;
            const vh = webcamVideo.videoHeight;

            liveOffCanvas.width = vw;
            liveOffCanvas.height = vh;
            liveOffCtx.drawImage(webcamVideo, 0, 0, vw, vh);

            // Process with EdgeDetector engine in browser
            const options = getOptions();
            const results = detector.processImage(liveOffCanvas, options);

            if (results && results.images && results.images.step4_boundaries && webcamLiveCanvas) {
                const liveImg = new Image();
                liveImg.onload = () => {
                    webcamLiveCanvas.width = vw;
                    webcamLiveCanvas.height = vh;
                    const lctx = webcamLiveCanvas.getContext('2d');
                    lctx.clearRect(0, 0, vw, vh);
                    lctx.drawImage(liveImg, 0, 0, vw, vh);
                };
                liveImg.src = results.images.step4_boundaries;

                if (liveObjCount) {
                    liveObjCount.textContent = results.objects ? results.objects.length : 0;
                }
            }

            // Calculate FPS
            frameCount++;
            const now = performance.now();
            if (now - lastFpsUpdate >= 1000) {
                const currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
                if (liveFpsCount) liveFpsCount.textContent = currentFps + ' FPS';
                frameCount = 0;
                lastFpsUpdate = now;
            }
        }

        // Throttled to ~15-20 FPS for smooth edge detection without burning CPU
        setTimeout(() => {
            if (isLiveDetecting) {
                liveAnimationId = requestAnimationFrame(liveDetectionLoop);
            }
        }, 60);
    }

    // Camera Event Listeners
    if (btnOpenWebcam) {
        btnOpenWebcam.addEventListener('click', () => {
            webcamModal.style.display = 'flex';
            startCamera();
        });
    }

    if (btnCloseWebcam) {
        btnCloseWebcam.addEventListener('click', () => {
            stopCameraStream();
            webcamModal.style.display = 'none';
        });
    }

    if (btnRestartCam) {
        btnRestartCam.addEventListener('click', () => {
            const selectedDev = cameraSelect ? cameraSelect.value : null;
            startCamera(selectedDev || null);
        });
    }

    if (cameraSelect) {
        cameraSelect.addEventListener('change', () => {
            const selectedDev = cameraSelect.value;
            startCamera(selectedDev || null);
        });
    }

    if (btnToggleLiveDetect) {
        btnToggleLiveDetect.addEventListener('click', () => {
            if (isLiveDetecting) {
                stopLiveDetection();
            } else {
                startLiveDetection();
            }
        });
    }

    if (btnCaptureWebcam) {
        btnCaptureWebcam.addEventListener('click', () => {
            if (!webcamVideo.videoWidth) {
                showToast('Camera video not ready yet.');
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = webcamVideo.videoWidth;
            canvas.height = webcamVideo.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(webcamVideo, 0, 0);

            const img = new Image();
            img.onload = () => {
                currentImage = img;
                stopCameraStream();
                webcamModal.style.display = 'none';
                triggerProcessing();
                showToast('Live camera frame captured & analyzed!');
            };
            img.src = canvas.toDataURL('image/png');
        });
    }

    // Trigger processing with debouncing
    function triggerProcessing() {
        if (!currentImage) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            processCurrentImage();
        }, 80);
    }

    function getOptions() {
        return {
            blurKsize: parseInt(blurKsize.value, 10),
            enableClahe: enableClahe ? enableClahe.checked : false,
            edgeMethod: edgeMethodSelect.value,
            cannyLow: parseInt(cannyLow.value, 10),
            cannyHigh: parseInt(cannyHigh.value, 10),
            sobelKsize: parseInt(sobelKsize.value, 10),
            morphDilation: parseInt(morphDilation.value, 10),
            minArea: parseFloat(minArea.value),
            approxEpsPct: parseFloat(approxEpsPct.value),
            drawBbox: drawBbox.checked,
            drawLabels: drawLabels.checked,
            drawCentroids: drawCentroids.checked,
            boundaryColor: boundaryColor.value,
            lineThickness: parseInt(lineThickness.value, 10)
        };
    }

    async function processCurrentImage() {
        if (!currentImage || isProcessing) return;
        isProcessing = true;

        const options = getOptions();

        if (activeEngine === 'python_api') {
            try {
                const formData = new FormData();
                formData.append('imageData', currentImage.src);
                for (const [k, v] of Object.entries(options)) {
                    formData.append(k, v);
                }

                const targetUrl = (apiBaseUrl ? apiBaseUrl : '') + '/api/detect';
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) {
                    throw new Error('Server returned ' + res.status);
                }

                const data = await res.json();
                renderResults(data);
                isProcessing = false;
                return;
            } catch (err) {
                console.warn('Python API failed or unavailable, falling back to OpenCV.js in browser:', err);
                // Fallback to client side
            }
        }

        // OpenCV.js client processing
        const res = detector.processImage(currentImage, options);
        renderResults(res);
        isProcessing = false;
    }

    function renderResults(results) {
        if (!results || !results.success) return;
        currentResults = results;

        const { images, summary, objects } = results;

        // Render images
        if (imgStep1) imgStep1.src = images.step1_gray;
        if (imgStep2) {
            // Show either Canny or Sobel based on selector
            const method = edgeMethodSelect.value;
            imgStep2.src = (method === 'sobel') ? images.step2_sobel : images.step2_canny;
        }
        if (imgStep3) imgStep3.src = images.step3_contours;
        if (imgStep4) imgStep4.src = images.step4_boundaries;

        if (imgSingle) imgSingle.src = images.step4_boundaries;
        if (compBefore) compBefore.src = images.original || currentImage.src;
        if (compAfter) compAfter.src = images.step4_boundaries;

        // Render Stats
        if (statTotalObjects) statTotalObjects.textContent = objects.length;
        if (objects.length > 0) {
            const sumArea = objects.reduce((acc, o) => acc + o.area, 0);
            const sumPerim = objects.reduce((acc, o) => acc + o.perimeter, 0);
            if (statAvgArea) statAvgArea.textContent = Math.round(sumArea / objects.length) + ' px²';
            if (statAvgPerimeter) statAvgPerimeter.textContent = Math.round(sumPerim / objects.length) + ' px';

            // Dominant shape
            const counts = {};
            objects.forEach(o => { counts[o.shape] = (counts[o.shape] || 0) + 1; });
            const dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, '-');
            if (statDominantShape) statDominantShape.textContent = dominant;
        } else {
            if (statAvgArea) statAvgArea.textContent = '0 px²';
            if (statAvgPerimeter) statAvgPerimeter.textContent = '0 px';
            if (statDominantShape) statDominantShape.textContent = '-';
        }

        // Render Table
        if (objectsTableBody) {
            objectsTableBody.innerHTML = '';
            objects.forEach(obj => {
                const tr = document.createElement('tr');
                const badgeClass = `shape-${obj.shape.toLowerCase().replace(/[^a-z]/g, '')}`;
                tr.innerHTML = `
                    <td><strong>#${obj.id}</strong></td>
                    <td><span class="shape-badge ${badgeClass}">${obj.shape}</span></td>
                    <td>${obj.area.toLocaleString()}</td>
                    <td>${obj.perimeter.toLocaleString()}</td>
                    <td>${obj.circularity}</td>
                    <td>${obj.vertices}</td>
                    <td>(${obj.centroid.x}, ${obj.centroid.y})</td>
                    <td>${obj.bbox.w} &times; ${obj.bbox.h}</td>
                `;
                objectsTableBody.appendChild(tr);
            });
        }
    }

    // Download handlers
    const btnDownloadBoundary = document.getElementById('btnDownloadBoundary');
    if (btnDownloadBoundary) {
        btnDownloadBoundary.addEventListener('click', () => {
            if (!currentResults || !currentResults.images.step4_boundaries) {
                alert('No processed image to download.');
                return;
            }
            const a = document.createElement('a');
            a.href = currentResults.images.step4_boundaries;
            a.download = 'object_boundaries_detected.png';
            a.click();
            showToast('Boundary image downloaded!');
        });
    }

    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            if (!currentResults || !currentResults.objects || currentResults.objects.length === 0) {
                alert('No detected objects to export.');
                return;
            }
            let csv = 'ID,Shape,Area_px2,Perimeter_px,Circularity,Vertices,Centroid_X,Centroid_Y,BBox_W,BBox_H\n';
            currentResults.objects.forEach(o => {
                csv += `${o.id},"${o.shape}",${o.area},${o.perimeter},${o.circularity},${o.vertices},${o.centroid.x},${o.centroid.y},${o.bbox.w},${o.bbox.h}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'detected_objects_boundary_report.csv';
            a.click();
            URL.revokeObjectURL(url);
            showToast('CSV report exported!');
        });
    }

    // Step 2 Edge visual switch handler
    const edgeViewRadios = document.querySelectorAll('input[name="step2View"]');
    edgeViewRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (currentResults) {
                imgStep2.src = radio.value === 'sobel' ? currentResults.images.step2_sobel : currentResults.images.step2_canny;
            }
        });
    });

    // Listen for OpenCV readiness
    window.addEventListener('opencv-ready', () => {
        showToast('OpenCV.js Engine Ready');
        if (currentImage) triggerProcessing();
    });

    // Initial backend check and load default sample image
    checkBackend().then(() => {
        loadSampleImage('sample_motorcycle.png');
    });
});
