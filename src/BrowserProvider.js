import fs from "node:fs";
import path from "node:path";
import timersPromises from "node:timers/promises";

import sider from "@lis355/sider";

class BrowserProvider {
	async initialize() {
		const args = new sider.CLIArguments();

		args.parseArrayArguments([
			"--start-maximized",
			"--restore-last-session",

			"--auto-open-devtools-for-tabs" // DEBUG
		]);

		args.set("--user-data-dir", path.resolve(process.cwd(), "userData/browserSession").replaceAll(/\\/g, "/"));

		this.browser = new sider.Browser();

		this.browser.on("closed", () => {
		});

		const options = {
			executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
			args
		};

		await this.browser.launch(options);
		await this.browser.initialize();

		this.page = await new Promise(resolve => {
			this.browser.once("pageAdded", page => {
				page.network.requestHandler = params => {
					console.log(new URL(params.request.url).host);
				};

				return resolve(page);
			});
		});

		// const url = 
		// await this.page.navigate(url);
		// await this.page.waitForNavigation(url);
	}
}

// const browserProvider = new BrowserProvider();
// await browserProvider.initialize();
