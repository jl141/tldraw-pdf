import type { Editor } from "tldraw";

export function isMobile(editor: Editor): boolean {
  return editor.getViewportScreenBounds().width < 840;
}
