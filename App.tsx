import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import 'tldraw/tldraw.css'
import { PdfPicker } from './PdfPicker'
import type { Pdf } from './pdfTypes'
import './pdf-editor.css'

const PdfEditor = lazy(() => import('./PdfEditor').then(({ PdfEditor }) => ({ default: PdfEditor })))

type State =
	| {
			phase: 'pick'
	  }
	| {
			phase: 'edit'
			pdf: Pdf
	  }

export default function PdfEditorWrapper() {
	const [state, setState] = useState<State>({ phase: 'pick' })
	const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)
	const allowNextNavigation = useRef(false)
	const allowUnload = useRef(false)

	useEffect(() => {
		if (state.phase !== 'edit') return

		const editorUrl = window.location.href
		const guardState = { ...(window.history.state ?? {}), pdfEditorLeaveGuard: true }
		if (!window.history.state?.pdfEditorLeaveGuard) {
			window.history.pushState(guardState, '', editorUrl)
		}

		function onPopState() {
			if (allowNextNavigation.current) {
				allowNextNavigation.current = false
				allowUnload.current = false
				return
			}

			window.history.pushState(guardState, '', editorUrl)
			setShowLeaveConfirmation(true)
		}

		function onBeforeUnload(event: BeforeUnloadEvent) {
			if (allowUnload.current) {
				allowUnload.current = false
				return
			}
			event.preventDefault()
			event.returnValue = ''
		}

		window.addEventListener('popstate', onPopState)
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			window.removeEventListener('popstate', onPopState)
			window.removeEventListener('beforeunload', onBeforeUnload)
		}
	}, [state.phase])

	function leaveEditor() {
		setShowLeaveConfirmation(false)
		allowNextNavigation.current = true
		allowUnload.current = true
		window.history.back()
	}

	switch (state.phase) {
		case 'pick':
			return (
				<div className="PdfEditor">
					<PdfPicker onOpenPdf={(pdf) => setState({ phase: 'edit', pdf })} />
				</div>
			)
		case 'edit':
			return (
				<div className="PdfEditor">
					<Suspense fallback={<div className="PdfEditor-loading" role="status">Loading editor…</div>}>
						<PdfEditor pdf={state.pdf} />
					</Suspense>
					{showLeaveConfirmation && (
						<div className="LeaveConfirmation-backdrop">
							<section
								className="LeaveConfirmation-dialog"
								role="alertdialog"
								aria-modal="true"
								aria-labelledby="leave-confirmation-title"
								aria-describedby="leave-confirmation-description"
							>
								<h2 id="leave-confirmation-title">Leave this PDF?</h2>
								<p id="leave-confirmation-description">
									Are you sure you want to leave? Your annotations may not be saved.
								</p>
								<div className="LeaveConfirmation-actions">
									<button type="button" onClick={() => setShowLeaveConfirmation(false)} autoFocus>
										Stay
									</button>
									<button type="button" className="LeaveConfirmation-leave" onClick={leaveEditor}>
										Leave
									</button>
								</div>
							</section>
						</div>
					)}
				</div>
			)
	}
}
