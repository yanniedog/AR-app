// Expo's native WHATWG implementation is also used explicitly here. React
// Native's fallback URL has getter-only properties and different serialization,
// so security checks must not depend on which global was installed first.
export { URL as StandardUrl } from 'whatwg-url-without-unicode';
