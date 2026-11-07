import os
import cv2
import numpy as np
import base64
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

def encode_img_to_base64(img_bgr):
    """Encodes an OpenCV image to base64 JPEG string"""
    _, buffer = cv2.imencode('.png', img_bgr)
    return 'data:image/png;base64,' + base64.b64encode(buffer).decode('utf-8')

def classify_shape(contour, approx, circularity):
    """
    Classify shape based on polygon approximation and circularity:
    - 3 vertices: Triangle
    - 4 vertices: Square or Rectangle based on aspect ratio
    - 5 vertices: Pentagon
    - 6 vertices: Hexagon
    - High circularity (>= 0.78): Circle
    - Others: Star or Polygon or Complex
    """
    num_vertices = len(approx)
    
    if circularity >= 0.82:
        return "Circle"
    
    if num_vertices == 3:
        return "Triangle"
    elif num_vertices == 4:
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = float(w) / h if h > 0 else 1.0
        if 0.90 <= aspect_ratio <= 1.10:
            return "Square"
        else:
            return "Rectangle"
    elif num_vertices == 5:
        return "Pentagon"
    elif num_vertices == 6:
        return "Hexagon"
    elif 7 <= num_vertices <= 12:
        # Check if it could be a star or circle
        if circularity >= 0.70:
            return "Circle/Ellipse"
        return "Polygon"
    else:
        if circularity >= 0.75:
            return "Circle/Ellipse"
        return "Complex / Irregular"

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'ok', 'engine': 'python_opencv', 'version': cv2.__version__})

@app.route('/test_samples/<path:filename>')
def serve_sample(filename):
    return send_from_directory('test_samples', filename)

