import PdfJSWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useState } from "react";
import { PdfPickerView } from "./PdfPickerView";
import type { Pdf, PdfPage, RecentPdf } from "../types/pdfTypes";
import {
  canPersistFiles,
  forgetRecentPdf,
  listRecentPdfs,
  pickPdfHandle,
  saveRecentPdf,
} from "../utils/recentPdfs";

const pageSpacing = 32;

export function PdfPicker({ onOpenPdf }: { onOpenPdf(pdf: Pdf): void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [recents, setRecents] = useState<RecentPdf[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refreshRecents() {
    if (!canPersistFiles) return;
    listRecentPdfs().then((list) => {
      setRecents(list);
      setSelectedId((id) =>
        list.some((r) => r.id === id) ? id : (list[0]?.id ?? ""),
      );
    });
  }
  useEffect(refreshRecents, []);

  async function loadPdf(
    id: string,
    name: string,
    source: ArrayBuffer,
  ): Promise<Pdf> {
    const { AssetRecordType, Box, createShapeId } = await import("tldraw");
    const PdfJS = await import("pdfjs-dist");
    PdfJS.GlobalWorkerOptions.workerSrc = PdfJSWorkerSrc;

    const pdf = await PdfJS.getDocument(source.slice(0)).promise;
    const pages: PdfPage[] = [];

    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Failed to create canvas context");

    const visualScale = 1.5;
    const scale = window.devicePixelRatio;

    let top = 0;
    let widest = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: scale * visualScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const renderContext = {
        canvasContext: context,
        viewport,
      };
      await page.render(renderContext).promise;

      const width = viewport.width / scale;
      const height = viewport.height / scale;
      pages.push({
        src: canvas.toDataURL(),
        bounds: new Box(0, top, width, height),
        assetId: AssetRecordType.createId(`${id}-page-${i}`),
        shapeId: createShapeId(`${id}-page-${i}`),
      });
      top += height + pageSpacing;
      widest = Math.max(widest, width);
    }
    canvas.width = 0;
    canvas.height = 0;

    for (const page of pages) {
      page.bounds.x = (widest - page.bounds.width) / 2;
    }

    return {
      id,
      name,
      pages,
      source,
    };
  }

  async function openFile(id: string, file: File) {
    setIsLoading(true);
    try {
      onOpenPdf(await loadPdf(id, file.name, await file.arrayBuffer()));
    } finally {
      setIsLoading(false);
    }
  }

  async function onClickOpenPdf() {
    setError(null);
    if (canPersistFiles) {
      const handle = await pickPdfHandle();
      if (!handle) return;
      const file = await handle.getFile();
      await openFile(await saveRecentPdf(handle), file);
      return;
    }

    // Browsers without the File System Access API can't remember files, so key by file identity.
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file)
        openFile(`${file.name}-${file.size}-${file.lastModified}`, file);
    });
    input.click();
  }

  async function onClickContinue() {
    const recent = recents.find((r) => r.id === selectedId);
    if (!recent) return;
    setError(null);
    try {
      const handle = recent.handle;
      if ((await handle.requestPermission({ mode: "read" })) !== "granted") {
        setError("Permission to read the file was denied.");
        return;
      }
      const file = await handle.getFile();
      await saveRecentPdf(handle);
      await openFile(recent.id, file);
    } catch (e) {
      if ((e as DOMException).name !== "NotFoundError") {
        setError(`Could not open "${recent.name}": ${(e as Error).message}`);
        return;
      }
      await forgetRecentPdf(recent.id);
      setError(
        `"${recent.name}" was moved or deleted. Its saved annotations were removed.`,
      );
      refreshRecents();
    }
  }

  return (
    <PdfPickerView
      isLoading={isLoading}
      recents={recents}
      selectedId={selectedId}
      error={error}
      onOpenFile={() => void onClickOpenPdf()}
      onContinue={() => void onClickContinue()}
      onSelectRecent={setSelectedId}
    />
  );
}
