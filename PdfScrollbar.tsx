import { useEffect, useRef, useState } from 'react'
import { Box, track, useEditor } from 'tldraw'
import type { Pdf } from './pdfTypes'

export const PDF_PADDING_Y = 64

export function getPdfBounds(pdf: Pdf) {
	return pdf.pages.reduce((acc, page) => acc.union(page.bounds), pdf.pages[0].bounds.clone())
}

/*
A camera-driven scrollbar: the camera is the single source of truth. The scrollable range is the
document bounds plus the camera constraint's vertical padding, which is in screen pixels and so
spans `PDF_PADDING_Y / zoom` page units. Dragging only calls `setCamera`; constraints clamp it.
*/
export const PdfScrollbar = track(function PdfScrollbar({ pdf }: { pdf: Pdf }) {
	const editor = useEditor()
	const trackRef = useRef<HTMLDivElement>(null)
	const drag = useRef<{ pointerY: number; viewportY: number } | null>(null)
	const [isDragging, setIsDragging] = useState(false)

	const { z } = editor.getCamera()
	const viewport = editor.getViewportPageBounds()
	const bounds = getPdfBounds(pdf)
	const padding = PDF_PADDING_Y / z
	const range = new Box(bounds.x, bounds.y - padding, bounds.w, bounds.h + padding * 2)

	const thumbSize = Math.min(viewport.h / range.h, 1)
	const thumbOffset = Math.min(Math.max((viewport.y - range.y) / range.h, 0), 1 - thumbSize)

	const cleanup = useRef<(() => void) | null>(null)
	useEffect(() => () => cleanup.current?.(), [])

	function endDrag() {
		cleanup.current?.()
		cleanup.current = null
		drag.current = null
		setIsDragging(false)
	}

	function onPointerDown(e: React.PointerEvent) {
		e.stopPropagation()
		drag.current = { pointerY: e.clientY, viewportY: viewport.y }
		setIsDragging(true)

		// Window-level listeners keep tracking (and see the release) even outside the window/thumb.
		function onMove(ev: PointerEvent) {
			if (!drag.current || !trackRef.current) return
			// A release outside the window can be missed; no buttons pressed means the drag is over.
			if (ev.buttons === 0) return endDrag()
			const pageDelta =
				((ev.clientY - drag.current.pointerY) / trackRef.current.clientHeight) * range.h
			const camera = editor.getCamera()
			editor.setCamera(
				{ x: camera.x, y: -(drag.current.viewportY + pageDelta), z: camera.z },
				{ immediate: true }
			)
		}
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', endDrag)
		window.addEventListener('pointercancel', endDrag)
		window.addEventListener('blur', endDrag)
		cleanup.current = () => {
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', endDrag)
			window.removeEventListener('pointercancel', endDrag)
			window.removeEventListener('blur', endDrag)
		}
	}

	return (
		<div ref={trackRef} className="PdfScrollbar">
			<div
				className="PdfScrollbar-thumb"
				role="scrollbar"
				aria-orientation="vertical"
				aria-valuenow={Math.round(thumbOffset * 100)}
				data-dragging={isDragging}
				style={{ top: `${thumbOffset * 100}%`, height: `${thumbSize * 100}%` }}
				onPointerDown={onPointerDown}
			/>
		</div>
	)
})
