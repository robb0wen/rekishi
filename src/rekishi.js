/**
 * Exported constants for Rekishi's action types. Can be imported into code to ensure correct naming
 */
export const REKISHI_POP = "POP";
export const REKISHI_PUSH = "PUSH";
export const REKISHI_HASH = "HASH";
export const REKISHI_PARAMS = "PARAMS";
export const REKISHI_HASHPARAMS = "HASHPARAMS";
export const REKISHI_NOCHANGE = "NOCHANGE";

/**
 * Helper to shallow compare objects
 * @param {Object} a
 * @param {Object} b
 */
const paramsAreEqual = (a, b) => 
  Object.keys(a).every(key => (key in b) && a[key] === b[key]) &&
  Object.keys(b).every(key => (key in a) && a[key] === b[key]); 


/**
 * Sanitise incoming paths
 * @param {String} url 
 */
const stripTrailingSlash = url => url == '/' ? url : url.replace(/\/$/g, '');

/**
 * Processes a url string to extract path, hash and params
 * @param {String} url The url as a string without the domain but with hash and params
 */
const processUrl = url => {
  if (typeof url !== "string" || !url) {
    throw new Error('Value passed must be a string');
  }

  // if this was a relative url, prefix the current path
  let prefixedUrl;
  if (url.substr(0,1) == "/") {
    // the url is fine as is
    prefixedUrl = url;
  } else if (url.substr(0,1) == "?") {
    // the url is a relative wit query
    prefixedUrl = `${window.location.pathname.replace(/\/$/, '')}/${url}`;
  } else if (url.substr(0,1) == "#") {
    // the url is a hash only
    prefixedUrl = window.location.pathname+window.location.search+url;
  } else {
    // the url is a relative path
    prefixedUrl = `${window.location.pathname.replace(/\/$/, '')}/${url}`;
  }

  // extract the hash
  let [urlWithParams, hash] = prefixedUrl.split('#');

  // grab the query string 
  let [path, queryString] = urlWithParams.split('?');

  const params = queryString 
    ? queryString.split('&').reduce((acc, param) => {
        const [key, value] = param.split('=');
        return {
          ...acc,
          [key]: value
        };
      }, {}) 
    : {};

  return {
    path: stripTrailingSlash(path),
    hash: hash ? `#${hash}` : null,
    params
  };
};

/**
 * Convert simple path glob into a regex
 * @param {String} path a path without domain. Will match exactly unless a * is placed at the end of the url i.e. /posts/*. Trailing slash is optional.
 */
const getPathRegex = path => {
  try {
    let preciseMatch = path.substr(-1) != "*";
    let reg = path.replace(/(\*)|(\/)$/g, '');
    
    if (preciseMatch) {
      return new RegExp(`^${reg}(\\\/)?$`);
    } else {
      return new RegExp(`^${reg}`);
    }
  } catch (err) {
    throw new Error('Path is not in the correct format');
  }
};


// Main Rekishi class
export class Rekishi {

  /**
   * internal constructor for Rekishi class
   * @param {Object} options The options object. Will merge with, and override, internal defaults
   */
  constructor(options) {
    // set default options
    const defaultOptions = {
      // data to be passed to the initial URL (overrides registered Path Data)
      initPathData: {},
      // an array of registered path regex and associated data
      registeredPaths: [],
      // by default give the user control over scroll position
      scrollRestoration: 'manual',
    };

    // merge user options with defaults to override
    const mergedOptions = {...defaultOptions, ...options};

    // set the history scroll mode
    history.scrollRestoration = mergedOptions.scrollRestoration;

    // initialise the internal watched function queue
    this._callbacks = [];

    // init internal objects
    this._prevURL = {};
    this._currentURL = {};
    this._pathData = {};
    this._registeredPaths = [];

    // external methods
    this.push = this.push.bind(this);
    this.registerPath = this.registerPath.bind(this);
    this.getCurrentState = this.getCurrentState.bind(this);
    this.watch = this.watch.bind(this);
    this.unwatch = this.unwatch.bind(this);

    // internal methods
    this._handlePop = this._handlePop.bind(this);
    this._updatePathData = this._updatePathData.bind(this);
    this._updatePosition = this._updatePosition.bind(this);
    this._didHashChange = this._didHashChange.bind(this);
    this._mergeRegisteredData = this._mergeRegisteredData.bind(this);

    // register any paths passed in options
    if (mergedOptions.registeredPaths.length) {
      mergedOptions.registeredPaths.forEach(pathToRegister => {
        const { path, data } = pathToRegister;
        this.registerPath(path, data);
      })
    }

    // set init page date state
    const initUrl = `${window.location.pathname}${window.location.hash}${window.location.search}`;
    const { path, hash, params } = processUrl(initUrl);
    this._updatePosition(path, hash, params);
    this._updatePathData(path, mergedOptions.initPathData);

    // bind the pop listener
    window.addEventListener('popstate', this._handlePop);
  }

