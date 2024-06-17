I jotted the following down and because Jira doesn't load over the phone network and I'll have limited availibiI'll add this to Jira but I'm hoping you'll have time for it (and otherwise I'll try to beat you to it 😉 ). We want a somewhat nicer way to do the OP "hey, I need to see this data" structure. The frontend can supply the reasoning etc, but we need the backend of it. I'm fairly certain we can have something through which we can use pushPayload in the frontend to add attribute values.
It's not going to be perfect. I'm hoping for a straightforward json configuration for now for some limited fields (I think all string fields, not 100% sure).
I jotted the following down and because Jira doesn't load over the phone network and I'll have limited availibility, here are my intermittent notes:

```
A two step process seems to be okay:
   1. fetch main resources through mu-cl-resources
   2. fill in extra information through custom service

   The access-with-reason-service would:
   - check the current mu-session-id
   - the reason the frontend supplies (which in some cases could just be a default)
   - the entity+attribute combinations which are to be returned

   The service is configured to find properties of objects, and the subject of those objects:
   1. based on a type or key, what is the path to the subject of this entity
   2. which properties may be returned for a type

   A response will only be given after both of:
   1. the user could be found for mu-session-id
   2. a note was written to the triplestore saying the _user_ (not
      session) accessed information from _subject_ with all specific
      fields written down.

   The response will be handled in the frontend through ember-data.  It
   should contain a json-api compliant response with resources in the
   frontend, the requested properties, and no relations.  It would be
   possible to add relations in the future for a more full-fledged
   response but this is _not_ a requirement at this point.
```

Yes, it's more like a broad solution for that.
I think we can go really really far by just filling in the properties in the ember-data models and leaving the rest to mu-cl-resources. There's an obvious problem when the identifiers are reused so that's a word of warning. There's also the risk that we'd be implementing a second mu-cl-resources with some extra constraints
But I think implementing a basic service with basic properties can help us for this sort of case which we expect to exist in multiple applications and we assume will become a reality in other services too.
Boris has the specific fields which should be captured for their case. I don't have their story either but it looks like I'll be able to make a ticket on Jira for this one now 😃

We want to get rid of more sudo queries and scopes might help there. A microservice can supply a mu-auth-scope header (easy to supply in mu-javascript-template/feature-query-meta) and you can supply other access rights for such a scope. Ideally the scope is a URI (we think that will be smart).
A concrete example: Users may not be allowed to upload files, yet they may be allowed to request an image of a certain scale. That image may be cached. The image-service could be granted file creation rights in the public graph in tche name of a regular logged in user, even though the user isn't allowed to created files themselves.

```lisp
(grant (read)
       :to-graph public
       :for-allowed-group "public")
(grant (write)
       :to public
       :for "admin")

(with-scope "service:image-service"
  (grant (read write)
         :to files
         :for "public"))
```
