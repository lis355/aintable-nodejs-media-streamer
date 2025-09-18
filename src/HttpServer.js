import express from "express";
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
			.get("/media.m3u8", async (req, res) => {
				if (this.mediaManifest) {
					const manifest = await this.mediaManifest.getManifest();

					return res
						.contentType("application/vnd.apple.mpegurl")
						.status(httpStatus.OK)
						.send(manifest.localManifest.m3u8Text);
				}

				return res.sendStatus(httpStatus.NOT_FOUND);
			})
			.get("/{:channel}-{:channelIndex}.m3u8", async (req, res) => {
				if (this.mediaManifest) {
					const channel = req.params.channel;
					if (channel === "audio" ||
						channel === "video") {
						const channelIndex = Number(req.params.channelIndex) - 1;

						const manifest = await this.mediaManifest.getManifest();

						const channelManifest = manifest.localManifest.channelManifests[channel][channelIndex];
						if (channelManifest) {
							const manifest = await channelManifest.getManifest();

							return res
								.contentType("application/vnd.apple.mpegurl")
								.status(httpStatus.OK)
								.send(manifest.localManifest.m3u8Text);
						}
					}
				}

				return res.sendStatus(httpStatus.NOT_FOUND);
			})
			.get("/segments/{:channel}-{:channelIndex}/{:segmentNumber}.ts", async (req, res) => {
				if (this.mediaManifest) {
					const channel = req.params.channel;
					if (channel === "audio" ||
						channel === "video") {
						const channelIndex = Number(req.params.channelIndex) - 1;

						const manifest = await this.mediaManifest.getManifest();

						const channelManifest = manifest.localManifest.channelManifests[channel][channelIndex];
						if (channelManifest) {
							const manifest = await channelManifest.getManifest();

							const segmentNumber = Number(req.params.segmentNumber) - 1;
							const segmentInfo = manifest.localManifest.segmentInfos[segmentNumber];
							if (segmentInfo) {
								const segmentBuffer = await this.application.mediaProvider.getSegmentBuffer(segmentInfo.url);

								return res
									.contentType(`${channel}/mp2t`)
									.status(httpStatus.OK)
									.send(segmentBuffer);
							}
						}
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

	registerMediaManifest(mediaManifest) {
		this.mediaManifest = mediaManifest;

		this.application.mediaProvider.clearSegmentBuffersCache();

		console.log(`media manifest registered on ${this.url.href}media.m3u8`);
	}

	unregisterMediaManifest() {
		this.mediaManifest = undefined;

		console.log("media manifest unregistered");
	}
}