  /**
   * Update internal values for previous and current paths
   * @param {String} path The incoming path without domain, hash or search params
   * @param {String} hash the incoming hash with leading #
   */
  _updatePosition(path, hash, params) {
    // update the outgoing url
    this._prevURL = this._currentURL;

    // store the incoming
    this._currentURL = {
      path: stripTrailingSlash(path),
      hash,
      params
    };

    // determine action if paths match
    if (this._prevURL.path == this._currentURL.path) {
      if (this._didHashChange() && !this._didParamsChange()) {
        return REKISHI_HASH;
      }

      if (!this._didHashChange() && this._didParamsChange()) {
        return REKISHI_PARAMS;
      }

      if (this._didHashChange() && this._didParamsChange()) {
        return REKISHI_HASHPARAMS;
      }

      if (!this._didHashChange() && !this._didParamsChange()) {
        return REKISHI_NOCHANGE;
      }
    }

    return;
  }

  /**
   * Updates the data store with new values
   * @param {String} path the parh without domain to assign the data to
   * @param {Object} data the updated data object to insert into the store
   */
  _updatePathData(path, data) {
    // strip any slashes for consistency
    const pathKey = stripTrailingSlash(path);
    this._pathData = {
      ...this._pathData,
      [pathKey]: data
    };
    return this._pathData;
  }

  /**
   * Get path data from internal store, and merge with regex based internal defaults
   * @param {String} path the path without domain to get data for
   */
  _mergeRegisteredData(path) {
    const newData = this._registeredPaths.reduce((acc, curr) => {
      if (curr.regex.test(path)) {
        return {
          ...acc,
          ...curr.data
        }
      } else {
        return acc;
      }
    }, {});

    return {
      ...newData,
      ...this._pathData[path]
    }
  }

  /**
   * Push a new url to history with some accompanying data
   * @param {String} url The new pathname without domain, but with hash and params
   * @param {Object} data The data object to be associated with url
   */
  push(url, data) {
    // update some things
    const { path, hash, params } = processUrl(url);

    this._updatePathData(path, data || {});
    let action = this._updatePosition(path, hash, params);
    // if no specific action returned, set to PUSH
    action = !action ? REKISHI_PUSH : action;

    // update history
    history.pushState(null, null, url);

    // run callbacks
    this._callbacks.forEach(cb => cb({ ...this.getCurrentState(), action }));
  }

  /**
   * Method to bind to internal history API popstate event
   */
  _handlePop(e) {
    const poppedUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const { path, hash, params } = processUrl(poppedUrl);

    let action = this._updatePosition(path, hash, params);
    // if no specific action returned, set to POP
    action = !action ? REKISHI_POP : action;

    // run callbacks
    this._callbacks.forEach(cb => cb({ ...this.getCurrentState(), action }));
  }

  /**
   * simple check to see if the hash has changed
   */
  _didHashChange() {
    return this._currentURL.path == this._prevURL.path && this._currentURL.hash != this._prevURL.hash;
  }

  /**
   * simple check to see if the params have changed
   */
  _didParamsChange() {
    return this._currentURL.path == this._prevURL.path && !paramsAreEqual(this._currentURL.params, this._prevURL.params);
  }

  /**
   * Returns a copy of the current and previous urls, with data, formatted for public use
   */
  getCurrentState() {
    return {
      incoming: {
        path: this._currentURL.path,
        hash: this._currentURL.hash,
        params: this._currentURL.params,
        data: this._mergeRegisteredData(this._currentURL.path)
      },
      outgoing: {
        path: this._prevURL.path,
        hash: this._prevURL.hash,
        params: this._prevURL.params,
        data: this._mergeRegisteredData(this._prevURL.path)
      }
    }
  }

  /**
   * Map default data to be associated with a simple path blog
   * @param {String} path a path without domain. Will match exactly unless a * is placed at the end of the url i.e. /posts/*. Trailing slash is optional.
   * @param {Object} data The data object to be associated with url
   */
  registerPath(path, data) {
    this._registeredPaths = [
      ...this._registeredPaths,
      {
        path,
        regex: getPathRegex(path),
        data
      }
    ];

    return this._registeredPaths;
  }

  /**
   * Subscribes a function to the 'watched functions' list.
   * Watched functions will be automatically called on history update
   * @param {Function} callback The function to call on update
   */
  watch(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Value passed to Watch is not a function');
    }

    // push the callback to the queue to ensure it runs on future updates
    this._callbacks.push(callback);
  }

  /**
   * Unsubscribe a function from the 'watched functions' list
   * @param {Function} callback The function to be removed
   */
  unwatch(callback) {
    if (typeof callback !== 'function') {
      throw new Error('The value passed to unwatch is not a function');
    }

    // remove the callback from the list
    this._callbacks = this._callbacks.filter(cb => cb !== callback);
  }
}