@app.route('/api/detect', methods=['POST'])
def detect_boundaries():
    try:
        # 1. Parse Image Input
        file = request.files.get('image')
        image_data = request.form.get('imageData')

        if file:
            npimg = np.frombuffer(file.read(), np.uint8)
            img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        elif image_data:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            img_bytes = base64.b64decode(image_data)
            npimg = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        else:
            # Fallback to default sample
            sample_path = 'test_samples/sample_geometric.png'
            if os.path.exists(sample_path):
                img = cv2.imread(sample_path)
            else:
                return jsonify({'error': 'No image provided'}), 400

        if img is None:
            return jsonify({'error': 'Invalid image data'}), 400

        # Read Parameters
        blur_ksize = int(request.form.get('blurKsize', 5))
        if blur_ksize % 2 == 0:
            blur_ksize += 1
        
        enable_clahe = request.form.get('enableClahe', 'false').lower() == 'true'
        edge_method = request.form.get('edgeMethod', 'canny')  # 'canny', 'sobel', 'both'
        canny_low = int(request.form.get('cannyLow', 50))
        canny_high = int(request.form.get('cannyHigh', 150))
        sobel_ksize = int(request.form.get('sobelKsize', 3))
        if sobel_ksize % 2 == 0:
            sobel_ksize += 1
            
        morph_size = int(request.form.get('morphDilation', 2))
        min_area = float(request.form.get('minArea', 150))
        max_area_pct = float(request.form.get('maxAreaPct', 98))
        approx_eps_pct = float(request.form.get('approxEpsPct', 2.0)) / 100.0
        
        draw_bbox = request.form.get('drawBbox', 'true').lower() == 'true'
        draw_labels = request.form.get('drawLabels', 'true').lower() == 'true'
        draw_centroids = request.form.get('drawCentroids', 'true').lower() == 'true'
        color_hex = request.form.get('boundaryColor', '#00e5ff')
        line_thickness = int(request.form.get('lineThickness', 3))

        # Parse Hex Color to BGR
        color_hex = color_hex.lstrip('#')
        if len(color_hex) == 6:
            r = int(color_hex[0:2], 16)
            g = int(color_hex[2:4], 16)
            b = int(color_hex[4:6], 16)
            boundary_bgr = (b, g, r)
        else:
            boundary_bgr = (255, 229, 0) # default cyan/teal in BGR

        # Normalize image size for consistent kernel scaling & fast processing
        orig_h, orig_w = img.shape[:2]
        max_dim = 850
        if max(orig_h, orig_w) > max_dim:
            scale = max_dim / float(max(orig_h, orig_w))
            img = cv2.resize(img, (int(orig_w * scale), int(orig_h * scale)), interpolation=cv2.INTER_AREA)
            orig_h, orig_w = img.shape[:2]

        total_img_area = orig_h * orig_w
        max_area = total_img_area * (max_area_pct / 100.0)

        # ==========================================
        # STEP 1: Convert image to grayscale & Preprocessing
        # ==========================================
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Adaptive Contrast Enhancement (CLAHE) - lifts shadows and reveals faint boundaries
        if enable_clahe:
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)

        # Noise reduction pre-filter for clean edge gradient
        if blur_ksize > 1:
            blurred = cv2.GaussianBlur(gray, (blur_ksize, blur_ksize), 0)
        else:
            blurred = gray.copy()
            
        step1_gray_bgr = cv2.cvtColor(blurred, cv2.COLOR_GRAY2BGR)

        # ==========================================
        # STEP 2: Apply Sobel and Canny edge detection
        # ==========================================
        # 2a. Sobel Edge Detection
        sobel_x = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=sobel_ksize)
        sobel_y = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=sobel_ksize)
        sobel_mag = cv2.magnitude(sobel_x, sobel_y)
        sobel_8u = cv2.convertScaleAbs(sobel_mag)
        step2_sobel_bgr = cv2.cvtColor(sobel_8u, cv2.COLOR_GRAY2BGR)

        # 2b. Canny Edge Detection
        canny_edges = cv2.Canny(blurred, canny_low, canny_high, L2gradient=True)
        step2_canny_bgr = cv2.cvtColor(canny_edges, cv2.COLOR_GRAY2BGR)

        # Select edge map for contour extraction
        if edge_method == 'sobel':
            _, binary_edges = cv2.threshold(sobel_8u, canny_low, 255, cv2.THRESH_BINARY)
        elif edge_method == 'both':
            binary_edges = cv2.bitwise_or(canny_edges, sobel_8u)
        else:
            binary_edges = canny_edges.copy()

        # Clear outer image border frame (3px) to prevent borders from merging with background texture
        bm = 3
        binary_edges[:bm, :] = 0
        binary_edges[-bm:, :] = 0
        binary_edges[:, :bm] = 0
        binary_edges[:, -bm:] = 0

        # Connect fragmented edges with morphological closing/dilation
        if morph_size > 0:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (morph_size * 2 + 1, morph_size * 2 + 1))
            edges_connected = cv2.morphologyEx(binary_edges, cv2.MORPH_CLOSE, kernel)
        else:
            edges_connected = binary_edges

        # ==========================================
        # STEP 3: Extract Contours & Shape Representation
        # ==========================================
        contours, hierarchy = cv2.findContours(edges_connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # If zero closed contours found due to open/faint edges, apply adaptive bridge fallback
        valid_cnts = [c for c in contours if min_area <= cv2.contourArea(c) <= max_area]
        if len(valid_cnts) == 0:
            bridge_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
            edges_bridged = cv2.morphologyEx(binary_edges, cv2.MORPH_CLOSE, bridge_kernel)
            contours, hierarchy = cv2.findContours(edges_bridged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        objects_data = []
        filtered_contours = []
        
        # Intermediate contour visual canvas
        step3_contours_bgr = np.zeros_like(img)

        obj_id = 1
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue

            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue

            filtered_contours.append(cnt)

            # Shape representation metrics
            circularity = (4.0 * np.pi * area) / (perimeter * perimeter)
            epsilon = approx_eps_pct * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            # Bounding box
            bx, by, bw, bh = cv2.boundingRect(cnt)
            aspect_ratio = round(float(bw) / bh, 2) if bh > 0 else 1.0

            # Moments & Centroid
            M = cv2.moments(cnt)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
            else:
                cx, cy = bx + bw // 2, by + bh // 2

            # Shape classification
            shape_type = classify_shape(cnt, approx, circularity)

            objects_data.append({
                'id': obj_id,
                'shape': shape_type,
                'area': round(area, 1),
                'perimeter': round(perimeter, 1),
                'circularity': round(circularity, 3),
                'vertices': len(approx),
                'bbox': {'x': bx, 'y': by, 'w': bw, 'h': bh},
                'aspectRatio': aspect_ratio,
                'centroid': {'x': cx, 'y': cy}
            })

            # Draw onto Step 3 debug contour map
            cv2.drawContours(step3_contours_bgr, [cnt], -1, (0, 255, 255), 2)
            cv2.circle(step3_contours_bgr, (cx, cy), 4, (0, 0, 255), -1)
            obj_id += 1

        # ==========================================
        # STEP 4: Draw Object Boundaries on Result Image
        # ==========================================
        step4_boundaries_bgr = img.copy()

        # Draw semi-transparent fill if desired
        overlay = step4_boundaries_bgr.copy()
        cv2.drawContours(overlay, filtered_contours, -1, boundary_bgr, -1)
        cv2.addWeighted(overlay, 0.15, step4_boundaries_bgr, 0.85, 0, step4_boundaries_bgr)

        # Draw crisp object boundaries
        cv2.drawContours(step4_boundaries_bgr, filtered_contours, -1, boundary_bgr, line_thickness)

        # Annotate with shape representation overlays
        for obj in objects_data:
            cx, cy = obj['centroid']['x'], obj['centroid']['y']
            bx, by, bw, bh = obj['bbox']['x'], obj['bbox']['y'], obj['bbox']['w'], obj['bbox']['h']

            # 4a. Centroid
            if draw_centroids:
                cv2.circle(step4_boundaries_bgr, (cx, cy), 5, (0, 0, 255), -1)
                cv2.circle(step4_boundaries_bgr, (cx, cy), 7, (255, 255, 255), 1)

            # 4b. Bounding Box
            if draw_bbox:
                cv2.rectangle(step4_boundaries_bgr, (bx, by), (bx + bw, by + bh), (255, 180, 0), 1, cv2.LINE_AA)

            # 4c. Labels (Shape Name + ID)
            if draw_labels:
                label = f"#{obj['id']} {obj['shape']}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.5
                thickness = 1
                (label_w, label_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
                
                label_y = max(by - 6, label_h + 4)
                # Background tag
                cv2.rectangle(step4_boundaries_bgr, (bx, label_y - label_h - 4), (bx + label_w + 6, label_y + 2), (20, 24, 33), -1)
                cv2.rectangle(step4_boundaries_bgr, (bx, label_y - label_h - 4), (bx + label_w + 6, label_y + 2), boundary_bgr, 1)
                cv2.putText(step4_boundaries_bgr, label, (bx + 3, label_y - 2), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

        # Prepare Response
        return jsonify({
            'success': True,
            'summary': {
                'totalObjects': len(objects_data),
                'imageWidth': orig_w,
                'imageHeight': orig_h,
                'edgeMethod': edge_method
            },
            'objects': objects_data,
            'images': {
                'original': encode_img_to_base64(img),
                'step1_gray': encode_img_to_base64(step1_gray_bgr),
                'step2_sobel': encode_img_to_base64(step2_sobel_bgr),
                'step2_canny': encode_img_to_base64(step2_canny_bgr),
                'step3_contours': encode_img_to_base64(step3_contours_bgr),
                'step4_boundaries': encode_img_to_base64(step4_boundaries_bgr)
            }
        })

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

if __name__ == '__main__':
    print("Starting Edge-Based Object Boundary Detection Web Server on http://localhost:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)
