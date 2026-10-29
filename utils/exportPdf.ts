import { PDFDocument, rgb } from "pdf-lib";
import type { Editor } from "tldraw";
import type { Pdf } from "../types/pdfTypes";
import { SCRATCH_PAGE_TYPE } from "../components/ScratchPageShape";
import { getRowBounds, getScratchPages } from "./scratchPages";

export async function exportPdf(
  editor: Editor,
  { name, source, pages }: Pdf,
  onProgress: (progress: number) => void,
) {
  const totalThings = pages.length * 2 + 2;
  let progressCount = 0;
  const tickProgress = () => {
    progressCount++;
    onProgress(progressCount / totalThings);
  };

  const pdf = await PDFDocument.load(source);
  tickProgress();

  const pdfPages = pdf.getPages();
  if (pdfPages.length !== pages.length) {
    throw new Error("PDF page count mismatch");
  }

  const pageShapeIds = new Set(pages.map((page) => page.shapeId));
  const allIds = Array.from(editor.getCurrentPageShapeIds()).filter(
    (id) =>
      !pageShapeIds.has(id) && editor.getShape(id)?.type !== SCRATCH_PAGE_TYPE,
  );
  const scratchPages = getScratchPages(editor);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pdfPage = pdfPages[i];

    // The exported page grows to include its scratch pages; other pages keep their own width.
    const row = getRowBounds(editor, { pages } as Pdf, i);
    const hasLeft = scratchPages.some(
      (s) => s.props.pageIndex === i && s.props.side === "left",
    );
    const hasRight = scratchPages.some(
      (s) => s.props.pageIndex === i && s.props.side === "right",
    );
    const hasScratch = hasLeft || hasRight;

    const shapesInBounds = allIds.filter((id) => {
      const shapePageBounds = editor.getShapePageBounds(id);
      if (!shapePageBounds) return false;
      return shapePageBounds.collides(row);
    });

    if (hasScratch) {
      const w = pdfPage.getWidth();
      const h = pdfPage.getHeight();
      const sideWidth = w / 2;
      const leftWidth = hasLeft ? sideWidth : 0;
      const totalWidth = leftWidth + w + (hasRight ? sideWidth : 0);

      const embedded = await pdf.embedPage(pdfPage);
      const newPage = pdf.insertPage(i, [totalWidth, h]);
      pdf.removePage(i + 1);
      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: totalWidth,
        height: h,
        color: rgb(1, 1, 1),
      });
      newPage.drawPage(embedded, { x: leftWidth, y: 0, width: w, height: h });

      if (shapesInBounds.length === 0) {
        tickProgress();
        tickProgress();
        continue;
      }
      const exportedPng = await editor.toImage(shapesInBounds, {
        format: "png",
        background: false,
        bounds: row,
        padding: 0,
        scale: 1,
      });
      tickProgress();
      newPage.drawImage(
        await pdf.embedPng(await exportedPng.blob.arrayBuffer()),
        {
          x: 0,
          y: 0,
          width: totalWidth,
          height: h,
        },
      );
      tickProgress();
      continue;
    }

    if (shapesInBounds.length === 0) {
      tickProgress();
      tickProgress();
      continue;
    }

    const exportedPng = await editor.toImage(shapesInBounds, {
      format: "png",
      background: false,
      bounds: page.bounds,
      padding: 0,
      scale: 1,
    });
    tickProgress();

    pdfPage.drawImage(
      await pdf.embedPng(await exportedPng.blob.arrayBuffer()),
      {
        x: 0,
        y: 0,
        width: pdfPage.getWidth(),
        height: pdfPage.getHeight(),
      },
    );
    tickProgress();
  }

  const url = URL.createObjectURL(
    new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" }),
  );
  tickProgress();
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
