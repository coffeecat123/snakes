const socket = io();
var my_id = null, my_snake = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
var cvs = $("#cvs");
var ipt_name = $("#ipt_name");
var instruction = $("#instruction");
var name_div = $("#name_div");
var enter_name_btn = $("#enter_name_btn");
var ctx = cvs.getContext("2d");
var ti;
var rr;
var ping = null, offset = 0;
var map = { width: 0, height: 0 };

var client_snakes = [];
var client_snakes_map = new Map();
var client_foods = [];

var buttons = [];

var lastSentInput = { dx: 0, dy: 0, time: 0 };
var lastTime, frameCount = 0, fps = 60;
var lastFrameTime = performance.now();

const margin = 100;
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
var keys = { w: 0, a: 0, s: 0, d: 0, shift: 0 };
var camera = { x: 0, y: 0, width: 0, height: 0, inited: false };
var joystick = { x: 0, y: 0, default_x: 0, default_y: 0, active: 0, id: -1, sx: 0, sy: 0, r: 85 };
var add_speed = { x: 0, y: 0, default_x: 0, default_y: 0, id: -1, r: 85 - 5, active: 0 };

var showRank = 0, showFps = 0;

// 直接接收伺服器狀態（繞過 Worker，徹底根除執行緒延遲造成的微抖動）
socket.on('gameState', (state) => {
    map = state.map;
    rr = state.rr;

    const currentServerIds = new Set();

    for (const s of state.snakes) {
        currentServerIds.add(s.id);
        let localSnake = client_snakes_map.get(s.id);

        if (!localSnake) {
            // 新加入的蛇
            localSnake = {
                id: s.id,
                x: s.x,
                y: s.y,
                targetX: s.x,
                targetY: s.y,
                serverX: s.x,  // 校對點
                serverY: s.y,
                dx: s.dx,
                dy: s.dy,
                r: s.r,
                clr: s.clr,
                name: s.name,
                score: s.score,
                chscs: s.chscs,
                err: s.err,
                type: s.type,
                body: [{ x: s.x, y: s.y }]
            };
            client_snakes_map.set(s.id, localSnake);
        } else {
            // 1. 吃到傳送蘋果的大距離瞬移直接重置，不拉扯 (比對本地實際位置與伺服器位置)
            if (Math.hypot(s.x - localSnake.x, s.y - localSnake.y) > 150) {
                localSnake.x = s.x;
                localSnake.y = s.y;
                localSnake.body = [{ x: s.x, y: s.y }];
            }

            // 2. ★ 核心關鍵分流：
            if (s.id === my_id) {
                // 【自己的蛇】：只記錄伺服器位置作為背景校準點，絕不覆蓋自己的 dx/dy！
                localSnake.serverX = s.x;
                localSnake.serverY = s.y;
            } else {
                // 【別人的蛇 / AI】：更新目標座標與速度，供本地平滑追趕
                localSnake.targetX = s.x;
                localSnake.targetY = s.y;
                localSnake.dx = s.dx;
                localSnake.dy = s.dy;
            }

            // 3. 權威屬性同步（半徑、分數、名字、異常狀態、飄字）
            localSnake.r = s.r;
            localSnake.score = s.score;
            localSnake.name = s.name;
            localSnake.clr = s.clr;
            localSnake.chscs = s.chscs;
            localSnake.err = s.err;
            localSnake.type = s.type;
        }
    }

    // 清理已斷線的蛇
    for (const [id] of client_snakes_map) {
        if (!currentServerIds.has(id)) {
            client_snakes_map.delete(id);
        }
    }

    client_snakes = Array.from(client_snakes_map.values());
    my_snake = client_snakes_map.get(my_id) || null;

    // 食物狀態更新 (蘋果與禮物瞬移定位，其他平滑)
    if (client_foods.length !== state.foods.length) {
        client_foods = state.foods.map(f => ({
            ...f,
            targetX: f.x,
            targetY: f.y,
            vx: f.v ? f.v.dx : 0,
            vy: f.v ? f.v.dy : 0
        }));
    } else {
        for (let i = 0; i < state.foods.length; i++) {
            const sf = state.foods[i];
            const cf = client_foods[i];

            if (sf.type === 0 || sf.type === 3 || Math.hypot(sf.x - cf.x, sf.y - cf.y) > 150) {
                cf.x = sf.x;
                cf.y = sf.y;
            }
            cf.targetX = sf.x;
            cf.targetY = sf.y;
            cf.type = sf.type;
            cf.dt = sf.dt;
            // 同步速度
            if (sf.v) {
                cf.vx = sf.v.dx;
                cf.vy = sf.v.dy;
            }
        }
    }
});

