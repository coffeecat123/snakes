const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('js'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`link: http://${getLocalIP()}:${PORT}`);
});
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

var rr = 30; // snake radius
var map = { width: 3000, height: 3000 };
var snakes = {}; // id
var foods = [];
var fps = 60;

//tool
function generateRandomUsername(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let username = '';
    for (let i = 0; i < length; i++) {
        username += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return username;
}
function random(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
}
function getRandomColor() {
    const r = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const g = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const b = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
function cmp(a, b, c) {
    return a <= b && b <= c;
}
//class
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

        for (const s of Object.values(snakes)) {
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
}

function start_game() {
    let w = map.width, h = map.height;
    snakes = {};
    foods = [];

    // ai snake
    for (let i = 0; i < 10; i++) {
        const k = 1.1;
        let t = Math.ceil(Math.log(1 + Math.random() * (k ** 8 - 1)) / Math.log(k) + 1);
        if (Math.random() * 100 < 5) t = 1;
        let name = generateRandomUsername(random(4, 8));
        let id=`ai_${i}`;
        snakes[id] = new Snake(
            random(0, map.width), random(0, map.height),
            random(-200, 200), random(-200, 200),
            getRandomColor(), t, name);
        snakes[id].id=generateRandomUsername(16);
    }

    // food
    for (let i = 0; i < w * h / 1000000 * 3; i++) {
        foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 0,
            { clr: '#555555', r: rr * 1.3, text: ['🍎', 'X'], to: { x: random(rr, map.width - rr), y: random(rr, map.height - rr) } }));
    }
    for (let i = 0; i < w * h / 1000000 / 1.5; i++) {
        foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 1,
            { clr: '#555555', r: rr * 1.3, text: ['🍄', 'X'], v: { dx: random(-200, 200), dy: random(-200, 200) } }));
    }
    for (let i = 0; i < w * h / 1000000; i++) {
        foods.push(new Food(random(rr, map.width - rr), random(rr, map.height - rr), 2,
            { clr: '#555555', r: rr * 1.3, text: ['🍇', 'X'], v: { dx: 0, dy: 0 }, last_snake: -1 }));
    }
    setInterval(move, 1000 / fps);
}
function move() {
    let g = (x) => {
        if (x >= 100) return Math.log10(x);
        return x / 100 + 1;
    };
    const activeSnakes = Object.values(snakes); 
    for (const s of activeSnakes) {
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
    
    const state = {
        snakes: Object.values(snakes).map(s => {
            for (let i = 0; i < s.chscs.length; i++) {
                let c = s.chscs[i];
                if (Date.now() - c.lastTime >= c.waitTime) {
                    s.chscs.splice(i--, 1);
                }
            }
            return {
                id: s.id,
                x: s.body[0].x,
                y: s.body[0].y,
                dx: s.dx, 
                dy: s.dy,
                
                body: [s.body[0]],//only send head
                r: s.r,
                clr: s.clr,
                name: s.name,
                score: s.score,
                chscs: s.chscs,
                err: s.err,
                type: s.type
            };
        }),
        foods: foods.map(f => ({
            x: f.x,
            y: f.y,
            type: f.type,
            dt: { r: f.dt.r, text: f.dt.text, clr: f.dt.clr, to: f.type === 0 ? {x:Math.round(f.dt.to.x*10)/10,y:Math.round(f.dt.to.y*10)/10} : undefined }
        })),
        map: map,
        rr: rr,
        fps: fps
    };
    
    io.sockets.emit('gameState', state);
}

io.on('connection', (socket) => {
    console.log(`in: ${socket.id}, ${Object.keys(snakes).length}`);
    socket.on('setName', (data) => {
        const newSnake = new Snake(
            random(0, map.width), random(0, map.height), 0, 0, 
            getRandomColor(), 0, data.name);
        let id=socket.id;
        newSnake.id = id;
        snakes[id] = newSnake;

        socket.emit('start', { id: id, map: map, rr: rr });
    });
    socket.on('ping', () => {
        socket.emit('pong');
    });
    socket.on('playerInput', (data) => {
        const snake = snakes[socket.id];
        if (snake) {
            snake.dx = data.dx;
            snake.dy = data.dy;
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`out: ${socket.id}, ${Object.keys(snakes).length}`);
        delete snakes[socket.id]; 
    });
});
start_game();