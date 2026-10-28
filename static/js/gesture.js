// MediaPipe Hands 手势识别：张掌/握拳/手掌移动/手腕转动，带连续帧防抖
export class GestureController {
  /**
   * @param {Object} cbs { onOpen, onFist, onMove(dx,dy), onTurn(dir), onStatus(msg), onFrame(landmarks) }
   */
  constructor(video, cbs) {
    this.video = video;
    this.cbs = cbs;
    this.running = false;
    this.hands = null;
    this.stream = null;
    this._stable = 0;
    this._lastType = '';
    this._lastPalm = null;
    this._lastAngle = null;
  }

  async start() {
    if (this.running) return;
    const status = this.cbs.onStatus || (() => { });
    status('加载手势模型中（首次需要联网）……');
    if (!window.Hands) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('MediaPipe 加载失败'));
        document.head.appendChild(s);
      });
    }
    this.hands = new window.Hands({ locateFile: f => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + f });
    this.hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: .65, minTrackingConfidence: .6 });
    this.hands.onResults(r => this._onResults(r));

    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    status('手势识别已开启');
    const loop = async () => {
      if (!this.running) return;
      try {
        if (this.video.readyState >= 2) await this.hands.send({ image: this.video });
      } catch (e) {
        status('手势识别错误：' + e.message);
      }
      if (this.running) requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.video.srcObject = null;
  }

  _onResults(results) {
    const lm = results.multiHandLandmarks?.[0];
    if (!lm) {
      this._stable = 0; this._lastPalm = null; this._lastAngle = null;
      this.cbs.onFrame && this.cbs.onFrame(null);
      return;
    }
    this.cbs.onFrame && this.cbs.onFrame(lm);
    const wrist = lm[0];
    const d = p => Math.hypot(p.x - wrist.x, p.y - wrist.y);
    const extended = [8, 12, 16, 20].filter((tip, i) => d(lm[tip]) > d(lm[[6, 10, 14, 18][i]]) * 1.12).length;
    const type = extended >= 3 ? 'open' : extended <= 1 ? 'fist' : 'other';

    // 连续 5 帧防抖
    this._stable = type === this._lastType ? this._stable + 1 : 0;
    this._lastType = type;
    if (this._stable === 5) {
      if (type === 'open') this.cbs.onOpen && this.cbs.onOpen();
      else if (type === 'fist') this.cbs.onFist && this.cbs.onFist();
    }

    const palm = lm[9];
    if (this._lastPalm && type === 'open') {
      this.cbs.onMove && this.cbs.onMove(this._lastPalm.x - palm.x, palm.y - this._lastPalm.y);
    }
    this._lastPalm = { x: palm.x, y: palm.y };

    // 手腕转动：食指-小指连线倾角变化
    const ang = Math.atan2(lm[20].y - lm[8].y, lm[20].x - lm[8].x);
    if (this._lastAngle !== null && type === 'open') {
      let da = ang - this._lastAngle;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > .02) this.cbs.onTurn && this.cbs.onTurn(da);
    }
    this._lastAngle = ang;
  }
}