// 120Hz 每幀高精確流體平滑推移
function updateSmoothEntities(dt) {
    const smoothFactor = 1 - Math.exp(-22 * dt);

    for (const s of client_snakes) {
        if (s.id === my_id) {
            // ==========================================
            // 1. 本地玩家模擬 (支援蘑菇混亂反向負面狀態！)
            // ==========================================
            let moveDx = s.dx;
            let moveDy = s.dy;

            // ★ 關鍵：檢查是否處於蘑菇負面狀態（err[1] 混亂期間速度反轉）
            const isReversed = s.err && s.err[1] && (Date.now() + offset - s.err[1].lastTime < s.err[1].waitTime);
            if (isReversed) {
                moveDx *= -1;
                moveDy *= -1;
            }

            s.x += moveDx * dt;
            s.y += moveDy * dt;
            s.x = Math.max(s.r, Math.min(s.x, map.width - s.r));
            s.y = Math.max(s.r, Math.min(s.y, map.height - s.r));

            // 背景輕微吸收與伺服器的微小誤差 (Reconciliation)
            if (s.serverX !== undefined) {
                s.x += (s.serverX - s.x) * (1 - Math.exp(-5 * dt));
                s.y += (s.serverY - s.y) * (1 - Math.exp(-5 * dt));
            }
        } else {
            // 別人的蛇：平滑追隨
            s.x += (s.targetX - s.x) * smoothFactor;
            s.y += (s.targetY - s.y) * smoothFactor;
        }

        // 2. 鋪設身體軌跡與停駐消散
        if (!s.body || s.body.length === 0) {
            s.body = [{ x: s.x, y: s.y }];
        }

        const head = s.body[0];
        const dist = Math.hypot(s.x - head.x, s.y - head.y);

        const g = (x) => (x + 1) / 20 + Math.log10(x + 1) / Math.log10(100);
        let maxNodes = Math.max(1, Math.floor(60 * g(s.score) * 1.8));
        if (s.score <= 0) maxNodes = 1;

        if (dist >= 4) {
            s.body.unshift({ x: s.x, y: s.y });
            s.shrinkTimer = 0;
            while (s.body.length > maxNodes) {
                s.body.pop();
            }
        } else if (s.body.length > 1) {
            s.shrinkTimer = (s.shrinkTimer || 0) + dt;
            const shrinkInterval = 1 / 50;
            while (s.shrinkTimer >= shrinkInterval && s.body.length > 1) {
                s.body.pop();
                s.shrinkTimer -= shrinkInterval;
            }
        } else {
            s.shrinkTimer = 0;
        }
    }

    // ==========================================
    // 3. 葡萄與蘑菇：120Hz 連續物理飛行與彈力碰撞模擬
    // ==========================================
    for (const f of client_foods) {
        if ((f.type === 1 || f.type === 2) && f.vx !== undefined) {
            // (1) 依照速度在本地以 120 FPS 連續飛行
            f.x += f.vx * dt;
            f.y += f.vy * dt;

            // (2) 本地撞牆即時反彈，絕不卡在牆角
            let fr = f.dt ? f.dt.r : 30;
            if (f.x < fr) { f.x = fr; f.vx *= -1; }
            if (f.x > map.width - fr) { f.x = map.width - fr; f.vx *= -1; }
            if (f.y < fr) { f.y = fr; f.vy *= -1; }
            if (f.y > map.height - fr) { f.y = map.height - fr; f.vy *= -1; }

            // (3) 與伺服器權威座標進行極溫和的平滑微調（吸收延遲誤差）
            if (f.targetX !== undefined) {
                f.x += (f.targetX - f.x) * (1 - Math.exp(-8 * dt));
                f.y += (f.targetY - f.y) * (1 - Math.exp(-8 * dt));
            }
        } else if (f.targetX !== undefined) {
            // 蘋果(0)與禮物(3)直接鎖定目標座標，絕不滑行
            f.x = f.targetX;
            f.y = f.targetY;
        }
    }
}

