import { JSDOM } from "jsdom";
import httpStatus from "http-status-codes";
import TTLCache from "@isaacs/ttlcache";

import hash from "./utils/hash.js";

const CHECK_BASE_URL_TIMEOUT_IN_MILLISECONDS = 3000;
const SEGMENT_BUFFERS_CACHE_TTL_IN_MILLISECONDS = 15 * 60 * 1000;

export default class LordFilmMediaProvider {
	async initialize() {
		this.baseUrl = new URL(process.env.DOMAIN);

		this.segmentBuffersCache = new TTLCache({ ttl: SEGMENT_BUFFERS_CACHE_TTL_IN_MILLISECONDS });
	}

	async run() {
		await this.checkBaseUrl();
	}

	async checkBaseUrl() {
		console.log(`[LordFilmMediaProvider]: checking access to ${this.baseUrl.href}...`);

		try {
			const response = await this.application.requestsManager.request(this.baseUrl.href, {
				signal: AbortSignal.timeout(CHECK_BASE_URL_TIMEOUT_IN_MILLISECONDS)
			});

			if (response.status !== httpStatus.OK) throw new Error(`Bad status ${response.status}`);

			console.log(`[LordFilmMediaProvider]: ${this.baseUrl.href} is accessible`);
		} catch (error) {
			console.log(`[LordFilmMediaProvider]: ${this.baseUrl.href} is not accessible, exiting (${[error.message, error.cause && error.cause.code, error.cause && error.cause.message].filter(Boolean).join(", ")})`);

			this.application.exit(1);
		}
	}

	async search(queryStr) {
		const searchUrl = new URL(this.baseUrl);
		searchUrl.pathname = "search-result";

		const searchResponse = await this.application.requestsManager.request(searchUrl.href, {
			method: "POST",
			body: new URLSearchParams({
				do: "search",
				subaction: "search",
				story: queryStr.toLowerCase()
			})
		});

		const searchResponseHtml = await searchResponse.text();

		const document = (new JSDOM(searchResponseHtml)).window.document;

		const result = [];

		const searchItemElements = document.querySelectorAll(".th-item");
		for (const searchItemElement of searchItemElements) {
			const url = searchItemElement.querySelector("a[href]").getAttribute("href");

			let type;
			if (url.includes("filmy")) type = "film";
			else if (url.includes("serialy")) type = "series";
			else if (url.includes("mult")) type = "cartoon";
			else throw new Error("Unknown media type");

			const item = {
				title: searchItemElement.querySelector(".th-title").textContent,
				type,
				url
			};

			result.push(item);
		}

		return result;
	}

	async getMediaInfo(mediaItem) {
		const mediaPageResponse = await this.application.requestsManager.request(mediaItem.url);
		const mediaPageResponseHtml = await mediaPageResponse.text();

		let document = (new JSDOM(mediaPageResponseHtml)).window.document;

		const iframeElement = document.querySelector(".tabs-b.video-box iframe");

		let mediaInfoPageUrl = iframeElement.getAttribute("src");
		if (mediaInfoPageUrl.startsWith("//")) mediaInfoPageUrl = "https:" + mediaInfoPageUrl;

		const mediaInfoPageResponse = await this.application.requestsManager.request(mediaInfoPageUrl);
		const mediaInfoPageResponseHtml = await mediaInfoPageResponse.text();

		document = (new JSDOM(mediaInfoPageResponseHtml)).window.document;

		const scriptElement = document.querySelector("script[data-name=mk]");
		let scriptStr = scriptElement.textContent;

		const openBraceIndex = scriptStr.indexOf("makePlayer({") + "makePlayer({".length - 1;
		if (openBraceIndex <= 0) throw new Error("Invalid script string");

		let braceAmount = 1;
		for (let closeBraceIndex = openBraceIndex + 1; closeBraceIndex < scriptStr.length; closeBraceIndex++) {
			const c = scriptStr[closeBraceIndex];
			if (c === "{") braceAmount++;
			else if (c === "}") braceAmount--;

			if (braceAmount === 0) {
				scriptStr = scriptStr.substring(openBraceIndex, closeBraceIndex + 1);
				break;
			}
		}

		const playerInfo = eval("(" + scriptStr + ")");

		const mediaInfo = {
			title: mediaItem.title,
			type: mediaItem.type
		};

		function getInfo(rawInfo) {
			return {
				audio: rawInfo.audio.names,
				captions: rawInfo.cc,
				url: rawInfo.hls
			};
		}

		switch (mediaItem.type) {
			case "film":
			case "cartoon":
				mediaInfo.info = getInfo(playerInfo.source);
				break;

			case "series":
				mediaInfo.seasons = playerInfo.playlist.seasons.map(season => ({ episodes: season.episodes.map(episode => ({ title: episode.title, info: getInfo(episode) })) }));
				break;

			default: throw new Error(`Unknown media type ${mediaItem.type}`);
		}

		return mediaInfo;
	}

	clearSegmentBuffersCache() {
		this.segmentBuffersCache.clear();
	}

	async getSegmentBuffer(segmentUrl) {
		const segmentHash = hash(segmentUrl);

		let segmentBuffer = this.segmentBuffersCache.get(segmentHash);
		if (segmentBuffer) return segmentBuffer;

		const segmentResponse = await this.application.requestsManager.request(segmentUrl);
		segmentBuffer = Buffer.from(await segmentResponse.arrayBuffer());

		this.segmentBuffersCache.set(segmentHash, segmentBuffer);

		return segmentBuffer;
	}
}
