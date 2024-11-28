import { sparqlEscapeUri, uuid, sparqlEscapeString } from 'mu';
import { checkNotEmpty } from './util';
import { SESSION_GRAPH_URI, AUDIT_TRAIL_GRAPH } from '../constants';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';

const PREFIXES = `
PREFIX sh:   <http://www.w3.org/ns/shacl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX persoon: <https://data.vlaanderen.be/ns/persoon#>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX person: <http://www.w3.org/ns/person#>
PREFIX session: <http://mu.semte.ch/vocabularies/session/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
PREFIX dcterms: <http://purl.org/dc/terms/>
`;

function getAccount(sessionGraphUri, sessionId) {
  return `
    ${PREFIXES}
    SELECT distinct ?account ?identifier
    WHERE {
      GRAPH ${sparqlEscapeUri(sessionGraphUri)} {
          ${sparqlEscapeUri(sessionId)} session:account ?account.
      }
      GRAPH ?g  {
          ?account a foaf:OnlineAccount ;
             dcterms:identifier ?identifier.
      }
    }

  `;
}

function requestReadReasonQuery(
  graph,
  subject,
  accountUri,
  identifier,
  paths,
  reasonCodeUri,
) {
  let now = new Date().toISOString();
  let id = uuid();

  let auditEntryUri = `<http://data.lblod.info/id/audit-trail-entries/${id}>`;
  const shapes = [];
  for (const segments of paths) {
    shapes.push(buildPath(segments));
  }
  return `
    ${PREFIXES}
    INSERT DATA {
      graph ${sparqlEscapeUri(graph)} {
        ${auditEntryUri} a ext:AuditTrailEntry;
          mu:uuid "${id}";
          dcterms:created "${now}"^^xsd:dateTime;
          dcterms:identifier ${sparqlEscapeString(identifier)};
          ext:requester  ${sparqlEscapeUri(accountUri)};
          ext:subject ${sparqlEscapeUri(subject)};
          ext:shape ${shapes.map((s) => s.shapeUri).join(',')};
          ext:code  ${sparqlEscapeUri(reasonCodeUri)}.
          ${shapes.map((s) => s.shape).join('\n')}
      }
    }
  `;
}

function buildPath(paths = []) {
  if (!paths?.length) {
    throw Error('warn... path is empty! This should never happen');
  }
  let listPath = [...paths];
  const shapeId = uuid();
  const shapeUri = `<http://data.lblod.info/id/node-shapes/${shapeId}>`;

  function buildList(paths = [], acc = []) {
    if (paths.length == 0) {
      return '<http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>';
    }
    const listId = uuid();
    const listUri = `<http://data.lblod.info/id/node-paths/${listId}>`;
    acc.push(
      `${listUri} a <htc/#address=%3A%3Affff%3A94.225.216.3tp://www.w3.org/1999/02/22-rdf-syntax-ns#List>`,
    );
    acc.push(
      `${listUri} <http://mu.semte.ch/vocabularies/core/uuid> """${listId}"""`,
    );
    acc.push(
      `${listUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> <${paths.shift()}>`,
    );
    acc.push(
      `${listUri} <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> ${buildList(paths, acc)}`,
    );
    return listUri;
  }
  const acc = [
    `${shapeUri} a <http://www.w3.org/ns/shacl#NodeShape>`,
    `${shapeUri} <http://mu.semte.ch/vocabularies/core/uuid> """${shapeId}"""`,
  ];

  const entryListUri = buildList(listPath, acc);
  acc.push(`${shapeUri} <http://www.w3.org/ns/shacl#path> ${entryListUri}`);

  let shape = acc.join('.\n');
  if (!shape.endsWith('.')) shape += '.';
  return {
    shapeUri,
    shape,
  };
}

function getReasonById(reasonId) {
  return `
    ${PREFIXES}
    select distinct ?reasonUri where {
      ?reasonUri mu:uuid ${sparqlEscapeString(reasonId)}.
    }
    
  `;
}

function getSubjectQuery(rdfType, id) {
  return `
    ${PREFIXES}
    select ?subject where {
       ?subject a <${rdfType}>; mu:uuid ${sparqlEscapeString(id)}.
    } limit 1
`;
}
export async function getAccountBySession(sessionId) {
  checkNotEmpty(sessionId, 'No session id!');
  let getAccountQuery = getAccount(SESSION_GRAPH_URI, sessionId);
  const queryResult = await query(getAccountQuery);
  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return {
      accountUri: result.account?.value,
      identifier: result.identifier?.value,
    };
  } else {
    return { accountUri: null, identifier: null };
  }
}

export async function getReasonUri(reasonId) {
  checkNotEmpty(reasonId, 'reasonId cannot be null!');
  let queryResult = await query(getReasonById(reasonId));

  if (queryResult.results.bindings.length) {
    let res = queryResult.results.bindings[0];
    let reasonUri = res.reasonUri?.value;
    checkNotEmpty(reasonUri, 'Code list not found');
    return reasonUri;
  } else {
    throw Error('Code list not found');
  }
}
export async function getSubject(rdfType, id) {
  checkNotEmpty(rdfType, 'rdf type cannot be empty');
  checkNotEmpty(id, 'id cannot be empty');
  let queryResult = await query(getSubjectQuery(rdfType, id));
  if (queryResult.results.bindings.length) {
    let res = queryResult.results.bindings[0];
    let subject = res.subject?.value;
    checkNotEmpty(subject, 'subject not found');
    return subject;
  } else {
    throw Error('Resource not found');
  }
}

export async function getAttribute(subject, paths) {
  let path = paths?.map((p) => `<${p}>`).join('/');
  checkNotEmpty(path, 'path should not be empty');
  let queryResult = await query(`
        select distinct ?a where {
            <${subject}> ${path} ?a.
        }
   `);
  let bindings = queryResult.results.bindings;
  if (bindings.length) {
    if (bindings.length === 1) {
      return bindings[0].a.value;
    }
    return bindings.map((r) => r.a.value);
  }
  return null;
}

export async function writeReason(
  subject,
  accountUri,
  identifier,
  reasonUri,
  sentAttributes,
) {
  let paths = sentAttributes.map((a) => a.attributeConf.path);
  let updateQuery = requestReadReasonQuery(
    AUDIT_TRAIL_GRAPH,
    subject,
    accountUri,
    identifier,
    paths,
    reasonUri,
  );
  await update(updateQuery);
}
