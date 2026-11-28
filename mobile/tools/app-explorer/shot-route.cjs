// Shot routes reach adb inside a quoted shell argument. The history routes
// also accept the encoded spaces and separators in published keys.
const plainRoute = /^\/[a-z0-9-]+(\/[a-z0-9-]+)*(\?[a-z0-9=&_-]*)?$/i;
const historyRoute = /^\/(?:bank|product)\/(?:[a-z0-9_-]|%20|%7c)+$/i;

function isShotRoute(route) {
  return typeof route === 'string' && (plainRoute.test(route) || historyRoute.test(route));
}

module.exports = { isShotRoute };
