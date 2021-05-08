const express = require('express');
const app = express();
const serv = require('http').createServer(app);
const io = require('socket.io')(serv);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/client/index.html');
});

app.use('client', express.static(__dirname + 'client'));

serv.listen(3000);
console.log("Server is up and run on port 3000.");

let SOCKET_LIST = {};

let Entity = ()=>{
    let self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
    }
    self.update = ()=>{
        self.updatePosition();
    }
    self.updatePosition = ()=>{
        self.x += self.spdX;
        self.y += self.spdY;
    }
    return self;
}

let Player = (id)=>{
    let self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;

    let super_update = self.update;
    self.update = ()=>{
        self.updateSpd();
        super_update();
    }

    self.updateSpd = ()=>{
        if(self.pressingRight)
            self.spdX = self.maxSpd;
        else if(self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;
        
        if(self.pressingUp)
            self.spdY = -self.maxSpd;
        else if(self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    }
    Player.list[id] = self;
    return self;
}
Player.list = {};
Player.onConnect = (socket)=>{
    let player = Player(socket.id);
    socket.on('keyPress', (data)=>{
        if(data.inputId === 'left')
            player.pressingLeft = data.state;
        else if(data.inputId === 'right')
            player.pressingRight = data.state;
        else if(data.inputId === 'up')
            player.pressingUp = data.state;
        else if(data.inputId === 'down')
            player.pressingDown = data.state;
    })
}

Player.onDisconnect = (socket)=>{
    delete Player.list[socket.id];
}

Player.update = ()=>{
    let pack = [];
    for(let i in Player.list){
        let player = Player.list[i];
        player.update();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number
        });
    }
    return pack;
}

let Bullet = (angle)=>{
    let self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle/180*Math.PI) * 10;
    self.spdY = Math.sin(angle/180*Math.PI) * 10;

    self.timer = 0;
    self.toRemove = false;
    let super_update = self.update;
    self.update = ()=>{
        if(self.timer++ > 100)
            self.toRemove = true;
        super_update();
    }
    Bullet.list[self.id] = self;
    return self;
}
Bullet.list = {};

Bullet.update = ()=>{
    if(Math.random() < 0.1){
        Bullet(Math.random() * 360);
    }

    let pack = [];
    for(let i in Bullet.list){
        let bullet = Bullet.list[i];
        bullet.update();

        if (bullet.toRemove == true) 
            delete Bullet.list[i];
        
        pack.push({
            x: bullet.x,
            y: bullet.y
        });
    }
    return pack;
}

let DEBUG = true;
io.sockets.on('connection', (socket)=>{
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    Player.onConnect(socket);

    socket.on('disconnect', ()=>{
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    })
    socket.on('sendMsgToServer', (data)=>{
        let playerName = ("" + socket.id).slice(2,7);
        for(let i in SOCKET_LIST){
            SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
        }
    })
    socket.on('evalServer', (data)=>{
        if(!DEBUG)
            return;
        
        let res = eval(data);
        socket.emit('evalAnswer', res);
    })
});

setInterval(()=>{
    let pack = {
        player: Player.update(),
        bullet: Bullet.update()
    }

    for(let i in SOCKET_LIST){
        let socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack);
    }
}, 1000/25)
