import childProcess from "node:child_process";
import path from "node:path";

import _ from "lodash";
import { config as dotenv } from "dotenv-flow";
import fs from "fs-extra";

import HttpServer from "./HttpServer.js";
import LordFilmMediaProvider from "./LordFilmMediaProvider.js";
import MediaDownloader from "./MediaDownloader.js";
import MediaManifest from "./MediaManifest.js";
import RequestsManager from "./RequestsManager.js";

import applicationInfo from "../package.json" with { type: "json" };

const isDevelopment = process.env.VSCODE_INJECTION &&
	process.env.VSCODE_INSPECTOR_OPTIONS;

const CWD = path.resolve(process.cwd());

dotenv({
	path: CWD // import.meta.dirname
});

const USER_DATA_DIRECTORY = path.join(CWD, process.env.USER_DATA || "userData");


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
		this.addComponent(this.mediaDownloader = new MediaDownloader());

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

		const query = "никто 2"; // "Мартынко"

		console.log(`Searching for media "${query}"`);

		const searchResult = await this.mediaProvider.search(query);
		if (searchResult.length === 0) {
			console.log(`No media found for "${query}"`);
		} else {
			console.log(`Found ${searchResult.length} media items for "${query}": ${searchResult.map(mediaItem => `"${mediaItem.title}"`).join(", ")}`);

			const mediaItem = _.first(searchResult);

			const mediaInfo = await this.mediaProvider.getMediaInfo(mediaItem);
			const mediaManifest = new MediaManifest(this, mediaInfo);

			this.httpServer.registerMediaManifest(mediaManifest);

			childProcess.spawn(process.env.PLAYER_EXE_PATH, [`${this.httpServer.url.href}media.m3u8`], { detached: true });
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
