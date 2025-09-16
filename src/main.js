import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import timersPromises from "node:timers/promises";

import _ from "lodash";
import { config as dotenv } from "dotenv-flow";
import { CookieJar } from "tough-cookie";
import { JSDOM } from "jsdom";
import m3u8Parser from "m3u8-parser";
import makeFetchCookie from "fetch-cookie";
import urlJoin from "url-join";

import HttpServer from "./HttpServer.js";

import applicationInfo from "../package.json" with { type: "json" };

const isDevelopment = process.env.VSCODE_INJECTION &&
	process.env.VSCODE_INSPECTOR_OPTIONS;

const CWD = path.resolve(process.cwd());

dotenv({
	path: CWD // import.meta.dirname
});

const USER_DATA_DIRECTORY = path.join(CWD, process.env.USER_DATA || "userData");

const USER_AGENT = process.env.USER_AGENT;
if (!USER_AGENT) console.warn("Empty USER_AGENT");

const cookieJar = new CookieJar();
const fetchCookie = makeFetchCookie(fetch, cookieJar);

function request(url, options) {
	return fetchCookie(
		url,
		_.merge(
			{},
			options,
			{
				headers: {
					"user-agent": USER_AGENT
				}
			}
		)
	);
}

const DOMAIN = process.env.DOMAIN;
const baseUrl = new URL(DOMAIN);

async function checkBaseUrl() {
	try {
		const response = await request(baseUrl.href, {
			signal: AbortSignal.timeout(3000)
		});

		if (response.status !== 200) throw new Error(`Статус ответа ${response.status}`);

		return true;
	} catch (error) {
		console.error(`${baseUrl.href} не работает, проверьте настройки (${[error.message, error.cause && error.cause.code, error.cause && error.cause.message].filter(Boolean).join(", ")})`);

		return false;
	}
}

async function search(queryStr) {
	const searchUrl = new URL(baseUrl);
	searchUrl.pathname = "search-result";

	const searchResponse = await request(searchUrl.href, {
		method: "POST",
		body: new URLSearchParams({
			do: "search",
			subaction: "search",
			story: queryStr.toLowerCase()
		})
	});

	const searchResponseHtml = await searchResponse.text();

	let document = (new JSDOM(searchResponseHtml)).window.document;

	const result = [];

	const searchItemElements = document.querySelectorAll(".th-item");
	for (const searchItemElement of searchItemElements) {
		const item = {
			title: searchItemElement.querySelector(".th-title").textContent,
			url: searchItemElement.querySelector("a[href]").getAttribute("href")
		};

		result.push(item);
	}

	return result;
}

async function getMediaInfo(url) {
	const mediaPageResponse = await request(url);
	const mediaPageResponseHtml = await mediaPageResponse.text();

	let document = (new JSDOM(mediaPageResponseHtml)).window.document;

	const iframeElement = document.querySelector(".tabs-b.video-box iframe");

	let mediaInfoPageUrl = iframeElement.getAttribute("src");
	if (mediaInfoPageUrl.startsWith("//")) mediaInfoPageUrl = "https:" + mediaInfoPageUrl;

	const mediaInfoPageResponse = await request(mediaInfoPageUrl);
	const mediaInfoPageResponseHtml = await mediaInfoPageResponse.text();

	document = (new JSDOM(mediaInfoPageResponseHtml)).window.document;

	const scriptElement = document.querySelector("script[data-name=mk]");
	const scriptStr = scriptElement.textContent;

	const mediaInfo = eval("(" + scriptStr.substring(scriptStr.indexOf("({") + 1, scriptStr.lastIndexOf("})") + 1) + ")");

	return mediaInfo;
}

function parseManifestStr(manifestStr) {
	const parser = new m3u8Parser.Parser();
	parser.push(manifestStr);
	parser.end();

	const manifest = parser.manifest;

	return manifest;
}

const SEGMENT_DOWNLOADING_COOLDOWN_IN_MILLISECONDS = 500;

async function downloadAllMediaSegments(filePath, manifestUrl, manifest) {
	const segmentBuffers = [];

	manifestUrl = new URL(manifestUrl);

	for (let segmentIndex = 0; segmentIndex < manifest.segments.length; segmentIndex++) {
		const segment = manifest.segments[segmentIndex];

		const url = new URL(urlJoin(manifestUrl.origin, ...manifestUrl.pathname.split("/").slice(0, -1), segment.uri));

		const segmentResponse = await request(url.href);
		const segmentBuffer = Buffer.from(await segmentResponse.arrayBuffer());

		// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "segments", `${(segmentIndex + 1).toString().padStart(5, "0")}.ts`), segmentBuffer);

		segmentBuffers.push(segmentBuffer);

		console.log(`Downloaded ${segmentIndex + 1}/${manifest.segments.length} segments`);

		if (segmentIndex < manifest.segments.length - 1) await timersPromises.setTimeout(SEGMENT_DOWNLOADING_COOLDOWN_IN_MILLISECONDS);
	}

	fs.writeFileSync(filePath, Buffer.concat(segmentBuffers));
}

async function joinAudioAndVideo(videoFilePath, audioFilePath, outputMediaFilePath) {
	const cmd = `ffmpeg -hide_banner -y -i "${videoFilePath}" -i "${audioFilePath}" -c:v copy -c:a copy "${outputMediaFilePath}"`;

	const ffmpegProcess = childProcess.exec(cmd);

	ffmpegProcess.stderr.on("data", data => {
		console.log(data.toString());
	});

	await new Promise((resolve, reject) => {
		ffmpegProcess.once("exit", code => code === 0 ? resolve() : reject(new Error(code.toString())));
		ffmpegProcess.once("error", reject);
	});
}

