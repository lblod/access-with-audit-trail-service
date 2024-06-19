import { APP_CONFILE_FILE } from './../constants';
import { readFileSync } from 'fs';
const commonProtocols = [
  'http:',
  'https:',
  'tcp:',
  'mailto:',
  'phone:',
  'ftp:',
  'sftp:',
  'ssh:',
  'ws:',
  'wss:',
  // "file:",
  // "data:",
  // "ldap:",
  // "smb:",
  // "rtsp:",
  // "telnet:",
  // "imap:",
  // "pop:",
  // "smtp:",
  // "nfs:",
  // "gopher:",
  // "mms:",
  // "magnet:",
  // "irc:",
  // "urn:",
];

function isValidURI(uri) {
  try {
    const url = new URL(uri);
    return commonProtocols.includes(url.protocol);
  } catch (e) {
    return false;
  }
}
function normalizeURI(prefixes, uri) {
  if (!uri?.length) {
    throw `ERR: empty uri ${uri}`;
  }
  if (isValidURI(uri)) {
    return uri;
  }
  const [prefix, suffix] = uri.split(':');
  if (!prefixes.has(prefix)) {
    throw `${uri} could not be parsed. ${prefix} doesn't seem to exist`;
  }
  const normalizedUri = `${prefixes.get(prefix)}${suffix}`;
  if (!isValidURI(normalizedUri)) {
    throw `could not parse ${uri}. Results in '${normalizedUri}' which doesn't seem to be a valid uri`;
  }
  return normalizedUri;
}

export class RDFAttribute {
  constructor(prefixes, attr) {
    const normalizedPath = [];
    if (Array.isArray(attr.path)) {
      for (const p of attr.path) {
        normalizedPath.push(normalizeURI(prefixes, p));
      }
    } else {
      normalizedPath.push(normalizeURI(prefixes, attr.path));
    }
    this.type = attr.type;
    this.label = attr.label;
    this.path = normalizedPath;
  }
}

export class Config {
  constructor(prefixes, resources) {
    this.prefixes = prefixes;
    this.resources = resources;
  }
  getAttributes(key) {
    return this.getResource(key)?.attributes;
  }
  getResource(key) {
    if (this.resources.has(key)) {
      return this.resources.get(key);
    }
    return null;
  }
}

export class RDFResource {
  constructor(prefixes, configObject) {
    this.rdfType = normalizeURI(prefixes, configObject.rdfType);
    const attributes = new Map();

    for (const [key, attr] of Object.entries(configObject.attributes)) {
      attributes.set(key, new RDFAttribute(prefixes, attr));
    }
    this.attributes = attributes;
  }
}

function loadConfig() {
  const rawData = readFileSync(APP_CONFILE_FILE, { encoding: 'utf8' });
  const config = JSON.parse(rawData);
  const prefixes = new Map(Object.entries(config.prefixes || {}));
  const resources = new Map();
  for (const [key, r] of Object.entries(config.resources)) {
    resources.set(key, new RDFResource(prefixes, r));
  }
  return new Config(prefixes, resources);
}

export default loadConfig();
