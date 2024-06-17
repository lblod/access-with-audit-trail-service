import { sparqlEscapeUri, uuid, sparqlEscapeString } from "mu";
import { checkNotEmpty } from "./util";
import { SESSION_GRAPH_URI, AUDIT_TRAIL_GRAPH } from "../constants";
import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";

const PREFIXES = `
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX persoon: <https://data.vlaanderen.be/ns/persoon#>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX person: <http://www.w3.org/ns/person#>
PREFIX session: <http://mu.semte.ch/vocabularies/session/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
`;

function getAccount(sessionGraphUri, sessionId) {
  return `
    ${PREFIXES}
    SELECT distinct ?account
    WHERE {
      GRAPH ${sparqlEscapeUri(sessionGraphUri)} {
          ${sparqlEscapeUri(sessionId)} session:account ?account.
      }
    }

  `;
}

function requestReadReasonQuery(graph, accountUri, message, reasonCodeUri) {
  let now = new Date().toISOString();
  let id = uuid();
  return `
    ${PREFIXES}
    INSERT DATA {
      graph ${sparqlEscapeUri(graph)} {
        <http://data.lblod.info/id/audit-trail-entries/${id}> a ext:AuditTrailEntry;
          mu:uuid "${id}";
          ext:date "${now}"^^xsd:dateTime;
          ext:requester  ${sparqlEscapeUri(accountUri)};
          ext:message ${sparqlEscapeString(message)} ;
          ext:code  ${sparqlEscapeUri(reasonCodeUri)}.
      }
    }
  `;
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
    select  ?subject where {
       ?subject a <${rdfType}>; mu:uuid ${sparqlEscapeString(id)}.
    } limit 1
`;
}
export async function getAccountBySession(sessionId) {
  checkNotEmpty(sessionId, "No session id!");
  let getAccountQuery = getAccount(SESSION_GRAPH_URI, sessionId);
  const queryResult = await query(getAccountQuery);
  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return result.account?.value;
  } else {
    return null;
  }
}

export async function getReasonUri(reasonId) {
  checkNotEmpty(reasonId, "reasonId cannot be null!");
  let queryResult = await query(getReasonById(reasonId));

  if (queryResult.results.bindings.length) {
    let res = queryResult.results.bindings[0];
    let reasonUri = res.reasonUri?.value;
    checkNotEmpty(reasonUri, "Code list not found");
    return reasonUri;
  } else {
    throw Error("Code list not found");
  }
}
export async function getSubject(rdfType, id) {
  checkNotEmpty(rdfType, "rdf type cannot be empty");
  checkNotEmpty(id, "id cannot be empty");
  let queryResult = await query(getSubjectQuery(rdfType, id));
  if (queryResult.results.bindings.length) {
    let res = queryResult.results.bindings[0];
    let subject = res.subject?.value;
    checkNotEmpty(subject, "subject not found");
    return subject;
  } else {
    throw Error("Resource not found");
  }
}

export async function getAttribute(subject, paths) {
  let path = paths?.map((p) => `<${p}>`).join("/");
  checkNotEmpty(path, "path should not be empty");
  let queryResult = await query(`
        select distinct ?a where {
          graph ?g {
            <${subject}> ${path} ?a.
          }
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

export async function writeReason(accountUri, reasonUri, sentAttributes) {
  let message = `User requested ${sentAttributes.map((a) => `'${a}'`).join(",")}`;
  let updateQuery = requestReadReasonQuery(
    AUDIT_TRAIL_GRAPH,
    accountUri,
    message,
    reasonUri,
  );
  await update(updateQuery);
}
