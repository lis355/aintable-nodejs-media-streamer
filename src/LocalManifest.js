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

export class LocalManifest {
	constructor(remoteManifest, url) {
		this.remoteManifest = remoteManifest;
		this.url = new URL(url);
	}

	compile() { }
}

export class LocalMediaManifest extends LocalManifest {
	compile() {
		const lines = [
			"#EXTM3U",
			"#EXT-X-VERSION:3",
			"#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio0\",NAME=\"default\",DEFAULT=YES,AUTOSELECT=YES,URI=\"audio.m3u8\"",
			"#EXT-X-STREAM-INF:PROGRAM-ID=1,NAME=\"360p\",BANDWIDTH=439791,CODECS=\"avc1.64001e,mp4a.40.2\",RESOLUTION=640x360,AUDIO=\"audio0\",FRAME-RATE=24.000,VIDEO-RANGE=SDR",
			"video.m3u8"
		];

		this.m3u8Text = lines.join("\n") + "\n";
	}
}

export class LocalChannelManifest extends LocalManifest {
	constructor(remoteManifest, channel, url) {
		super(remoteManifest, url);

		this.channel = channel;
	}

	compile() {
		const segments = this.remoteManifest.segments;

		const lines = [
			"#EXTM3U",
			"#EXT-X-VERSION:3",
			"#EXT-X-PLAYLIST-TYPE:VOD",
			"#EXT-X-MEDIA-SEQUENCE:1",
			`#EXT-X-TARGETDURATION:${Math.ceil(_.max(segments.map(segment => segment.duration)))}`
		];

		this.segmentInfos = [];

		for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
			const segment = segments[segmentIndex];

			lines.push(
				`#EXTINF:${segment.duration},`,
				`segments/${this.channel}/${(segmentIndex + 1).toString().padStart(5, "0")}.ts`
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
