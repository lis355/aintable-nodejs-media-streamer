import path from "node:path";

import express from "express";
import fs from "fs-extra";
import httpStatus from "http-status-codes";

const PORT = parseInt(process.env.HTTP_SERVER_PORT) || 5070;

export default class HttpServer {
	async initialize() {
		this.url = new URL(`http://localhost:${PORT}/`);

		this.expressApplication = express();
		this.expressApplication.disable("x-powered-by");
		this.expressApplication.set("etag", false);

		this.router = express.Router();

		this.router
			.use((req, res, next) => {
				// console.log(`${req.method} ${req.url} [${req.headers["user-agent"]}]`);

				return next();
			})
			.get("/media.m3u8", (req, res) => {
				if (this.manifestRegistered) {
					return res
						.contentType("application/vnd.apple.mpegurl")
						.status(httpStatus.OK)
						.send(this.mediaManifestBuffer);
					// .send(fs.readFileSync(path.join(this.application.userDataDirectory, "localMediaManifest.txt")));
				}

				return res.sendStatus(httpStatus.NOT_FOUND);
			})
			.get("/audio.m3u8", (req, res) => {
				if (this.manifestRegistered) {
					return res
						.contentType("application/vnd.apple.mpegurl")
						.status(httpStatus.OK)
						.send(this.channelManifests.audio.manifestBuffer);
					// .send(fs.readFileSync(path.join(this.application.userDataDirectory, "localAudioManifest.txt")));
				}

				return res.sendStatus(httpStatus.NOT_FOUND);
			})
			.get("/video.m3u8", (req, res) => {
				if (this.manifestRegistered) {
					return res
						.contentType("application/vnd.apple.mpegurl")
						.status(httpStatus.OK)
						.send(this.channelManifests.video.manifestBuffer);
					// .send(fs.readFileSync(path.join(this.application.userDataDirectory, "localVideoManifest.txt")));
				}

				return res.sendStatus(httpStatus.NOT_FOUND);
			})
			.get("/segments/{:channel}/{:segmentNumber}.ts", async (req, res) => {
				if (this.manifestRegistered) {
					const channel = req.params.channel;
					const segmentNumber = Number(req.params.segmentNumber);
					const channelManifest = this.channelManifests[channel];
					if (channelManifest &&
						Number.isFinite(segmentNumber) &&
						segmentNumber >= 1 &&
						segmentNumber < channelManifest.manifest.segmentInfos.length) {
						const segmentInfo = channelManifest.manifest.segmentInfos[segmentNumber - 1];
						const segmentBuffer = await this.application.mediaProvider.getSegmentBuffer(segmentInfo.url);
						// const segmentBuffer = fs.readFileSync(path.join(this.application.userDataDirectory, "segments", channel, `${req.params.segmentNumber}.ts`));

						return res
							.contentType(`${channel}/mp2t`)
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
			console.log(`HTTP server is running on ${this.url.href}`);
		});
	}

	registerMediaManifest(localMediaManifest, localVideoManifest, localAudioManifest) {
		this.mediaManifest = localMediaManifest;
		this.mediaManifestBuffer = Buffer.from(this.mediaManifest.m3u8Text);
		this.channelManifests = {
			video: {
				manifest: localVideoManifest,
				manifestBuffer: Buffer.from(localVideoManifest.m3u8Text)
			},
			audio: {
				manifest: localAudioManifest,
				manifestBuffer: Buffer.from(localAudioManifest.m3u8Text)
			}
		};

		this.manifestRegistered = true;

		this.application.mediaProvider.clearSegmentBuffersCache();

		console.log(`media manifest registered on ${this.url.href}media.m3u8`);
	}

	unregisterMediaManifest() {
		this.mediaManifest = undefined;
		this.mediaManifestBuffer = undefined;
		this.channelManifests = undefined;
		this.manifestRegistered = false;

		console.log("media manifest unregistered");
	}
}
