// const express = require("express");
// const fs = require("fs");

// const app = express();

// const port = 3000;

// app.use(express.static("public"));

// const filePath = "C:/Programming/JS/node-ytdwnld/userData/videoCache/xVWeRnStdSA.mp4";

// app.get("/works-in-chrome", (req, res) => {
// 	res.setHeader("content-type", "video/mp4");

// 	fs.stat(filePath, (err, stat) => {
// 		if (err) {
// 			console.error(`File stat error for ${filePath}.`);
// 			console.error(err);
// 			res.sendStatus(500);
// 			return;
// 		}

// 		res.setHeader("content-length", stat.size);

// 		const fileStream = fs.createReadStream(filePath);
// 		fileStream.on("error", error => {
// 			console.log(`Error reading file ${filePath}.`);
// 			console.log(error);
// 			res.sendStatus(500);
// 		});

// 		fileStream.pipe(res);
// 	});
// });

// app.get("/works-in-chrome-and-safari", (req, res) => {

// 	const options = {};

// 	let start;
// 	let end;

// 	const range = req.headers.range;
// 	if (range) {
// 		const bytesPrefix = "bytes=";
// 		if (range.startsWith(bytesPrefix)) {
// 			const bytesRange = range.substring(bytesPrefix.length);
// 			const parts = bytesRange.split("-");
// 			if (parts.length === 2) {
// 				const rangeStart = parts[0] && parts[0].trim();
// 				if (rangeStart && rangeStart.length > 0) {
// 					options.start = start = parseInt(rangeStart);
// 				}
// 				const rangeEnd = parts[1] && parts[1].trim();
// 				if (rangeEnd && rangeEnd.length > 0) {
// 					options.end = end = parseInt(rangeEnd);
// 				}
// 			}
// 		}
// 	}

// 	res.setHeader("content-type", "video/mp4");

// 	fs.stat(filePath, (err, stat) => {
// 		if (err) {
// 			console.error(`File stat error for ${filePath}.`);
// 			console.error(err);
// 			res.sendStatus(500);
// 			return;
// 		}

// 		let contentLength = stat.size;

// 		if (req.method === "HEAD") {
// 			res.statusCode = 200;
// 			res.setHeader("accept-ranges", "bytes");
// 			res.setHeader("content-length", contentLength);
// 			res.end();
// 		}
// 		else {
// 			let retrievedLength;
// 			if (start !== undefined && end !== undefined) {
// 				retrievedLength = (end + 1) - start;
// 			}
// 			else if (start !== undefined) {
// 				retrievedLength = contentLength - start;
// 			}
// 			else if (end !== undefined) {
// 				retrievedLength = (end + 1);
// 			}
// 			else {
// 				retrievedLength = contentLength;
// 			}

// 			res.statusCode = start !== undefined || end !== undefined ? 206 : 200;

// 			res.setHeader("content-length", retrievedLength);

// 			if (range !== undefined) {
// 				res.setHeader("content-range", `bytes ${start || 0}-${end || (contentLength - 1)}/${contentLength}`);
// 				res.setHeader("accept-ranges", "bytes");
// 			}

// 			const fileStream = fs.createReadStream(filePath, options);
// 			fileStream.on("error", error => {
// 				console.log(`Error reading file ${filePath}.`);
// 				console.log(error);
// 				res.sendStatus(500);
// 			});

// 			fileStream.pipe(res);
// 		}
// 	});
// });

// app.listen(port, () => {
// 	console.log(`Open your browser and navigate to http://localhost:${port}`);
// });

(async () => {
	// const r = await fetch("https://cdnr.xh8007l.ws/x-en-x/khQ4RvAxYa8ckX8akn8xFn8xFC9LyvkkRw00yn8aRa4xRBz4kBA3YBRURBwaYoKezr0/HiE9RhXpR2z0RhkpzryrRBA3OrZvjBb5kBlpkrR5zmzxzvepknSfHB05RhSezmSwzBLcFhE5kiRrHtA9zvb1kBlrkGbGSvQ0RhkvOrZ1jBR1kBw0SmR1zrsZzGR5kpSfKmw9FiOwkmE4krEaFBDxSBR3OoA9RBq1FhbaFhA0FnS4YmkwMv0xRhb1RBAcRc==", {
	// 	"headers": {
	// 		"accept": "*/*",
	// 		"accept-language": "en-US,en;q=0.9,de;q=0.8",
	// 		"sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
	// 		"sec-ch-ua-mobile": "?0",
	// 		"sec-ch-ua-platform": "\"Windows\"",
	// 		"sec-fetch-dest": "empty",
	// 		"sec-fetch-mode": "cors",
	// 		"sec-fetch-site": "cross-site",
	// 		"Referer": "https://api.namy.ws/"
	// 	},
	// 	"body": null,
	// 	"method": "GET"
	// });

	// console.log(r.status);

	// const b = await r.arrayBuffer();

	// console.log(Buffer.from(b).toString());

	const r = await fetch("https://cdnr.xh8007l.ws/x-en-x/khQ4RvAxYa8ckX8akn8xFn8xFC9LyvkkRw00yn8aRa4xRBz4kBA3YBRURBwaYoKezr0/HiE9RhXpR2z0RhkpzryrRBA3OrZvjBb5kBlpkrR5zmzxzvepknSfHB05RhSezmSwzBLcFhE5kiRrHtA9zvb1kBlrkGbGSvQ0RhkvOrZ1jBR1kBw0SmR1zrsZzGR5kpSfKmw9FiOwkmE4krEaFBDxSBR3OoA9RBq1FhbaFhA0FnS4YmkwMv0xRhb1RBAcRc==", {
		"headers": {
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
		},
		"method": "GET"
	});

	console.log("response status", r.status);

	const base64String = Buffer.from(await r.arrayBuffer()).toString("base64");

	console.log("base64 starts", base64String.substring(0, 10), "base64 response length", base64String.length);

	// process.exit(0);
})();
