import childProcess from "node:child_process";

import fs from "fs-extra";
import LineTransformStream from "line-transform-stream";

function parseDuration(str) {
	let duration = 0;

	const match = /(\d\d):(\d\d):(\d\d)/.exec(str);
	if (match &&
		match.length === 4) {
		const [h, m, s] = match.slice(1).map(Number);

		duration = 1000 * (s + 60 * (m + 60 * h));
	}

	return duration;
}

export default class FFMpegManager {
	async initialize() {
	}

	async checkFFMpeg() {
		if (this.__checked) return;

		this.__checkExePath();

		await this.__checkVersion();

		this.__checked = true;
	}

	__checkExePath() {
		this.ffmpegExePath = process.env.FFMPEG_EXE_PATH;
		if (!fs.existsSync(this.ffmpegExePath)) throw new Error("Please, provide FFMPEG_EXE_PATH to ffmpeg.exe");
	}

	async __checkVersion() {
		if (!await this.getVersion()) throw new Error("Bad FFMpeg version");
	}

	createFFMpegProcess(args) {
		const cmd = `"${this.ffmpegExePath}" -hide_banner ${args}`;

		// console.log("[FFMpegManager]:", cmd);

		const ffmpegProcess = childProcess.exec(cmd);

		ffmpegProcess.stderr
			.pipe(new LineTransformStream(line => {
				// console.log("ffmpeg:", line);

				if (line.toLowerCase().indexOf("error") >= 0) throw new Error(line);

				return line;
			}));

		return ffmpegProcess;
	}

	async getVersion() {
		let version;

		const ffmpegProcess = this.createFFMpegProcess("-version");

		ffmpegProcess.stdout
			.pipe(new LineTransformStream(line => {
				// console.log(line);

				const versionIndex = line.toLowerCase().indexOf("ffmpeg version");
				if (versionIndex >= 0) {
					try {
						version = line.substring(versionIndex + 1 + "ffmpeg version".length).split(" ")[0].trim();
					} catch (_) {
					}
				}

				return line;
			}));

		await new Promise((resolve, reject) => {
			ffmpegProcess.once("exit", () => version ? resolve(version) : reject(new Error("Bad version")));
			ffmpegProcess.once("error", reject);
		});

		return version;
	}

	async joinAudioAndVideo(videoFilePath, audioFilePath, outputMediaFilePath, { onProgress }) {
		const ffmpegProcess = this.createFFMpegProcess(`-y -i "${videoFilePath}" -i "${audioFilePath}" -progress pipe:1 "${outputMediaFilePath}"`); // -c:v copy -c:a copy

		let totalDuration = 0;
		let currentDuration = 0;

		ffmpegProcess.stderr
			.pipe(new LineTransformStream(line => {
				if (onProgress &&
					!totalDuration &&
					line.includes("Duration:")) {
					totalDuration = parseDuration(line);

					onProgress(0);
				}

				return line;
			}));

		ffmpegProcess.stdout
			.pipe(new LineTransformStream(line => {
				if (onProgress) {
					if (totalDuration &&
						line.includes("out_time=")) {
						currentDuration = parseDuration(line.replace("out_time=", ""));
						const progress = currentDuration / totalDuration;
						onProgress(progress);
					} else if (line.includes("progress=end")) {
						onProgress(1);
					}
				}

				return line;
			}));

		await new Promise((resolve, reject) => {
			ffmpegProcess.once("exit", code => code === 0 ? resolve() : reject(new Error(code.toString())));
			ffmpegProcess.once("error", reject);
		});
	}
};
