import { XmlDocumentModel, XmlNode, XmlAttribute } from '../types';

let nextIdCounter = 1;
export const generateNodeId = (): string => `node_${Date.now()}_${nextIdCounter++}`;

/**
 * Parses raw XML text into our structured XmlNode model
 */
export function parseXmlStringToModel(xmlString: string, fileName: string = 'document.xml'): {
  document?: XmlDocumentModel;
  error?: string;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parser errors
  const parserError = doc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    const errorText = parserError[0].textContent || 'Invalid XML syntax';
    return { error: errorText };
  }

  const rootElement = doc.documentElement;
  if (!rootElement) {
    return { error: 'XML document does not have a root element' };
  }

  const rootNode = domNodeToXmlNode(rootElement, `/${rootElement.tagName}`);

  return {
    document: {
      fileName,
      fileSize: new Blob([xmlString]).size,
      lastModified: Date.now(),
      root: rootNode,
      rawXml: xmlString,
      version: 1,
    },
  };
}

function domNodeToXmlNode(element: Element, currentPath: string): XmlNode {
  const attributes: XmlAttribute[] = [];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attributes.push({
      id: `attr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: attr.name,
      value: attr.value,
    });
  }

  const children: XmlNode[] = [];
  let textValue: string | undefined = undefined;

  // Track occurrences of tag names for path indexing (e.g., item[0], item[1])
  const tagCounts: Record<string, number> = {};

  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element;
      const tagName = childEl.tagName;
      const count = tagCounts[tagName] || 0;
      tagCounts[tagName] = count + 1;

      const childPath = `${currentPath}/${tagName}[${count}]`;
      children.push(domNodeToXmlNode(childEl, childPath));
    } else if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      const text = child.textContent?.trim();
      if (text && text.length > 0) {
        textValue = (textValue ? textValue + ' ' : '') + text;
      }
    }
  }

  return {
    id: generateNodeId(),
    tagName: element.tagName,
    path: currentPath,
    attributes,
    textValue: children.length === 0 ? (textValue ?? '') : undefined,
    children,
    isExpanded: true,
  };
}

/**
 * Serializes the XmlNode model back to clean, formatted XML string
 */
export function xmlModelToString(rootNode: XmlNode): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';

  function serializeNode(node: XmlNode, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    let attrs = '';
    if (node.attributes && node.attributes.length > 0) {
      attrs = ' ' + node.attributes.map((a) => `${escapeXmlName(a.name)}="${escapeXml(a.value)}"`).join(' ');
    }

    if (node.children.length === 0) {
      if (node.textValue !== undefined && node.textValue !== '') {
        return `${indent}<${escapeXmlName(node.tagName)}${attrs}>${escapeXml(node.textValue)}</${escapeXmlName(node.tagName)}>\n`;
      } else {
        return `${indent}<${escapeXmlName(node.tagName)}${attrs} />\n`;
      }
    }

    let result = `${indent}<${escapeXmlName(node.tagName)}${attrs}>\n`;
    for (const child of node.children) {
      result += serializeNode(child, indentLevel + 1);
    }
    result += `${indent}</${escapeXmlName(node.tagName)}>\n`;
    return result;
  }

  xml += serializeNode(rootNode, 0);
  return xml;
}

function escapeXmlName(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '_';
      case '>':
        return '_';
      case '&':
        return '_';
      case "'":
        return '_';
      case '"':
        return '_';
      default:
        return c;
    }
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * Validate raw XML string
 */
export function validateXmlString(xml: string): { isValid: boolean; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const parserError = doc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      return { isValid: false, error: parserError[0].textContent || 'Syntax Error in XML' };
    }
    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: (err as Error).message };
  }
}

/**
 * Clones a node tree deep
 */
export function cloneXmlTree(node: XmlNode): XmlNode {
  return {
    ...node,
    id: generateNodeId(),
    attributes: node.attributes.map((a) => ({ ...a, id: `attr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
    children: node.children.map(cloneXmlTree),
  };
}
