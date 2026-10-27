import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { TldrawUiButton, TldrawUiButtonLabel } from 'tldraw'
import type { Editor } from 'tldraw'
import type { Pdf } from '../types/pdfTypes'
import { getCurrentPageIndex } from '../utils/pdfPages'
import chevronIcon from '../assets/chevron.svg'

const MAX_SIDEBAR_WIDTH = 320

function getMaxSidebarWidth() {
	return Math.min(MAX_SIDEBAR_WIDTH, Math.max(240, window.innerWidth - 120))
}

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
	const resizeHandleRef = useRef<HTMLDivElement>(null)
	const drag = useRef<{ pointerX: number; width: number } | null>(null)
	const [currentPage, setCurrentPage] = useState(0)
	const [pageInput, setPageInput] = useState('')
	const [isEditingPage, setIsEditingPage] = useState(false)
	const [isResizing, setIsResizing] = useState(false)
	const [resizeIndicatorPosition, setResizeIndicatorPosition] = useState<{ x: number; y: number } | null>(
		null
	)
	const isMacOS = navigator.platform.startsWith('Mac')

	useEffect(() => {
		function updateCurrentPage() {
			const bestIndex = getCurrentPageIndex(editor, pdf)
			setCurrentPage((previous) => (previous === bestIndex ? previous : bestIndex))
		}

		updateCurrentPage()
		return editor.store.listen(updateCurrentPage, { scope: 'session' })
	}, [editor, pdf])

	useEffect(() => {
		if (!isOpen || !isEditingPage) return
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [isOpen, isEditingPage])

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'Digit1' && isOpen) {
				event.preventDefault()
				event.stopPropagation()
				onClose()
				return
			}

			if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'KeyG') {
				event.preventDefault()
				event.stopPropagation()
				setPageInput(String(currentPage + 1))
				setIsEditingPage(true)
				if (!isOpen) {
					onOpen()
				} else if (isEditingPage) {
					inputRef.current?.focus()
					inputRef.current?.select()
				}
			}
		}

		document.addEventListener('keydown', onKeyDown, true)
		return () => document.removeEventListener('keydown', onKeyDown, true)
	}, [currentPage, isEditingPage, isOpen, onClose, onOpen])

	useEffect(() => {
		if (!isResizing) return

		function onPointerMove(event: PointerEvent) {
			if (!drag.current) return
			updateResizeIndicatorPosition(event.clientX, event.clientY)
			const maxWidth = getMaxSidebarWidth()
			onWidthChange(Math.min(Math.max(drag.current.width + event.clientX - drag.current.pointerX, 180), maxWidth))
		}

		function onPointerUp(event: PointerEvent) {
			drag.current = null
			setIsResizing(false)
			updateResizeIndicatorPosition(event.clientX, event.clientY)
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
		setIsEditingPage(false)
	}

	function submitPage() {
		const requestedPage = Number(pageInput)
		if (!Number.isInteger(requestedPage) || requestedPage < 1) return
		goToPage(Math.min(requestedPage, pdf.pages.length))
	}

	function handlePageSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		submitPage()
	}

	function isOverResizeHandle(x: number, y: number) {
		const handle = resizeHandleRef.current
		return handle !== null && document.elementsFromPoint(x, y).includes(handle)
	}

	function updateResizeIndicatorPosition(x: number, y: number) {
		if (drag.current || isOverResizeHandle(x, y)) {
			setResizeIndicatorPosition({ x, y })
		} else {
			setResizeIndicatorPosition(null)
		}
	}

	function startResize(event: ReactPointerEvent<HTMLDivElement>) {
		if (event.button !== 0) return
		event.preventDefault()
		event.stopPropagation()
		event.currentTarget.setPointerCapture(event.pointerId)
		drag.current = { pointerX: event.clientX, width }
		setIsResizing(true)
		updateResizeIndicatorPosition(event.clientX, event.clientY)
	}

	function handleResizeIndicatorPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		if (isOverResizeHandle(event.clientX, event.clientY)) {
			startResize(event)
			return
		}

		event.preventDefault()
		event.stopPropagation()
		updateResizeIndicatorPosition(event.clientX, event.clientY)
	}

	return (
		<aside
			className="PdfPageSidebar"
			data-open={isOpen}
			data-resizing={isResizing}
			data-resize-hovered={resizeIndicatorPosition !== null && !isResizing}
			style={{ width, maxWidth: getMaxSidebarWidth() }}
			aria-label="PDF pages"
			onPointerDown={(event) => event.stopPropagation()}
			onWheel={(event) => event.stopPropagation()}
		>
			<header className="PdfPageSidebar-header">
				<div className="PdfPageSidebar-heading">
					<strong>Page Previews</strong>
				</div>
				<TldrawUiButton
					className="PdfPageSidebar-closeButton"
					type="normal"
					title={isMacOS ? 'Close sidebar — ⌘⌥1' : 'Close sidebar'}
					aria-label="Close sidebar"
					onClick={onClose}
				>
					<img src={chevronIcon} alt="" aria-hidden="true" />
				</TldrawUiButton>
			</header>
			<form className="PdfPageSidebar-jump" onSubmit={handlePageSubmit}>
				<span>Page</span>
				{isEditingPage ? (
					<input
						ref={inputRef}
						id="PdfPageSidebar-pageInput"
						type="number"
						min={1}
						step={1}
						value={pageInput}
						onChange={(event) => setPageInput(event.target.value)}
						onKeyDown={(event) => event.stopPropagation()}
						onBlur={() => setIsEditingPage(false)}
						aria-label="Page number"
					/>
				) : (
					<button
						className="PdfPageSidebar-currentPage"
						type="button"
						title="Click to specify a page to jump to"
						onClick={() => {
							setPageInput(String(currentPage + 1))
							setIsEditingPage(true)
						}}
					>
						{currentPage + 1}
					</button>
				)}
				<span>
					of {pdf.pages.length}
					{isMacOS && ' · ⌘⌥G'}
				</span>
			</form>
			<nav className="PdfPageSidebar-thumbnails" aria-label="Page thumbnails">
				{pdf.pages.map((page, index) => (
					<TldrawUiButton
						key={page.shapeId}
						className="PdfPageSidebar-thumbnail"
						type="normal"
						aria-label={`Go to page ${index + 1}`}
						aria-current={currentPage === index ? 'page' : undefined}
						onClick={() => goToPage(index + 1)}
						style={{
							display: 'grid',
							gridTemplateColumns: 'minmax(0, 1fr)',
							alignContent: 'start',
							gap: 4,
							width: '100%',
							minWidth: 0,
							height: 'auto',
							minHeight: 0,
							flex: '0 0 auto',
							boxSizing: 'border-box',
							padding: 6,
							color: currentPage === index ? '#222' : '#555',
							background: 'transparent',
							borderColor: currentPage === index ? '#368eff' : 'transparent',
						}}
					>
						<img
							src={page.src}
							alt={"Preview of page " + (index + 1)}
							loading="lazy"
							draggable={false}
							style={{
								display: 'block',
								width: '100%',
								maxWidth: '100%',
								height: 'auto',
								maxHeight: 'none',
								objectFit: 'contain',
								background: 'transparent',
							}}
						/>
						<TldrawUiButtonLabel>{index + 1}</TldrawUiButtonLabel>
					</TldrawUiButton>
				))}
			</nav>
			<div
				ref={resizeHandleRef}
				className="PdfPageSidebar-resizeHandle"
				role="separator"
				aria-label="Resize page sidebar"
				aria-orientation="vertical"
				aria-valuenow={width}
				aria-valuemin={180}
				aria-valuemax={getMaxSidebarWidth()}
				tabIndex={0}
				onPointerDown={startResize}
				onPointerEnter={(event) =>
					updateResizeIndicatorPosition(event.clientX, event.clientY)
				}
				onPointerMove={(event) =>
					updateResizeIndicatorPosition(event.clientX, event.clientY)
				}
			/>
			{resizeIndicatorPosition && (
				<div
					className="PdfPageSidebar-resizeIndicator"
					aria-hidden="true"
					onPointerDown={handleResizeIndicatorPointerDown}
					onPointerMove={(event) =>
						updateResizeIndicatorPosition(event.clientX, event.clientY)
					}
					onPointerLeave={(event) =>
						updateResizeIndicatorPosition(event.clientX, event.clientY)
					}
					style={{
						left: resizeIndicatorPosition.x,
						top: resizeIndicatorPosition.y,
					}}
				/>
			)}
		</aside>
	)
}
