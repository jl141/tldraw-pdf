import { Suspense, lazy, useEffect, useState } from 'react'
import 'tldraw/tldraw.css'
import { PdfPicker } from './PdfPicker'
import type { Pdf } from '../types/pdfTypes'
import '../styles/pdf-editor.css'

const PdfEditor = lazy(() => import('./PdfEditor').then(({ PdfEditor }) => ({ default: PdfEditor })))
const ProductionAnalytics = import.meta.env.PROD
	? lazy(() =>
			import('./ProductionAnalytics').then(({ ProductionAnalytics }) => ({
				default: ProductionAnalytics,
			}))
		)
	: null

function ProductionAnalyticsSlot() {
	if (!ProductionAnalytics) return null
	return (
		<Suspense fallback={null}>
			<ProductionAnalytics />
		</Suspense>
	)
}

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

	useEffect(() => {
		if (state.phase !== 'edit') return

		function onBeforeUnload(event: BeforeUnloadEvent) {
			event.preventDefault()
			event.returnValue = ''
		}

		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload)
		}
	}, [state.phase])

	switch (state.phase) {
		case 'pick':
			return (
				<div className="PdfEditor">
					<PdfPicker onOpenPdf={(pdf) => setState({ phase: 'edit', pdf })} />
					<ProductionAnalyticsSlot />
				</div>
			)
		case 'edit':
			return (
				<div className="PdfEditor">
					<Suspense fallback={<div className="PdfEditor-loading" role="status">Loading editor…</div>}>
						<PdfEditor pdf={state.pdf} />
					</Suspense>
					<ProductionAnalyticsSlot />
				</div>
			)
	}
}
