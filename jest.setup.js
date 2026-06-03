// Polyfills for ES2021+ methods needed when running tests on Node < 15.
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (search, replace) {
        if (search instanceof RegExp) {
            return this.replace(search, replace);
        }
        return this.split(search).join(replace);
    };
}

// Global fetch mock — prevents "fetch is not defined" errors in tests that
// trigger window load event listeners attached by app.init().
if (!global.fetch) {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
    }));
}
