import timersPromises from "node:timers/promises";

import _ from "lodash";
import { CookieJar } from "tough-cookie";
import async from "async";
import makeFetchCookie from "fetch-cookie";

const REQUEST_COOLDOWN_IN_MILLISECONDS = 500;

const USER_AGENT = process.env.USER_AGENT;
if (!USER_AGENT) console.warn("Empty USER_AGENT");

const cookieJar = new CookieJar();
const fetchCookie = makeFetchCookie(fetch, cookieJar);

export default class RequestsManager {
	async initialize() {
		// TODO OPTIMIZE concrete queue for every domain
		this.requestsQueue = async.queue(async action => action());
	}

	async request(url, options) {
		return new Promise((resolve, reject) => {
			this.requestsQueue.push(async () => {
				// console.log(new Date().toISOString(), url);

				try {
					await timersPromises.setTimeout(Math.max(0, REQUEST_COOLDOWN_IN_MILLISECONDS - (Date.now() - (this.lastSegmentResponseTime || 0))));

					const response = await fetchCookie(
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

					this.lastSegmentResponseTime = Date.now();

					return resolve(response);
				} catch (error) {
					return reject(error);
				}
			});
		});
	}
}
