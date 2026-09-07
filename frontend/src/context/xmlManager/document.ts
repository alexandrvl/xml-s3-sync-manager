import { XmlNode } from '../../types';
import { xmlModelToString } from '../../utils/xmlParser';

export function cloneNode(root: XmlNode): XmlNode {
  return JSON.parse(JSON.stringify(root)) as XmlNode;
}

export function applyTreeUpdate(root: XmlNode, updater: (node: XmlNode) => boolean): XmlNode | null {
  const copy = cloneNode(root);

  function traverse(curr: XmlNode): boolean {
    if (updater(curr)) return true;
    for (const child of curr.children) {
      if (traverse(child)) return true;
    }
    return false;
  }

  return traverse(copy) ? copy : null;
}

export function removeNodeById(
  root: XmlNode,
  nodeId: string
): { root: XmlNode; deletedTag: string; deletedPath: string; deletedXmlSnippet: string } | null {
  if (root.id === nodeId) return null;
  const copy = cloneNode(root);
  let deletedTag = '';
  let deletedPath = '';
  let deletedXmlSnippet = '';

  function removeRecursive(curr: XmlNode): boolean {
    const idx = curr.children.findIndex((c) => c.id === nodeId);
    if (idx !== -1) {
      const removed = curr.children[idx];
      deletedTag = removed.tagName;
      deletedPath = removed.path;
      deletedXmlSnippet = xmlModelToString(removed);
      curr.children.splice(idx, 1);
      return true;
    }
    for (const child of curr.children) {
      if (removeRecursive(child)) return true;
    }
    return false;
  }

  if (!removeRecursive(copy)) return null;
  return { root: copy, deletedTag, deletedPath, deletedXmlSnippet };
}

export function withUpdatedDocument<T extends { root: XmlNode; version: number }>(
  document: T,
  root: XmlNode,
  serialized: string
): T & { rawXml: string; fileSize: number; lastModified: number } {
  return {
    ...document,
    root,
    rawXml: serialized,
    fileSize: new Blob([serialized]).size,
    version: document.version + 1,
    lastModified: Date.now(),
  };
}
