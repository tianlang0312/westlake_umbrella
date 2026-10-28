from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import numpy as np, cv2, io, base64

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024


def transform(img, style):
    img = ImageOps.exif_transpose(img).convert('RGB')
    img.thumbnail((1200, 1200))
    rgb = np.array(img)
    if style == 'ink':
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        smooth = cv2.bilateralFilter(gray, 9, 60, 60)
        edges = cv2.adaptiveThreshold(smooth, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 4)
        wash = cv2.GaussianBlur(gray, (0,0), 2.5)
        tone = np.clip(wash.astype(np.float32)*1.17+17, 0, 255).astype(np.uint8)
        out = np.minimum(tone, edges)
        paper = np.array([239,231,211],dtype=np.float32)
        rgb = np.clip(out[...,None]/255 * paper,0,255).astype('uint8')
    elif style == 'gongbi':
        smooth = cv2.bilateralFilter(rgb, 11, 65, 65)
        gray = cv2.cvtColor(smooth, cv2.COLOR_RGB2GRAY)
        edge = cv2.Canny(gray, 65, 140)
        edge = cv2.dilate(edge, np.ones((2,2),np.uint8),iterations=1)
        toned = np.clip(smooth.astype(np.float32)*.72+np.array([62,55,42]),0,255)
        toned[edge>0] *= .32
        rgb=toned.astype('uint8')
    elif style == 'pastel':
        smooth=cv2.bilateralFilter(rgb, 13, 90, 90)
        hsv=cv2.cvtColor(smooth,cv2.COLOR_RGB2HSV)
        hsv[:,:,1]=(hsv[:,:,1].astype(np.float32)*.56).astype('uint8')
        rgb=cv2.cvtColor(hsv,cv2.COLOR_HSV2RGB)
        rgb=np.clip(rgb.astype(np.float32)*.83+np.array([39,35,28]),0,255).astype('uint8')
    else:
        raise ValueError('Unknown style')
    return Image.fromarray(rgb)

@app.route('/')
def index(): return send_from_directory('static','index.html')

@app.route('/api/stylize',methods=['POST'])
def stylize():
    try:
        f=request.files.get('image')
        if not f: return jsonify(error='请选择图片'),400
        if f.mimetype not in ('image/png','image/jpeg','image/webp','image/bmp'):
            return jsonify(error='仅支持 PNG/JPEG/WebP/BMP 图片'),400
        im=Image.open(f.stream)
        im.verify()
        f.stream.seek(0)
        im=Image.open(f.stream)
        out=transform(im,request.form.get('style','ink'))
        buf=io.BytesIO();out.save(buf,format='PNG')
        return jsonify(image='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode())
    except Exception as e:
        return jsonify(error=str(e)),400

if __name__=='__main__':
    app.run(host='127.0.0.1',port=5000,debug=False)
