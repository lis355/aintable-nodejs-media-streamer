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

const CWD = path.resolve(process.cwd());

dotenv({
	path: CWD // import.meta.dirname
});

const USER_DATA_DIRECTORY = path.join(CWD, "userData");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const cookieJar = new CookieJar();//new FileCookieStore(path.join(USER_DATA_DIRECTORY, ".cookies")));
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

		segmentBuffers.push(segmentBuffer);

		console.log(`Downloaded ${segmentIndex}/${manifest.segments.length} segments`);

		if (segmentIndex < manifest.segments.length - 1) await timersPromises.setTimeout(SEGMENT_DOWNLOADING_COOLDOWN_IN_MILLISECONDS);
	}

	fs.writeFileSync(filePath, Buffer.concat(segmentBuffers));
}

async function run() {
	const searchResult = await search("мартынко");
	if (searchResult.length === 0) return;

	const mediaItem = _.first(searchResult);

	const mediaInfo = await getMediaInfo(mediaItem.url);
	// console.log(JSON.stringify(mediaInfo, null, "\t"));

	const mediaManifestResponse = await request(mediaInfo.source.hls);
	const mediaManifestStr = await mediaManifestResponse.text();
	// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "manifest.txt"), mediaManifestStr);
	const mediaManifest = parseManifestStr(mediaManifestStr);

	const videoManifestUrl = mediaManifest.playlists[0].uri;
	const videoManifestResponse = await request(videoManifestUrl);
	const videoManifestStr = await videoManifestResponse.text();
	// fs.writeFileSync(path.join(USER_DATA_DIRECTORY, "manifest.txt"), videoManifestStr);
	const videoManifest = parseManifestStr(videoManifestStr);
	// console.log(videoManifest);

	downloadAllMediaSegments(path.join(USER_DATA_DIRECTORY, "video.mp4"), videoManifestUrl, videoManifest);
}

run();
