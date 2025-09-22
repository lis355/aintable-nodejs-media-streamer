import childProcess from "node:child_process";
import path from "node:path";

import _ from "lodash";
import { config as dotenv } from "dotenv-flow";
import { input, select } from "@inquirer/prompts";
import filenamify from "filenamify";
import fs from "fs-extra";

import FFMpegManager from "./FFMpegManager.js";
import HttpServer from "./HttpServer.js";
import LordFilmMediaProvider from "./LordFilmMediaProvider.js";
import MediaDownloader from "./MediaDownloader.js";
import MediaManifest from "./MediaManifest.js";
import RequestsManager from "./RequestsManager.js";

import packageInfo from "../package.json" with { type: "json" };

const isDevelopment = Boolean(process.env.VSCODE_INJECTION &&
	process.env.VSCODE_INSPECTOR_OPTIONS);

const projectFolder = path.resolve(import.meta.dirname, "..");

dotenv({
	path: projectFolder
});

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

		if (isDevelopment) console.warn("[isDevelopment]");
	}

	printLogo() {
		const logo = fs.readFileSync(path.join(projectFolder, "assets", "logo.txt")).toString().replace("############", `v ${packageInfo.version}`.padStart(12, " "));

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

		console.log(`[userDataDirectory]: ${this.userDataDirectory}`);

		this.addComponent(this.httpServer = new HttpServer());
		this.addComponent(this.requestsManager = new RequestsManager());
		this.addComponent(this.ffmpegManager = new FFMpegManager());
		this.addComponent(this.mediaProvider = new LordFilmMediaProvider());
		this.addComponent(this.mediaDownloader = new MediaDownloader());

		for (let i = 0; i < this.components.length; i++) if (this.components[i].initialize) await this.components[i].initialize();
	}

	createUserDataDirectory() {
		this.userDataDirectory = path.join(
			this.isDevelopment ? projectFolder : path.resolve(process.env.APPDATA, filenamify(packageInfo.name)),
			"userData"
		);

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

		// console.log(`[config]: ${this.configPath}`);
		// console.log(`[config.outputDirectory]: ${this.config.outputDirectory}`);

		this.checkPlayerExePath();

		await this.startSearch();
	}

	async exit(code = 0) {
		for (let i = 0; i < this.components.length; i++) if (this.components[i].exit) await this.components[i].exit();

		process.exit(code);
	}

	checkPlayerExePath() {
		this.playerExePath = process.env.PLAYER_EXE_PATH;
		if (!fs.existsSync(this.playerExePath)) throw new Error("Please, provide PLAYER_EXE_PATH to media player, I wish to recommended to you VLC Player");
	}

	async startSearch() {
		const answer = await input({
			message: "Enter search query:",
			required: true,
			validate: s => Boolean(s.trim())
		});

		const query = answer.trim();
		// const query = "мартынко";
		// const query = "Первозданная Америка";

		console.log("Searching media...");

		const searchResult = await this.mediaProvider.search(query);
		if (searchResult.length === 0) {
			console.log("No media found");

			await input({
				message: "Press Enter to next search"
			});

			setTimeout(() => {
				// console.clear();

				this.startSearch();
			}, 0);
		} else {
			function formatType(type) {
				switch (type) {
					case "film": return "фильм";
					case "series": return "сериал";
					case "cartoon": return "мультфильм";
					case "anime": return "аниме";
					default: throw new Error("Unknown media type");
				}
			}

			let mediaItem;
			if (searchResult.length > 1) {
				const searchItemIndex = await select({
					message: `Found ${searchResult.length} media items, select one of them:`,
					choices: searchResult.map((searchItem, searchItemIndex) => ({
						name: `${searchItem.title} (${formatType(searchItem.type)})`,
						value: searchItemIndex
					}))
				});

				mediaItem = searchResult[searchItemIndex];
			} else {
				mediaItem = searchResult[0];

				console.log(`${mediaItem.title} (${formatType(mediaItem.type)})`);
			}

			let mediaInfo = await this.mediaProvider.getMediaInfo(mediaItem);
			if (mediaItem.type === "series") mediaInfo = mediaInfo.seasons[0].episodes[0];

			const mediaManifest = new MediaManifest(this, mediaInfo);

			const mediaItemProcessType = await select({
				message: "Do you want watch media in player, or download it to disk?",
				choices: [
					{
						name: "Watch",
						value: "watch"
					},
					{
						name: "Download",
						value: "download"
					}
				]
			});
			// const mediaItemProcessType = "download";

			switch (mediaItemProcessType) {
				case "watch": {
					this.httpServer.registerMediaManifest(mediaManifest);

					const mediaPlayerProcess = childProcess.spawn(this.playerExePath, [`${this.httpServer.url.href}media.m3u8`], { detached: false });
					mediaPlayerProcess.once("close", () => {
						this.httpServer.unregisterMediaManifest();

						setTimeout(() => {
							// console.clear();

							this.startSearch();
						}, 0);
					});

					break;
				}
				case "download": {
					await this.ffmpegManager.checkFFMpeg();

					const manifest = await mediaManifest.getManifest();

					const videoChannelIndex = manifest.localManifest.channelManifests["video"].length === 1
						? 0
						: await select({
							message: "Select video channel",
							choices: manifest.localManifest.channelManifests["video"].map((channelManifest, channelIndex) => ({
								name: channelManifest.caption,
								value: channelIndex
							}))
						});

					const audioChannelIndex = manifest.localManifest.channelManifests["audio"].length === 1
						? 0
						: await select({
							message: "Select audio channel",
							choices: manifest.localManifest.channelManifests["audio"].map((channelManifest, channelIndex) => ({
								name: channelManifest.caption,
								value: channelIndex
							}))
						});

					const mediaFilePath = path.join(this.userDataDirectory, filenamify(`${mediaInfo.title} [${manifest.localManifest.channelManifests["video"][videoChannelIndex].caption}] [${manifest.localManifest.channelManifests["audio"][audioChannelIndex].caption}]`) + ".mp4");

					await this.mediaDownloader.downloadMediaManifest(mediaManifest, videoChannelIndex, audioChannelIndex, mediaFilePath);

					setTimeout(() => {
						// console.clear();

						this.startSearch();
					}, 0);

					break;
				}
				default: throw new Error("Unknown mediaItemProcessType");
			}
		}
	}
}

const application = new Application();
await application.initialize();
await application.run();
