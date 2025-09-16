import _ from "lodash";
import { CookieJar } from "tough-cookie";
import makeFetchCookie from "fetch-cookie";

const USER_AGENT = process.env.USER_AGENT;
if (!USER_AGENT) console.warn("Empty USER_AGENT");

const cookieJar = new CookieJar();
const fetchCookie = makeFetchCookie(fetch, cookieJar);

export default class RequestsManager {
	async initialize() {
	}

	async request(url, options) {
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
}
