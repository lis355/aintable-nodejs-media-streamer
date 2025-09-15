import fs from "node:fs";
import path from "node:path";
import timersPromises from "node:timers/promises";

// https://ru.wikipedia.org/wiki/MPEG-DASH

// p2p: Object.assign({
// 	packetSize: 16e3,
// 	rtc: {
// 		peerConnection: {
// 			iceServers: [
// 				{ urls: "stun:stun.fastscr.cc:3480" },
// 				{ urls: "stun:stun.l.google.com:19302" },
// 				{
// 					urls: "turn:turn.zcvh.net:443",
// 					username: 'brucewayne',
// 					credential: '54321'
// 				},
// 				{
// 					urls: "turns:turn.zcvh.net:443",
// 					username: 'brucewayne',
// 					credential: '54321'
// 				}
// 			],
// 			bundlePolicy: "max-compat"
// 		}
// 	},

// скачивание видео происходит matroska чанками
// для скачивания нужен url чанка + user-agent браузеровский в хидерах

// const r = await fetch("https://cdnr.xh8007l.ws/04_25/19/18/HV3M2M4U/22.1168547/233.webm?hc=5950b6c9af1b9b5&hi=906eafda208194c&ht=719fe96791bb5f6&hu=35594ec5bdac396&hui=8bd5a86a2901e37&t=1758564842&x-cdn=10551403&ha=01b3f403bbef147", {
// 	"headers": {
// 		"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
// 	},
// 	"method": "GET"
// });

// console.log("response status", r.status);

// const base64String = Buffer.from(await r.arrayBuffer()).toString("base64");

// console.log("base64 starts", base64String.substring(0, 10), "base64 response length", base64String.length);

// application/dash+xml

// application/vnd.apple.mpegurl .m3u8
