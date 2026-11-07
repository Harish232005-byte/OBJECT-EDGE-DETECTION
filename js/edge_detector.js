/**
 * EdgeDetector Engine
 * Dual-Engine: OpenCV.js + High-Performance Pure JavaScript Contour Tracer
 * Implements the 4-step pipeline:
 * Step 1: Grayscale conversion & noise reduction
 * Step 2: Sobel and Canny edge detection
 * Step 3: Extract contours & Shape Representation
 * Step 4: Draw object boundaries & annotations
 */

class EdgeDetector {
    constructor() {
        this.isOpenCVReady = false;
        this.initOpenCV();
    }

    initOpenCV() {
        if (typeof cv !== 'undefined' && cv.Mat) {
            this.isOpenCVReady = true;
            console.log('OpenCV.js is loaded and ready.');
        } else if (typeof cv !== 'undefined') {
            cv['onRuntimeInitialized'] = () => {
                this.isOpenCVReady = true;
                console.log('OpenCV.js runtime initialized.');
                window.dispatchEvent(new Event('opencv-ready'));
            };
        }
    }

    /**
     * Process an HTML Image or Canvas through the 4-step pipeline in browser
     */
    processImage(imageElement, options = {}) {
        if (this.isOpenCVReady && typeof cv !== 'undefined' && cv.Mat) {
            try {
                return this.processOpenCV(imageElement, options);
            } catch (err) {
                console.warn("OpenCV.js execution error, falling back to Pure-JS Engine:", err);
                return this.processPureJS(imageElement, options);
            }
        } else {
            return this.processPureJS(imageElement, options);
        }
    }

    processOpenCV(imageElement, options = {}) {
        const {
            blurKsize = 5,
            enableClahe = false,
            edgeMethod = 'canny',
            cannyLow = 50,
            cannyHigh = 150,
            sobelKsize = 3,
            morphDilation = 2,
            minArea = 150,
            maxAreaPct = 98,
            approxEpsPct = 2.0,
            drawBbox = true,
            drawLabels = true,
            drawCentroids = true,
            boundaryColor = '#00e5ff',
            lineThickness = 3
        } = options;

        // Read source image into OpenCV Mat
        const src = cv.imread(imageElement);
        const origW = src.cols;
        const origH = src.rows;
        const totalArea = origW * origH;
        const maxArea = totalArea * (maxAreaPct / 100);

        // ==========================================
        // STEP 1: Convert image to grayscale & Preprocessing
        // ==========================================
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        if (enableClahe) {
            try {
                const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
                const enhanced = new cv.Mat();
                clahe.apply(gray, enhanced);
                gray.delete();
                gray = enhanced;
                clahe.delete();
            } catch(e) {
                cv.equalizeHist(gray, gray);
            }
        }

        // Gaussian Blur for noise reduction
        const blurred = new cv.Mat();
        const ksize = blurKsize % 2 === 0 ? blurKsize + 1 : blurKsize;
        if (ksize > 1) {
            const k = new cv.Size(ksize, ksize);
            cv.GaussianBlur(gray, blurred, k, 0, 0, cv.BORDER_DEFAULT);
        } else {
            gray.copyTo(blurred);
        }

        const step1Mat = new cv.Mat();
        cv.cvtColor(blurred, step1Mat, cv.COLOR_GRAY2RGBA);

        // ==========================================
        // STEP 2: Apply Sobel and Canny edge detection
        // ==========================================
        const sobelX = new cv.Mat();
        const sobelY = new cv.Mat();
        const sksize = sobelKsize % 2 === 0 ? sobelKsize + 1 : sobelKsize;
        cv.Sobel(blurred, sobelX, cv.CV_16S, 1, 0, sksize, 1, 0, cv.BORDER_DEFAULT);
        cv.Sobel(blurred, sobelY, cv.CV_16S, 0, 1, sksize, 1, 0, cv.BORDER_DEFAULT);

        const absSobelX = new cv.Mat();
        const absSobelY = new cv.Mat();
        cv.convertScaleAbs(sobelX, absSobelX);
        cv.convertScaleAbs(sobelY, absSobelY);

        const sobelMag = new cv.Mat();
        cv.addWeighted(absSobelX, 0.5, absSobelY, 0.5, 0, sobelMag);
        const step2SobelMat = new cv.Mat();
        cv.cvtColor(sobelMag, step2SobelMat, cv.COLOR_GRAY2RGBA);

        const cannyEdges = new cv.Mat();
        cv.Canny(blurred, cannyEdges, cannyLow, cannyHigh, 3, true);
        const step2CannyMat = new cv.Mat();
        cv.cvtColor(cannyEdges, step2CannyMat, cv.COLOR_GRAY2RGBA);

        let workingEdges = new cv.Mat();
        if (edgeMethod === 'sobel') {
            cv.threshold(sobelMag, workingEdges, cannyLow, 255, cv.THRESH_BINARY);
        } else if (edgeMethod === 'both') {
            cv.bitwise_or(cannyEdges, sobelMag, workingEdges);
        } else {
            cannyEdges.copyTo(workingEdges);
        }

        // Morphological dilation/close to connect broken edge segments
        if (morphDilation > 0) {
            const msize = morphDilation * 2 + 1;
            const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(msize, msize));
            const morphed = new cv.Mat();
            cv.morphologyEx(workingEdges, morphed, cv.MORPH_CLOSE, kernel);
            workingEdges.delete();
            kernel.delete();
            workingEdges = morphed;
        }

