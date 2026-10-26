import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Editor } from 'tldraw'
import type { Pdf } from '../types/pdfTypes'
import { getCurrentPageIndex } from '../utils/pdfPages'

interface PdfPageSidebarProps {
	editor: Editor
	pdf: Pdf
	width: number
	onWidthChange(width: number): void
	isOpen: boolean
	onOpen(): void
	onClose(): void
}

export function PdfPageSidebar({
	editor,
	pdf,
	width,
	onWidthChange,
	isOpen,
	onOpen,
	onClose,
}: PdfPageSidebarProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const focusInputOnOpen = useRef(false)
	const drag = useRef<{ pointerX: number; width: number } | null>(null)
	const [currentPage, setCurrentPage] = useState(0)
	const [pageInput, setPageInput] = useState('')
	const [isResizing, setIsResizing] = useState(false)

	useEffect(() => {
		function updateCurrentPage() {
			const bestIndex = getCurrentPageIndex(editor, pdf)
			setCurrentPage((previous) => (previous === bestIndex ? previous : bestIndex))
		}

		updateCurrentPage()
		return editor.store.listen(updateCurrentPage, { scope: 'session' })
	}, [editor, pdf])

	useEffect(() => {
		if (!isOpen || !focusInputOnOpen.current) return
		focusInputOnOpen.current = false
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [isOpen])

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'KeyG') {
				event.preventDefault()
				event.stopPropagation()
				if (!isOpen) {
					focusInputOnOpen.current = true
					onOpen()
					return
				}
				inputRef.current?.focus()
				inputRef.current?.select()
			}
		}

		document.addEventListener('keydown', onKeyDown, true)
		return () => document.removeEventListener('keydown', onKeyDown, true)
	}, [isOpen, onOpen])

	useEffect(() => {
		if (!isResizing) return

		function onPointerMove(event: PointerEvent) {
			if (!drag.current) return
			const maxWidth = Math.min(520, Math.max(240, window.innerWidth - 120))
			onWidthChange(Math.min(Math.max(drag.current.width + event.clientX - drag.current.pointerX, 180), maxWidth))
		}

		function onPointerUp() {
			drag.current = null
			setIsResizing(false)
		}

		window.addEventListener('pointermove', onPointerMove)
		window.addEventListener('pointerup', onPointerUp)
		window.addEventListener('pointercancel', onPointerUp)
		return () => {
			window.removeEventListener('pointermove', onPointerMove)
			window.removeEventListener('pointerup', onPointerUp)
			window.removeEventListener('pointercancel', onPointerUp)
		}
	}, [isResizing, onWidthChange])

	function goToPage(pageNumber: number) {
		const page = pdf.pages[pageNumber - 1]
		if (!page) return

		const viewport = editor.getViewportPageBounds()
		const camera = editor.getCamera()
		const targetX = page.bounds.x + page.bounds.w / 2 - viewport.w / 2
		const targetY = page.bounds.y + page.bounds.h / 2 - viewport.h / 2
		editor.setCamera(
			{ x: -targetX, y: -targetY, z: camera.z },
			{ animation: { duration: 240 } }
		)
		setPageInput(String(pageNumber))
	}

	function submitPage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const requestedPage = Number(pageInput)
		if (!Number.isInteger(requestedPage) || requestedPage < 1) return
		goToPage(Math.min(requestedPage, pdf.pages.length))
	}

	function startResize(event: ReactPointerEvent<HTMLDivElement>) {
		if (event.button !== 0) return
		event.preventDefault()
		event.stopPropagation()
		drag.current = { pointerX: event.clientX, width }
		setIsResizing(true)
	}

	return (
		<aside
			className="PdfPageSidebar"
			data-open={isOpen}
			data-resizing={isResizing}
			style={{ width }}
			aria-label="PDF pages"
			onPointerDown={(event) => event.stopPropagation()}
			onWheel={(event) => event.stopPropagation()}
		>
			<header className="PdfPageSidebar-header">
				<div className="PdfPageSidebar-heading">
					<strong>Page Previews</strong>
				</div>
				<button
					className="PdfPageSidebar-close"
					type="button"
					aria-label="Close page thumbnails"
					onClick={onClose}
				>
					×
				</button>
			</header>
			<form className="PdfPageSidebar-jump" onSubmit={submitPage}>
				<label htmlFor="PdfPageSidebar-pageInput">Go to page</label>
				<div>
					<input
						ref={inputRef}
						id="PdfPageSidebar-pageInput"
						type="number"
						min={1}
						max={pdf.pages.length}
						step={1}
						value={pageInput}
						placeholder={String(currentPage + 1)}
						onChange={(event) => setPageInput(event.target.value)}
						onKeyDown={(event) => event.stopPropagation()}
					/>
					<button type="submit">Go</button>
				</div>
				<small>
					Page {currentPage + 1} of {pdf.pages.length} · ⌘⌥G
				</small>
			</form>
			<nav className="PdfPageSidebar-thumbnails" aria-label="Page thumbnails">
				{pdf.pages.map((page, index) => (
					<button
						key={page.shapeId}
						className="PdfPageSidebar-thumbnail"
						type="button"
						aria-label={`Go to page ${index + 1}`}
						aria-current={currentPage === index ? 'page' : undefined}
						onClick={() => goToPage(index + 1)}
					>
						<img src={page.src} alt="" loading="lazy" draggable={false} />
						<span>{index + 1}</span>
					</button>
				))}
			</nav>
			<div
				className="PdfPageSidebar-resizeHandle"
				role="separator"
				aria-label="Resize page sidebar"
				aria-orientation="vertical"
				aria-valuenow={width}
				aria-valuemin={180}
				aria-valuemax={Math.min(520, Math.max(240, window.innerWidth - 120))}
				tabIndex={0}
				onPointerDown={startResize}
				onKeyDown={(event) => {
					if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
					event.preventDefault()
					onWidthChange(Math.min(Math.max(width + (event.key === 'ArrowRight' ? 16 : -16), 180), 520))
				}}
			/>
		</aside>
	)
}
