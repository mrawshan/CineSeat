export function LoadingState({ message = 'Loading...' }: { message?: string }) {
	return (
		<div className="flex min-h-[40vh] items-center justify-center">
			<div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center text-sm text-slate-200 shadow-2xl shadow-black/20">
				<div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-orange-300/30 border-t-orange-300" />
				<p>{message}</p>
			</div>
		</div>
	);
}