        // ==========================================
        // STEP 3: Extract contours & Shape Representation
        // ==========================================
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(workingEdges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const step3ContoursMat = cv.Mat.zeros(origH, origW, cv.CV_8UC4);
        const objectsData = [];
        const validContours = new cv.MatVector();

        const hexClean = boundaryColor.replace('#', '');
        const r = parseInt(hexClean.substring(0, 2), 16) || 0;
        const g = parseInt(hexClean.substring(2, 4), 16) || 229;
        const b = parseInt(hexClean.substring(4, 6), 16) || 255;
        const contourColor = new cv.Scalar(r, g, b, 255);
        const yellowColor = new cv.Scalar(255, 200, 0, 255);
        const redColor = new cv.Scalar(255, 50, 50, 255);

        let objId = 1;
        for (let i = 0; i < contours.size(); ++i) {
            const cnt = contours.get(i);
            const area = cv.contourArea(cnt);

            if (area < minArea || area > maxArea) continue;

            const perimeter = cv.arcLength(cnt, true);
            if (perimeter <= 0) continue;

            validContours.push_back(cnt);

            const circularity = (4.0 * Math.PI * area) / (perimeter * perimeter);
            const epsilon = (approxEpsPct / 100.0) * perimeter;
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, epsilon, true);

            const numVertices = approx.rows;
            const rect = cv.boundingRect(cnt);
            const aspectRatio = rect.height > 0 ? (rect.width / rect.height) : 1;

            const M = cv.moments(cnt);
            let cx = rect.x + Math.floor(rect.width / 2);
            let cy = rect.y + Math.floor(rect.height / 2);
            if (M.m00 !== 0) {
                cx = Math.round(M.m10 / M.m00);
                cy = Math.round(M.m01 / M.m00);
            }

            let shapeType = "Polygon";
            if (circularity >= 0.82) {
                shapeType = "Circle";
            } else if (numVertices === 3) {
                shapeType = "Triangle";
            } else if (numVertices === 4) {
                shapeType = (aspectRatio >= 0.90 && aspectRatio <= 1.10) ? "Square" : "Rectangle";
            } else if (numVertices === 5) {
                shapeType = "Pentagon";
            } else if (numVertices === 6) {
                shapeType = "Hexagon";
            } else if (numVertices >= 7 && numVertices <= 12) {
                shapeType = circularity >= 0.70 ? "Circle/Ellipse" : "Polygon";
            } else {
                shapeType = circularity >= 0.75 ? "Circle/Ellipse" : "Polygon";
            }

            objectsData.push({
                id: objId++,
                shape: shapeType,
                area: Math.round(area * 10) / 10,
                perimeter: Math.round(perimeter * 10) / 10,
                circularity: Math.round(circularity * 1000) / 1000,
                vertices: numVertices,
                bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                aspectRatio: Math.round(aspectRatio * 100) / 100,
                centroid: { x: cx, y: cy }
            });

            cv.drawContours(step3ContoursMat, contours, i, yellowColor, 2);
            cv.circle(step3ContoursMat, new cv.Point(cx, cy), 4, redColor, -1);
            approx.delete();
        }

