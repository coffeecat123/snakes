const socket = io();
var my_id = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
var cvs = $("#cvs");
var ctx = cvs.getContext("2d");
var ti;
var rr;
var ping = null;
var map = { width: 0, height: 0 };
var client_snakes = [];
var client_foods = [];
const gameWorker = new Worker('worker.js');

var buttons = [];

var lastTime, frameCount=0, fps = 60;
const margin = 50;
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
var keys = { w: 0, a: 0, s: 0, d: 0, shift: 0 };
var camera = { x: 0, y: 0, width: 0, height: 0 };
var joystick = { x: 0, y: 0, default_x: 0, default_y: 0, active: 0, id: -1, sx: 0, sy: 0, r: 85 };
var add_speed = { x: 0, y: 0, default_x: 0, default_y: 0, id: -1, r: 85 - 5, active: 0 };

var showRank = 0, showFps = 0,updating=0;

gameWorker.onmessage = function(e) {
    const data = e.data;
    client_snakes = data.snakes;
    client_foods = data.foods;
    map = data.map;
    rr = data.rr;
    updating=1;
};
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
            if (isInside) {
                return true;
            }
        }

        return false;

    }
    addShape(path, color, hover, type = 'fill') {
        //hover:-1 means any
        //hover:0 means not hover
        //hover:1 means hover
        //type: fill, stroke, both
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
    let b = {x: s.x, y: s.y};
    let alpha = 255;
    let r = s.r;
    alpha = alpha.toString(16).padStart(2, '0').toLowerCase();
    ctx.fillStyle = `${s.clr}${alpha}`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, 2 * Math.PI);
    ctx.fill();

    if (Date.now() - s.err[1].lastTime < s.err[1].waitTime) {
        fillText('?', b.x, b.y, "#fff", 1, `${s.r}px Arial`);
    }
    else {
        fillText(s.score, b.x, b.y, "#fff", 1, `${s.r / 1.5}px Arial`);
    }
    fillText(s.name, b.x, b.y - s.r * 1.5, "#fff", 1, `${s.r / 1.5}px Arial`);
    for (let i = 0; i < s.chscs.length; i++) {
        let c = s.chscs[i];
        if (Date.now() - c.lastTime < c.waitTime) {
            fillText(c.txt, s.body[0].x, s.body[0].y - s.r * 1.5 - s.r * 2 * (Date.now() - c.lastTime) / c.waitTime, addOpacity(hslToHex((540 - i * 34) % 360, 100, 50), 1 - (Date.now() - c.lastTime) / c.waitTime), 1, `${s.r / 1.5}px Arial`);
        } else {
            s.chscs.splice(i--, 1);
        }
    }
}
function drawSnakeBody(s) {
    const VIEW_LEFT = camera.x;
    const VIEW_RIGHT = camera.x + camera.width;
    const VIEW_TOP = camera.y;
    const VIEW_BOTTOM = camera.y + camera.height;
    
    const baseStep = 1;
    const lengthFactor = Math.min(1, 50 / s.body.length) || 1;
    const scoreFactor = Math.sqrt(Math.log10(s.score + 10)) || 1;
    const DRAW_STEP = Math.max(baseStep, Math.floor(baseStep * lengthFactor * scoreFactor));

    for (let i = 0; i < s.body.length; i++) {
        let x=s.body[i].x;
        let y=s.body[i].y;
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
        fillText(f.dt.text[0], f.x, f.y, "#ff0000", 1);
        fillText(f.dt.text[1], f.dt.to.x, f.dt.to.y, "#ff0000", 1);
    }
    if (f.type == 1 || f.type == 2 || f.type == 3) {
        ctx.fillStyle = f.dt.clr;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
        ctx.fill();
        fillText(f.dt.text[0], f.x, f.y, "#ff0000", 1);
    }
}
function disableMobileScrolling() {
    document.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
    }, { passive: false }); 
}
//main functions
function setcvswh() {
    let w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    let h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    let v = 600;
    if (w > h) {
        cvs.width = w / h * v;
        cvs.height = v;
    }
    else {
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
function fillText(text, x, y, clr, a, font = `${rr * 1.3}px Arial`) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = clr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (a) {
        x -= camera.x;
        y -= camera.y;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
}
function draw() {
    ctx.save();

    //draw grid
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

    //draw edge
    let lw = 10;
    let gdt = ctx.createLinearGradient(0, 0, cvs.width, cvs.height);
    gdt.addColorStop(1, "#f00");
    gdt.addColorStop(0, "#f0f");
    ctx.strokeStyle = gdt;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-lw / 2, -lw / 2);
    ctx.lineTo(-lw / 2, map.height + lw / 2);
    ctx.lineTo(map.width + lw / 2, map.height + lw / 2);
    ctx.lineTo(map.width + lw / 2, -lw / 2);
    ctx.lineTo(-lw / 2, -lw / 2);
    ctx.closePath();
    ctx.stroke();

    //draw foods
    for (let i = 0; i < client_foods.length; i++) {
        drawFood(client_foods[i]);
    }

    const s = [...client_snakes].sort((a, b) => b.r - a.r);
    
    //draw snakes
    for (let i = 0; i < s.length; i++) {
        drawSnakeBody(s[i]);
    }
    for (let i = s.length - 1; i >= 0; i--) {
        drawSnakeHead(s[i]);
    }
    
    const mySnake = client_snakes.find(s => s.id === my_id);
    if (mySnake) {
        drawSnakeHead(mySnake);
    }
    //joystick
    if (isMobile) {
        let j = joystick;
        ctx.beginPath();
        ctx.strokeStyle = "#0005";
        ctx.fillStyle = "#fff3";
        if (j.active) {
            ctx._arc(j.x, j.y, j.r, 0, Math.PI * 2);
        } else {
            ctx._arc(j.default_x, j.default_y, j.r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "#0005";
        ctx.fillStyle = "#fff3";
        if (j.active) {
            ctx._arc(j.x, j.y, j.r / 1.6, 0, Math.PI * 2);
        } else {
            ctx._arc(j.default_x, j.default_y, j.r / 1.6, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "#fff5";
        if (j.active) {
            ctx._arc(j.x + j.sx, j.y + j.sy, j.r / 4, 0, Math.PI * 2);
        } else {
            ctx._arc(j.default_x, j.default_y, j.r / 4, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
    }
    //add_speed
    if (isMobile) {
        let d = add_speed;
        ctx.beginPath();
        ctx.beginPath();
        ctx.strokeStyle = "#0005";
        ctx.fillStyle = addOpacity("#fff", 0.2 + d.active / 3);
        if (d.active) {
            ctx._arc(d.x, d.y, d.r, 0, Math.PI * 2);
        } else {
            ctx._arc(d.default_x, d.default_y, d.r, 0, Math.PI * 2);
        }
        ctx.fill();
        if (d.active) {
            fillText("🍌", d.x, d.y, addOpacity("#000", 0.7 + d.active / 10 * 3), 0, `${d.r}px Arial`);
        } else {
            fillText("🍌", d.default_x, d.default_y, addOpacity("#000", 0.7 + d.active / 10 * 3), 0, `${d.r}px Arial`);
        }
    }

    ctx.lineWidth = 8;
    //buttons
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].draw();
    }

    fillText("flsc", 50, 50, addOpacity("#0f0", 1 - buttons[0].hover / 3), 0);
    fillText("fps", 130, 50, addOpacity("#0f0", 1 - buttons[1].hover / 3), 0);
    if(isMobile){
        fillText("rank",210, 50, addOpacity("#0f0", 1 - buttons[0].hover / 3), 0);
    }
    
    const sortedSnakes = [...client_snakes].sort((a, b) => b.score - a.score);
    // rank
    if (showRank) {
        let lx = cvs.width / 3 - 10;
        let ly = 130;
        let r = Math.min(200, cvs.width / 3);
        
        // title
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
                ctx._fillRect(lx - 85, yOffset - 35, r * 2 + 90, 40); 
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
    fillText(`${myRank}/${totalPlayers}`, cvs.width-55, 80, addOpacity("#eee", 1), 0);

    //draw fps
    if (showFps) {
        let text = `fps:${fps}`;
        ctx.font = '40px Arial';
        ctx.fillStyle = '#0f0';
        ctx.textAlign = 'right';
        let x = cvs.width - 10;
        let y = 40;
        ctx.fillText(text, x, y);
    }

    fillText(`ping:${ping}ms`, cvs.width-85, 150, addOpacity("#0ff", 1), 0);
    ctx.restore();
}
function bk() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.save();
    ctx.fillStyle = "#181818";
    ctx.fillRect(-margin, -margin, map.width + margin * 2, map.height + margin * 2);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.restore();
}
function bindCamera(ctx, camera) {
    ctx._moveTo = ctx.moveTo;
    ctx._lineTo = ctx.lineTo;
    ctx._arc = ctx.arc;
    ctx._fillRect = ctx.fillRect;

    ctx.moveTo = function (x, y) {
        this._moveTo(x - camera.x, y - camera.y);
    };

    ctx.lineTo = function (x, y) {
        this._lineTo(x - camera.x, y - camera.y);
    };

    ctx.arc = function (x, y, radius, startAngle, endAngle, anticlockwise) {
        this._arc(x - camera.x, y - camera.y, radius, startAngle, endAngle, anticlockwise);
    };
    ctx.fillRect = function (x, y, w, h) {
        this._fillRect(x - camera.x, y - camera.y, w, h);
    };
}
function player_input() {
    const speed = 250;
    let dx = 0, dy = 0;
    
    if (isMobile && joystick.active && (joystick.sx != 0 || joystick.sy != 0)) {
        let j = joystick;
        let v = speed * (1 + add_speed.active);
        let vv = Math.hypot(j.sx, j.sy);
        dx = (j.sx / vv) * v; 
        dy = (j.sy / vv) * v;
    } else {
        let v = speed * (1 + keys.shift);
        if ((keys.w || keys.s) && (keys.a || keys.d)) v /= Math.sqrt(2);
        if (keys.w > keys.s) dy = -v;
        else if (keys.s > keys.w) dy = v;
        if (keys.a > keys.d) dx = -v;
        else if (keys.d > keys.a) dx = v;
    }
    
    socket.emit('playerInput', { dx: dx, dy: dy});
}
function updateCamera() {
    let mySnake = client_snakes.find(s => s.id == my_id);
    if(!mySnake) return;
    let head ={x:mySnake.x,y:mySnake.y};
    if (!head) return;
    let targetX = head.x + rr - camera.width / 2;
    let targetY = head.y + rr - camera.height / 2;
    camera.x = Math.max(-margin, Math.min(targetX, map.width - camera.width + margin));
    camera.y = Math.max(-margin, Math.min(targetY, map.height - camera.height + margin));
    if (map.width < camera.width) camera.x = -(camera.width - map.width) / 2;
    if (map.height < camera.height) camera.y = -(camera.height - map.height) / 2;
}
function updateFps() {
    let time = Date.now();
    if (lastTime) {
        const deltaTime = time - lastTime; frameCount++;
        if (deltaTime > 100) { fps = Math.round(frameCount * 1000 / deltaTime); frameCount = 0; lastTime = time; }
    }
}
function update() {
    updateFps();
    updateCamera();
    player_input();
    if(updating){
        bk();
        draw();
        updating=0;
    }
    requestAnimationFrame(update);
}
function initButtons() {
    buttons = [];
    
    //fullscreen
    let button_flsc = new Button(1, () => {
        setTimeout(() => {
            if (isFullScreen()) exitFullScreen();
            else enterFullScreen();
        }, 100);
    }, ctx); 
    button_flsc.addShape(new Path2D(`${svgarc(50, 50, 30)}`), '#fff8', 0, 'fill');
    button_flsc.addShape(new Path2D(`${svgarc(50, 50, 30)}`), '#fff5', 1, 'fill');
    buttons.push(button_flsc);
    //fps
    let button_fps = new Button(1, () => {
        showFps ^= 1;
    }, ctx);
    button_fps.addShape(new Path2D(`${svgarc(130, 50, 30)}`), '#fff8', 0, 'fill');
    button_fps.addShape(new Path2D(`${svgarc(130, 50, 30)}`), '#fff5', 1, 'fill');
    buttons.push(button_fps);
    //rank(isMobile)
    if(!isMobile) return;
    let button_rank = new Button(1, () => {
        showRank ^= 1;
    }, ctx);
    button_rank.addShape(new Path2D(`${svgarc(210, 50, 30)}`), '#fff8', 0, 'fill');
    button_rank.addShape(new Path2D(`${svgarc(210, 50, 30)}`), '#fff5', 1, 'fill');
    buttons.push(button_rank);
}
//event
window.addEventListener('resize', setcvswh);
document.onkeydown = (e) => {
    if (e.key == 'ArrowUp' || e.key == 'w' || e.key == 'W') keys.w = Date.now();
    if (e.key == 'ArrowLeft' || e.key == 'a' || e.key == 'A') keys.a = Date.now();
    if (e.key == 'ArrowDown' || e.key == 's' || e.key == 'S') keys.s = Date.now();
    if (e.key == 'ArrowRight' || e.key == 'd' || e.key == 'D') keys.d = Date.now();
    if (e.key == 'Shift') keys.shift = 1;
    if (e.key == 'q' || e.key == 'Q') showRank = 1; 
}
document.onkeyup = (e) => {
    if (e.key == 'ArrowUp' || e.key == 'w' || e.key == 'W') keys.w = 0;
    if (e.key == 'ArrowLeft' || e.key == 'a' || e.key == 'A') keys.a = 0;
    if (e.key == 'ArrowDown' || e.key == 's' || e.key == 'S') keys.s = 0;
    if (e.key == 'ArrowRight' || e.key == 'd' || e.key == 'D') keys.d = 0;
    if (e.key == 'Shift') keys.shift = 0;
    if (e.key == 'q' || e.key == 'Q') showRank = 0; 
}
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
socket.on('pong', () => {
  ping = Date.now() - lastPingTime;
});
setInterval(() => {
  lastPingTime = Date.now();
  socket.emit('ping');
}, 1000);
//connect
socket.on('connect', () => {
    let name=prompt("Enter your name:", "Player");
    if(name==null || name.trim()=="") name="Player";
    socket.emit('setName', { name: name  });
});
//start
socket.on('start', (data) => {
    my_id = data.id; rr = data.rr; map = data.map;
    setcvswh();
    bindCamera(ctx, camera);
    initButtons();
    disableMobileScrolling();
    lastTime = Date.now();
    gameWorker.postMessage({ type: 'init', rr: rr ,my_id: my_id});
    requestAnimationFrame(update);
});
//game state
socket.on('gameState', (state) => {
    //to worker
    gameWorker.postMessage({ type: 'game_state', state: state });
});