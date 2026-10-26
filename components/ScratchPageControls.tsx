import { track, useEditor } from 'tldraw'
import trashIcon from '../assets/trash.svg'
import type { Pdf } from '../types/pdfTypes'
import type { ScratchSide } from './ScratchPageShape'
import { addScratchPage, getRowBounds, getScratchPages, removeScratchPage } from '../utils/scratchPages'

const STRIP_WIDTH = 22
const STRIP_GAP = 6
const SIDES: ScratchSide[] = ['left', 'right']

/*
One strip per side of each visible PDF page, sitting just outside the page (and outside its
scratch page, if any). It adds a scratch page when none exists on that side, else deletes it.
*/
export const ScratchPageControls = track(function ScratchPageControls({ pdf }: { pdf: Pdf }) {
	const editor = useEditor()
	const viewport = editor.getViewportPageBounds()
	const scratch = getScratchPages(editor)

	return (
		<>
			{pdf.pages.flatMap((page, pageIndex) => {
				if (!viewport.collides(page.bounds)) return []
				const row = getRowBounds(editor, pdf, pageIndex)
				const { z } = editor.getCamera()
				return SIDES.map((side) => {
					const hasScratch = scratch.some(
						(shape) => shape.props.pageIndex === pageIndex && shape.props.side === side
					)
					const edge = editor.pageToViewport({ x: side === 'left' ? row.x : row.maxX, y: row.y })
					const left = side === 'left' ? edge.x - STRIP_GAP - STRIP_WIDTH : edge.x + STRIP_GAP
					const label = hasScratch ? 'Delete scratch page' : 'Add scratch page'
					return (
						<button
							key={`${pageIndex}-${side}`}
							type="button"
							className="ScratchPageStrip"
							data-delete={hasScratch}
							title={label}
							aria-label={`${label} ${side} of page ${pageIndex + 1}`}
							style={{ left, top: edge.y, width: STRIP_WIDTH, height: row.h * z }}
							onPointerDown={(e) => e.stopPropagation()}
							onClick={() =>
								hasScratch
									? removeScratchPage(editor, pdf, pageIndex, side)
									: addScratchPage(editor, pdf, pageIndex, side)
							}
						>
							{hasScratch ? (
								<img src={trashIcon} aria-hidden="true" className="ScratchPageStrip-trashIcon" />
							) : (
								<span aria-hidden>+</span>
							)}
						</button>
					)
				})
			})}
		</>
	)
})
