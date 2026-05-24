import type { ReactNode } from 'react';

// This is a reusable component for the panel
function Panel({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<section className='rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 sm:p-6'>
			<div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
				<div>
					<h3 className='text-xl font-semibold text-white'>{title}</h3>
					<p className='mt-1 text-sm text-slate-400'>{description}</p>
				</div>
			</div>
			<div className='mt-5'>{children}</div>
		</section>
	);
}

export default Panel;
