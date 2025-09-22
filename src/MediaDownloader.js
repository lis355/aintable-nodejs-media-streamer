import path from "node:path";

import byteSize from "byte-size";
import cliProgress from "cli-progress";
import fs from "fs-extra";

export default class MediaDownloader {
	async initialize() {
	}

	async downloadMediaManifest(mediaManifest, videoChannelIndex, audioChannelIndex, mediaFilePath) {
		const manifest = await mediaManifest.getManifest();

		const channelManifests = [
			manifest.localManifest.channelManifests["video"][videoChannelIndex],
			manifest.localManifest.channelManifests["audio"][audioChannelIndex]
		];

		const downloadTempDirectory = path.join(this.application.userDataDirectory, "download");
		fs.ensureDirSync(downloadTempDirectory);

		for (const channelManifest of channelManifests) {
			if (!channelManifest) throw new Error("No channel");

			const manifest = await channelManifest.getManifest();

			let downloadedBytesAmount = 0;

			const progressBar = new cliProgress.SingleBar({
				hideCursor: true,
				barCompleteChar: "\u2588",
				barIncompleteChar: "\u2591",
				barsize: 80,
				format: (options, params) => {
					const approximateTotalBytesAmount = downloadedBytesAmount > 0
						? Math.floor(downloadedBytesAmount / params.progress)
						: 0;

					return `${cliProgress.Format.BarFormat(params.progress, options)}| ${(params.progress * 100).toFixed(2).padStart(6, "0")}% | ${byteSize(downloadedBytesAmount)} / ~${byteSize(approximateTotalBytesAmount)}`;
				}
			});

			channelManifest.channelTempPath = path.join(downloadTempDirectory, channelManifest.channel + ".mp4");

			const writeStream = fs.createWriteStream(channelManifest.channelTempPath);

			console.log(`[MediaDownloader]: downloading ${channelManifest.channel} channel ${channelManifest.caption}`);

			progressBar.start(manifest.localManifest.segmentInfos.length, 0, {});

			for (let segmentIndex = 0; segmentIndex < manifest.localManifest.segmentInfos.length; segmentIndex++) {
				const segmentInfo = manifest.localManifest.segmentInfos[segmentIndex];

				const segmentBuffer = await this.application.mediaProvider.getSegmentBuffer(segmentInfo);

				writeStream.write(segmentBuffer);

				downloadedBytesAmount += segmentBuffer.length;

				progressBar.update(segmentIndex + 1);
			}

			await new Promise(resolve => {
				writeStream.close(resolve);
			});

			progressBar.update(1);
			progressBar.stop();
		}

		console.log("[MediaDownloader]: converting media");

		const progressBar = new cliProgress.SingleBar({
			hideCursor: true,
			barCompleteChar: "\u2588",
			barIncompleteChar: "\u2591",
			barsize: 80,
			format: (options, params) => `${cliProgress.Format.BarFormat(params.progress, options)}| ${(params.progress * 100).toFixed(2).padStart(6, "0")}%`
		});

		progressBar.start(1, 0);

		await this.application.ffmpegManager.joinAudioAndVideo(
			channelManifests[0].channelTempPath,
			channelManifests[1].channelTempPath,
			mediaFilePath,
			{
				onProgress: progress => {
					progressBar.update(progress);
				}
			}
		);

		progressBar.update(1);
		progressBar.stop();

		fs.removeSync(downloadTempDirectory);

		console.log(`[MediaDownloader]: downloaded at ${mediaFilePath}`);
	}
}
