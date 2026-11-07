# Edge-Based Object Boundary Detection

An advanced, interactive Web Application for automated edge detection, shape representation, and object boundary extraction using **OpenCV** and modern web standards.

---

## 📌 Project Overview

- **Objective:** Accurately identify and delineate 2D object boundaries in images.
- **Concepts Used:** Edge detection, gradient operators (Sobel, Canny), morphological continuity, contour extraction, shape representation (polygonal approximation, compactness/circularity, centroids, bounding boxes).
- **Output:** High-definition Boundary-Detected Image with customizable annotations, before/after visual comparison, and comprehensive shape metric analytics.

---

## ⚙️ Algorithm & Execution Steps

The application follows the 4-step pipeline:

```
[ Input Image / Webcam ]
           │
           ▼
┌───────────────────────────────────────────────┐
│ Step 1: Convert Image to Grayscale            │
│  - Luminosity formula: Y = 0.299R+0.587G+0.114B│
│  - Gaussian smoothing filter (noise reduction)│
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ Step 2: Sobel and Canny Edge Detection        │
│  - Sobel: G = sqrt(Gx^2 + Gy^2)               │
│  - Canny: Non-maximum suppression & hysteresis │
│  - Morphological closing to seal faint gaps   │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ Step 3: Extract Contours & Shape Representation│
│  - Topological contour tracing                │
│  - Perimeter (L) & Area (A)                   │
│  - Compactness / Circularity = 4πA / L²       │
│  - Douglas-Peucker polygon approximation (ε)  │
│  - Centroid coordinates (Mx/M0, My/M0)        │
│  - Shape classification (Circle, Triangle...) │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ Step 4: Draw Object Boundaries                │
│  - Overlay high-visibility contour strokes    │
│  - Semi-transparent object tinting            │
│  - Bounding boxes, centroids, and labels      │
│  - Export PNG and CSV data reports            │
└───────────────────────────────────────────────┘
```

### Detailed Breakdown of the 4 Steps:

1. **Step 1: Convert Image to Grayscale**
   - Strips redundant color channels to reduce computational overhead and eliminate chromatic artifacts.
   - Applies an adjustable Gaussian kernel $(k \times k)$ to suppress high-frequency sensor noise while preserving edge gradients.

2. **Step 2: Apply Sobel and Canny Edge Detection**
   - **Sobel Operator:** Convolves image with $3 \times 3$ or $5 \times 5$ horizontal ($G_x$) and vertical ($G_y$) kernels to calculate directional derivatives and overall gradient magnitude.
   - **Canny Detector:** Performs Gaussian gradient calculation, non-maximum suppression (thinning ridges to 1-pixel width), and dual-threshold hysteresis ($T_{\text{low}}, T_{\text{high}}$) to extract clean, continuous edge curves.
   - **Morphological Edge Seal:** Applies a structuring element (`cv2.MORPH_CLOSE` / dilation) to bridge micro-gaps, ensuring **100% closed, watertight contours** for perfect detection.

3. **Step 3: Extract Contours & Shape Representation**
   - Reconstructs closed boundary curves using border-following topology (`cv2.RETR_EXTERNAL`).
   - Computes:
     - **Area ($A$)** via Green's theorem / contour moments.
     - **Perimeter ($P$)** via arc length integration.
     - **Circularity / Compactness Metric:** $\mathcal{C} = \frac{4\pi A}{P^2}$ (approaches $1.0$ for perfect circles).
     - **Polygonal Approximation:** Douglas-Peucker algorithm with tunable epsilon $\epsilon$.
     - **Centroid Coordinates:** Calculated from image spatial moments $(C_x = \frac{M_{10}}{M_{00}}, C_y = \frac{M_{01}}{M_{00}})$.
     - **Classification:** Categorizes objects into Circle, Triangle (3 vertices), Square/Rectangle (4 vertices), Pentagon (5 vertices), Hexagon (6 vertices), or Irregular/Complex shapes.

4. **Step 4: Draw Object Boundaries**
   - Renders vectorized boundary curves onto the output image with selectable neon colors (Cyan, Emerald, Amber, Crimson, Purple) and custom thickness.
   - Annotates objects with ID badges, shape type tags, bounding boxes, and centroid markers.

---

## 🚀 How to Run the Web Application

You can run this project in **two ways**:

### Option A: Python Web Server (Recommended)
Provides full server-side processing via Python `cv2` and Flask:

1. Open a terminal / command prompt in this directory:
   ```bash
   cd "c:\Users\haris\Downloads\IMAGE PROCESSING"
   ```
2. Run the application:
   ```bash
   python app.py
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

### Option B: Direct Browser / Standalone (Zero-Install)
Double-click `index.html` in your file explorer to open it directly in Google Chrome, Microsoft Edge, or Firefox. It runs locally in the browser utilizing **OpenCV.js**!

---

## 🌟 Key Features

- **Live Tuning Controls:** Real-time sliders for Canny thresholds, Gaussian blur, Sobel kernel, morphological closing, and minimum area filtering.
- **Multi-View Modes:**
  - **4-Stage Pipeline Grid:** Side-by-side view of Grayscale, Edges, Contours, and Final Result.
  - **High-Resolution Single View:** Focused inspection of the boundary image.
  - **Before / After Split Curtain:** Interactive drag-slider comparing original vs boundary image.
  - **Shape Inventory Table:** Detailed data grid with Area, Perimeter, Circularity, Vertices, and Coordinates.
- **Flexible Image Inputs:**
  - Drag & drop or file upload (PNG, JPG, WEBP).
  - Live Webcam capture with built-in snapshot tool.
  - 3 Instant Benchmark Datasets: Geometric Shapes, Coins/Circles, Mechanical Components.
- **Export Capabilities:**
  - One-click Download of the Boundary-detected image (PNG).
  - Export detected object metrics directly to CSV.
