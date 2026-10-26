import { useMemo } from 'react'
import {
	Box,
	SVGContainer,
	TLComponents,
	TLImageShape,
	TLShapePartial,
	Tldraw,
	getIndicesBetween,
	react,
	sortByIndex,
	track,
	useEditor,
} from 'tldraw'
import { ExportPdfButton } from './ExportPdfButton'
import type { Pdf } from '../types/pdfTypes'
import { PDF_PADDING_Y, PdfScrollbar, getPdfBounds } from './PdfScrollbar'

export function PdfEditor({ pdf }: { pdf: Pdf }) {
	/*
  The page menu is hidden because everything lives on one page. `OnTheCanvas` draws the dimmed
  area around the PDF pages and `SharePanel` is repurposed for the export button.
  */
	const components = useMemo<TLComponents>(
		() => ({
			PageMenu: null,
			OnTheCanvas: () => <PageOverlayScreen pdf={pdf} />,
			SharePanel: () => <ExportPdfButton pdf={pdf} />,
			InFrontOfTheCanvas: () => <PdfScrollbar pdf={pdf} />,
		}),
		[pdf]
	)

	return (
		<Tldraw
			onMount={(editor) => {
				/*
        Each PDF page is rendered to a PNG in PdfPicker.tsx and placed on the canvas as a locked
        image shape backed by an image asset.
        */
				editor.createAssets(
					pdf.pages.filter((page) => !editor.getAsset(page.assetId)).map((page) => ({
						id: page.assetId,
						typeName: 'asset',
						type: 'image',
						meta: {},
						props: {
							w: page.bounds.w,
							h: page.bounds.h,
							mimeType: 'image/png',
							src: page.src,
							name: 'page',
							isAnimated: false,
						},
					}))
				)
				editor.createShapes(
					pdf.pages.filter((page) => !editor.getShape(page.shapeId)).map(
						(page): TLShapePartial<TLImageShape> => ({
							id: page.shapeId,
							type: 'image',
							x: page.bounds.x,
							y: page.bounds.y,
							isLocked: true,
							props: {
								assetId: page.assetId,
								w: page.bounds.w,
								h: page.bounds.h,
							},
						})
					)
				)

				const shapeIds = pdf.pages.map((page) => page.shapeId)
				const shapeIdSet = new Set(shapeIds)

				/*
        A before-change side effect rejects any update that would unlock a page image, so users
        can't accidentally move or delete a page.
        */
				editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next) => {
					if (!shapeIdSet.has(next.id)) return next
					if (next.isLocked) return next
					return { ...prev, isLocked: true }
				})

        /*
        Annotations must draw above the pages, so after any shape is created or changed we check
        that the page images still hold the lowest indexes and re-index them if not.
        */
        function makeSureShapesAreAtBottom() {
					const shapes = shapeIds.map((id) => editor.getShape(id)!).sort(sortByIndex)
					const pageId = editor.getCurrentPageId()

					const siblings = editor.getSortedChildIdsForParent(pageId)
					const currentBottomShapes = siblings
						.slice(0, shapes.length)
						.map((id) => editor.getShape(id)!)

					if (currentBottomShapes.every((shape, i) => shape.id === shapes[i].id)) return

					const otherSiblings = siblings.filter((id) => !shapeIdSet.has(id))
					const bottomSibling = otherSiblings[0]
					const lowestIndex = editor.getShape(bottomSibling)!.index

					const indexes = getIndicesBetween(undefined, lowestIndex, shapes.length)
					editor.updateShapes(
						shapes.map((shape, i) => ({
							...shape,
							id: shape.id,
							isLocked: shape.isLocked,
							index: indexes[i],
						}))
					)
				}

				makeSureShapesAreAtBottom()
				editor.sideEffects.registerAfterCreateHandler('shape', makeSureShapesAreAtBottom)
				editor.sideEffects.registerAfterChangeHandler('shape', makeSureShapesAreAtBottom)

        /*
        Camera constraints keep the viewport on the pages: `contain` prevents scrolling past the
        document, `fit-x-100` fits the width on load. The horizontal padding shrinks on narrow
        screens; the `react` callback re-applies the constraints when the viewport crosses that
        threshold. Returning its disposer from `onMount` stops it when the editor unmounts.
        */
				const targetBounds = getPdfBounds(pdf)

				function updateCameraBounds(isMobile: boolean) {
					editor.setCameraOptions({
						constraints: {
							bounds: targetBounds,
							padding: { x: isMobile ? 16 : 164, y: PDF_PADDING_Y },
							origin: { x: 0.5, y: 0 },
							initialZoom: 'fit-x-100',
							baseZoom: 'default',
							behavior: 'contain',
						},
					})
					editor.setCamera(editor.getCamera(), { reset: true })
				}

				let isMobile = editor.getViewportScreenBounds().width < 840

				const stopReacting = react('update camera', () => {
					const isMobileNow = editor.getViewportScreenBounds().width < 840
					if (isMobileNow === isMobile) return
					isMobile = isMobileNow
					updateCameraBounds(isMobile)
				})

				updateCameraBounds(isMobile)

				return stopReacting
			}}
			components={components}
      persistenceKey={pdf.id}
		/>
	)
}

/*
The overlay is an SVG in page space with an even-odd path: the viewport rectangle minus each
visible page rectangle, filled with a translucent background color. Only pages that collide
with the viewport are drawn.
*/
const PageOverlayScreen = track(function PageOverlayScreen({ pdf }: { pdf: Pdf }) {
	const editor = useEditor()

	const viewportPageBounds = editor.getViewportPageBounds()

	const relevantPageBounds = pdf.pages
		.map((page) => {
			if (!viewportPageBounds.collides(page.bounds)) return null
			return page.bounds
		})
		.filter((bounds): bounds is Box => bounds !== null)

	function pathForPageBounds(bounds: Box) {
		return `M ${bounds.x} ${bounds.y} L ${bounds.maxX} ${bounds.y} L ${bounds.maxX} ${bounds.maxY} L ${bounds.x} ${bounds.maxY} Z`
	}

	const viewportPath = `M ${viewportPageBounds.x} ${viewportPageBounds.y} L ${viewportPageBounds.maxX} ${viewportPageBounds.y} L ${viewportPageBounds.maxX} ${viewportPageBounds.maxY} L ${viewportPageBounds.x} ${viewportPageBounds.maxY} Z`

	return (
		<>
			<SVGContainer className="PageOverlayScreen-screen">
				<path
					d={`${viewportPath} ${relevantPageBounds.map(pathForPageBounds).join(' ')}`}
					fillRule="evenodd"
				/>
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
	)
})
