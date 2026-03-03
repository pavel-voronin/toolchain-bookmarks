import type { CanonicalBookmarkNode } from "../types/canonical";
import type { FlatNode } from "../types/bookmarks";

export function flattenCanonicalTree(
  tree: CanonicalBookmarkNode[],
): Map<string, FlatNode> {
  const out = new Map<string, FlatNode>();

  const walk = (
    node: CanonicalBookmarkNode,
    parentPath: string,
    parentTitle: string | null,
    parentFolderId: string | null,
    fallbackIndex: number,
  ): void => {
    const title = node.title ?? "";
    const index = Number.isInteger(node.index) ? node.index : fallbackIndex;
    const path = node.path ?? `${parentPath}/${title}`;
    const parentId = node.parentId ?? parentFolderId;

    if (node.type === "link") {
      out.set(node.id, {
        id: node.id,
        type: "link",
        title,
        url: node.url,
        parentId,
        index,
        path,
        folderId: parentFolderId,
        folderTitle: parentTitle,
        folderPath: parentPath,
      });
      return;
    }

    out.set(node.id, {
      id: node.id,
      type: "folder",
      title,
      url: null,
      parentId,
      index,
      path,
      folderId: parentFolderId,
      folderTitle: parentTitle,
      folderPath: parentPath,
    });

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child, childIndex) =>
      walk(child, path, title, node.id, childIndex),
    );
  };

  tree.forEach((root, rootIndex) => walk(root, "", null, null, rootIndex));
  return out;
}
