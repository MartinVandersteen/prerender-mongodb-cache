const mongo = require('mongodb');
const MongoClient = require('mongodb').MongoClient;

const mongoUri = process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://localhost:27017/prerender';

const ttl = process.env.CACHE_TTL || 2592000; //defaults to 1 month

const cacheManager = require('cache-manager');
const mongoStore = require('cache-manager-mongodb');
let mongoCache;

module.exports = {
  init: () => {
    mongoCache = cacheManager.caching({
      store: mongoStore,
      uri: mongoUri,
      options: {
        collection: 'pages',
        compression: false,
        server: {
          poolSize: 5,
          auto_reconnect: true
        }
      },
      ttl: ttl
    });
  },

  requestReceived: (req, res, next) => {

    let url = req.url.replace(/%(25)+/gi, '%').replace(/%3f_escaped_fragment.*/gi, '');
    const parts = req.url.split('/');
    const lastPart = parts[parts.length - 1];

    try {
      url = url.replace(lastPart, decodeURIComponent(lastPart).replace(/\?_escaped_fragment.*/g, ''));
    } catch (e) {};

    if (req.method !== 'GET') {
      return next();
    }

    try {
      mongoCache.get(url, (err, result) => {
        if (err) {
          throw err;
        }
        if (!err && result) {
          res.send(200, result);
        } else {
          next();
        }
      });
    } catch (e) {
      console.log(e.stack || e.message);
      next();
    }
  },

  beforeSend: (req, res, next) => {
    const currentTTL = req.headers['cache-ttl'] || ttl;
    let url = req.url.replace(/%(25)+/gi, '%').replace(/%3f_escaped_fragment.*/gi, '');
    const parts = req.url.split('/');
    const lastPart = parts[parts.length - 1];

    try {
      url = url.replace(lastPart, decodeURIComponent(lastPart).replace(/\?_escaped_fragment.*/g, ''));
    } catch (e) {};

    try {
      mongoCache.set(url, req.prerender.documentHTML, {
        ttl: currentTTL
      }, (err) => {
        if (err) {
          throw err;
        }
        next();
      });
    } catch (e) {
      console.log(e.stack || e.message);
      next();
    }
  }
};
