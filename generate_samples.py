"""
Generate benchmark test images for Edge-Based Object Boundary Detection:
1. Geometric shapes (circles, triangles, squares, stars, pentagons)
2. Overlapping / Multi-object scene
3. Coins / Circular tokens
4. Industrial mechanical part / silhouette
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import math
import os

os.makedirs('test_samples', exist_ok=True)

def create_geometric_shapes():
    # 800x600 image with clear colored shapes on contrasting background
    img = Image.new('RGB', (800, 600), color=(245, 247, 250))
    draw = ImageDraw.Draw(img)

    # 1. Circle
    draw.ellipse([60, 80, 220, 240], fill=(66, 133, 244), outline=(20, 70, 180), width=3)
    
    # 2. Rectangle / Square
    draw.rectangle([300, 80, 480, 240], fill=(234, 67, 53), outline=(150, 30, 20), width=3)

    # 3. Triangle
    points_triangle = [(650, 80), (550, 240), (750, 240)]
    draw.polygon(points_triangle, fill=(251, 188, 5), outline=(180, 130, 5), width=3)

    # 4. Pentagon
    cx, cy, r = 140, 430, 80
    pentagon_pts = [
        (cx + r * math.cos(math.radians(i * 72 - 90)),
         cy + r * math.sin(math.radians(i * 72 - 90)))
        for i in range(5)
    ]
    draw.polygon(pentagon_pts, fill=(52, 168, 83), outline=(20, 100, 45), width=3)

    # 5. Star (10 points)
    cx, cy, r_out, r_in = 390, 430, 85, 38
    star_pts = []
    for i in range(10):
        rad = math.radians(i * 36 - 90)
        curr_r = r_out if i % 2 == 0 else r_in
        star_pts.append((cx + curr_r * math.cos(rad), cy + curr_r * math.sin(rad)))
    draw.polygon(star_pts, fill=(155, 89, 182), outline=(100, 50, 120), width=3)

    # 6. Rounded Pill / Ellipse
    draw.ellipse([560, 370, 740, 490], fill=(255, 112, 67), outline=(180, 60, 20), width=3)

    img.save('test_samples/sample_geometric.png')
    print("Created test_samples/sample_geometric.png")

def create_coins_sample():
    img = Image.new('RGB', (800, 600), color=(30, 35, 45))
    draw = ImageDraw.Draw(img)

    coins = [
        (150, 180, 65, (230, 190, 70), (190, 150, 40)),
        (350, 160, 55, (210, 215, 220), (160, 165, 170)),
        (550, 190, 75, (220, 140, 60), (170, 100, 40)),
        (230, 380, 80, (235, 195, 80), (180, 140, 35)),
        (450, 400, 60, (200, 205, 215), (150, 155, 165)),
        (660, 360, 70, (225, 145, 65), (165, 95, 35)),
    ]

    for cx, cy, r, fill_col, border_col in coins:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill_col, outline=border_col, width=4)
        # Inner rim
        draw.ellipse([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], fill=None, outline=border_col, width=2)

    img.save('test_samples/sample_coins.png')
    print("Created test_samples/sample_coins.png")

def create_mechanical_parts():
    img = Image.new('RGB', (800, 600), color=(240, 242, 245))
    draw = ImageDraw.Draw(img)

    # Gear silhouette
    cx, cy = 250, 300
    outer_r, inner_r, teeth = 150, 120, 12
    gear_pts = []
    for i in range(teeth * 2):
        angle = math.radians(i * (360 / (teeth * 2)))
        r = outer_r if (i % 2 == 0) else inner_r
        gear_pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(gear_pts, fill=(70, 80, 95), outline=(30, 40, 50), width=3)
    # Gear center hole
    draw.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], fill=(240, 242, 245), outline=(30, 40, 50), width=3)

    # Hex nut
    cx2, cy2, r2 = 580, 220, 90
    nut_pts = [
        (cx2 + r2 * math.cos(math.radians(i * 60)),
         cy2 + r2 * math.sin(math.radians(i * 60)))
        for i in range(6)
    ]
    draw.polygon(nut_pts, fill=(90, 105, 120), outline=(40, 50, 60), width=3)
    draw.ellipse([cx2 - 40, cy2 - 40, cx2 + 40, cy2 + 40], fill=(240, 242, 245), outline=(40, 50, 60), width=3)

    # Wrench / Spanner outline
    draw.rounded_rectangle([480, 420, 700, 470], radius=15, fill=(110, 125, 140), outline=(50, 60, 70), width=3)
    draw.ellipse([440, 410, 510, 480], fill=(110, 125, 140), outline=(50, 60, 70), width=3)
    draw.rectangle([435, 435, 475, 455], fill=(240, 242, 245))

    img.save('test_samples/sample_mechanical.png')
    print("Created test_samples/sample_mechanical.png")

if __name__ == '__main__':
    create_geometric_shapes()
    create_coins_sample()
    create_mechanical_parts()
