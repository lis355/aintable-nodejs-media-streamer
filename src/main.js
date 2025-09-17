import childProcess from "node:child_process";
import path from "node:path";

import _ from "lodash";
import { config as dotenv } from "dotenv-flow";
import fs from "fs-extra";

import { parseManifestStr, LocalMediaManifest, LocalChannelManifest } from "./LocalManifest.js";
import HttpServer from "./HttpServer.js";
import LordFilmMediaProvider from "./LordFilmMediaProvider.js";
import RequestsManager from "./RequestsManager.js";

import applicationInfo from "../package.json" with { type: "json" };

const isDevelopment = process.env.VSCODE_INJECTION &&
	process.env.VSCODE_INSPECTOR_OPTIONS;

const CWD = path.resolve(process.cwd());

dotenv({
	path: CWD // import.meta.dirname
});

const USER_DATA_DIRECTORY = path.join(CWD, process.env.USER_DATA || "userData");

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

class Application {
	constructor() {
		process.on("uncaughtException", error => { this.onUncaughtException(error); });
		process.on("unhandledRejection", error => { this.onUnhandledRejection(error); });

		const defaultErrorHandler = error => {
			console.error(error);
		};

		this.onUncaughtException = defaultErrorHandler;
		this.onUnhandledRejection = defaultErrorHandler;

		this.components = [];

		this.printLogo();
	}

	printLogo() {
		const logo = fs.readFileSync(path.join(CWD, "assets", "logo.txt")).toString().replace("############", `v ${applicationInfo.version}`.padStart(12, " "));

		console.log(logo);
	}

	addComponent(component) {
		component.application = this;

		this.components.push(component);
	}

	get isDevelopment() {
		return isDevelopment;
	}

	async initialize() {
		this.createUserDataDirectory();
		// this.createConfig();

		// const { default: FFMpegManager } = await import("./components/FFMpegManager.js");

		this.addComponent(this.httpServer = new HttpServer());
		this.addComponent(this.requestsManager = new RequestsManager());
		this.addComponent(this.mediaProvider = new LordFilmMediaProvider());

		for (let i = 0; i < this.components.length; i++) if (this.components[i].initialize) await this.components[i].initialize();
	}

	createUserDataDirectory() {
		// this.userDataDirectory = this.isDevelopment
		// 	? path.resolve(import.meta.dirname, "userData")
		// 	: path.resolve(process.env.APPDATA, filenamify(this.info.name));

		this.userDataDirectory = USER_DATA_DIRECTORY;

		fs.ensureDirSync(this.userDataDirectory);
	}

	// createConfig() {
	// 	this.configPath = path.resolve(this.userDataDirectory, "config.yaml");

	// 	let userConfig;
	// 	if (fs.existsSync(this.configPath)) {
	// 		try {
	// 			userConfig = YAML.parse(fs.readFileSync(this.configPath).toString());
	// 		} catch (error) {
	// 			console.error(`Error in reading config file: ${this.configPath}, please, edit or remove it`);

	// 			return this.application.exit(1);
	// 		}
	// 	}

	// 	this.config = _.merge({}, BASE_CONFIG, userConfig);

	// 	if (!userConfig) fs.outputFileSync(this.configPath, YAML.stringify(this.config));
	// }

	async run() {
		for (let i = 0; i < this.components.length; i++) if (this.components[i].run) await this.components[i].run();

		if (isDevelopment) console.warn("[isDevelopment]");
		console.log(`[userDataDirectory]: ${this.userDataDirectory}`);
		// console.log(`[config]: ${this.configPath}`);
		// console.log(`[config.outputDirectory]: ${this.config.outputDirectory}`);

		// const query = "Мартынко";
		const query = "дылда";

		console.log(`Searching for media "${query}"`);

		const searchResult = await this.mediaProvider.search(query);
		if (searchResult.length === 0) {
			console.log(`No media found for "${query}"`);
		} else {
			console.log(`Found ${searchResult.length} media items for "${query}"`);

			const mediaItem = _.first(searchResult);

			const mediaInfo = await this.mediaProvider.getMediaInfo(mediaItem);
			// console.log(JSON.stringify(mediaInfo, null, "\t"));

			const mediaManifestUrl = mediaInfo.source.hls;
			const mediaManifestResponse = await this.requestsManager.request(mediaManifestUrl);
			const mediaManifestStr = await mediaManifestResponse.text();
			// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "mediaManifest.txt"), mediaManifestStr);
			const mediaManifest = parseManifestStr(mediaManifestStr);
			// const mediaManifest = parseManifestStr(fs.readFileSync(path.join(USER_DATA_DIRECTORY, "mediaManifest.txt")).toString());
			const localMediaManifest = new LocalMediaManifest(mediaManifest, mediaManifestUrl, mediaInfo);
			localMediaManifest.compile();

			for (const videoManifestItem of localMediaManifest.videoManifestItems) {
				const videoManifestUrl = videoManifestItem.url;
				const videoManifestResponse = await this.requestsManager.request(videoManifestUrl);
				const videoManifestStr = await videoManifestResponse.text();
				// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "videoManifest.txt"), videoManifestStr);
				const videoManifest = parseManifestStr(videoManifestStr);
				// const videoManifest = parseManifestStr(fs.readFileSync(path.join(USER_DATA_DIRECTORY, "videoManifest.txt")).toString());
				const localVideoManifest = new LocalChannelManifest(videoManifestItem, videoManifest);
				localVideoManifest.compile();
				// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "localVideoManifest.txt"), localVideoManifest.compile());

				videoManifestItem.localManifest = localVideoManifest;

				// const videoFilePath = path.join(USER_DATA_DIRECTORY, "video.mp4");
				// await downloadAllMediaSegments(videoFilePath, videoManifestUrl, videoManifest);
			}

			for (const audioManifestItem of localMediaManifest.audioManifestItems) {
				const audioManifestUrl = audioManifestItem.url;
				const audioManifestResponse = await this.requestsManager.request(audioManifestUrl);
				const audioManifestStr = await audioManifestResponse.text();
				// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "audioManifest.txt"), audioManifestStr);
				const audioManifest = parseManifestStr(audioManifestStr);
				// const audioManifest = parseManifestStr(fs.readFileSync(path.join(USER_DATA_DIRECTORY, "audioManifest.txt")).toString());
				const localAudioManifest = new LocalChannelManifest(audioManifestItem, audioManifest);
				localAudioManifest.compile();
				// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "localAudioManifest.txt"), localAudioManifest.compile());

				audioManifestItem.localManifest = localAudioManifest;

				// const audioFilePath = path.join(USER_DATA_DIRECTORY, "audio.mp4");
				// await downloadAllMediaSegments(audioFilePath, audioManifestUrl, audioManifest);
			}

			// const mediaFilePath = path.join(USER_DATA_DIRECTORY, "out.mp4");
			// await joinAudioAndVideo(videoFilePath, audioFilePath, mediaFilePath);

			this.httpServer.registerMediaManifest(localMediaManifest);

			childProcess.spawn(process.env.MPC_PATH, [`${this.httpServer.url.href}media.m3u8`], { detached: true });
		}
	}

	async exit(code = 0) {
		for (let i = 0; i < this.components.length; i++) if (this.components[i].exit) await this.components[i].exit();

		process.exit(code);
	}
}

const application = new Application();
await application.initialize();
await application.run();
