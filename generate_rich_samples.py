"""
Generate a rich set of high quality example images with clean contrast for perfect object boundary detection:
1. sample_motorcycle.png
2. sample_supercar.png
3. sample_airplane.png
4. sample_apple.png
5. sample_coffee.png
6. sample_smartwatch.png
7. sample_geometric.png (existing)
8. sample_coins.png (existing)
9. sample_mechanical.png (existing)
"""
import os
import math
import numpy as np
from PIL import Image, ImageDraw

os.makedirs('test_samples', exist_ok=True)

def generate_supercar():
    img = Image.new('RGB', (800, 500), color=(240, 243, 248))
    draw = ImageDraw.Draw(img)

    # Ground / road shadow
    draw.ellipse([100, 360, 700, 420], fill=(200, 205, 215))

    # Car body aerodynamic curve
    body_pts = [
        (120, 340), (140, 310), (180, 290), (280, 250), (370, 200),
        (520, 200), (620, 260), (700, 300), (720, 340), (670, 350),
        (580, 350), (520, 310), (450, 350), (280, 350), (220, 310), (150, 350)
    ]
    draw.polygon(body_pts, fill=(220, 38, 38), outline=(150, 20, 20), width=3)

    # Cabin & Windshield
    cabin_pts = [(300, 250), (380, 210), (510, 210), (590, 260), (450, 260)]
    draw.polygon(cabin_pts, fill=(30, 41, 59), outline=(15, 23, 42), width=2)
    # Side window
    window_pts = [(390, 218), (495, 218), (560, 255), (390, 255)]
    draw.polygon(window_pts, fill=(100, 116, 139), outline=(15, 23, 42), width=2)

    # Spoiler
    draw.rectangle([650, 260, 720, 275], fill=(30, 41, 59), outline=(15, 23, 42), width=2)
    draw.rectangle([680, 275, 695, 300], fill=(30, 41, 59))

    # Front wheel
    draw.ellipse([170, 300, 260, 390], fill=(20, 25, 35), outline=(10, 10, 15), width=4)
    draw.ellipse([195, 325, 235, 365], fill=(200, 205, 215), outline=(100, 110, 120), width=2)

    # Rear wheel
    draw.ellipse([530, 300, 620, 390], fill=(20, 25, 35), outline=(10, 10, 15), width=4)
    draw.ellipse([555, 325, 595, 365], fill=(200, 205, 215), outline=(100, 110, 120), width=2)

    # Headlight & Taillight
    draw.polygon([(130, 320), (160, 310), (150, 330)], fill=(255, 255, 200), outline=(200, 200, 100))
    draw.rectangle([705, 315, 715, 335], fill=(255, 50, 50))

    img.save('test_samples/sample_supercar.png')
    print("Created sample_supercar.png")

def generate_motorcycle():
    img = Image.new('RGB', (800, 500), color=(245, 247, 250))
    draw = ImageDraw.Draw(img)

    # Ground shadow
    draw.ellipse([100, 380, 700, 440], fill=(210, 215, 225))

    # Rear wheel
    draw.ellipse([120, 260, 280, 420], fill=(30, 35, 45), outline=(10, 15, 20), width=6)
    draw.ellipse([160, 300, 240, 380], fill=(245, 247, 250), outline=(100, 105, 115), width=3)

    # Front wheel
    draw.ellipse([520, 260, 680, 420], fill=(30, 35, 45), outline=(10, 15, 20), width=6)
    draw.ellipse([560, 300, 640, 380], fill=(245, 247, 250), outline=(100, 105, 115), width=3)

    # Frame & Engine (Dark metal)
    draw.polygon([(200, 340), (320, 350), (420, 320), (380, 240), (280, 260)], fill=(70, 75, 85), outline=(20, 25, 30), width=3)

    # Fairing & Gas Tank (Bright Blue / White sporty)
    tank_pts = [(300, 240), (370, 190), (450, 185), (490, 230), (430, 270), (350, 270)]
    draw.polygon(tank_pts, fill=(37, 99, 235), outline=(20, 50, 150), width=3)

    # Front Cowling & Windshield
    cowling_pts = [(450, 185), (530, 150), (560, 180), (520, 240), (470, 230)]
    draw.polygon(cowling_pts, fill=(37, 99, 235), outline=(20, 50, 150), width=3)
    draw.polygon([(500, 160), (535, 120), (565, 160), (530, 175)], fill=(15, 23, 42), outline=(10, 10, 10), width=2)

    # Seat & Tail section
    tail_pts = [(220, 240), (310, 240), (330, 260), (200, 270)]
    draw.polygon(tail_pts, fill=(220, 38, 38), outline=(150, 20, 20), width=3)
    draw.rectangle([250, 230, 320, 245], fill=(20, 20, 20)) # rider seat

    # Exhaust pipe
    draw.polygon([(260, 340), (170, 310), (160, 330), (270, 370)], fill=(180, 190, 200), outline=(80, 85, 95), width=2)

    # Front fork
    draw.line([(530, 180), (600, 340)], fill=(160, 165, 175), width=8)

    img.save('test_samples/sample_motorcycle.png')
    print("Created sample_motorcycle.png")

