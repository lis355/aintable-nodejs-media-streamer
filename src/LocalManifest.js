import _ from "lodash";
import m3u8Parser from "m3u8-parser";
import urlJoin from "url-join";

export function parseManifestStr(manifestStr) {
	const parser = new m3u8Parser.Parser();
	parser.push(manifestStr);
	parser.end();

	const manifest = parser.manifest;

	return manifest;
}

function formatIndex(index) {
	return index.toString().padStart(5, "0");
}

export class LocalManifest {
	constructor(remoteManifest, url) {
		this.remoteManifest = remoteManifest;
		this.url = new URL(url);
	}

	compile() { }
}

export class LocalMediaManifest extends LocalManifest {
	constructor(remoteManifest, url, mediaInfo) {
		super(remoteManifest, url);

		this.mediaInfo = mediaInfo;
	}

	compile() {
		const lines = [
			"#EXTM3U",
			"#EXT-X-VERSION:3"
		];

		const audioStreamNameForFilter = "audio0";

		this.audioManifestItems = [];

		const audioMediaGroupEntries = Object.entries(this.remoteManifest.mediaGroups.AUDIO[audioStreamNameForFilter]);

		for (let audioMediaGroupIndex = 0; audioMediaGroupIndex < audioMediaGroupEntries.length; audioMediaGroupIndex++) {
			const audioMediaGroup = audioMediaGroupEntries[audioMediaGroupIndex];

			const [audioName, audioInfo] = audioMediaGroup;

			const name = formatIndex(audioMediaGroupIndex + 1);
			const caption = `${this.mediaInfo.source.audio.names[audioMediaGroupIndex]} (${audioInfo.language})`;

			lines.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${caption}",DEFAULT=${audioInfo.default ? "YES" : "NO"},AUTOSELECT=${audioInfo.default ? "YES" : "NO"},URI="audio-${name}.m3u8"`);

			this.audioManifestItems.push({
				name,
				caption: caption,
				channel: "audio",
				url: audioInfo.uri
			});
		}

		this.videoManifestItems = [];

		const videoStreamPlaylists = this.remoteManifest.playlists
			.filter(playlist => playlist.attributes.AUDIO === audioStreamNameForFilter);

		for (let streamIndex = 0; streamIndex < videoStreamPlaylists.length; streamIndex++) {
			const stream = videoStreamPlaylists[streamIndex];

			const name = formatIndex(streamIndex + 1);

			lines.push(
				`#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=${stream.attributes.BANDWIDTH},CODECS="${stream.attributes.CODECS}",RESOLUTION=${stream.attributes.RESOLUTION.width}x${stream.attributes.RESOLUTION.height},AUDIO="audio",FRAME-RATE=${stream.attributes["FRAME-RATE"]},VIDEO-RANGE=${stream.attributes["VIDEO-RANGE"]}`,
				`video-${name}.m3u8`
			);

			this.videoManifestItems.push({
				name,
				channel: "video",
				url: stream.uri
			});
		}

		this.m3u8Text = lines.join("\n") + "\n";
	}
}

export class LocalChannelManifest extends LocalManifest {
	constructor(manifestItem, remoteManifest) {
		super(remoteManifest, manifestItem.url);

		this.manifestItem = manifestItem;
	}

	compile() {
		const segments = this.remoteManifest.segments;

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
				`#EXTINF:${segment.duration}, `,
				`segments/${this.manifestItem.channel}-${this.manifestItem.name}/${formatIndex(segmentIndex + 1)}.ts`
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
