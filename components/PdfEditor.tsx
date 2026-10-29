import { useEffect, useMemo, useState } from "react";
import {
  Box,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultZoomMenu,
  DefaultZoomMenuContent,
  Editor,
  SVGContainer,
  TLComponents,
  TLImageShape,
  TLShapeId,
  TLShapePartial,
  TLUiOverrides,
  TldrawUiMenuItem,
  Tldraw,
  getIndicesBetween,
  react,
  track,
  useEditor,
} from "tldraw";
import { ExportPdfButton } from "./ExportPdfButton";
import type { Pdf } from "../types/pdfTypes";
import { PdfScrollbar } from "./PdfScrollbar";
import { PdfPageSidebar } from "./PdfPageSidebar";
import { SCRATCH_PAGE_TYPE, ScratchPageShapeUtil } from "./ScratchPageShape";
import { ScratchPageControls } from "./ScratchPageControls";
import {
  applyCameraConstraints,
  getRowBounds,
  getScratchBounds,
  getScratchPages,
} from "../utils/scratchPages";
import { getCurrentPageIndex } from "../utils/pdfPages";
import { isMobile } from "../utils/viewport";

const shapeUtils = [ScratchPageShapeUtil];

export function PdfEditor({ pdf }: { pdf: Pdf }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 841px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 841px)");
    const onChange = (event: MediaQueryListEvent) =>
      setIsSidebarOpen(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  /*
  The page menu is hidden because everything lives on one page. `OnTheCanvas` draws the dimmed
  area around the PDF pages and `SharePanel` is repurposed for the export button.
  */
  const components = useMemo<TLComponents>(
    () => ({
      PageMenu: null,
      OnTheCanvas: () => <PageOverlayScreen pdf={pdf} />,
      SharePanel: () => <ExportPdfButton pdf={pdf} />,
      MainMenu: () => (
        <DefaultMainMenu>
          <div>
            <TldrawUiMenuItem
              id="pdf-toggle-sidebar"
              label="Toggle sidebar"
              onSelect={() => setIsSidebarOpen((open) => !open)}
              kbd="shift+q"
            />
          </div>
          <DefaultMainMenuContent />
        </DefaultMainMenu>
      ),
      ZoomMenu: () => <PdfZoomMenu pdf={pdf} />,
      InFrontOfTheCanvas: () => (
        <>
          <ScratchPageControls pdf={pdf} />
          <PdfScrollbar pdf={pdf} />
        </>
      ),
    }),
    [pdf],
  );

  const overrides = useMemo<TLUiOverrides>(
    () => ({
      actions: (editor, actions) => ({
        ...actions,
        "pdf-zoom-to-page": {
          id: "pdf-zoom-to-page",
          label: "Zoom to page",
          kbd: "shift+3",
          onSelect: () => zoomToPage(editor, pdf),
        },
        "pdf-toggle-sidebar": {
          id: "pdf-toggle-sidebar",
          label: "Toggle sidebar",
          kbd: "shift+q",
          onSelect: () => setIsSidebarOpen((open) => !open),
        },
      }),
    }),
    [pdf],
  );

  return (
    <div className="PdfEditor-workspace">
      {editor && (
        <PdfPageSidebar
          editor={editor}
          pdf={pdf}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          isOpen={isSidebarOpen}
          onOpen={() => setIsSidebarOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="PdfEditor-canvas">
        <Tldraw
          shapeUtils={shapeUtils}
          licenseKey={
            import.meta.env.PROD
              ? import.meta.env.VITE_TLDRAW_LICENSE_KEY
              : undefined
          }
          onMount={(editor) => {
            setEditor(editor);
            /*
        Each PDF page is rendered to a PNG in PdfPicker.tsx and placed on the canvas as a locked
        image shape backed by an image asset.
        */
            editor.createAssets(
              pdf.pages
                .filter((page) => !editor.getAsset(page.assetId))
                .map((page) => ({
                  id: page.assetId,
                  typeName: "asset",
                  type: "image",
                  meta: {},
                  props: {
                    w: page.bounds.w,
                    h: page.bounds.h,
                    mimeType: "image/png",
                    src: page.src,
                    name: "page",
                    isAnimated: false,
                  },
                })),
            );
            editor.createShapes(
              pdf.pages
                .filter((page) => !editor.getShape(page.shapeId))
                .map((page): TLShapePartial<TLImageShape> => ({
                  id: page.shapeId,
                  type: "image",
                  x: page.bounds.x,
                  y: page.bounds.y,
                  isLocked: true,
                  props: {
                    assetId: page.assetId,
                    w: page.bounds.w,
                    h: page.bounds.h,
                  },
                })),
            );

            const shapeIds = pdf.pages.map((page) => page.shapeId);
            const shapeIdSet = new Set(shapeIds);

            /*
        A before-change side effect rejects any update that would unlock a page image, so users
        can't accidentally move or delete a page.
        */
            editor.sideEffects.registerBeforeChangeHandler(
              "shape",
              (prev, next) => {
                if (!shapeIdSet.has(next.id) && next.type !== SCRATCH_PAGE_TYPE)
                  return next;
                if (next.isLocked) return next;
                return { ...prev, isLocked: true };
              },
            );

            /*
        Annotations must draw above the pages, so after any shape is created or changed we check
        that the page images still hold the lowest indexes and re-index them if not.
        */
            function makeSureShapesAreAtBottom() {
              const isBackground = (id: TLShapeId) =>
                shapeIdSet.has(id) ||
                editor.getShape(id)?.type === SCRATCH_PAGE_TYPE;

              const siblings = editor.getSortedChildIdsForParent(
                editor.getCurrentPageId(),
              );
              const background = siblings.filter(isBackground);
              const others = siblings.filter((id) => !isBackground(id));

              if (others.length === 0) return;
              if (siblings.slice(0, background.length).every(isBackground))
                return;

              const lowestIndex = editor.getShape(others[0])!.index;
              const indexes = getIndicesBetween(
                undefined,
                lowestIndex,
                background.length,
              );
              editor.updateShapes(
                background.map((id, i) => {
                  const shape = editor.getShape(id)!;
                  return {
                    id,
                    type: shape.type,
                    isLocked: shape.isLocked,
                    index: indexes[i],
                  };
                }),
              );
            }

            makeSureShapesAreAtBottom();
            editor.sideEffects.registerAfterCreateHandler(
              "shape",
              makeSureShapesAreAtBottom,
            );
            editor.sideEffects.registerAfterChangeHandler(
              "shape",
              makeSureShapesAreAtBottom,
            );

            /*
        Camera constraints keep the viewport on the pages: `contain` prevents scrolling past the
        document, `fit-x-100` fits the width on load. The horizontal padding shrinks on narrow
        screens; the `react` callback re-applies the constraints when the viewport crosses that
        threshold. Returning its disposer from `onMount` stops it when the editor unmounts.
        */
            let mobile = isMobile(editor);
            let boundsKey = "";
            const scratchKey = () =>
              getScratchPages(editor)
                .map(
                  (shape) =>
                    `${shape.id}:${shape.x},${shape.y},${shape.props.w},${shape.props.h}`,
                )
                .sort()
                .join("|");

            /*
        Scratch pages change the document bounds, so constraints are reapplied whenever they
        change (add, delete, undo, redo, reload). Only crossing the mobile threshold resets the camera.
        */
            const stopReacting = react("update camera", () => {
              const isMobileNow = isMobile(editor);
              const key = scratchKey();
              if (isMobileNow === mobile && key === boundsKey) return;
              const crossedThreshold = isMobileNow !== mobile;
              mobile = isMobileNow;
              boundsKey = key;
              applyCameraConstraints(editor, pdf, crossedThreshold);
            });

            applyCameraConstraints(editor, pdf, true);

            return stopReacting;
          }}
          components={components}
          overrides={overrides}
          persistenceKey={pdf.id}
        />
      </div>
    </div>
  );
}

function PdfZoomMenu({ pdf }: { pdf: Pdf }) {
  const editor = useEditor();

  return (
    <DefaultZoomMenu>
      <DefaultZoomMenuContent />
      <TldrawUiMenuItem
        id="pdf-zoom-to-page"
        label="Zoom to page"
        onSelect={() => zoomToPage(editor, pdf)}
        kbd="shift+3"
      />
    </DefaultZoomMenu>
  );
}

function zoomToPage(editor: Editor, pdf: Pdf) {
  const pageIndex = getCurrentPageIndex(editor, pdf);
  editor.zoomToBounds(getRowBounds(editor, pdf, pageIndex), {
    inset: 48,
    animation: { duration: 200 },
  });
}

/*
The overlay is an SVG in page space with an even-odd path: the viewport rectangle minus each
visible page rectangle, filled with a translucent background color. Only pages that collide
with the viewport are drawn.
*/
const PageOverlayScreen = track(function PageOverlayScreen({
  pdf,
}: {
  pdf: Pdf;
}) {
  const editor = useEditor();

  const viewportPageBounds = editor.getViewportPageBounds();
  const scratchPages = getScratchPages(editor).filter((shape) =>
    viewportPageBounds.collides(getScratchBounds(shape)),
  );

  const relevantPageBounds = [
    ...pdf.pages.map((page) => page.bounds),
    ...scratchPages.map((shape) => getScratchBounds(shape)),
  ].filter((bounds): bounds is Box => viewportPageBounds.collides(bounds));

  function pathForPageBounds(bounds: Box) {
    return `M ${bounds.x} ${bounds.y} L ${bounds.maxX} ${bounds.y} L ${bounds.maxX} ${bounds.maxY} L ${bounds.x} ${bounds.maxY} Z`;
  }

  const viewportPath = `M ${viewportPageBounds.x} ${viewportPageBounds.y} L ${viewportPageBounds.maxX} ${viewportPageBounds.y} L ${viewportPageBounds.maxX} ${viewportPageBounds.maxY} L ${viewportPageBounds.x} ${viewportPageBounds.maxY} Z`;

  return (
    <>
      <SVGContainer className="PageOverlayScreen-screen">
        <path
          d={`${viewportPath} ${relevantPageBounds.map(pathForPageBounds).join(" ")}`}
          fillRule="evenodd"
        />
        {scratchPages.map((shape) => (
          <rect
            key={shape.id}
            x={shape.x}
            y={shape.y}
            width={shape.props.w}
            height={shape.props.h}
            fill="#fff"
          />
        ))}
      </SVGContainer>
      {relevantPageBounds.map((bounds, i) => (
        <div
          key={i}
          className="PageOverlayScreen-outline"
          style={{
            width: bounds.w,
            height: bounds.h,
            transform: `translate(${bounds.x}px, ${bounds.y}px)`,
          }}
        />
      ))}
    </>
  );
});
