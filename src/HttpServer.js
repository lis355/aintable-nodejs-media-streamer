import fs from "node:fs";
import path from "node:path";

import express from "express";
import httpStatus from "http-status-codes";

const PORT = parseInt(process.env.HTTP_SERVER_PORT) || 5070;

export default class HttpServer {
	async initialize() {
		this.expressApplication = express();
		this.expressApplication.disable("x-powered-by");
		this.expressApplication.set("etag", false);

		this.router = express.Router();

		this.router.use((req, res, next) => {
			console.log(`${req.method} ${req.url} [${req.headers["user-agent"]}]`);

			return next();
		});

		this.router.get("/media.m3u8", (req, res) => {
			if (this.manifestBuffer) {
				return res
					.contentType("application/vnd.apple.mpegurl")
					.status(httpStatus.OK)
					.send(this.manifestBuffer);
			}

			return res.sendStatus(httpStatus.NOT_FOUND);
		});

		this.router.get("/s/{:n}.ts", (req, res) => {
			if (this.manifestBuffer) {
				const segmentNumber = Number(req.params.n);
				if (Number.isFinite(segmentNumber) &&
					segmentNumber >= 1 &&
					segmentNumber < this.videoSegmentInfos.length) {
					const segmentInfo = this.videoSegmentInfos[segmentNumber - 1];
					const segmentPath = segmentInfo;
					const segmentBuffer = fs.readFileSync(segmentPath);

					return res
						.contentType("video/mp2t")
						.status(httpStatus.OK)
						.send(segmentBuffer);
				}
			}

			return res.sendStatus(httpStatus.NOT_FOUND);
		});

		this.expressApplication.use(this.router);
	}

	async run() {
		this.expressApplication.listen(PORT, () => {
			this.url = new URL(`http://localhost:${PORT}/`);

			console.log(`HTTP server is running on ${this.url.href}`);
		});
	}

	registerMedia(manifestBuffer, videoManifestBuffer, videoSegmentInfos, audioManifestBuffer, audioSegmentInfos) {
		this.manifestBuffer = manifestBuffer;
		this.videoManifestBuffer = videoManifestBuffer;
		this.videoSegmentInfos = videoSegmentInfos;
		this.audioManifestBuffer = audioManifestBuffer;
		this.audioSegmentInfos = audioSegmentInfos;

		console.log(`media manifest registered on ${this.url.href}media.m3u8`);
	}

	unregisterMedia() {

	}
}