//class
class Button {
    constructor(pausedShow, doAction) {
        this.shapes = [];
        this.pausedShow = pausedShow;
        this.hover = false;
        this.doAction = doAction;
    }
    do() {
        this.doAction();
    }
    containsPoint(x, y) {
        for (const shape of this.shapes) {
            let isInside = false;
            switch (shape.type) {
                case 'fill':
                    isInside = ctx.isPointInPath(shape.path, x, y);
                    break;
                case 'stroke':
                    isInside = ctx.isPointInStroke(shape.path, x, y);
                    break;
                case 'both':
                    isInside = ctx.isPointInPath(shape.path, x, y) || ctx.isPointInStroke(shape.path, x, y);
                    break;
                default:
                    console.warn(`Unknown shape type: ${shape.type}`);
                    isInside = false;
                    break;
            }
            if (isInside) return true;
        }
        return false;
    }
    addShape(path, color, hover, type = 'fill') {
        this.shapes.push({ path: new Path2D(path), color, hover, type });
    }
    draw() {
        for (const shape of this.shapes) {
            if (shape.hover != this.hover && shape.hover >= 0) continue;
            ctx.strokeStyle = shape.color;
            ctx.fillStyle = shape.color;
            if (shape.type === 'fill') {
                ctx.fill(shape.path);
            } else if (shape.type === 'stroke') {
                ctx.stroke(shape.path);
            } else if (shape.type === 'both') {
                ctx.fill(shape.path);
                ctx.stroke(shape.path);
            }
        }
    }
}

function drawSnakeHead(s) {
    let alpha = 255;
    let r = s.r;
    alpha = alpha.toString(16).padStart(2, '0').toLowerCase();
    ctx.fillStyle = `${s.clr}${alpha}`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, 2 * Math.PI);
    ctx.fill();

    if (Date.now() + offset - s.err[1].lastTime < s.err[1].waitTime) {
        fillText('?', s.x, s.y, "#fff", `${s.r}px Arial`);
    } else {
        fillText(s.score, s.x, s.y, "#fff", `${s.r / 1.5}px Arial`);
    }
    fillText(s.name, s.x, s.y - s.r * 1.5, "#fff", `${s.r / 1.5}px Arial`);
    for (let i = 0; i < s.chscs.length; i++) {
        let c = s.chscs[i];
        if (Date.now() + offset - c.lastTime < c.waitTime) {
            fillText(c.txt,
                s.x,
                s.y - s.r * 1.5 - s.r * 2 * (Date.now() + offset - c.lastTime) / c.waitTime,
                `hsla(${(540 - i * 34) % 360}, 100%, 50%, ${1 - (Date.now() + offset - c.lastTime) / c.waitTime})`,
                `${s.r / 1.5}px Arial`);
        } else {
            s.chscs.splice(i--, 1);
        }
    }
}