class LocalManifest {
	constructor(remoteManifest) {
		this.remoteManifest = remoteManifest;
	}

	compile() {
		const lines = [
			"#EXTM3U",
			"#EXT-X-VERSION:3",
			"#EXT-X-PLAYLIST-TYPE:VOD",
			"#EXT-X-MEDIA-SEQUENCE:1",
			`#EXT-X-TARGETDURATION:${Math.ceil(_.max(this.remoteManifest.segments.map(segment => segment.duration)))}`
		];

		for (let segmentIndex = 0; segmentIndex < this.remoteManifest.segments.length; segmentIndex++) {
			const segment = this.remoteManifest.segments[segmentIndex];

			lines.push(
				`#EXTINF:${segment.duration},`,
				`s/${(segmentIndex + 1).toString().padStart(5, "0")}.ts`
			);
		}

		lines.push("#EXT-X-ENDLIST");

		return lines.join("\n") + "\n";
	}
}

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

		this.addComponent(this.httpServer = new HttpServer());

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
		// this.createUserDataDirectory();
		// this.createConfig();

		// const { default: FFMpegManager } = await import("./components/FFMpegManager.js");

		// this.addComponent(this.ffmpegManager = new FFMpegManager());

		for (let i = 0; i < this.components.length; i++) await this.components[i].initialize && this.components[i].initialize();
	}

	// createUserDataDirectory() {
	// 	this.userDataDirectory = this.isDevelopment
	// 		? path.resolve(import.meta.dirname, "userData")
	// 		: path.resolve(process.env.APPDATA, filenamify(this.info.name));

	// 	fs.ensureDirSync(this.userDataDirectory);
	// }

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
		for (let i = 0; i < this.components.length; i++) await this.components[i].run && this.components[i].run();

		if (isDevelopment) console.warn("[isDevelopment]");
		console.log(`[userDataDirectory]: ${this.userDataDirectory}`);
		// console.log(`[config]: ${this.configPath}`);
		// console.log(`[config.outputDirectory]: ${this.config.outputDirectory}`);

		// if (!(await checkBaseUrl())) return;

		// const searchResult = await search("мартынко");
		// if (searchResult.length === 0) return;

		// const mediaItem = _.first(searchResult);

		// const mediaInfo = await getMediaInfo(mediaItem.url);
		// // console.log(JSON.stringify(mediaInfo, null, "\t"));

		// const mediaManifestResponse = await request(mediaInfo.source.hls);
		// const mediaManifestStr = await mediaManifestResponse.text();
		// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "mediaManifest.txt"), mediaManifestStr);
		// const mediaManifest = parseManifestStr(mediaManifestStr);
		// // const mediaManifest = parseManifestStr(fs.readFileSync(path.join(USER_DATA_DIRECTORY, "mediaManifest.txt")).toString());

		// const videoManifestUrl = mediaManifest.playlists[0].uri;
		// const videoManifestResponse = await request(videoManifestUrl);
		// const videoManifestStr = await videoManifestResponse.text();
		// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "videoManifest.txt"), videoManifestStr);
		// const videoManifest = parseManifestStr(videoManifestStr);
		const videoManifest = parseManifestStr(fs.readFileSync(path.join(USER_DATA_DIRECTORY, "videoManifest.txt")).toString());
		const localVideoManifest = new LocalManifest(videoManifest);
		fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "localVideoManifest.txt"), localVideoManifest.compile());

		// const videoFilePath = path.join(USER_DATA_DIRECTORY, "video.mp4");
		// await downloadAllMediaSegments(videoFilePath, videoManifestUrl, videoManifest);

		// const audioManifestUrl = mediaManifest.mediaGroups.AUDIO["audio0"].default.uri;
		// const audioManifestResponse = await request(audioManifestUrl);
		// const audioManifestStr = await audioManifestResponse.text();
		// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "audioManifest.txt"), audioManifestStr);
		// const audioManifest = parseManifestStr(audioManifestStr);
		// const audioManifest = parseManifestStr(fs.readFileSync(path.join(USER_DATA_DIRECTORY, "audioManifest.txt")).toString());

		// const audioFilePath = path.join(USER_DATA_DIRECTORY, "audio.mp4");
		// await downloadAllMediaSegments(audioFilePath, audioManifestUrl, audioManifest);

		// const mediaFilePath = path.join(USER_DATA_DIRECTORY, "out.mp4");
		// await joinAudioAndVideo(videoFilePath, audioFilePath, mediaFilePath);


		setTimeout(() => {
			const videoSegmentInfos = videoManifest.segments.map((segment, index) => path.join(USER_DATA_DIRECTORY, "segments", `${(index + 1).toString().padStart(5, "0")}.ts`));

			this.httpServer.registerMedia(
				Buffer.from(localVideoManifest.compile()),
				null,
				videoSegmentInfos
			);

			childProcess.spawn(process.env.MPC_PATH, [`${this.httpServer.url.href}media.m3u8`], { detached: true });
		}, 500);
	}

	async exit(code = 0) {
		for (let i = 0; i < this.components.length; i++) await this.components[i].exit && this.components[i].exit();

		process.exit(code);
	}
}

const application = new Application();
await application.initialize();
await application.run();
