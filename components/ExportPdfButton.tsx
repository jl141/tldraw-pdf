import { useState } from "react";
import { useEditor } from "tldraw";
import type { Pdf } from "../types/pdfTypes";

export function ExportPdfButton({ pdf }: { pdf: Pdf }) {
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const editor = useEditor();

  return (
    <button
      className="ExportPdfButton"
      onClick={async () => {
        setExportProgress(0);
        try {
          const { exportPdf } = await import("../utils/exportPdf");
          await exportPdf(editor, pdf, setExportProgress);
        } finally {
          setExportProgress(null);
        }
      }}
    >
      {exportProgress
        ? `Exporting... ${Math.round(exportProgress * 100)}%`
        : "Export PDF"}
    </button>
  );
}
