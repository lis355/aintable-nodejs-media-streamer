import timersPromises from "node:timers/promises";

import _ from "lodash";
import { CookieJar } from "tough-cookie";
import async from "async";
import makeFetchCookie from "fetch-cookie";

const REQUEST_COOLDOWN_IN_MILLISECONDS = 500;

class RequestsQueue {
	constructor(requestsManager, domain) {
		this.userAgent = process.env.USER_AGENT;
		if (!this.userAgent) console.warn("Empty USER_AGENT");

		this.requestsManager = requestsManager;
		this.domain = domain;
		this.requestsQueue = async.queue(async action => action());
	}

	async request(url, options) {
		return new Promise((resolve, reject) => {
			this.requestsQueue.push(async () => {
				// console.log(new Date().toISOString(), this.domain, this.requestsQueue.length(), url);

				try {
					await timersPromises.setTimeout(Math.max(0, REQUEST_COOLDOWN_IN_MILLISECONDS - (Date.now() - (this.lastResponseTime || 0))));

					const response = await this.requestsManager.fetchCookie(
						url,
						_.merge(
							{},
							options,
							{
								headers: {
									"user-agent": this.userAgent
								}
							}
						)
					);

					this.lastResponseTime = Date.now();

					return resolve(response);
				} catch (error) {
					return reject(error);
				}
			});
		});
	}
}

export default class RequestsManager {
	async initialize() {
		this.cookieJar = new CookieJar();
		this.fetchCookie = makeFetchCookie(fetch, this.cookieJar);
	}

	__getRequestsQueueForDomain(domain) {
		if (!this.requestsQueuesForDomains) this.requestsQueuesForDomains = {};

		let requestsQueue = this.requestsQueuesForDomains[domain];
		if (!requestsQueue) requestsQueue = this.requestsQueuesForDomains[domain] = new RequestsQueue(this, domain);

		return requestsQueue;
	}

	async request(url, options) {
		return this.__getRequestsQueueForDomain(new URL(url).host).request(url, options);
	}
}
