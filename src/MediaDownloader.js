// async function joinAudioAndVideo(videoFilePath, audioFilePath, outputMediaFilePath) {
// 	const cmd = `ffmpeg -hide_banner -y -i "${videoFilePath}" -i "${audioFilePath}" -c:v copy -c:a copy "${outputMediaFilePath}"`;

// 	const ffmpegProcess = childProcess.exec(cmd);

// 	ffmpegProcess.stderr.on("data", data => {
// 		console.log(data.toString());
// 	});

// 	await new Promise((resolve, reject) => {
// 		ffmpegProcess.once("exit", code => code === 0 ? resolve() : reject(new Error(code.toString())));
// 		ffmpegProcess.once("error", reject);
// 	});
// }

export default class MediaDownloader {
	async initialize() {
	}
}