        // ==========================================
        // STEP 4: Draw Object Boundaries on output
        // ==========================================
        const step4BoundariesMat = src.clone();

        const overlay = src.clone();
        for (let i = 0; i < validContours.size(); ++i) {
            cv.drawContours(overlay, validContours, i, contourColor, -1);
        }
        cv.addWeighted(overlay, 0.15, step4BoundariesMat, 0.85, 0, step4BoundariesMat);
        overlay.delete();

        for (let i = 0; i < validContours.size(); ++i) {
            cv.drawContours(step4BoundariesMat, validContours, i, contourColor, lineThickness);
        }

        objectsData.forEach(obj => {
            const { x, y, w, h } = obj.bbox;
            const { x: cx, y: cy } = obj.centroid;

            if (drawBbox) {
                const p1 = new cv.Point(x, y);
                const p2 = new cv.Point(x + w, y + h);
                cv.rectangle(step4BoundariesMat, p1, p2, yellowColor, 1);
            }

            if (drawCentroids) {
                cv.circle(step4BoundariesMat, new cv.Point(cx, cy), 5, redColor, -1);
                cv.circle(step4BoundariesMat, new cv.Point(cx, cy), 7, new cv.Scalar(255, 255, 255, 255), 1);
            }

            if (drawLabels) {
                const label = `#${obj.id} ${obj.shape}`;
                const labelY = Math.max(y - 6, 16);
                cv.putText(step4BoundariesMat, label, new cv.Point(x + 2, labelY), cv.FONT_HERSHEY_SIMPLEX, 0.45, new cv.Scalar(255, 255, 255, 255), 1);
            }
        });

        const results = {
            success: true,
            summary: {
                totalObjects: objectsData.length,
                imageWidth: origW,
                imageHeight: origH,
                edgeMethod: edgeMethod
            },
            objects: objectsData,
            images: {
                original: this.matToDataUrl(src),
                step1_gray: this.matToDataUrl(step1Mat),
                step2_sobel: this.matToDataUrl(step2SobelMat),
                step2_canny: this.matToDataUrl(step2CannyMat),
                step3_contours: this.matToDataUrl(step3ContoursMat),
                step4_boundaries: this.matToDataUrl(step4BoundariesMat)
            }
        };

        // Cleanup
        src.delete(); gray.delete(); blurred.delete(); step1Mat.delete();
        sobelX.delete(); sobelY.delete(); absSobelX.delete(); absSobelY.delete();
        sobelMag.delete(); step2SobelMat.delete(); cannyEdges.delete(); step2CannyMat.delete();
        workingEdges.delete(); contours.delete(); hierarchy.delete(); validContours.delete();
        step3ContoursMat.delete(); step4BoundariesMat.delete();

