import base64
from app import app

def test_samples():
    client = app.test_client()
    for name in ['sample_coins.png', 'sample_mechanical.png']:
        with open('test_samples/' + name, 'rb') as f:
            img_bytes = f.read()
        res = client.post('/api/detect', data={
            'imageData': 'data:image/png;base64,' + base64.b64encode(img_bytes).decode('utf-8'),
            'blurKsize': '5', 'cannyLow': '40', 'cannyHigh': '120', 'morphDilation': '2', 'minArea': '200'
        })
        data = res.get_json()
        print(name, '-> Total detected objects:', data['summary']['totalObjects'])
        for obj in data['objects']:
            print(f"   * #{obj['id']} {obj['shape']} (Area: {obj['area']} px^2)")

if __name__ == '__main__':
    test_samples()
