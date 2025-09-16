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
