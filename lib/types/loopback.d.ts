/**
 * Loopback trust fence for the dsh-updater host route family: socket
 * address, Host header, and browser same-origin markers. The check route is
 * read-only, but the update route mutates the host checkout, so it must never
 * be served to a LAN-exposed dsh web deployment.
 *
 * Semantics: RFC 5735 IPv4 127/8, ::1, IPv4-mapped ::ffff:127/8, localhost
 * hostnames, plus the browser same-origin markers (sec-fetch-site and Origin)
 * for the request-level fence.
 */
import type { IncomingMessage } from 'node:http';
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
export declare function isIPv4Loopback(v4: string): boolean;
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
export declare function isLoopbackAddress(address: string | undefined): boolean;
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
export declare function isLoopbackHostname(hostname: string): boolean;
/**
 * Request-level trust fence: a loopback socket address AND a loopback Host
 * header, plus browser same-origin markers. The socket address is
 * authoritative; X-Forwarded-For is never trusted.
 */
export declare function isLoopbackRequest(request: IncomingMessage): boolean;
