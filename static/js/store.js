// 全局共享状态：伞面纹理画布、作品信息、制伞进度
export const store = {
  workName: '我的油纸伞',
  patternImg: null,      // 用户上传/生成的图案
  scale: 100,
  rotate: 0,
  stepsDone: { zhu: false, gu: false, zhuang: false, hu: false, hui: false, you: false },
};

export const texCanvas = document.createElement('canvas');
texCanvas.width = texCanvas.height = 1024;
export const texCtx = texCanvas.getContext('2d');

const PALETTE = { paper: '#e9e2d2', ink: '#334a48', sage: '#86a59a' };

// 重绘伞面纹理（底纸 + 图案 + 伞骨放射线 + 外圈）
export function drawTexture() {
  const ctx = texCtx;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.save();
  ctx.beginPath();
  ctx.arc(512, 512, 490, 0, Math.PI * 2);
  ctx.clip();
  if (store.patternImg) {
    const s = store.scale / 100;
    const rot = store.rotate * Math.PI / 180;
    ctx.translate(512, 512);
    ctx.rotate(rot);
    const img = store.patternImg;
    const ratio = Math.max(980 / img.width, 980 / img.height) * s;
    ctx.drawImage(img, -img.width * ratio / 2, -img.height * ratio / 2, img.width * ratio, img.height * ratio);
  } else {
    // 默认：烟雨落叶纹
    ctx.fillStyle = PALETTE.sage;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.ellipse(512 + Math.sin(i * 1.7) * 300, 512 + Math.cos(i * 1.7) * 300, 80, 35, i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // 伞骨放射线
  ctx.strokeStyle = '#334a4840';
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(512, 512);
    ctx.lineTo(512 + 490 * Math.cos(a), 512 + 490 * Math.sin(a));
    ctx.stroke();
  }
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(512, 512, 490, 0, Math.PI * 2);
  ctx.stroke();
}

export const SCENES = [
  ['断桥残雪', '冬日雪后，断桥向阳桥面雪融，远望桥似断非断。'],
  ['苏堤春晓', '春日苏堤六桥烟柳，晨曦初露，湖山如画。'],
  ['曲院风荷', '夏日荷风送香，曲桥回转，步步生莲。'],
  ['平湖秋月', '秋夜湖平如镜，月光如水，水天一色。'],
  ['雷峰夕照', '夕阳西下，雷峰塔影镀金装，倒映湖面。'],
  ['双峰插云', '南北高峰云雾缭绕，双峰时隐时现。'],
  ['南屏晚钟', '净慈寺暮钟回荡，声震湖山之间。'],
  ['三潭印月', '月夜三塔点灯，塔影月影相映成趣。'],
  ['花港观鱼', '花港池鱼嬉戏，落英缤纷，鱼乐人亦乐。'],
  ['柳浪闻莺', '沿湖垂柳如浪，黄莺啼鸣其间。'],
];

export const PROVERBS = [
  '伞下江南，一蓑烟雨任平生。',
  '开合之间，自有天地。',
  '纸伞不惧雨，桐油护千年。',
  '一伞撑起，便是整个江南。',
  '伞骨七十二，工序见匠心。',
];

export function randomProverb() {
  return PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
}
