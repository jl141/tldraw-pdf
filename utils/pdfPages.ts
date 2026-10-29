import type { Editor } from "tldraw";
import type { Pdf } from "../types/pdfTypes";

export function getCurrentPageIndex(editor: Editor, pdf: Pdf) {
  const viewport = editor.getViewportPageBounds();
  let bestIndex = 0;
  let bestArea = -1;
  let bestDistance = Infinity;

  pdf.pages.forEach((page, index) => {
    const overlapWidth = Math.max(
      0,
      Math.min(viewport.maxX, page.bounds.maxX) -
        Math.max(viewport.x, page.bounds.x),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(viewport.maxY, page.bounds.maxY) -
        Math.max(viewport.y, page.bounds.y),
    );
    const area = overlapWidth * overlapHeight;
    const distance = Math.abs(
      viewport.y + viewport.h / 2 - (page.bounds.y + page.bounds.h / 2),
    );
    if (area > bestArea || (area === bestArea && distance < bestDistance)) {
      bestIndex = index;
      bestArea = area;
      bestDistance = distance;
    }
  });

  return bestIndex;
}
