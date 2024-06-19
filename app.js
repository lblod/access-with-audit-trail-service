import config from './lib/config';
const HEADER_MU_SESSION_ID = 'mu-session-id';

import { app } from 'mu';
import bodyParser from 'body-parser';
import { checkNotEmpty } from './lib/util';
import {
  getAccountBySession,
  getSubject,
  getAttribute,
  getReasonUri,
  writeReason,
} from './lib/queries';
app.use(
  bodyParser.json({
    type: function (req) {
      return /^application\/json/.test(req.get('content-type'));
    },
  }),
);

app.get('/:key/:id', async function (req, res, next) {
  try {
    const sessionId = req.get(HEADER_MU_SESSION_ID);
    const { key, id } = req.params;
    const { reasonId, include } = req.query;
    const result = await processRead(sessionId, {
      key,
      resourceId: id,
      reasonId,
      include,
    });
    return res.status(200).send(result);
  } catch (e) {
    return next(e);
  }
});

async function processRead(sessionId, params) {
  const { key, reasonId, resourceId, include } = params;

  let reason = await getReasonUri(reasonId);
  let accountUri = await getAccountBySession(sessionId);
  checkNotEmpty(accountUri, 'Account must be set!');
  let resourceConfig = config.getResource(key);
  checkNotEmpty(resourceConfig, `no configuration found for ${key}`);
  let props = include.split(',');
  checkNotEmpty(props, 'no property requested');

  let subject = await getSubject(resourceConfig.rdfType, resourceId);

  let foundAttributes = new Map();
  for (const prop of props) {
    if (resourceConfig.attributes.has(prop)) {
      const attributeConf = resourceConfig.attributes.get(prop);
      const attribute = await getAttribute(subject, attributeConf.path);
      if (attribute?.length) {
        foundAttributes.set(prop, attribute);
      }
    }
  }
  if (foundAttributes.size === 0) {
    console.error(
      "didn't find any attributes for",
      resourceId,
      'attributes:',
      props,
    );
    return null;
  }
  await writeReason(accountUri, reason, [...foundAttributes.keys()]);
  const attrs = [...foundAttributes].reduce((o, [key, value]) => {
    o[key] = value;
    return o;
  }, {});
  return {
    data: {
      type: key,
      id: resourceId,
      attributes: attrs,
      relationships: {},
    },
  };
}

function error(res, message, status = 400) {
  return res.status(status).json({ errors: [{ title: message }] });
}

app.use(error);
