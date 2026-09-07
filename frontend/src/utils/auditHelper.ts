import { XmlNode, DocumentFieldValue } from '../types';

/**
 * Traverses an XmlNode tree and extracts all leaf text values and attributes
 */
export function extractDocumentValues(root: XmlNode): DocumentFieldValue[] {
  const values: DocumentFieldValue[] = [];

  function traverse(node: XmlNode) {
    if (node.attributes && node.attributes.length > 0) {
      for (const attr of node.attributes) {
        values.push({
          path: `${node.path}/@${attr.name}`,
          tag: `@${attr.name}`,
          value: attr.value,
        });
      }
    }

    if (node.children.length === 0) {
      if (node.textValue !== undefined && node.textValue !== '') {
        values.push({
          path: node.path,
          tag: node.tagName,
          value: node.textValue,
        });
      }
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return values;
}

/**
 * Extracts the most informative key fields for high-level preview
 */
export function extractKeySummary(values: DocumentFieldValue[]): { tag: string; value: string }[] {
  const priorityKeywords = [
    'name',
    'applicationName',
    'environment',
    'currency',
    'totalAmount',
    'status',
    'host',
    'merchantId',
    'customerId',
    'invoiceNumber',
    'version',
    'department',
    's3Bucket',
    'warehouseId',
    'entityId',
  ];

  const matched: { tag: string; value: string }[] = [];
  const matchedTags = new Set<string>();

  for (const kw of priorityKeywords) {
    const found = values.find(
      (v) =>
        v.tag.toLowerCase().includes(kw.toLowerCase()) &&
        !v.tag.startsWith('@') &&
        !matchedTags.has(v.tag)
    );
    if (found) {
      matched.push({ tag: found.tag, value: found.value });
      matchedTags.add(found.tag);
      if (matched.length >= 5) break;
    }
  }

  if (matched.length < 3) {
    for (const v of values) {
      if (!matchedTags.has(v.tag) && !v.tag.startsWith('@') && v.value.length < 50) {
        matched.push({ tag: v.tag, value: v.value });
        matchedTags.add(v.tag);
        if (matched.length >= 5) break;
      }
    }
  }

  return matched;
}
