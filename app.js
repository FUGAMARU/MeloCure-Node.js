/*const https = require("https");
const fs = require("fs");
const ws = require("ws");
let app = https.createServer({
    key: fs.readFileSync("/etc/letsencrypt/live/melocure.fugamaru.com/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/melocure.fugamaru.com/cert.pem")
}, (req, res) => {
    // ダミーリクエスト処理
    res.writeHead(200);
    res.end("All glory to WebSockets!\n");
}).listen(8080);
let s = new ws.Server({ server: app });*/

const http = require("http");
const ws = require("ws");
let app = http.createServer().listen(8080);
let s = new ws.Server({ server: app });

const ytdl = require("ytdl-core");
const { exec } = require("child_process");

let durations = [];
let connections = [];
let cnt = 0;
let queue = [{ "type": "init", "online": 0, "queue": [] }];

setInterval(() => {
    if (durations.length) {
        cnt++;
        if (durations[0] <= cnt * 1000) {
            console.log("◇Ended Playback => " + queue[0]["queue"][0][0]["title"]);
            queue[0]["queue"].shift();
            console.log("==========Current Queue State==========");
            console.log(queue[0]["queue"]);
            durations.shift();
            cnt = 0;
        }
    }
}, 1000);

s.on("connection", (ws) => {

    connections.push(ws);
    const date = new Date().toLocaleString();
    console.log(date + "  NewConnection!");

    ws.on("message", (args) => {
        const date = new Date().toLocaleString();
        const received = JSON.parse(args)[0];
        switch (received.type) {
            case "rfq":
                console.log("RFQ Received");
                queue[0]["online"]++;
                const send = [{ "type": "online", "users": queue[0]["online"] }];
                broadcast(JSON.stringify(send));
                ws.send(JSON.stringify(queue));
                break;
            case "add":
                console.log("==========Added a new content(" + date + ")==========");
                console.log(received);
                if (received.service == "youtube") {
                    if (!(fs.existsSync(`/home/fugamaru/nginx/melocure.fugamaru.com/YouTube/${received.id}.mp3`))) {//サービスがYouTubeでmp3ファイルを準備する必要がある場合
                        ytdl(`http://www.youtube.com/watch?v=${received.id}`, { filter: "audioonly", quality: "highestaudio" })
                            .pipe(fs.createWriteStream(`/home/fugamaru/nginx/melocure.fugamaru.com/YouTube/${received.id}.mp4`))
                            .on('close', () => {
                                exec(`ffmpeg -y -i /home/fugamaru/nginx/melocure.fugamaru.com/YouTube/${received.id}.mp4 /home/fugamaru/nginx/melocure.fugamaru.com/YouTube/${received.id}.mp3`, (error, stdout, stderr) => {
                                    if (error) {
                                        console.error(error);
                                        return;
                                    }
                                    console.log(stdout);
                                    console.log(stderr);
                                    console.log(`Conversion has been completed ! => ${received.id}.mp3`);
                                    const send = [{ "type": "add", "service": received.service, "id": received.id, "src": received.src, "title": received.title, "artists": received.artists, "preview": received.preview, "duration": received.duration }];
                                    broadcast(JSON.stringify(send));
                                    queue[0]["queue"].push(send);
                                    console.log("==========Current Queue State==========");
                                    console.log(queue[0]["queue"]);
                                    durations.push(received.duration);
                                    fs.unlinkSync(`/home/fugamaru/nginx/melocure.fugamaru.com/YouTube/${received.id}.mp4`);
                                });;
                            });
                    } else {//サービスがYouTubeで既にmp3ファイルの準備が整っていた場合(通常のWebSocketブロードキャスト)
                        const send = [{ "type": "add", "service": received.service, "id": received.id, "src": received.src, "title": received.title, "artists": received.artists, "preview": received.preview, "duration": received.duration }];
                        broadcast(JSON.stringify(send));
                        queue[0]["queue"].push(send);
                        console.log("==========Current Queue State==========");
                        console.log(queue[0]["queue"]);
                        durations.push(received.duration);
                    }
                } else {//サービスがYouTubeで無かった場合(通常のWebSocketブロードキャスト)
                    const send = [{ "type": "add", "service": received.service, "id": received.id, "src": received.src, "title": received.title, "artists": received.artists, "preview": received.preview, "duration": received.duration }];
                    broadcast(JSON.stringify(send));
                    queue[0]["queue"].push(send);
                    console.log("==========Current Queue State==========");
                    console.log(queue[0]["queue"]);
                    durations.push(received.duration);
                }
                break;
        }
    });

    ws.on("close", () => {
        const date = new Date().toLocaleString();
        console.log(date + "  Disconnected!");
        connections = connections.filter(function (conn, i) {
            return (conn === ws) ? false : true;
        });
        queue[0]["online"]--;
        const send = [{ "type": "online", "users": queue[0]["online"] }];
        broadcast(JSON.stringify(send));
    });
});

const broadcast = (message) => {
    connections.forEach(function (con, i) {
        con.send(message);
    });
};