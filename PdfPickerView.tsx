import { useEffect, useRef, useState } from 'react'
import type { RecentPdf } from './recentPdfs'
import documentIcon from './assets/document.svg'
import uploadIcon from './assets/upload.svg'
import fileIcon from './assets/file.svg'
import chevronIcon from './assets/chevron.svg'
import checkIcon from './assets/check.svg'
import arrowRightIcon from './assets/arrow-right.svg'

interface PdfPickerViewProps {
	isLoading: boolean
	recents: RecentPdf[]
	selectedId: string
	error: string | null
	onOpenFile(): void
	onContinue(): void
	onSelectRecent(id: string): void
}

export function PdfPickerView({
	isLoading,
	recents,
	selectedId,
	error,
	onOpenFile,
	onContinue,
	onSelectRecent,
}: PdfPickerViewProps) {
	const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false)
	const pickerRef = useRef<HTMLDivElement>(null)
	const recentMenuButtonRef = useRef<HTMLButtonElement>(null)
	const selectedRecent = recents.find((recent) => recent.id === selectedId)

	useEffect(() => {
		if (!isRecentMenuOpen) return

		function onPointerDown(event: PointerEvent) {
			if (!pickerRef.current?.contains(event.target as Node)) {
				setIsRecentMenuOpen(false)
			}
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsRecentMenuOpen(false)
				recentMenuButtonRef.current?.focus()
			}
		}

		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [isRecentMenuOpen])

	if (isLoading) {
		return (
			<div className="PdfPicker">
				<div className="PdfPicker-card PdfPicker-loading" role="status">
					<span className="PdfPicker-spinner" aria-hidden="true" />
					<span>Preparing your PDF…</span>
				</div>
			</div>
		)
	}

	return (
		<div className="PdfPicker">
			<div className="PdfPicker-card" ref={pickerRef}>
				<div className="PdfPicker-heading">
					<div className="PdfPicker-icon" aria-hidden="true">
						<img src={documentIcon} alt="" />
					</div>
					<div>
						<h1>Open a PDF</h1>
						<p>Bring a document into your canvas and start annotating.</p>
					</div>
				</div>
				<button className="PdfPicker-openButton" onClick={onOpenFile}>
					<img src={uploadIcon} alt="" aria-hidden="true" />
					Open a file
				</button>
				{recents.length > 0 && (
					<div className="PdfPicker-recents">
						<div className="PdfPicker-divider">
							<span>OR CONTINUE</span>
						</div>
						<div className="PdfPicker-recentControls">
							<div className="PdfPicker-recentPicker">
								<span className="PdfPicker-fieldLabel">Recent document</span>
								<button
									ref={recentMenuButtonRef}
									className="PdfPicker-selectButton"
									type="button"
									aria-haspopup="menu"
									aria-expanded={isRecentMenuOpen}
									aria-controls={isRecentMenuOpen ? 'PdfPicker-recentMenu' : undefined}
									onClick={() => setIsRecentMenuOpen((open) => !open)}
								>
									<span className="PdfPicker-fileIcon" aria-hidden="true">
										<img src={fileIcon} alt="" />
									</span>
									<span className="PdfPicker-selectedName">{selectedRecent?.name ?? 'Choose a PDF'}</span>
									<img className="PdfPicker-chevron" src={chevronIcon} alt="" aria-hidden="true" />
								</button>
								{isRecentMenuOpen && (
									<div
										className="PdfPicker-menu"
										id="PdfPicker-recentMenu"
										role="menu"
										aria-label="Recent PDFs"
									>
										{recents.map((recent) => (
											<button
												key={recent.id}
												className="PdfPicker-menuOption"
												type="button"
												role="menuitemradio"
												aria-checked={recent.id === selectedId}
												onClick={() => {
													onSelectRecent(recent.id)
													setIsRecentMenuOpen(false)
													recentMenuButtonRef.current?.focus()
												}}
											>
												<span className="PdfPicker-menuFileIcon" aria-hidden="true">
													<img src={fileIcon} alt="" />
												</span>
												<span className="PdfPicker-optionName">{recent.name}</span>
												{recent.id === selectedId && (
													<img className="PdfPicker-check" src={checkIcon} alt="" aria-hidden="true" />
												)}
											</button>
										))}
									</div>
								)}
							</div>
							<button className="PdfPicker-continueButton" onClick={onContinue} disabled={!selectedRecent}>
								Continue
								<img src={arrowRightIcon} alt="" aria-hidden="true" />
							</button>
						</div>
					</div>
				)}
				{error && (
					<div className="PdfPicker-error" role="alert">
						{error}
					</div>
				)}
			</div>
		</div>
	)
}
