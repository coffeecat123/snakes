const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
var cvs = $("#cvs");
var ctx = cvs.getContext("2d");
var ti;
var default_clr = "#ff0000", buttons, snakes, foods;
var rr, paused, cnt, pointers = new Map();
var lastTime, frameCount, fps, showFps;
var currentSequence = "",timeout;
const margin = 50;
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
var map = {
    width: 0,
    height: 0
};
var keys = {
    w: 0,
    a: 0,
    s: 0,
    d: 0,
    shift: 0
};
var camera = {
    x: 0,
    y: 0,
    width: cvs.width,
    height: cvs.height
};
var joystick = {
    x: 0,
    y: 0,
    default_x: 0,
    default_y: 0,
    active: 0,
    id: -1,
    sx: 0,
    sy: 0,
    r: 85
};
var add_speed = {
    x: 0,
    y: 0,
    default_x: 0,
    default_y: 0,
    id: -1,
    r: 85 - 5,
    active: 0
};

//tool functions
function generateRandomUsername(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let username = '';
    for (let i = 0; i < length; i++) {
        username += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return username;
}
function getSmallerAbsoluteValue(a, b) {
    return Math.abs(a) < Math.abs(b) ? a : b;
}
function addOpacity(hex, opacity) {
    const alpha = Math.round(opacity * 255);
    const alphaHex = alpha.toString(16).padStart(2, '0');
    if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex + alphaHex;
}
function cmp(a, b, c) {
    return a <= b && b <= c;
}
function svgarc(x, y, r) {
    return `M ${x},${y} m ${-r},0 a ${r},${r} 0 1 1 ${r * 2},0 a ${r},${r} 0 1 1 ${-r * 2},0`;
}
function svgrec(x, y, w, h) {
    return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
}
function isFullScreen() {
    return !!(document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement);
}
function enterFullScreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}
function exitFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}
function getRandomColor() {
    const r = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const g = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const b = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
function DegToRad(a) {
    return a * Math.PI / 180;
}
function random(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
}
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0'); // Convert to Hex and pad with zeros
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2,
        r = 0,
        g = 0,
        b = 0;
    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return "rgb(" + r + "," + g + "," + b + ")";
}
//events
window.onfocus = () => {
    //paused = 0;
};
window.onblur = () => {
    paused = 1;
};
document.onfocusin = () => {
    //paused = 0;
};
document.onfocusout = () => {
    paused = 1;
};
window.addEventListener('resize', setcvswh);
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
    } else if (paused == 0) {
        if (x < cvs.width / 2) {
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
document.onkeydown = (e) => {
    if (e.key == 'ArrowUp' || e.key == 'w' || e.key == 'W') {
        keys.w = Date.now();
        snakes[0].type = 0;
    }
    if (e.key == 'ArrowLeft' || e.key == 'a' || e.key == 'A') {
        keys.a = Date.now();
        snakes[0].type = 0;
    }
    if (e.key == 'ArrowDown' || e.key == 's' || e.key == 'S') {
        keys.s = Date.now();
        snakes[0].type = 0;
    }
    if (e.key == 'ArrowRight' || e.key == 'd' || e.key == 'D') {
        keys.d = Date.now();
        snakes[0].type = 0;
    }
    if (e.key == 'Shift') {
        keys.shift = 1;
        snakes[0].type = 0;
    }

    clearTimeout(timeout);
    currentSequence += e.key.toLowerCase();
    
    if (currentSequence.includes('cft')) {
        if (snakes[0]?.type != undefined) {
            snakes[0].type = 1;
        }
        currentSequence = "";
    }
    
    timeout = setTimeout(() => {
        currentSequence = "";
    }, 1000);
}
document.onkeyup = (e) => {
    if (e.key == 'ArrowUp' || e.key == 'w' || e.key == 'W') {
        keys.w = 0;
    }
    if (e.key == 'ArrowLeft' || e.key == 'a' || e.key == 'A') {
        keys.a = 0;
    }
    if (e.key == 'ArrowDown' || e.key == 's' || e.key == 'S') {
        keys.s = 0;
    }
    if (e.key == 'ArrowRight' || e.key == 'd' || e.key == 'D') {
        keys.d = 0;
    }
    if (e.key == 'Shift') {
        keys.shift = 0;
    }
    if (e.key == 'Escape') {
        paused ^= 1;
    }
}
//classes
class Snake {
    constructor(x, y, dx, dy, clr, type, name) {
        //body[0] is head
        this.body = [{ x, y }];
        this.dx = dx;
        this.dy = dy;
        this.r = rr;
        this.clr = clr;
        this.type = type;
        if (type == 1) {
            this.name = '👑';
        } else {
            this.name = name;
        }
        this.score = 0;
        this.setTime();
        this.chscs = [];
        this.err = [];//error status
        this.err[0] = {
            lastTime: 0,
            waitTime: 0
        }
        this.err[1] = {
            lastTime: 0,
            waitTime: 0
        }
        //type:0 player
        //type:1-9 computer smart to stupid
    }
    move() {
        let [x, y] = [this.body[0].x, this.body[0].y];
        let b = this.body;
        if (this.type == 1 || (this.type > 0 && (Date.now() - this.lastTime > this.waitTime))) {
            this.set_v(x, y);
        }
        let dx = this.dx / fps, dy = this.dy / fps;
        if (Date.now() - this.err[1].lastTime < this.err[1].waitTime) {
            dx *= -1;
            dy *= -1;
        }
        x += dx;
        y += dy;
        if ((cmp(1, this.type, 5)) && (x > map.width - this.r || x < this.r || y > map.height - this.r || y < this.r)) {
            this.set_v(x, y);
        }
        x = Math.max(this.r, Math.min(x, map.width - this.r));
        y = Math.max(this.r, Math.min(y, map.height - this.r));

        for (let i = 0; i < snakes.length; i++) {
            let s = snakes[i];
            let k = 0.1, t = 1000 / 10;
            if (s == this) continue;
            if (s.score == this.score) continue;
            let s1 = s.score;
            let s2 = this.score;
            if (Math.hypot(x - s.body[0].x, y - s.body[0].y) < this.r + s.r
                && Date.now() - this.err[0].lastTime > this.err[0].waitTime
                && Date.now() - s.err[0].lastTime > s.err[0].waitTime) {
                if (this.r < s.r) {
                    this.chscore(-Math.min(k, s2), '-');
                    this.err[0].lastTime = Date.now();
                    this.err[0].waitTime = t;
                    s.chscore(+Math.min(k, s2));
                    s.err[0].lastTime = Date.now();
                    s.err[0].waitTime = t;
                }
                if (s.r < this.r) {
                    this.chscore(+Math.min(k, s1));
                    this.err[0].lastTime = Date.now();
                    this.err[0].waitTime = t;
                    s.chscore(-Math.min(k, s1), '-');
                    s.err[0].lastTime = Date.now();
                    s.err[0].waitTime = t;
                }
            }
        }
        for (let i = 0; i < foods.length; i++) {
            let f = foods[i];
            if (f.type == 0) {
                if (Math.hypot(x - f.x, y - f.y) < this.r
                    && (x - f.x) * (dx) + (y - f.y) * (dy) > 0) {

                    f.dt.to.x = random(this.r, map.width - this.r);
                    f.dt.to.y = random(this.r, map.height - this.r);
                    [x, y] = [f.dt.to.x, f.dt.to.y];
                    f.x = random(this.r, map.width - this.r);
                    f.y = random(this.r, map.height - this.r);
                    this.chscore(1);
                    break;
                }
            }
            if (f.type == 1) {
                if (Math.hypot(x - f.x, y - f.y) < this.r + f.dt.r) {
                    if (Date.now() - this.err[1].lastTime > 1000 / 10) {
                        this.chscore(-0.5, '-');
                        this.err[1].lastTime = Date.now();
                        this.err[1].waitTime = 3000;
                    }
                    break;
                }
            }
            if (f.type == 2) {
                if (Math.hypot(x - f.x, y - f.y) < (this.r + f.dt.r) * 0.9) {
                    if (f.last_snake != this) {
                        this.chscore(-3, '-');
                    }
                    f.last_snake = this;
                    let v = Math.hypot(this.dx, this.dy) * (1 + Math.random());
                    let vv = Math.hypot(f.x - x, f.y - y);
                    f.dt.v.dx = (f.x - x) / vv * v;
                    f.dt.v.dy = (f.y - y) / vv * v;
                    break;
                }
            }
            if (f.type == 3) {
                if (Math.hypot(x - f.x, y - f.y) < (this.r + f.dt.r) * 0.9) {
                    this.chscore(f.dt.score);
                    foods.splice(i--, 1);
                    break;
                }
            }
        }
        if (x != b[0].x || y != b[0].y) {
            b.unshift({ x, y });
        }
        else if (b.length > 1) {
            b.pop();
        }
        if(this.score<=0&&b.length > 1){
            b.splice(1);
        }
        let g = (x) => {
            return (x + 1) / 20 + Math.log10(x + 1) / Math.log10(100);
        };
        if (b.length > fps * g(this.score) / 2 && b.length > 1) {
            b.pop();
        }
    }
    setTime() {
        this.lastTime = Date.now();
        this.waitTime = random(this.type * 500, this.type * 1000);
    }
    set_v(x, y) {
        this.setTime();
        let last_dx = this.dx, last_dy = this.dy;

        let cc = [...foods].filter((f) => {
            return f.type == 0;
        }).sort((a, b) => {
            let d1 = Math.hypot(x - a.x, y - a.y);
            let d2 = Math.hypot(x - b.x, y - b.y);
            return d1 - d2;
        });
        let closestFood = cc[0], cf = 0;

        let c2 = [...foods].filter((f) => {
            return f.type != 0;
        }).sort((a, b) => {
            let d1 = Math.hypot(x - a.x, y - a.y);
            let d2 = Math.hypot(x - b.x, y - b.y);
            return d1 - d2;
        });
        let closeM = c2[0], cm = 0;

        const p = Math.random();
        if (Date.now() - this.err[1].lastTime > this.err[1].waitTime
            && closestFood
            && p < (this.type - 9) ** 2 / 128 + 0.5) {
            let dx = closestFood.x - x;
            let dy = closestFood.y - y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                dx /= distance;
                dy /= distance;
            }
            const speed = random(200, 500);
            this.dx = dx * speed;
            this.dy = dy * speed;
        }
        else {
            this.dx = random(-200, 200);
            this.dy = random(-200, 200);
        }
        if (this.type == 1) {
            this.dx = last_dx;
            this.dy = last_dy;
            while (1) {
                let a = 0;
                for (let i = 0; i < c2.length; i++) {
                    let p1 = cc[cf];
                    let p2 = c2[i];
                    if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < p1.dt?.r + p2.dt?.r) {
                        a = 1;
                        break;
                    }
                }
                if (a) {
                    cf++;
                    if (cf >= cc.length) {
                        return;
                    }
                } else {
                    break;
                }
            }
            closestFood = cc[cf];
            let dx = closestFood.x - x;
            let dy = closestFood.y - y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                dx /= distance;
                dy /= distance;
            }
            let speed =400;
            this.dx = dx * speed;
            this.dy = dy * speed;
            if (closeM) {
                let c = { ...closeM };
                let b = { ...this.body[0] };
                let ddx = c.dt.v?.dx | 0;
                let ddy = c.dt.v?.dy | 0;
                for (let i = 0; i < fps / 20; i++) {
                    c.x += ddx / fps;
                    c.y += ddy / fps;
                    b.x += this.dx / fps;
                    b.y += this.dy / fps;
                    c.x = Math.min(Math.max(c.x, c.dt.r), map.width - c.dt.r);
                    c.y = Math.min(Math.max(c.y, c.dt.r), map.height - c.dt.r);
                    b.x = Math.min(Math.max(b.x, this.r), map.width - this.r);
                    b.y = Math.min(Math.max(b.y, this.r), map.height - this.r);
                    distance = Math.hypot(b.x - c.x, b.y - c.y);
                    if (distance < this.r + (c.dt?.r | 0) + Math.hypot(ddx, ddy) / fps * 2) {
                        dx = closeM.x - this.body[0].x;
                        dy = closeM.y - this.body[0].y;
                        distance = Math.hypot(dx, dy);
                        dx /= distance;
                        dy /= distance;
                        let lx = -dy, ly = dx;
                        let rx = dy, ry = -dx;
                        let l = lx * ddx + ly * ddy;
                        let r = rx * ddx + ry * ddy;
                        if (ddx == 0 && ddy == 0) {
                            let dx = this.body[0].x - closestFood.x;
                            let dy = this.body[0].y - closestFood.y;
                            l = lx * dx + ly * dy;
                            r = rx * dx + ry * dy;
                        }
                        if (l > r) {
                            this.dx = rx * speed;
                            this.dy = ry * speed;
                        } else {
                            this.dx = lx * speed;
                            this.dy = ly * speed;
                        }
                        let u = { ...this.body[0] };
                        let d1 = Math.hypot((u.x + this.dx) - closestFood.x, (u.y + this.dy) - closestFood.y);
                        let d2 = Math.hypot((u.x) - closestFood.x, (u.y) - closestFood.y);
                        if (d1 > d2&&(ddx!=0||ddy!=0)) {
                            this.dx = 0;
                            this.dy = 0;
                            let c = { ...closeM };
                            let b = { ...this.body[0] };
                            let ddx = c.dt.v?.dx | 0;
                            let ddy = c.dt.v?.dy | 0;
                            for (let i = 0; i < fps / 20; i++) {
                                c.x += ddx / fps;
                                c.y += ddy / fps;
                                c.x = Math.min(Math.max(c.x, c.dt.r), map.width - c.dt.r);
                                c.y = Math.min(Math.max(c.y, c.dt.r), map.height - c.dt.r);
                                distance = Math.hypot(b.x - c.x, b.y - c.y);
                                if (distance < this.r + (c.dt?.r | 0) + Math.hypot(ddx, ddy) / fps * 2) {
                                    dx = closeM.x - this.body[0].x;
                                    dy = closeM.y - this.body[0].y;
                                    distance = Math.hypot(dx, dy);
                                    dx /= distance;
                                    dy /= distance;
                                    this.dx = -dx * speed;
                                    this.dy = -dy * speed;
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
            }
            if (Date.now() - this.err[1].lastTime < this.err[1].waitTime) {
                this.dx *= -1;
                this.dy *= -1;
            }
        }
    }
    chscore(n, m = '+') {
        let s = this.score, n2;
        this.score += n;
        if (this.score < 0) {
            this.score = 0;
        }
        this.score = Number(this.score.toFixed(2));
        s = Number(s.toFixed(2));
        n = this.score - s;
        n = Number(n.toFixed(2));
        let c = {};
        c.lastTime = Date.now();
        c.waitTime = 1000;
        if (n > 0) {
            c.txt = `+${n}`;
        }
        else if (n < 0) {
            c.txt = `${n}`;
        }
        else {
            c.txt = `${m}0`;
        }
        this.chscs.push(c);
    }
    draw_head() {
        let s = this;
        let b = s.body[0];
        let alpha = Math.floor((1 - 0 / s.body.length) * 255);
        let r = this.r * (1 - 0 / s.body.length);
        alpha = alpha.toString(16).padStart(2, '0').toLowerCase();
        ctx.fillStyle = `${s.clr}${alpha}`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, 2 * Math.PI);
        ctx.fill();

        if (Date.now() - s.err[1].lastTime < s.err[1].waitTime) {
            fillText('?', s.body[0].x, s.body[0].y, "#fff", 1, `${this.r}px Arial`);
        }
        else {
            fillText(s.score, s.body[0].x, s.body[0].y, "#fff", 1, `${this.r / 1.5}px Arial`);
        }
        fillText(s.name, s.body[0].x, s.body[0].y - this.r * 1.5, "#fff", 1, `${this.r / 1.5}px Arial`);
        for (let i = 0; i < s.chscs.length; i++) {
            let c = s.chscs[i];
            if (Date.now() - c.lastTime < c.waitTime) {
                fillText(c.txt, s.body[0].x, s.body[0].y - this.r * 1.5 - this.r * 2 * (Date.now() - c.lastTime) / c.waitTime, addOpacity(hslToHex((540 - i * 34) % 360, 100, 50), 1 - (Date.now() - c.lastTime) / c.waitTime), 1, `${this.r / 1.5}px Arial`);
            } else {
                s.chscs.splice(i--, 1);
            }
        }
    }
    draw_body() {
        let s = this;
        for (let i = s.body.length - 1; i > 0; i--) {
            let b = s.body[i];
            let alpha = Math.floor((1 - i / s.body.length) * 255/1.5/Math.log10(this.score+1));
            let r = this.r * (1 - i / s.body.length);
            alpha = alpha.toString(16).padStart(2, '0').toLowerCase();
            ctx.fillStyle = `${s.clr}${alpha}`;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}
class Food {
    constructor(x, y, type, dt) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.dt = dt;//detail
        /*type:
        0:tp +1
        1:reverse -0.5
        2:shoot -3
        3:gift -10~+10
        */
    }
    do() {
        let [x, y] = [this.x, this.y];
        if (this.type == 0) {
            return;
        }
        if (this.type == 1 || this.type == 2) {
            x += this.dt.v.dx / fps;
            y += this.dt.v.dy / fps;
            if (x > map.width - this.dt.r || x < this.dt.r) {
                this.dt.v.dx *= -1;
            }
            if (y > map.height - this.dt.r || y < this.dt.r) {
                this.dt.v.dy *= -1;
            }
            x = Math.max(this.dt.r, Math.min(x, map.width - this.dt.r));
            y = Math.max(this.dt.r, Math.min(y, map.height - this.dt.r));
            this.x = x;
            this.y = y;
            return;
        }
    }
    draw() {
        let f = this;
        if (f.type == 0) {
            ctx.fillStyle = f.dt.clr;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
            ctx.arc(f.dt.to.x, f.dt.to.y, f.dt.r, 0, 2 * Math.PI);
            ctx.fill();
            fillText(f.dt.text[0], f.x, f.y, "#ff0000", 1);
            fillText(f.dt.text[1], f.dt.to.x, f.dt.to.y, "#ff0000", 1);
        }
        if (f.type == 1) {
            ctx.fillStyle = f.dt.clr;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
            ctx.fill();
            fillText(f.dt.text[0], f.x, f.y, "#ff0000", 1);
        }
        if (f.type == 2) {
            ctx.fillStyle = f.dt.clr;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
            ctx.fill();
            fillText(f.dt.text[0], f.x, f.y, "#ff0000", 1);
        }
        if (f.type == 3) {
            ctx.fillStyle = f.dt.clr;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.dt.r, 0, 2 * Math.PI);
            ctx.fill();
            fillText(f.dt.text[0], f.x, f.y, "#ff0000", 1);
        }
    }
}
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
        if (this.pausedShow != paused && this.pausedShow >= 0) return false;

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
        if (this.pausedShow != paused && this.pausedShow >= 0) return;

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
    for (let i = 0; i < foods.length; i++) {
        foods[i].draw();
    }


    const s = [...snakes].sort((a, b) => b.r - a.r);
    //draw snakes
    for (let i = 0; i < s.length; i++) {
        s[i].draw_body();
    }
    for (let i = s.length - 1; i >= 0; i--) {
        s[i].draw_head();
    }
    //joystick
    if (isMobile && !paused) {
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
    if (isMobile && !paused) {
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
    //blur
    if (paused) {
        ctx.fillStyle = "#18181860";
        ctx._fillRect(0, 0, cvs.width, cvs.height);
    }

    ctx.lineWidth = 8;
    //buttons
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].draw();
    }
    if (paused) {
        fillText("fps", 210, 50, addOpacity("#0f0", 1 - buttons[3].hover / 3), 0);
        fillText("flsc", 130, 50, addOpacity("#0f0", 1 - buttons[2].hover / 3), 0);
    }
    //rank
    if (paused) {
        let lx = cvs.width / 3 - 10;
        let ly = 130;
        let r = Math.min(200, cvs.width / 3);
        ctx.font = '40px Arial';
        ctx.fillStyle = '#f00';
        ctx.textAlign = 'right';
        ctx.fillText(`rank`, lx, ly);
        ctx.fillText(`name`, lx + r, ly);
        ctx.fillText(`score`, lx + r * 2, ly);
        const s = [...snakes].sort((a, b) => b.score - a.score);
        let a = 0;
        let t;
        for (let i = 0; i < s.length; i++) {
            if (s[i].score != s[i - 1]?.score) {
                a++;
            }
            if (s[i].name == '🐍') {
                ctx.save();
                ctx.fillStyle = "#3aa8";
                ctx._fillRect(lx - 85, i * 40 + 5 + ly, r * 2 + 90, 40);
                ctx.restore();
            }
            t = `${a}`;
            ctx.fillText(t, lx, (i + 1) * 40 + ly, r - 20);
            t = `${s[i].name}`;
            ctx.fillText(t, lx + r, (i + 1) * 40 + ly, r - 20);
            t = `${s[i].score}`;
            ctx.fillText(t, lx + r * 2, (i + 1) * 40 + ly, r - 20);
        }
    }

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
function move() {
    let g = (x) => {
        if (x >= 100) return Math.log10(x);
        return x / 100 + 1;
    };
    for (let i = 0; i < snakes.length; i++) {
        let s = snakes[i];
        s.r = rr * g(s.score) ** 0.5;
        s.move();
    }
    if (foods.map((f) => {
        return f.type;
    }).reduce((s, m) => {
        return s + (m == 3);
    }, 0) < 3) {
        if (random(0, 800 * 60 / fps) < 2) {
            foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 3,
                {
                    clr: '#555555', r: rr * 1.3, text: ['🎁'],
                    score: random(-10, 10)
                }));
        }
    }
    for (let i = 0; i < foods.length; i++) {
        let f = foods[i];
        f.do();
    }
}
function player_move() {
    const speed = 250;
    let dx = 0, dy = 0;
    if (isMobile) {
        let j = joystick;
        if (j.active && (j.sx != 0 && j.sy != 0)) {
            let v = speed * (1 + add_speed.active);
            let vv = Math.hypot(j.sx, j.sy);
            dx = getSmallerAbsoluteValue(j.sx / vv * v, j.sx * v / j.r * 2);
            dy = getSmallerAbsoluteValue(j.sy / vv * v, j.sy * v / j.r * 2);
        }
    } else {
        let v = speed * (1 + keys.shift);
        if ((keys.w || keys.s) && (keys.a || keys.d)) {
            v /= Math.sqrt(2);
        }
        if (keys.w || keys.s) {
            if (keys.w > keys.s) {
                dy = -v;
            } else {
                dy = v;
            }
        }
        if (keys.a || keys.d) {
            if (keys.a > keys.d) {
                dx = - v;
            } else {
                dx = v;
            }
        }
    }
    snakes[0].dx = dx;
    snakes[0].dy = dy;
}
function updateCamera() {

    let head = snakes[0].body[0];

    let targetX = head.x + rr - camera.width / 2;
    let targetY = head.y + rr - camera.height / 2;

    camera.x = Math.max(-margin, Math.min(targetX, map.width - camera.width + margin));
    camera.y = Math.max(-margin, Math.min(targetY, map.height - camera.height + margin));

    if (map.width < camera.width) {
        camera.x = -(camera.width - map.width) / 2;
    }
    if (map.height < camera.height) {
        camera.y = -(camera.height - map.height) / 2;
    }
}
function updateFps() {
    let time = Date.now();
    if (lastTime) {
        const deltaTime = time - lastTime;
        frameCount++;
        if (deltaTime > 100) {
            fps = Math.round(frameCount * 1000 / deltaTime);
            frameCount = 0;
            lastTime = time;
        }
    }
}
function update() {
    updateFps();
    if (paused == 0 && fps > 10) {
        cvs.style.touchAction = 'none';
        player_move();
        move();
    } else {
        cvs.style.touchAction = 'auto';
    }
    updateCamera();
    bk();
    draw();
    requestAnimationFrame(update);
}
function start(w = 3000, h = 3000) {
    setcvswh();
    map.width = w;
    map.height = h;
    lastTime = Date.now();
    fps = 60;
    frameCount = 0;
    cnt = 0;
    showFps = 0;
    paused = 0;
    rr = 30;
    default_clr = getRandomColor();

    snakes = [new Snake(random(0, map.width), random(0, map.height), 0, 0, default_clr, 0, '🐍')];
    for (let i = 0; i < 10; i++) {
        const k = 1.1;
        let t = Math.ceil(Math.log(1 + Math.random() * (k ** 8 - 1)) / Math.log(k) + 1);
        if (Math.random() * 100 < 5) t = 1;
        snakes.push(new Snake(
            random(0, map.width), random(0, map.height),
            random(-200, 200), random(-200, 200),
            getRandomColor(), t, generateRandomUsername(random(4, 8))));
    }
    foods = [];
    //w * h / 1000000 * 3
    for (let i = 0; i < w * h / 1000000 * 3; i++) {
        foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 0,
            {
                clr: '#555555', r: rr * 1.3, text: ['🍎', 'X'],
                to: {
                    x: random(rr, map.width - rr),
                    y: random(rr, map.height - rr)
                }
            }));
    }
    //w * h / 1000000 / 1.5
    for (let i = 0; i < w * h / 1000000 / 1.5; i++) {
        foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 1,
            {
                clr: '#555555', r: rr * 1.3, text: ['🍄', 'X'],
                v: {
                    dx: random(-200, 200), dy: random(-200, 200)
                }
            }));
    }
    //w * h / 1000000
    for (let i = 0; i < w * h / 1000000; i++) {
        foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 2,
            {
                clr: '#555555', r: rr * 1.3, text: ['🍇', 'X'],
                v: {
                    dx: 0, dy: 0
                },
                last_snake: -1
            }));
    }
    buttons = [];
    //pause button
    let button0 = new Button(0, () => {
        paused = 1;
    });
    let a = 5, b = 5, c = 10;
    button0.addShape(
        new Path2D(`${svgarc(50, 50, 40)}`),
        '#0005', -1, 'fill');
    button0.addShape(
        new Path2D(`${svgarc(50, 50, 30)}`),
        '#00ff00', 0, 'stroke');
    button0.addShape(
        new Path2D(`${svgrec(50 - a - b, 50 - c, b, 2 * c)}${svgrec(50 + a, 50 - c, b, 2 * c)}`),
        '#00ff00', 0, 'fill');
    button0.addShape(
        new Path2D(`${svgarc(50, 50, 30)}`),
        '#008800', 1, 'stroke');
    button0.addShape(
        new Path2D(`${svgrec(50 - a - b, 50 - c, b, 2 * c)}${svgrec(50 + a, 50 - c, b, 2 * c)}`),
        '#008800', 1, 'fill');
    buttons.push(button0);
    //play button
    let button1 = new Button(1, () => {
        paused = 0;
    });
    button1.addShape(
        new Path2D(`${svgarc(50, 50, 40)}`),
        '#ffffff20', 0, 'fill');
    button1.addShape(
        new Path2D(`${svgarc(50, 50, 30)}`),
        '#0000cc', 0, 'stroke');
    button1.addShape(
        new Path2D(`M 50,50 m -10,-20 l 30,20 l -30,20 Z`),
        '#0000cc', 0, 'fill');
    button1.addShape(
        new Path2D(`${svgarc(50, 50, 40)}`),
        '#ffffff50', 1, 'fill');
    button1.addShape(
        new Path2D(`${svgarc(50, 50, 30)}`),
        '#0000ff', 1, 'stroke');
    button1.addShape(
        new Path2D(`M 50,50 m -10,-20 l 30,20 l -30,20 Z`),
        '#0000ff', 1, 'fill');
    buttons.push(button1);
    //fullscreen
    let button2 = new Button(1, () => {
        setTimeout(() => {
            if (isFullScreen()) {
                exitFullScreen();
            } else {
                enterFullScreen();
            }
        }, 100);
    });
    button2.addShape(
        new Path2D(`${svgarc(130, 50, 30)}`),
        '#fff8', 0, 'fill');
    button2.addShape(
        new Path2D(`${svgarc(130, 50, 30)}`),
        '#fff5', 1, 'fill');
    buttons.push(button2);
    //show fps
    let button3 = new Button(1, () => {
        showFps ^= 1;
    });
    button3.addShape(
        new Path2D(`${svgarc(210, 50, 30)}`),
        '#fff8', 0, 'fill');
    button3.addShape(
        new Path2D(`${svgarc(210, 50, 30)}`),
        '#fff5', 1, 'fill');
    buttons.push(button3);
    //playing
    update();
}
bindCamera(ctx, camera);
start();