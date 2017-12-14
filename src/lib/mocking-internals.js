const compileRoute = require('./compile-route');
const mockResponse = require('./mock-response');

const FetchMock = {};

FetchMock._mock = function () {
	if (!this.isSandbox) {
		// Do this here rather than in the constructor to ensure it's scoped to the test
		this.realFetch = this.realFetch || this.global.fetch;
		this.global.fetch = this.fetchMock;
	}
	return this;
}

FetchMock._unMock = function () {
	if (this.realFetch) {
		this.global.fetch = this.realFetch;
		this.realFetch = null;
	}
	this.fallbackResponse = null;
	return this;
}

FetchMock.fetchMock = function (url, opts) {
	const Promise = this.config.Promise;
	let resolveHoldingPromise
	const holdingPromise = new Promise(res => resolveHoldingPromise = res)
	this._holdingPromises.push(holdingPromise)
	let response = this.router(url, opts);

	if (!response) {
		console.warn(`Unmatched ${opts && opts.method || 'GET'} to ${url}`);
		this.push(null, [url, opts]);

		if (this.fallbackResponse) {
			response = this.fallbackResponse;
		} else {
			throw new Error(`No fallback response defined for ${opts && opts.method || 'GET'} to ${url}`)
		}
	}

	if (typeof response === 'function') {
		response = response(url, opts);
	}

	if (typeof response.then === 'function') {
		// Ensure Promise is always our implementation.
		return Promise.resolve(
			response
				.then(response => this.mockResponse(url, response, opts, resolveHoldingPromise))
		);
	} else {
		return this.mockResponse(url, response, opts, resolveHoldingPromise);
	}

}

FetchMock.router = function (url, opts) {
	let route;
	for (let i = 0, il = this.routes.length; i < il ; i++) {
		route = this.routes[i];
		if (route.matcher(url, opts)) {
			this.push(route.name, [url, opts]);
			return route.response;
		}
	}
}

FetchMock.addRoute = function (route) {

	if (!route) {
		throw new Error('.mock() must be passed configuration for a route')
	}

	// Allows selective application of some of the preregistered routes
	this.routes.push(compileRoute(route, this.config.Request, this.config.Headers));
}


FetchMock.mockResponse = mockResponse;

FetchMock.respond = function (response, resolveHoldingPromise) {
	response
		.then(resolveHoldingPromise, resolveHoldingPromise)

	return response;
}

FetchMock.push = function (name, call) {
	if (name) {
		this._calls[name] = this._calls[name] || [];
		this._calls[name].push(call);
		this._matchedCalls.push(call);
	} else {
		this._unmatchedCalls.push(call);
	}
};

module.exports = FetchMock;