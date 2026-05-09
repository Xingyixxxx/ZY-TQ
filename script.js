// ===================================================================
// 三枚铜钱起卦 — 主逻辑
// ===================================================================

// 状态枚举
const STATES = {
    IDLE: 'idle',
    TOSSING: 'tossing',
    RECORDING: 'recording',
    WAITING_NEXT: 'waitingNext',
    GENERATING: 'generatingHexagram',
    SHOWING: 'showingHexagram',
    FADING: 'fadingHexagram',
    INTERPRETING: 'showingInterpretation'
};

let currentState = STATES.IDLE;
let tossCount = 0;
const MAX_TOSS = 6;
let linesData = []; // 保存每一爻的数据

// DOM 元素
const tossBtn = document.getElementById('toss-btn');
const progressText = document.getElementById('progress-text');
const statusText = document.getElementById('status-text');
const linesRecord = document.getElementById('lines-record');
const mainArea = document.getElementById('main-area');
const resultArea = document.getElementById('result-area');
const resetBtn = document.getElementById('reset-btn');
const progressFill = document.getElementById('progress-fill');

// ===================================================================
// 背景粒子系统
// ===================================================================
function initParticles() {
    const canvas = document.getElementById('bg-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const PARTICLE_COUNT = 40;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -Math.random() * 0.4 - 0.1,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.3 + 0.05,
            life: Math.random() * 200 + 100,
            maxLife: 300
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0 || p.y < -10) {
                p.x = Math.random() * canvas.width;
                p.y = canvas.height + 10;
                p.life = Math.random() * 200 + 100;
                p.opacity = Math.random() * 0.3 + 0.05;
            }

            const fadeRatio = Math.min(p.life / 50, 1);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(212, 169, 74, ${p.opacity * fadeRatio})`;
            ctx.fill();
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// ===================================================================
// 初始化
// ===================================================================
function init() {
    tossBtn.addEventListener('click', handleToss);
    resetBtn.addEventListener('click', resetApp);
    initParticles();
    resetApp();
}

// 重置应用
function resetApp() {
    currentState = STATES.IDLE;
    tossCount = 0;
    linesData = [];

    tossBtn.disabled = false;
    tossBtn.querySelector('.btn-text').textContent = '开始起卦';
    tossBtn.querySelector('.btn-icon').textContent = '☰';
    progressText.innerHTML = `第 <span class="progress-current">0</span> / <span class="progress-total">${MAX_TOSS}</span> 爻`;
    statusText.textContent = "准备就绪，请点击开始起卦";
    linesRecord.innerHTML = '';
    progressFill.style.width = '0%';

    // 隐藏结果区，显示主要区
    mainArea.classList.remove('hidden');
    resultArea.classList.add('hidden');

    // 重置结果区状态
    document.getElementById('hexagram-visual').classList.remove('fading');
    document.getElementById('interpretation-box').classList.add('hidden');
    document.getElementById('interpretation-box').classList.remove('show');

    // 重置硬币状态
    const coins = document.querySelectorAll('.coin');
    coins.forEach(coin => {
        coin.style.transform = `rotateX(0deg) rotateY(0deg)`;
        coin.getAnimations().forEach(a => a.cancel());
    });

    // 重置指示器
    document.querySelectorAll('.indicator').forEach(ind => {
        ind.className = 'indicator';
        ind.querySelector('span').textContent = '—';
    });

    // 移除 tossing/landed 类
    document.querySelectorAll('.coin-container').forEach(c => {
        c.classList.remove('tossing', 'landed');
    });
}

// ===================================================================
// 处理点击投掷
// ===================================================================
function handleToss() {
    if (currentState !== STATES.IDLE && currentState !== STATES.WAITING_NEXT) return;
    if (tossCount >= MAX_TOSS) return;

    currentState = STATES.TOSSING;
    tossBtn.disabled = true;
    statusText.textContent = `正在生成第 ${tossCount + 1} 爻...`;

    // 随机生成三枚硬币的结果 (2 或 3)
    // 2: 字面/正面/阴 (front); 3: 背面/反面/阳 (back)
    const results = [
        Math.random() < 0.5 ? 2 : 3,
        Math.random() < 0.5 ? 2 : 3,
        Math.random() < 0.5 ? 2 : 3
    ];

    animateCoins(results, () => {
        showCoinResults(results);
        setTimeout(() => {
            recordResult(results);
        }, 600);
    });
}

// ===================================================================
// 显示铜钱结果指示
// ===================================================================
function showCoinResults(results) {
    results.forEach((r, i) => {
        const ind = document.getElementById(`indicator-${i + 1}`);
        ind.className = 'indicator show';
        if (r === 3) {
            ind.classList.add('yang');
            ind.querySelector('span').textContent = '背 (阳)';
        } else {
            ind.classList.add('yin');
            ind.querySelector('span').textContent = '字 (阴)';
        }
    });
}

// ===================================================================
// 铜钱抛掷动画 — 高品质3D物理模拟
// ===================================================================
function animateCoins(results, callback) {
    const coinContainers = document.querySelectorAll('.coin-container');
    const coins = document.querySelectorAll('.coin');

    let completedCount = 0;

    // 标记为 tossing 状态
    coinContainers.forEach(c => {
        c.classList.add('tossing');
        c.classList.remove('landed');
    });

    coins.forEach((coin, index) => {
        // 清除之前的动画
        coin.getAnimations().forEach(a => a.cancel());

        const isBack = results[index] === 3; // 是否显示背面

        // 翻转参数
        const flipCount = 3 + Math.floor(Math.random() * 4); // 3-6 次翻转
        const totalRotateX = flipCount * 360 + (isBack ? 180 : 0);
        
        // 随机扰动
        const wobbleY = (Math.random() - 0.5) * 40;
        const wobbleZ = (Math.random() - 0.5) * 25;

        // 抛起高度和水平偏移
        const peakHeight = -200 - Math.random() * 100;
        const lateralDrift = (Math.random() - 0.5) * 30;
        
        // 动画时长 - 有微小差异，更自然
        const duration = 1400 + index * 100 + Math.random() * 200;
        
        // 定义关键帧 — 抛物线 + 旋转
        const keyframes = [
            {
                transform: `translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg)`,
                offset: 0
            },
            {
                // 上升阶段 — 快速旋转
                transform: `translate3d(${lateralDrift * 0.5}px, ${peakHeight * 0.7}px, 60px) rotateX(${totalRotateX * 0.35}deg) rotateY(${wobbleY * 0.7}deg) rotateZ(${wobbleZ * 0.5}deg)`,
                offset: 0.3
            },
            {
                // 最高点 — 稍有滞留感
                transform: `translate3d(${lateralDrift}px, ${peakHeight}px, 80px) rotateX(${totalRotateX * 0.55}deg) rotateY(${wobbleY}deg) rotateZ(${wobbleZ}deg)`,
                offset: 0.45
            },
            {
                // 下落阶段
                transform: `translate3d(${lateralDrift * 0.7}px, ${peakHeight * 0.3}px, 40px) rotateX(${totalRotateX * 0.85}deg) rotateY(${wobbleY * 0.5}deg) rotateZ(${wobbleZ * 0.3}deg)`,
                offset: 0.7
            },
            {
                // 落地
                transform: `translate3d(0, 0, 0) rotateX(${totalRotateX}deg) rotateY(0deg) rotateZ(0deg)`,
                offset: 1
            }
        ];

        const animation = coin.animate(keyframes, {
            duration: duration,
            easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)',
            fill: 'forwards'
        });

        // 阴影动画 — 随抛掷高度变化
        const shadow = coinContainers[index].querySelector('.coin-shadow');
        if (shadow) {
            shadow.animate([
                { opacity: 0.5, transform: 'scale(1)', filter: 'blur(4px)' },
                { opacity: 0.15, transform: 'scale(0.4)', filter: 'blur(8px)', offset: 0.45 },
                { opacity: 0.5, transform: 'scale(1)', filter: 'blur(4px)' }
            ], {
                duration: duration,
                fill: 'forwards'
            });
        }

        animation.onfinish = () => {
            // 保持最终状态
            coin.style.transform = `rotateX(${isBack ? 180 : 0}deg) rotateY(0deg) rotateZ(0deg)`;

            // 移除 tossing，添加 landed
            coinContainers[index].classList.remove('tossing');
            coinContainers[index].classList.add('landed');

            // 清除 landed 动画（延时后恢复呼吸动画）
            setTimeout(() => {
                coinContainers[index].classList.remove('landed');
            }, 500);

            completedCount++;
            if (completedCount === coins.length) {
                setTimeout(callback, 300);
            }
        };
    });

    // 音效模拟 — 通过视觉震动代替
    setTimeout(() => {
        document.querySelector('.coins-area').style.transform = 'translateY(0)';
    }, 100);
}

// ===================================================================
// 记录结果
// ===================================================================
function recordResult(results) {
    currentState = STATES.RECORDING;
    tossCount++;

    const sum = results.reduce((a, b) => a + b, 0);
    let lineName, isMoving, originalLine, changingLine;

    switch (sum) {
        case 6:
            lineName = '老阴 ⚋';
            isMoving = true;
            originalLine = 0;
            changingLine = 1;
            break;
        case 7:
            lineName = '少阳 ⚊';
            isMoving = false;
            originalLine = 1;
            changingLine = 1;
            break;
        case 8:
            lineName = '少阴 ⚋';
            isMoving = false;
            originalLine = 0;
            changingLine = 0;
            break;
        case 9:
            lineName = '老阳 ⚊';
            isMoving = true;
            originalLine = 1;
            changingLine = 0;
            break;
    }

    const lineData = { index: tossCount, results, sum, lineName, isMoving, originalLine, changingLine };
    linesData.push(lineData);

    // 更新进度
    const yaoNames = ['初', '二', '三', '四', '五', '上'];
    progressText.innerHTML = `第 <span class="progress-current">${tossCount}</span> / <span class="progress-total">${MAX_TOSS}</span> 爻`;
    progressFill.style.width = `${(tossCount / MAX_TOSS) * 100}%`;

    // 插入记录
    const li = document.createElement('li');
    li.innerHTML = `
        <span class="yao-label">第${yaoNames[tossCount - 1]}爻</span>
        <span class="yao-coins">${results.map(r => r === 2 ? '字' : '背').join(' · ')} = ${sum}</span>
        <span class="yao-result ${isMoving ? 'moving' : ''}">${lineName}${isMoving ? ' ✦动' : ''}</span>
    `;
    linesRecord.appendChild(li);

    // 重置指示器（延时）
    setTimeout(() => {
        document.querySelectorAll('.indicator').forEach(ind => {
            ind.className = 'indicator';
            ind.querySelector('span').textContent = '—';
        });
    }, 800);

    if (tossCount < MAX_TOSS) {
        currentState = STATES.WAITING_NEXT;
        tossBtn.disabled = false;
        tossBtn.querySelector('.btn-text').textContent = `投掷第${yaoNames[tossCount]}爻`;
        statusText.textContent = `请继续投掷`;
    } else {
        currentState = STATES.GENERATING;
        statusText.textContent = `六爻已成，正在生成卦象...`;
        tossBtn.querySelector('.btn-text').textContent = '生成中...';
        setTimeout(generateHexagram, 1200);
    }
}

// ===================================================================
// 生成完整卦象
// ===================================================================
function generateHexagram() {
    // 隐藏主区，显示结果区
    mainArea.classList.add('hidden');
    resultArea.classList.remove('hidden');

    const originalBinary = linesData.map(d => d.originalLine).join('');
    const changingBinary = linesData.map(d => d.changingLine).join('');
    const hasMoving = linesData.some(d => d.isMoving);

    const originalInfo = getHexagramInfo(originalBinary);

    // 绘制本卦
    drawHexagram('original-hexagram', linesData, 'originalLine', originalInfo);

    // 绘制变卦
    if (hasMoving) {
        const changingInfo = getHexagramInfo(changingBinary);
        document.getElementById('changing-hexagram').style.display = 'block';
        document.querySelector('.hexagram-arrow').style.display = 'block';
        drawHexagram('changing-hexagram', linesData, 'changingLine', changingInfo);

        document.getElementById('original-interpretation').textContent = originalInfo.interpretation;
        document.getElementById('changing-interpretation').textContent = changingInfo.interpretation;
        document.getElementById('changing-interpretation-wrap').style.display = 'block';
    } else {
        document.getElementById('changing-hexagram').style.display = 'none';
        document.querySelector('.hexagram-arrow').style.display = 'none';

        document.getElementById('original-interpretation').textContent = originalInfo.interpretation;
        document.getElementById('changing-interpretation').textContent = "无动爻，本卦不变。可重点参看本卦卦辞。";
        document.getElementById('changing-interpretation-wrap').style.display = 'block';
    }

    currentState = STATES.SHOWING;

    // 停留 3 秒后触发虚化
    setTimeout(() => {
        currentState = STATES.FADING;
        document.getElementById('hexagram-visual').classList.add('fading');

        setTimeout(() => {
            currentState = STATES.INTERPRETING;
            const interpBox = document.getElementById('interpretation-box');
            interpBox.classList.remove('hidden');
            setTimeout(() => interpBox.classList.add('show'), 50);
        }, 1000);

    }, 3000);
}

// ===================================================================
// 绘制单卦图形
// ===================================================================
function drawHexagram(containerId, lines, typeKey, info) {
    const container = document.getElementById(containerId);
    container.querySelector('.hexagram-name').textContent = info.name;

    const drawingBox = container.querySelector('.lines-drawing');
    drawingBox.innerHTML = '';

    lines.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        const isYang = line[typeKey] === 1;
        lineDiv.className = `line ${isYang ? 'yang' : 'yin'}`;
        if (line.isMoving) {
            lineDiv.classList.add('moving');
        }
        // 添加逐行动画延迟
        lineDiv.style.opacity = '0';
        lineDiv.style.animation = `fadeSlideIn 0.4s ease-out ${index * 0.15}s forwards`;
        drawingBox.appendChild(lineDiv);
    });
}

// ===================================================================
// 启动
// ===================================================================
window.onload = init;
