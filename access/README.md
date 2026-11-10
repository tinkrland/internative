# access

what the internative can reach, as grants rather than intentions.

knowledge answers "does she know how". access answers "is it hers to do", and the two fail
differently: a missing skill produces a bad attempt, a missing grant produces an attempt at
something nobody authorised. so tool-calling lives here, not in `knowledge/`, and a grant is
data with a decision attached instead of a sentence in a prompt.

a grant names:

| field | why it is there |
|---|---|
| `reaches` | what it reaches, in the internative's words: "her email", "the shop's checkout" |
| `tool` | the callable, not the intention |
| `kind` | read, write, spend, call |
| `credential_env` | the NAME of an environment variable. a grant that carries a secret is a leak with a schema |
| `state` | live, unverified, revoked, expired |
| `granted_by`, `granted_at` | an agent may not authorise itself, and a live grant says when it was given |
| `spend_ceiling`, `spend_unit` | a spend grant without a ceiling is an unlimited bet with somebody else's money |
| `last_ok_at` | an oauth grant can die without telling anybody, so the last time it worked is part of the grant |

`hasAccess()` denies before it allows: revoked beats every scope, unverified is not live,
an expired grant is expired even if the date is only a day old, and a spend over its ceiling
is refused with both numbers in the reason. every answer carries a reason, because "no" with a
reason is something an agent can work with and "no" alone is something it will route around.

`accessBrief()` is what a surface may say about itself to the model, and it labels anything
not live. a prompt that says "you can post to instagram" and then fails is worse than a prompt
that never claimed it.

code: `tool.ts` (`grantProblems`, `hasAccess`, `accessBrief`).