function drawSnakeBody(s) {
    if (!s.body || s.body.length <= 1) return;

    const VIEW_LEFT = camera.x;
    const VIEW_RIGHT = camera.x + camera.width;
    const VIEW_TOP = camera.y;
    const VIEW_BOTTOM = camera.y + camera.height;

    const baseStep = 2;
    const lengthFactor = Math.min(1, 50 / s.body.length) || 1;
    const scoreFactor = Math.sqrt(Math.log10(s.score + 10)) || 1;
    const DRAW_STEP = Math.max(baseStep, Math.floor(baseStep * lengthFactor * scoreFactor));

    // 從 i = 1 開始畫身體，與頭部分工明確
    for (let i = 1; i < s.body.length; i++) {
        let x = s.body[i].x;
        let y = s.body[i].y;
        if (i % DRAW_STEP !== 0) continue;

        const segmentRatio = 1 - i / s.body.length;
        let r = s.r * segmentRatio;

        if (x + r < VIEW_LEFT || x - r > VIEW_RIGHT ||
            y + r < VIEW_TOP || y - r > VIEW_BOTTOM) {
            continue;
        }

        let alpha = Math.floor(segmentRatio * 255 / 1.5 / Math.log10(s.score + 1 || 1));
        alpha = Math.max(1, Math.min(255, alpha));
        alpha = alpha.toString(16).padStart(2, '0').toLowerCase();

        ctx.fillStyle = `${s.clr}${alpha}`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawFood(f) {
    if (f.type == 0) {
        ctx.fillStyle = f.dt.clr;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
        ctx.arc(f.dt.to.x, f.dt.to.y, f.dt.r, 0, 2 * Math.PI);
        ctx.fill();
        fillText(f.dt.text[0], f.x, f.y, "#ff0000");
        fillText(f.dt.text[1], f.dt.to.x, f.dt.to.y, "#ff0000");
    }
    if (f.type == 1 || f.type == 2 || f.type == 3) {
        ctx.fillStyle = f.dt.clr;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
        ctx.fill();
        fillText(f.dt.text[0], f.x, f.y, "#ff0000");
    }
}

function disableMobileScrolling() {
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
}

function setcvswh() {
    let w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    let h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    let v = 600;
    if (w > h) {
        cvs.width = w / h * v;
        cvs.height = v;
    } else {
        cvs.width = v;
        cvs.height = h / w * v;
    }
    ti = cvs.width / cvs.offsetWidth;
    camera.width = cvs.width;
    camera.height = cvs.height;
    joystick.default_x = cvs.width / 5;
    joystick.default_y = cvs.height / 4 * 3;
    add_speed.default_x = cvs.width / 5 * 4;
    add_speed.default_y = cvs.height / 4 * 3;
}

function fillText(text, x, y, clr, font = `${rr * 1.3}px Arial`) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = clr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function draw() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 網格
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= map.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, map.height);
        ctx.stroke();
    }
    for (let y = 0; y <= map.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(map.width, y);
        ctx.stroke();
    }

    // 邊界
    let lw = 10;
    let gdt = ctx.createLinearGradient(0, 0, map.width, map.height);
    gdt.addColorStop(1, "#f00");
    gdt.addColorStop(0, "#f0f");
    ctx.strokeStyle = gdt;
    ctx.lineWidth = lw;
    ctx.strokeRect(-lw / 2, -lw / 2, map.width + lw, map.height + lw);

    // 食物
    for (let i = 0; i < client_foods.length; i++) {
        drawFood(client_foods[i]);
    }

    // 其他蛇
    const s = [...client_snakes].sort((a, b) => b.r - a.r);
    for (let i = 0; i < s.length; i++) {
        if (s[i].id === my_id) continue;
        drawSnakeBody(s[i]);
    }
    for (let i = s.length - 1; i >= 0; i--) {
        if (s[i].id === my_id) continue;
        drawSnakeHead(s[i]);
    }

    // 自己的蛇 (最後畫，置頂)
    if (my_snake) {
        drawSnakeBody(my_snake);
        drawSnakeHead(my_snake);
    }

    ctx.restore();

    // UI - 搖桿
    if (isMobile) {
        let j = joystick;
        ctx.beginPath();
        ctx.strokeStyle = "#0005";
        ctx.fillStyle = "#fff3";
        if (j.active) {
            ctx.arc(j.x, j.y, j.r, 0, Math.PI * 2);
        } else {
            ctx.arc(j.default_x, j.default_y, j.r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "#0005";
        ctx.fillStyle = "#fff3";
        if (j.active) {
            ctx.arc(j.x, j.y, j.r / 1.6, 0, Math.PI * 2);
        } else {
            ctx.arc(j.default_x, j.default_y, j.r / 1.6, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "#fff5";
        if (j.active) {
            ctx.arc(j.x + j.sx, j.y + j.sy, j.r / 4, 0, Math.PI * 2);
        } else {
            ctx.arc(j.default_x, j.default_y, j.r / 4, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
    }

    // UI - 加速
    if (isMobile) {
        let d = add_speed;
        ctx.beginPath();
        ctx.strokeStyle = "#0005";
        ctx.fillStyle = addOpacity("#fff", 0.2 + d.active / 3);
        if (d.active) {
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        } else {
            ctx.arc(d.default_x, d.default_y, d.r, 0, Math.PI * 2);
        }
        ctx.fill();
        if (d.active) {
            fillText("🍌", d.x, d.y, addOpacity("#000", 0.7 + d.active / 10 * 3), `${d.r}px Arial`);
        } else {
            fillText("🍌", d.default_x, d.default_y, addOpacity("#000", 0.7 + d.active / 10 * 3), `${d.r}px Arial`);
        }
    }

    ctx.lineWidth = 8;
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].draw();
    }

    fillText("flsc", 50, 50, addOpacity("#0f0", 1 - buttons[0].hover / 3));
    fillText("fps", 130, 50, addOpacity("#0f0", 1 - buttons[1].hover / 3));
    if (isMobile && buttons[2]) {
        fillText("rank", 210, 50, addOpacity("#0f0", 1 - buttons[2].hover / 3));
    }

    // 排行榜
    const sortedSnakes = [...client_snakes].sort((a, b) => b.score - a.score);
    if (showRank) {
        let lx = cvs.width / 3 - 10;
        let ly = 130;
        let r = Math.min(200, cvs.width / 3);

        ctx.font = '40px Arial';
        ctx.fillStyle = '#f00';
        ctx.textAlign = 'right';
        ctx.fillText(`Rank`, lx, ly);
        ctx.fillText(`Name`, lx + r, ly);
        ctx.fillText(`Score`, lx + r * 2, ly);

        let currentRank = 1;
        let lastScore = null;
        let mySnakeWithRank = null;

        const rankedSnakes = [];
        for (let i = 0; i < sortedSnakes.length; i++) {
            const s = sortedSnakes[i];
            if (s.score !== lastScore) {
                currentRank = i + 1;
            }
            const snakeWithRank = { ...s, rank: currentRank };
            rankedSnakes.push(snakeWithRank);

            if (s.id === my_id) {
                mySnakeWithRank = snakeWithRank;
            }
            lastScore = s.score;
        }

        let displayList = rankedSnakes.slice(0, 10);
        const isMySnakeInTop10 = displayList.some(s => s.id === my_id);

        if (mySnakeWithRank && !isMySnakeInTop10) {
            displayList.push(mySnakeWithRank);
        }
        for (let i = 0; i < displayList.length; i++) {
            const s = displayList[i];
            const yOffset = (i + 1) * 40 + ly;

            if (s.id === my_id) {
                ctx.save();
                ctx.fillStyle = "#3aa8";
                ctx.fillRect(lx - 85, yOffset - 35, r * 2 + 90, 40);
                ctx.restore();
            }

            ctx.fillStyle = '#ddd';
            ctx.fillText(`${s.rank}`, lx, yOffset, r - 20);
            ctx.fillText(`${s.name}`, lx + r, yOffset, r - 20);
            ctx.fillText(`${s.score.toFixed(1)}`, lx + r * 2, yOffset, r - 20);
        }
    }

    const totalPlayers = client_snakes.length;
    let myRank = 'N/A';
    let lastScore = null;
    let currentRank = 1;
    for (let i = 0; i < totalPlayers; i++) {
        const s = sortedSnakes[i];
        if (s.score !== lastScore) {
            currentRank = i + 1;
        }
        if (s.id === my_id) {
            myRank = currentRank;
            break;
        }
        lastScore = s.score;
    }
    fillText(`${myRank}/${totalPlayers}`, cvs.width - 55, 80, addOpacity("#eee", 1));

    if (showFps) {
        ctx.font = '20px Arial';
        ctx.fillStyle = '#0f0';
        ctx.textAlign = 'right';
        ctx.fillText(`fps:${fps}`, cvs.width - 10, 50);
    }

    fillText(`${ping}ms`, cvs.width - 45, 20, addOpacity("#0ff", 1), `20px Arial`);
}

function bk() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = "#181818";
    ctx.fillRect(-margin, -margin, map.width + margin * 2, map.height + margin * 2);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.restore();
}

function player_input() {
    const speed = 250;
    let dx = 0, dy = 0;

    // 計算 dx, dy ... (原邏輯不變)
    if (isMobile && joystick.active && (joystick.sx != 0 || joystick.sy != 0)) {
        let v = speed * (1 + add_speed.active);
        let vv = Math.hypot(joystick.sx, joystick.sy);
        dx = (joystick.sx / vv) * v;
        dy = (joystick.sy / vv) * v;
    } else {
        let v = speed * (1 + keys.shift);
        if ((keys.w || keys.s) && (keys.a || keys.d)) v /= Math.sqrt(2);
        if (keys.w > keys.s) dy = -v;
        else if (keys.s > keys.w) dy = v;
        if (keys.a > keys.d) dx = -v;
        else if (keys.d > keys.a) dx = v;
    }

    dx = Math.round(dx);
    dy = Math.round(dy);

    // ★ 關鍵：本地自己的蛇【立刻套用速度】，不需要等伺服器回傳！
    if (my_snake) {
        my_snake.dx = dx;
        my_snake.dy = dy;
    }

    // 發送給伺服器 (原節流邏輯不變)
    const now = performance.now();
    const isChanged = (dx !== lastSentInput.dx || dy !== lastSentInput.dy);
    if ((isChanged && now - lastSentInput.time > 33) || now - lastSentInput.time > 200) {
        socket.emit('playerInput', { dx, dy });
        lastSentInput.dx = dx;
        lastSentInput.dy = dy;
        lastSentInput.time = now;
    }
}

// 相機緊密平滑跟隨，消除蛇在螢幕中心的來回晃動
function updateCamera(dt) {
    if (!my_snake || my_snake.x === undefined) return;

    let targetX = my_snake.x + rr - camera.width / 2;
    let targetY = my_snake.y + rr - camera.height / 2;
    let clampedX = Math.max(-margin, Math.min(targetX, map.width - camera.width + margin));
    let clampedY = Math.max(-margin, Math.min(targetY, map.height - camera.height + margin));

    if (!camera.inited) {
        camera.x = clampedX;
        camera.y = clampedY;
        camera.inited = true;
    } else {
        let factor = 1 - Math.exp(-22 * dt);
        camera.x += (clampedX - camera.x) * factor;
        camera.y += (clampedY - camera.y) * factor;
    }

    if (map.width < camera.width) camera.x = -(camera.width - map.width) / 2;
    if (map.height < camera.height) camera.y = -(camera.height - map.height) / 2;
}

function updateFps() {
    let time = performance.now();
    if (lastTime) {
        const deltaTime = time - lastTime; frameCount++;
        if (deltaTime > 100) { fps = Math.round(frameCount * 1000 / deltaTime); frameCount = 0; lastTime = time; }
    }
}

function update() {
    let now = performance.now();
    let dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    if (dt > 0.1) dt = 0.1;

    updateFps();
    player_input();

    // 1. 在 120Hz 下將所有物件流體平滑推移
    updateSmoothEntities(dt);

    // 2. 相機同步緊密平滑跟隨
    updateCamera(dt);

    // 3. 繪製畫面
    bk();
    draw();

    requestAnimationFrame(update);
}

function initButtons() {
    buttons = [];

    let button_flsc = new Button(1, () => {
        setTimeout(() => {
            if (isFullScreen()) exitFullScreen();
            else enterFullScreen();
        }, 100);
    }, ctx);
    button_flsc.addShape(new Path2D(`${svgarc(50, 50, 30)}`), '#fff8', 0, 'fill');
    button_flsc.addShape(new Path2D(`${svgarc(50, 50, 30)}`), '#fff5', 1, 'fill');
    buttons.push(button_flsc);

    let button_fps = new Button(1, () => {
        showFps ^= 1;
    }, ctx);
    button_fps.addShape(new Path2D(`${svgarc(130, 50, 30)}`), '#fff8', 0, 'fill');
    button_fps.addShape(new Path2D(`${svgarc(130, 50, 30)}`), '#fff5', 1, 'fill');
    buttons.push(button_fps);

    if (!isMobile) return;
    let button_rank = new Button(1, () => {
        showRank ^= 1;
    }, ctx);
    button_rank.addShape(new Path2D(`${svgarc(210, 50, 30)}`), '#fff8', 0, 'fill');
    button_rank.addShape(new Path2D(`${svgarc(210, 50, 30)}`), '#fff5', 1, 'fill');
    buttons.push(button_rank);
}

window.addEventListener('resize', setcvswh);
document.onkeydown = (e) => {
    if (e.key == 'ArrowUp' || e.key == 'w' || e.key == 'W') keys.w = performance.now();
    if (e.key == 'ArrowLeft' || e.key == 'a' || e.key == 'A') keys.a = performance.now();
    if (e.key == 'ArrowDown' || e.key == 's' || e.key == 'S') keys.s = performance.now();
    if (e.key == 'ArrowRight' || e.key == 'd' || e.key == 'D') keys.d = performance.now();
    if (e.key == 'Shift') keys.shift = 1;
    if (e.key == 'q' || e.key == 'Q') showRank = 1;
};
document.onkeyup = (e) => {
    if (e.key == 'ArrowUp' || e.key == 'w' || e.key == 'W') keys.w = 0;
    if (e.key == 'ArrowLeft' || e.key == 'a' || e.key == 'A') keys.a = 0;
    if (e.key == 'ArrowDown' || e.key == 's' || e.key == 'S') keys.s = 0;
    if (e.key == 'ArrowRight' || e.key == 'd' || e.key == 'D') keys.d = 0;
    if (e.key == 'Shift') keys.shift = 0;
    if (e.key == 'q' || e.key == 'Q') showRank = 0;
};

cvs.addEventListener('pointerdown', (e) => {
    const rect = cvs.getBoundingClientRect();
    const x = (e.clientX - rect.left) * ti;
    const y = (e.clientY - rect.top) * ti;
    let d = [];
    for (let i in buttons) {
        let b = buttons[i];
        if (b.containsPoint(x, y)) {
            d.push(b);
        }
    }
    if (d.length > 0) {
        for (let i in d) {
            let b = d[i];
            b.do();
        }
    } else if (x < cvs.width / 2) {
        joystick.id = e.pointerId;
        joystick.active = 1;
        joystick.x = x;
        joystick.y = y;
        joystick.sx = 0;
        joystick.sy = 0;
    } else {
        add_speed.id = e.pointerId;
        add_speed.active = 1;
        add_speed.x = x;
        add_speed.y = y;
    }
});

cvs.addEventListener('pointermove', (e) => {
    const rect = cvs.getBoundingClientRect();
    const x = (e.clientX - rect.left) * ti;
    const y = (e.clientY - rect.top) * ti;
    for (let i in buttons) {
        let b = buttons[i];
        b.hover = b.containsPoint(x, y);
    }
    if (e.pointerId == joystick.id) {
        let j = joystick;
        let dx = x - joystick.x;
        let dy = y - joystick.y;
        let dd = Math.hypot(dx, dy);
        j.sx = getSmallerAbsoluteValue(j.r * dx / dd, dx);
        j.sy = getSmallerAbsoluteValue(j.r * dy / dd, dy);
        if (dd > j.r) {
            j.x = x - j.sx;
            j.y = y - j.sy;
        }
    }
});

cvs.addEventListener('pointerup', (e) => {
    if (e.pointerId == joystick.id) {
        joystick.id = -1;
        joystick.active = 0;
    }
    if (e.pointerId == add_speed.id) {
        add_speed.id = -1;
        add_speed.active = 0;
    }
});

//ping
let lastPingTime = 0;
socket.on('pong', (data) => {
    offset = data.now - Date.now();
    ping = performance.now() - lastPingTime;
    ping = Math.round(ping);
});
setInterval(() => {
    lastPingTime = performance.now();
    socket.emit('ping');
}, 1000);

//connect
socket.on('connect', () => {
    let num = Math.floor(Math.random() * 1000);
    let str = num.toString().padStart(3, '0');
    const p = `Player${str}`;
    ipt_name.value = p;
    ipt_name.placeholder = "enter your name";
    ipt_name.focus();
    instruction.innerText = "Use WASD or Arrow Keys to move\nHold Shift to speed up\nOn mobile, use joystick and banana button";
    let f1, f2;
    ipt_name.addEventListener('keydown', f1 = (e) => {
        if (e.key === 'Enter') {
            let name = ipt_name.value;
            if (name == null || name.trim() == "") name = p;
            name_div.style.display = "none";
            socket.emit('setName', { name: name });
            ipt_name.removeEventListener('keydown', f1);
            enter_name_btn.removeEventListener('click', f2);
        }
    });
    enter_name_btn.addEventListener('click', f2 = (e) => {
        let name = ipt_name.value;
        if (name == null || name.trim() == "") name = p;
        name_div.style.display = "none";
        socket.emit('setName', { name: name });
        ipt_name.removeEventListener('keydown', f1);
        enter_name_btn.removeEventListener('click', f2);
    });
});

//start
socket.on('start', (data) => {
    my_id = data.id; rr = data.rr; map = data.map;
    setcvswh();
    initButtons();
    lastTime = performance.now();
    lastFrameTime = performance.now();
    requestAnimationFrame(update);
});

disableMobileScrolling();