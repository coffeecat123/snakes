importScripts('tools.js');
var rr,my_id;
var worker_snakes_map = new Map();
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
    setTime() {
        this.lastTime = Date.now();
        this.waitTime = random(this.type * 500, this.type * 1000);
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
}

function processGameState(state) {
    //snake
    var next_snakes_map = new Map();
    var active_snakes_array = [];
    
    for (const s of state.snakes) {
        let snake;

        // 復用/創建邏輯
        if (worker_snakes_map.has(s.id)) {
            // 復用：取得現有實例並更新屬性
            snake = worker_snakes_map.get(s.id);
            
            // 更新屬性 (只更新狀態)
            snake.r=s.r;
            snake.x = s.x;
            snake.y = s.y;
            snake.dx = s.dx;
            snake.dy = s.dy;
            snake.score = s.score;
            snake.chscs = s.chscs;
            snake.err = s.err;
            
            let x=s.x, y=s.y;
            let b=snake.body;
            if (x != b[0].x || y != b[0].y) {
                b.unshift({ x, y });
            }
            else if (b.length > 1) {
                b.pop();
            }
            if(s.score<=0&&b.length > 1){
                b.splice(1);
            }
            let g = (x) => {
                return (x + 1) / 20 + Math.log10(x + 1) / Math.log10(100);
            };
            if (b.length > state.fps * g(s.score) / 2 && b.length > 1) {
                b.pop();
            }
        } else {
            // 創建：如果不存在，則創建新實例
            snake = new Snake(
                s.x, s.y, s.dx, s.dy, s.clr, s.type, s.name
            );
            // 設置其他屬性
            snake.r=s.r;
            snake.id = s.id;
            snake.score = s.score;
            snake.body = s.body;
            snake.chscs = s.chscs;
            snake.err = s.err;
        }

        next_snakes_map.set(s.id, snake);
        active_snakes_array.push(snake);
    }
    // 更新 Worker 中的 Map，釋放不需要的舊實例
    worker_snakes_map = next_snakes_map;

    //food
    const worker_foods = state.foods.map(f => new Food(f.x, f.y, f.type, f.dt));

    // 4. 返回數據給主執行緒
    return {
        snakes: active_snakes_array,
        foods: worker_foods,
        map: state.map,
        rr: state.rr
    };
}

// 4. 監聽主執行緒的訊息
self.onmessage = function(e) {
    const message = e.data;
    
    if (message.type === 'init') {
        rr = message.rr;
        my_id = message.my_id;
        return;
    }
    
    if (message.type === 'game_state') {
        const state = message.state;
        const processedData = processGameState(state);
        
        self.postMessage(processedData);
    }
};