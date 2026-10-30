from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, ImageOps
import numpy as np, cv2, io, base64

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024


# -----------------------------
# 国风风格化工具函数
# -----------------------------
def _fit_image(img: Image.Image) -> np.ndarray:
    img = ImageOps.exif_transpose(img).convert('RGB')
    img.thumbnail((1400, 1400))
    return np.array(img)


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def _soft_levels(x, low=0.0, high=1.0):
    x = (x - low) / max(1e-6, high - low)
    return np.clip(x, 0.0, 1.0)


def _edge_map(gray_u8, t1=48, t2=110, blur_sigma=1.3, intensity=0.16):
    e = cv2.Canny(gray_u8, t1, t2).astype(np.float32) / 255.0
    e = cv2.GaussianBlur(e, (0, 0), blur_sigma)
    return np.clip(e * intensity, 0.0, 1.0)


def _paper_tint(h, w, base=(244, 241, 234), noise=3.0):
    rng = np.random.default_rng(12345)
    paper = np.ones((h, w, 3), np.float32)
    paper[:] = np.array(base, np.float32)
    grain = rng.normal(0.0, noise, size=(h, w)).astype(np.float32)
    grain = cv2.GaussianBlur(grain, (0, 0), 1.0)
    paper += grain[:, :, None]
    return np.clip(paper, 0, 255)


def _desaturate_preserve_tint(rgb, sat_scale=0.12, val_lift=8):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 1] *= sat_scale
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] + val_lift, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)


def _ink_wash(rgb):
    """
    目标：更接近浅墨山水与留白感，避免纯黑硬阈值块。
    视觉特征：浅灰蓝墨色、柔和边界、雾化留白、少量结构线。
    """
    smooth = cv2.bilateralFilter(rgb, 9, 55, 55)
    lab = cv2.cvtColor(smooth, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0].astype(np.float32) / 255.0

    # 柔和明度场：提亮整体，压缩黑位，保留少量墨韵层次
    blur_small = cv2.GaussianBlur(L, (0, 0), 2.2)
    blur_large = cv2.GaussianBlur(L, (0, 0), 9.5)
    detail = np.clip(blur_large - blur_small, -0.18, 0.18)
    tonal = np.clip(blur_large * 1.05 + 0.06 - detail * 0.35, 0.0, 1.0)

    darkness = 1.0 - tonal
    # 压黑位：最深处也不允许变成大片死黑
    darkness = _soft_levels(darkness, 0.08, 0.80)
    darkness = np.power(darkness, 1.55) * 0.58

    # 雾气 / 留白：亮部和中远景做轻微泛白
    mist = cv2.GaussianBlur(1.0 - darkness, (0, 0), 10.5)
    mist = np.clip((mist - 0.48) / 0.52, 0.0, 1.0)
    mist = np.power(mist, 1.4) * 0.18

    # 只保留较强结构边缘，而且边缘强度很低，避免黑边脏块
    gray_u8 = (L * 255).astype(np.uint8)
    edges = _edge_map(gray_u8, 54, 128, blur_sigma=1.6, intensity=0.14)

    ink_strength = np.clip(darkness + edges - mist * 0.45, 0.0, 0.72)

    h, w = L.shape
    paper = _paper_tint(h, w, base=(245, 242, 236), noise=2.2)
    ink = np.array([92, 102, 115], np.float32)  # 灰蓝墨色，接近参考图 2/3
    out = paper * (1.0 - ink_strength[..., None]) + ink * ink_strength[..., None]

    # 叠加极轻微的原图色相，保留少量“江南淡彩”感，但不破坏水墨调性
    tint = _desaturate_preserve_tint(smooth, sat_scale=0.10, val_lift=6)
    color_mask = np.clip(np.power(darkness, 0.85) * 0.55 + 0.08, 0.0, 0.22)
    out = out * (1.0 - color_mask[..., None]) + tint * color_mask[..., None]

    # 再提亮一次，压住最深的黑色
    out = np.clip(out * 1.02 + 6, 0, 255)
    return out.astype(np.uint8)


def _gongbi_light(rgb):
    """工笔：细线更柔和，设色更淡，不做厚重纯黑。"""
    smooth = cv2.bilateralFilter(rgb, 11, 70, 70)
    gray = cv2.cvtColor(smooth, cv2.COLOR_RGB2GRAY)
    edge = cv2.Canny(gray, 50, 120).astype(np.float32) / 255.0
    edge = cv2.GaussianBlur(edge, (0, 0), 0.9)
    edge = np.clip(edge * 0.65, 0.0, 0.55)

    hsv = cv2.cvtColor(smooth, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 1] *= 0.36
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.04 + 10, 0, 255)
    flat = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
    flat = cv2.bilateralFilter(flat.astype(np.uint8), 7, 35, 35).astype(np.float32)

    paper = _paper_tint(*gray.shape, base=(243, 238, 230), noise=1.8)
    out = paper * 0.18 + flat * 0.82
    line = np.array([95, 79, 63], np.float32)  # 淡赭褐工笔线
    out = out * (1.0 - edge[..., None]) + line * edge[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def _jiangnan_pastel(rgb):
    """江南淡彩：偏灰蓝、灰绿色，保留温柔留白。"""
    smooth = cv2.bilateralFilter(rgb, 13, 85, 85)
    hsv = cv2.cvtColor(smooth, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 1] *= 0.30
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.05 + 12, 0, 255)
    pastel = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)

    lab = cv2.cvtColor(pastel.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[:, :, 0] / 255.0
    shadow = 1.0 - _soft_levels(L, 0.20, 0.92)
    shadow = np.power(shadow, 1.35) * 0.34

    paper = _paper_tint(*L.shape, base=(245, 243, 238), noise=1.6)
    cool_ink = np.array([120, 132, 144], np.float32)
    out = pastel * 0.86 + paper * 0.14
    out = out * (1.0 - shadow[..., None]) + cool_ink * shadow[..., None]

    haze = cv2.GaussianBlur(L, (0, 0), 8.0)
    haze = np.clip((haze - 0.50) / 0.50, 0.0, 1.0)
    out = out * (1.0 - 0.10 * haze[..., None]) + paper * (0.10 * haze[..., None])
    return np.clip(out, 0, 255).astype(np.uint8)


def transform(img, style):
    rgb = _fit_image(img)
    if style == 'ink':
        out = _ink_wash(rgb)
    elif style == 'gongbi':
        out = _gongbi_light(rgb)
    elif style == 'pastel':
        out = _jiangnan_pastel(rgb)
    else:
        raise ValueError('Unknown style')
    return Image.fromarray(out)


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/stylize', methods=['POST'])
def stylize():
    try:
        f = request.files.get('image')
        if not f:
            return jsonify(error='请选择图片'), 400
        if f.mimetype not in ('image/png', 'image/jpeg', 'image/webp', 'image/bmp'):
            return jsonify(error='仅支持 PNG/JPEG/WebP/BMP 图片'), 400
        im = Image.open(f.stream)
        im.verify()
        f.stream.seek(0)
        im = Image.open(f.stream)
        out = transform(im, request.form.get('style', 'ink'))
        buf = io.BytesIO()
        out.save(buf, format='PNG')
        return jsonify(image='data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode())
    except Exception as e:
        return jsonify(error=str(e)), 400


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