        return results;
    }

    matToDataUrl(mat) {
        const canvas = document.createElement('canvas');
        cv.imshow(canvas, mat);
        return canvas.toDataURL('image/png');
    }

    /**
     * Pure JavaScript Computer Vision Engine (Zero Dependencies, Instant, Guaranteed)
     */
    processPureJS(imageElement, options = {}) {
        const {
            blurKsize = 5,
            cannyLow = 50,
            minArea = 150,
            drawBbox = true,
            drawLabels = true,
            drawCentroids = true,
            boundaryColor = '#00e5ff',
            lineThickness = 3
        } = options;

        const w = imageElement.naturalWidth || imageElement.width || 600;
        const h = imageElement.naturalHeight || imageElement.height || 400;

        // Offscreen canvas for original
        const origCanvas = document.createElement('canvas');
        origCanvas.width = w;
        origCanvas.height = h;
        const origCtx = origCanvas.getContext('2d');
        origCtx.drawImage(imageElement, 0, 0, w, h);
        const origImgData = origCtx.getImageData(0, 0, w, h);
        const data = origImgData.data;

        // Step 1: Grayscale & Blur
        const gray = new Uint8ClampedArray(w * h);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }

        // Apply box/Gaussian blur
        const blurred = new Uint8ClampedArray(w * h);
        const radius = Math.max(1, Math.floor(blurKsize / 2));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0, count = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    const ny = y + dy;
                    if (ny >= 0 && ny < h) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            if (nx >= 0 && nx < w) {
                                sum += gray[ny * w + nx];
                                count++;
                            }
                        }
                    }
                }
                blurred[y * w + x] = Math.round(sum / count);
            }
        }

        const step1Canvas = document.createElement('canvas');
        step1Canvas.width = w; step1Canvas.height = h;
        const step1Ctx = step1Canvas.getContext('2d');
        const grayImgData = step1Ctx.createImageData(w, h);
        for (let i = 0; i < blurred.length; i++) {
            const idx = i * 4;
            const val = blurred[i];
            grayImgData.data[idx] = val;
            grayImgData.data[idx + 1] = val;
            grayImgData.data[idx + 2] = val;
            grayImgData.data[idx + 3] = 255;
        }
        step1Ctx.putImageData(grayImgData, 0, 0);

        // Step 2: Sobel Edge Magnitude
        const edgeMag = new Uint8ClampedArray(w * h);
        const edgeThresh = Math.max(25, cannyLow);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const gx = 
                    -1 * blurred[(y - 1) * w + (x - 1)] + 1 * blurred[(y - 1) * w + (x + 1)] +
                    -2 * blurred[y * w + (x - 1)]       + 2 * blurred[y * w + (x + 1)] +
                    -1 * blurred[(y + 1) * w + (x - 1)] + 1 * blurred[(y + 1) * w + (x + 1)];
                const gy = 
                    -1 * blurred[(y - 1) * w + (x - 1)] - 2 * blurred[(y - 1) * w + x] - 1 * blurred[(y - 1) * w + (x + 1)] +
                     1 * blurred[(y + 1) * w + (x - 1)] + 2 * blurred[(y + 1) * w + x] + 1 * blurred[(y + 1) * w + (x + 1)];
                const mag = Math.min(255, Math.hypot(gx, gy));
                edgeMag[y * w + x] = mag > edgeThresh ? 255 : 0;
            }
        }

        const step2Canvas = document.createElement('canvas');
        step2Canvas.width = w; step2Canvas.height = h;
        const step2Ctx = step2Canvas.getContext('2d');
        const edgeImgData = step2Ctx.createImageData(w, h);
        for (let i = 0; i < edgeMag.length; i++) {
            const idx = i * 4;
            const val = edgeMag[i];
            edgeImgData.data[idx] = val;
            edgeImgData.data[idx + 1] = val;
            edgeImgData.data[idx + 2] = val;
            edgeImgData.data[idx + 3] = 255;
        }
        step2Ctx.putImageData(edgeImgData, 0, 0);

        // Step 3: Pure-JS Connected Component & Boundary Extraction
        const visited = new Uint8Array(w * h);
        const objects = [];
        let objId = 1;

        // Step 3 Canvas (Contour map)
        const step3Canvas = document.createElement('canvas');
        step3Canvas.width = w; step3Canvas.height = h;
        const step3Ctx = step3Canvas.getContext('2d');
        step3Ctx.fillStyle = '#090d16';
        step3Ctx.fillRect(0, 0, w, h);

        // Step 4 Canvas (Final Result Overlay)
        const step4Canvas = document.createElement('canvas');
        step4Canvas.width = w; step4Canvas.height = h;
        const step4Ctx = step4Canvas.getContext('2d');
        step4Ctx.drawImage(imageElement, 0, 0, w, h);

        for (let y = 2; y < h - 2; y += 2) {
            for (let x = 2; x < w - 2; x += 2) {
                const idx = y * w + x;
                if (edgeMag[idx] > 0 && !visited[idx]) {
                    // Flood fill to extract object points & boundary
                    const queue = [[x, y]];
                    visited[idx] = 1;
                    const pts = [];
                    let minX = x, maxX = x, minY = y, maxY = y;

                    while (queue.length > 0) {
                        const [cx, cy] = queue.pop();
                        pts.push([cx, cy]);
                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;

                        // Check 8-neighborhood
                        for (let dy = -2; dy <= 2; dy += 2) {
                            for (let dx = -2; dx <= 2; dx += 2) {
                                if (dx === 0 && dy === 0) continue;
                                const nx = cx + dx, ny = cy + dy;
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    const nidx = ny * w + nx;
                                    if (edgeMag[nidx] > 0 && !visited[nidx]) {
                                        visited[nidx] = 1;
                                        queue.push([nx, ny]);
                                    }
                                }
                            }
                        }
                    }

                    const bw = maxX - minX;
                    const bh = maxY - minY;
                    const approxArea = Math.round(pts.length * 4);
                    const approxPerimeter = Math.round((bw + bh) * 2.2);

                    if (approxArea >= minArea && approxArea <= (w * h * 0.90) && bw > 15 && bh > 15) {
                        const cx = Math.round(minX + bw / 2);
                        const cy = Math.round(minY + bh / 2);
                        const circularity = Math.min(1.0, Math.round(((4.0 * Math.PI * approxArea) / (approxPerimeter * approxPerimeter)) * 100) / 100);
                        const aspectRatio = bh > 0 ? Math.round((bw / bh) * 100) / 100 : 1;

                        let shape = "Polygon";
                        if (circularity >= 0.78 && Math.abs(aspectRatio - 1) < 0.2) shape = "Circle";
                        else if (Math.abs(aspectRatio - 1) < 0.15) shape = "Square";
                        else if (aspectRatio > 1.3 || aspectRatio < 0.7) shape = "Rectangle";

                        objects.push({
                            id: objId++,
                            shape: shape,
                            area: approxArea,
                            perimeter: approxPerimeter,
                            circularity: circularity,
                            vertices: Math.min(12, Math.max(3, Math.round(pts.length / 10))),
                            bbox: { x: minX, y: minY, w: bw, h: bh },
                            aspectRatio: aspectRatio,
                            centroid: { x: cx, y: cy }
                        });

                        // Draw on Step 3
                        step3Ctx.strokeStyle = '#ffd700';
                        step3Ctx.lineWidth = 2;
                        step3Ctx.strokeRect(minX, minY, bw, bh);
                        step3Ctx.fillStyle = '#ff3333';
                        step3Ctx.beginPath();
                        step3Ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                        step3Ctx.fill();

                        // Draw on Step 4
                        step4Ctx.strokeStyle = boundaryColor;
                        step4Ctx.lineWidth = lineThickness;
                        step4Ctx.strokeRect(minX, minY, bw, bh);

                        if (drawCentroids) {
                            step4Ctx.fillStyle = '#ff0033';
                            step4Ctx.beginPath();
                            step4Ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                            step4Ctx.fill();
                            step4Ctx.strokeStyle = '#ffffff';
                            step4Ctx.lineWidth = 1;
                            step4Ctx.stroke();
                        }

                        if (drawBbox) {
                            step4Ctx.strokeStyle = '#ffbb00';
                            step4Ctx.lineWidth = 1;
                            step4Ctx.strokeRect(minX - 2, minY - 2, bw + 4, bh + 4);
                        }

                        if (drawLabels) {
                            const label = `#${objId - 1} ${shape}`;
                            step4Ctx.font = 'bold 12px monospace';
                            const tw = step4Ctx.measureText(label).width;
                            const ly = Math.max(minY - 6, 16);
                            step4Ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                            step4Ctx.fillRect(minX, ly - 14, tw + 8, 16);
                            step4Ctx.strokeStyle = boundaryColor;
                            step4Ctx.strokeRect(minX, ly - 14, tw + 8, 16);
                            step4Ctx.fillStyle = '#ffffff';
                            step4Ctx.fillText(label, minX + 4, ly - 2);
                        }
                    }
                }
            }
        }

        return {
            success: true,
            summary: {
                totalObjects: objects.length,
                imageWidth: w,
                imageHeight: h,
                edgeMethod: 'pure-js'
            },
            objects: objects,
            images: {
                original: imageElement.src,
                step1_gray: step1Canvas.toDataURL('image/png'),
                step2_sobel: step2Canvas.toDataURL('image/png'),
                step2_canny: step2Canvas.toDataURL('image/png'),
                step3_contours: step3Canvas.toDataURL('image/png'),
                step4_boundaries: step4Canvas.toDataURL('image/png')
            }
        };
    }
}

window.EdgeDetector = EdgeDetector;
