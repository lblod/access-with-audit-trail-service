# access-with-audit-trail-service

This service provides a way to log access to specific attributes of a given resource.

It works similarly to the [Privacy service](https://github.com/lblod/privacy-centric-service),
but in this case the service is more generic.

## Environment variable

## Full example

#### docker-compose.yml

```yml
access-with-audit-trail:
  image: lblod/access-with-audit-trail-service
  volumes:
    - ./config/access-with-audit-trail:/conf
  environment:
    APP_CONFILE_FILE: /conf/config.json # optional, default is: /config/config.json
    SESSION_GRAPH_URI: 'http://mu.semte.ch/graphs/sessions' # optional
    AUDIT_TRAIL_GRAPH: 'http://mu.semte.ch/graphs/audit-trail-service' # graph to store audit logs

  links:
    - db:database
```

#### config under `./config/access-with-audit-trail/config.json`

```json
{
  "prefixes": {
    "dc_terms": "http://purl.org/dc/terms/",
    "schema": "http://schema.org/",
    "person": "http://www.w3.org/ns/person#",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "persoon": "https://data.vlaanderen.be/ns/persoon#"
  },
  "resources": {
    "people": {
      "rdfType": "person:Person",
      "attributes": {
        "given-name": {
          "label": "Given Name",
          "type": "string",
          "path": ["foaf:givenName"]
        },
        "family-name": {
          "label": "Family Name",
          "type": "string",
          "path": ["foaf:familyName"]
        },
        "first-name-used": {
          "label": "First name used",
          "type": "string",
          "path": "persoon:gebruikteVoornaam"
        }
      }
    }
  }
}
```

#### insert reasons in the database

```sparql
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

 INSERT DATA {
  GRAPH  <http://mu.semte.ch/graphs/public> {
    <http://data.lblod.info/id/information-request-reason/3aeec145-acf3-4b6e-9c00-5b8e285736e0> a ext:ReasonCode,
        skos:Concept;
        mu:uuid "3aeec145-acf3-4b6e-9c00-5b8e285736e0";
        skos:prefLabel "Aanmaken van een persoon".
  }
}
```

#### dispatcher

```elixir
 match "/access-with-audit-trail/*path", %{ layer: :api_services, accept: %{ json: true } } do
    forward conn, path, "http://access-with-audit-trail"
  end
```

#### url structure

`http://localhost/access-with-audit-trail/<keyTypeInConfig>/<resourceId>?reasonId=<reasonId>&include=keyAttribute1,keyAttribute2`

#### using curl

```
curl 'http://localhost/access-with-audit-trail/people/7daa61fcd543c33f63014dd97db0950d0e6475ac40ed553346a9ce58d7775a95?reasonId=3aeec145-acf3-4b6e-9c00-5b8e285736e0&include=given-name' \
-H 'Accept: application/vnd.api+json'   --compressed  \
-H  'Cookie: mongo-express=s%3AInF0VUj85ivrTDBJZeO-m-DL0GHH4qj0.GdrzS6IKBEtY54extsCUWmWwKfShQgva%2F%2BVO0juLqRs; io=kvZdKTmLQwMQw6AHAAAB; proxy_session=QTEyOEdDTQ.SwAZnkCaGbcRwNO1sxYy_q9032Wygla2TgG073Z8ae7HN4GyO1RzDNQD32Y.rz5CNhgEXoV0VWyW.pS8jGskeXmStJY64AzM7mRdjsFE0-5Vd3HtsgskymkuqBk7VekS4u2Xs1uipacvlpdcoTyrWT8k4rx5KK58VhuDtcnwrJYxl8gHhltrdIkz8e1JtRdLXpKGDSSHeJ66V8iMqDQg6JTxa22-qctBFofBblVZgaCgv5YOBXaumGwBj01xaVnwguuhCoB6ebqRV-f8Cn5Kv4g-qL25nmoHgytCsRAZBeo6JXZZ2DPx-VK5rCrxSo9xbwBIESJND9XrNqR49REVaP83FJxqYtt3woC6iwTmfv7Kt7V-tegiGru1_PG87u0ibjpDPQg.5C-H8AKZPl_aua_ZvSck2g'
```

The command above using OP database should output:

```json
{
  "data": {
    "type": "people",
    "id": "7daa61fcd543c33f63014dd97db0950d0e6475ac40ed553346a9ce58d7775a95",
    "attributes": {
      "given-name": "Aagje",
      "family-name": "Merlevede"
    },
    "relationships": {}
  }
}
```

The following should be saved in the triplestore:

```sparql
 PREFIX sh:   <http://www.w3.org/ns/shacl#>
 PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
 PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
 PREFIX persoon: <https://data.vlaanderen.be/ns/persoon#>
 PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
 PREFIX person: <http://www.w3.org/ns/person#>
 PREFIX session: <http://mu.semte.ch/vocabularies/session/>
 PREFIX foaf: <http://xmlns.com/foaf/0.1/>
 PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>

     INSERT DATA {
       graph <http://mu.semte.ch/graphs/audit-trail-service> {
         <http://data.lblod.info/id/audit-trail-entries/413bf0f0-2fb8-11ef-a6eb-b941ca6da508> a ext:AuditTrailEntry;
           mu:uuid "413bf0f0-2fb8-11ef-a6eb-b941ca6da508";
           ext:date "2024-06-21T10:23:08.671Z"^^xsd:dateTime;
           ext:requester  <http://data.lblod.info/id/account/3a91ff60-07c1-4136-ac5e-55cf401e0957>;
           ext:subject <http://data.lblod.info/id/personen/7daa61fcd543c33f63014dd97db0950d0e6475ac40ed553346a9ce58d7775a95>;
           ext:path <http://xmlns.com/foaf/0.1/givenName>;
           ext:path <http://xmlns.com/foaf/0.1/familyName>;
           ext:code  <http://data.lblod.info/id/information-request-reason/3aeec145-acf3-4b6e-9c00-5b8e285736e0>.
       }
     }

```
