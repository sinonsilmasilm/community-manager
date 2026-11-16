// Per-process in-memory rate limiter. Good enough to stop a single user from
// hammering /ask within one serverless instance's lifetime. For strict
// cross-instance limits, back this with the same KV store used for config
// (swap the Map for kvGet/kvSet calls) — left simple here since AI Gateway
// calls already cost money per request and most abuse is bursty/local.
const buckets = new Map();
export function isRateLimited(key, maxRequests, windowSeconds) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const existing = buckets.get(key);
    if (!existing || now - existing.windowStart > windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return false;
    }
    existing.count += 1;
    if (existing.count > maxRequests)
        return true;
    return false;
}
