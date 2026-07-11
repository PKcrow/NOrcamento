/**
 * Defensive patch against a well-known browser conflict: when a page is
 * auto-translated (e.g. Chrome's "Translate this page" on Android) or
 * modified by certain extensions, the browser can move/replace DOM nodes
 * that React still believes it owns. When React's renderer then tries to
 * remove or insert a node in its expected position, the browser throws
 * `NotFoundError: Failed to execute 'removeChild'/'insertBefore' on 'Node'`
 * and crashes the whole page — even though nothing is actually wrong with
 * the app's own logic.
 *
 * This patches `Node.prototype.removeChild` / `insertBefore` to fail
 * silently (instead of throwing) when the node they're asked to act on is
 * no longer where React expects it, since in that situation the DOM
 * mutation is a no-op we actually want (the node is already gone/moved).
 *
 * We already added `translate="no"` / `notranslate` to discourage
 * auto-translation, but extensions and some browser versions ignore that,
 * so this patch is the last line of defense on top of the ErrorBoundary.
 */
export function installDomPatch() {
  if (typeof Node === "undefined" || !Node.prototype) return;

  const originalRemoveChild = Node.prototype.removeChild;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        return child.parentNode.removeChild(child) as T;
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  } as typeof Node.prototype.removeChild;

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  } as typeof Node.prototype.insertBefore;
}
