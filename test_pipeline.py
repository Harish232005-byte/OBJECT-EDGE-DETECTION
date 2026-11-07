import requests
import json
import base64

def test_local_detect():
    from app import app
    client = app.test_client()

    with open('test_samples/sample_geometric.png', 'rb') as f:
        img_bytes = f.read()

    response = client.post('/api/detect', data={
        'imageData': 'data:image/png;base64,' + base64.b64encode(img_bytes).decode('utf-8'),
        'blurKsize': '5',
        'edgeMethod': 'canny',
        'cannyLow': '50',
        'cannyHigh': '150',
        'sobelKsize': '3',
        'morphDilation': '2',
        'minArea': '150',
        'drawBbox': 'true',
        'drawLabels': 'true',
        'drawCentroids': 'true'
    })

    print("Status code:", response.status_code)
    data = response.get_json()
    if data and data.get('success'):
        print("Success!")
        print("Total Objects Detected:", data['summary']['totalObjects'])
        for obj in data['objects']:
            print(f" - #{obj['id']}: Shape={obj['shape']}, Area={obj['area']} px^2, Perimeter={obj['perimeter']} px, Circularity={obj['circularity']}, Vertices={obj['vertices']}")
    else:
        print("Error response:", data)

if __name__ == '__main__':
    test_local_detect()
