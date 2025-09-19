// import path from "node:path";

import _ from "lodash";
// import fs from "fs-extra";
import m3u8Parser from "m3u8-parser";
import urlJoin from "url-join";

function parseManifestStr(manifestStr) {
	const parser = new m3u8Parser.Parser();
	parser.push(manifestStr);
	parser.end();

	const manifest = parser.manifest;

	return manifest;
}

function formatIndex(index) {
	return index.toString().padStart(5, "0");
}

class Manifest {
	constructor(application) {
		this.application = application;
	}

	async getManifest() { }
}

export default class MediaManifest extends Manifest {
	constructor(application, mediaInfo) {
		super(application);

		this.mediaInfo = mediaInfo;
		this.url = this.mediaInfo.info.url;
	}

	async getManifest() {
		if (!this.__manifest) {
			const manifestResponse = await this.application.requestsManager.request(this.url);
			const manifestStr = await manifestResponse.text();

			this.__manifest = parseManifestStr(manifestStr);
			this.__manifest.text = manifestStr;
			// fs.outputFileSync(path.join(this.application.userDataDirectory, "MediaManifest.m3u8"), this.url + "\n\n" + this.__manifest.text);

			this.__manifest.localManifest = this.localManifest = new LocalMediaManifest(this.application, this);
			await this.localManifest.compile();
		}

		return this.__manifest;
	}
}

class ChannelManifest extends Manifest {
	constructor(application, name, caption, channel, url) {
		super(application);

		this.name = name;
		this.caption = caption;
		this.channel = channel;
		this.url = url;
	}

	async getManifest() {
		if (!this.__manifest) {
			// console.log("[channel]", this.channel, this.name, this.caption);

			const manifestResponse = await this.application.requestsManager.request(this.url);
			const manifestStr = await manifestResponse.text();

			this.__manifest = parseManifestStr(manifestStr);
			this.__manifest.text = manifestStr;
			// fs.outputFileSync(path.join(this.application.userDataDirectory, `ChannelManifest ${this.channel} ${this.name}.m3u8`), this.url + "\n\n" + this.__manifest.text);

			this.__manifest.localManifest = this.localManifest = new LocalChannelManifest(this.application, this);
			await this.localManifest.compile();
		}

		return this.__manifest;
	}
}

class LocalManifest {
	constructor(application, manifest) {
		this.application = application;
		this.manifest = manifest;
		this.url = new URL(this.manifest.url);
	}

	async compile() { }
}

class LocalMediaManifest extends LocalManifest {
	async compile() {
		const lines = [
			"#EXTM3U",
			"#EXT-X-VERSION:3"
		];

		const manifest = await this.manifest.getManifest();

		const audioStreamNameForFilter = "audio0";

		this.audioChannelManifests = [];

		const audioMediaGroupEntries = Object.entries(manifest.mediaGroups.AUDIO[audioStreamNameForFilter]);

		for (let audioMediaGroupIndex = 0; audioMediaGroupIndex < audioMediaGroupEntries.length; audioMediaGroupIndex++) {
			const audioMediaGroup = audioMediaGroupEntries[audioMediaGroupIndex];

			const [audioName, audioInfo] = audioMediaGroup;

			const name = formatIndex(audioMediaGroupIndex + 1);
			const caption = `${this.manifest.mediaInfo.info.audio[audioMediaGroupIndex]} (${audioInfo.language})`;

			lines.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${caption}",DEFAULT=${audioInfo.default ? "YES" : "NO"},AUTOSELECT=${audioInfo.default ? "YES" : "NO"},URI="audio-${name}.m3u8"`);

			this.audioChannelManifests.push(new ChannelManifest(this.application, name, caption, "audio", audioInfo.uri));
		}

		this.videoChannelManifests = [];

		const videoStreamPlaylists = manifest.playlists
			.filter(playlist => playlist.attributes.AUDIO === audioStreamNameForFilter);

		for (let streamIndex = 0; streamIndex < videoStreamPlaylists.length; streamIndex++) {
			const stream = videoStreamPlaylists[streamIndex];

			const name = formatIndex(streamIndex + 1);

			lines.push(
				`#EXT-X-STREAM-INF:PROGRAM-ID=1,NAME="${stream.attributes.RESOLUTION.width}x${stream.attributes.RESOLUTION.height} ${stream.attributes["FRAME-RATE"]} ${stream.attributes["VIDEO-RANGE"]} ${stream.attributes.BANDWIDTH}bps",BANDWIDTH=${stream.attributes.BANDWIDTH},CODECS="${stream.attributes.CODECS}",RESOLUTION=${stream.attributes.RESOLUTION.width}x${stream.attributes.RESOLUTION.height},AUDIO="audio",FRAME-RATE=${stream.attributes["FRAME-RATE"]},VIDEO-RANGE=${stream.attributes["VIDEO-RANGE"]}`,
				`video-${name}.m3u8`
			);

			this.videoChannelManifests.push(new ChannelManifest(this.application, name, name, "video", stream.uri));
		}

		this.channelManifests = {
			audio: this.audioChannelManifests,
			video: this.videoChannelManifests
		};

		this.m3u8Text = lines.join("\n") + "\n";
	}
}

class LocalChannelManifest extends LocalManifest {
	async compile() {
		const manifest = await this.manifest.getManifest();

		const segments = manifest.segments;

		const lines = [
			"#EXTM3U",
			"#EXT-X-VERSION:3",
			"#EXT-X-PLAYLIST-TYPE:VOD",
			"#EXT-X-MEDIA-SEQUENCE:1",
			`#EXT-X-TARGETDURATION:${Math.ceil(_.max(segments.map(segment => segment.duration)))} `
		];

		this.segmentInfos = [];

		for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
			const segment = segments[segmentIndex];

			lines.push(
				`#EXTINF:${segment.duration},`,
				`segments/${this.manifest.channel}-${this.manifest.name}/${formatIndex(segmentIndex + 1)}.ts`
			);

			const url = new URL(urlJoin(this.url.origin, ...this.url.pathname.split("/").slice(0, -1), segment.uri));

			this.segmentInfos.push({
				url: url.href
			});
		}

		lines.push("#EXT-X-ENDLIST");

		this.m3u8Text = lines.join("\n") + "\n";
	}
}
