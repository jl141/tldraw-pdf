import { Box, Editor, TLShapeId, createShapeId } from 'tldraw'
import {
	SCRATCH_PAGE_TYPE,
	type ScratchPageShape,
	type ScratchSide,
} from '../components/ScratchPageShape'
import type { Pdf } from '../types/pdfTypes'
import { isMobile } from './viewport'

export const PDF_PADDING_Y = 64

// Scratch pages are half the width of the PDF page they sit beside.
const SCRATCH_WIDTH_RATIO = 0.5

export function scratchShapeId(pdf: Pdf, pageIndex: number, side: ScratchSide): TLShapeId {
	return createShapeId(`${pdf.id}-scratch-${pageIndex}-${side}`)
}

export function getScratchPages(editor: Editor): ScratchPageShape[] {
	return editor
		.getCurrentPageShapes()
		.filter((shape): shape is ScratchPageShape => shape.type === SCRATCH_PAGE_TYPE)
}

export function getScratchBounds(shape: ScratchPageShape) {
	return new Box(shape.x, shape.y, shape.props.w, shape.props.h)
}

export function getDocumentBounds(editor: Editor, pdf: Pdf) {
	return getScratchPages(editor).reduce(
		(acc, shape) => acc.union(getScratchBounds(shape)),
		pdf.pages.reduce((acc, page) => acc.union(page.bounds), pdf.pages[0].bounds.clone())
	)
}

// A page's bounds extended by whichever scratch pages it has.
export function getRowBounds(editor: Editor, pdf: Pdf, pageIndex: number) {
	return getScratchPages(editor)
		.filter((shape) => shape.props.pageIndex === pageIndex)
		.reduce((acc, shape) => acc.union(getScratchBounds(shape)), pdf.pages[pageIndex].bounds.clone())
}

export function applyCameraConstraints(editor: Editor, pdf: Pdf, reset: boolean) {
	const mobile = isMobile(editor)
	editor.setCameraOptions({
		constraints: {
			bounds: getDocumentBounds(editor, pdf),
			padding: { x: mobile ? 16 : 164, y: PDF_PADDING_Y },
			origin: { x: 0.5, y: 0 },
			initialZoom: 'fit-x-100',
			baseZoom: 'default',
			behavior: 'contain',
		},
	})
	// Re-applying the current camera clamps it to the new bounds without resetting zoom or scroll.
	editor.setCamera(editor.getCamera(), reset ? { reset: true } : { immediate: true })
}

export function addScratchPage(editor: Editor, pdf: Pdf, pageIndex: number, side: ScratchSide) {
	const id = scratchShapeId(pdf, pageIndex, side)
	if (editor.getShape(id)) return

	const page = pdf.pages[pageIndex]
	const w = page.bounds.w * SCRATCH_WIDTH_RATIO
	const existing = getRowBounds(editor, pdf, pageIndex)

	editor.markHistoryStoppingPoint('add scratch page')
	editor.createShape<ScratchPageShape>({
		id,
		type: SCRATCH_PAGE_TYPE,
		x: side === 'left' ? page.bounds.x - w : page.bounds.maxX,
		y: page.bounds.y,
		isLocked: true,
		props: { w, h: page.bounds.h, pageIndex, side },
	})

	applyCameraConstraints(editor, pdf, false)
	const row = existing.union(getScratchBounds(editor.getShape<ScratchPageShape>(id)!))
	if (!editor.getViewportPageBounds().contains(row)) {
		editor.zoomToBounds(row, { inset: 48, animation: { duration: 200 } })
	}
}

// Annotations belong to a scratch page when their center lies inside it.
export function removeScratchPage(editor: Editor, pdf: Pdf, pageIndex: number, side: ScratchSide) {
	const id = scratchShapeId(pdf, pageIndex, side)
	const scratch = editor.getShape<ScratchPageShape>(id)
	if (!scratch) return

	const bounds = getScratchBounds(scratch)
	const pageShapeIds = new Set<TLShapeId>(pdf.pages.map((page) => page.shapeId))
	const owned = [...editor.getCurrentPageShapeIds()].filter((shapeId) => {
		if (shapeId === id || pageShapeIds.has(shapeId)) return false
		const shape = editor.getShape(shapeId)
		if (!shape || shape.type === SCRATCH_PAGE_TYPE) return false
		const shapeBounds = editor.getShapePageBounds(shapeId)
		return !!shapeBounds && bounds.containsPoint(shapeBounds.center)
	})

	editor.markHistoryStoppingPoint('delete scratch page')
	editor.run(() => editor.deleteShapes([...owned, id]), { ignoreShapeLock: true })
}