def generate_airplane():
    img = Image.new('RGB', (800, 500), color=(235, 240, 248))
    draw = ImageDraw.Draw(img)

    # Fuselage (Body)
    fuse_pts = [
        (120, 240), (140, 225), (250, 220), (600, 220), (700, 235),
        (720, 250), (690, 260), (550, 265), (200, 265), (130, 255)
    ]
    draw.polygon(fuse_pts, fill=(245, 245, 250), outline=(50, 60, 75), width=3)

    # Main Wings
    wing_pts = [(360, 235), (460, 80), (510, 80), (450, 245)]
    draw.polygon(wing_pts, fill=(59, 130, 246), outline=(30, 60, 120), width=3)

    wing_bot_pts = [(380, 255), (470, 390), (520, 390), (460, 255)]
    draw.polygon(wing_bot_pts, fill=(37, 99, 235), outline=(30, 60, 120), width=3)

    # Tail fin (Vertical Stabilizer)
    tail_pts = [(130, 230), (180, 120), (220, 120), (220, 222)]
    draw.polygon(tail_pts, fill=(239, 68, 68), outline=(150, 20, 20), width=3)

    # Tail wings (Horizontal Stabilizers)
    draw.polygon([(140, 240), (170, 200), (200, 200), (180, 242)], fill=(59, 130, 246), outline=(30, 60, 120), width=2)
    draw.polygon([(140, 250), (170, 280), (200, 280), (180, 252)], fill=(37, 99, 235), outline=(30, 60, 120), width=2)

    # Cockpit windows
    draw.polygon([(670, 232), (695, 238), (690, 245), (665, 240)], fill=(15, 23, 42))

    # Engine turbines under wings
    draw.rounded_rectangle([420, 170, 480, 195], radius=6, fill=(100, 116, 139), outline=(50, 60, 70), width=2)
    draw.rounded_rectangle([430, 295, 490, 320], radius=6, fill=(100, 116, 139), outline=(50, 60, 70), width=2)

    img.save('test_samples/sample_airplane.png')
    print("Created sample_airplane.png")

def generate_apple():
    img = Image.new('RGB', (800, 500), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Shadow
    draw.ellipse([300, 390, 500, 440], fill=(220, 225, 235))

    # Apple lobes
    draw.ellipse([310, 180, 450, 410], fill=(220, 38, 38), outline=(140, 20, 20), width=4)
    draw.ellipse([350, 180, 490, 410], fill=(239, 68, 68), outline=(140, 20, 20), width=4)

    # Stem
    draw.rectangle([395, 120, 405, 190], fill=(101, 67, 33), outline=(60, 40, 20), width=1)

    # Leaf
    draw.ellipse([400, 110, 460, 150], fill=(34, 197, 94), outline=(20, 100, 45), width=3)

    img.save('test_samples/sample_apple.png')
    print("Created sample_apple.png")

def generate_coffee():
    img = Image.new('RGB', (800, 500), color=(245, 247, 250))
    draw = ImageDraw.Draw(img)

    # Saucer / Plate
    draw.ellipse([250, 370, 550, 430], fill=(210, 215, 225), outline=(100, 110, 125), width=3)
    draw.ellipse([280, 380, 520, 420], fill=(240, 242, 248), outline=(140, 150, 165), width=2)

    # Mug Body
    draw.polygon([(300, 220), (320, 390), (480, 390), (500, 220)], fill=(16, 185, 129), outline=(5, 100, 65), width=4)

    # Mug Top Opening
    draw.ellipse([300, 200, 500, 240], fill=(78, 52, 46), outline=(5, 100, 65), width=3)

    # Handle
    draw.ellipse([460, 240, 540, 350], fill=None, outline=(5, 100, 65), width=12)

    img.save('test_samples/sample_coffee.png')
    print("Created sample_coffee.png")

def generate_smartwatch():
    img = Image.new('RGB', (800, 500), color=(240, 243, 248))
    draw = ImageDraw.Draw(img)

    # Straps
    draw.rounded_rectangle([360, 60, 440, 200], radius=8, fill=(30, 41, 59), outline=(15, 23, 42), width=3)
    draw.rounded_rectangle([360, 300, 440, 440], radius=8, fill=(30, 41, 59), outline=(15, 23, 42), width=3)

    # Watch Case
    draw.rounded_rectangle([320, 160, 480, 340], radius=24, fill=(15, 23, 42), outline=(100, 116, 139), width=5)

    # Watch Screen
    draw.rounded_rectangle([335, 175, 465, 325], radius=16, fill=(2, 6, 23), outline=(30, 41, 59), width=2)

    # Dial graphic
    draw.ellipse([360, 210, 440, 290], fill=None, outline=(0, 229, 255), width=3)
    draw.ellipse([385, 235, 415, 265], fill=(0, 229, 255))

    # Crown button
    draw.rectangle([480, 220, 492, 260], fill=(148, 163, 184), outline=(15, 23, 42), width=2)

    img.save('test_samples/sample_smartwatch.png')
    print("Created sample_smartwatch.png")

if __name__ == '__main__':
    generate_supercar()
    generate_motorcycle()
    generate_airplane()
    generate_apple()
    generate_coffee()
    generate_smartwatch()
