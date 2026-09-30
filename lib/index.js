/**
 * dsh-subagent-fish, node half. Pure UI plugin: the empty apply exists so the
 * package appears in the host cordis.yml / Loader; the browser half ships via
 * exports["./client"], discovered through the package.json dsh.client
 * declaration. There is no host-side behaviour — a subagent's fish is a pure
 * function of its session id, and every input it needs (the session list and
 * the subagent catalog projection) is already on the client.
 */
/** Host plugin body. */
export function apply() {}
