import type { ReactNode } from 'react';

// This is a reusable component for the field
function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className='flex flex-col gap-2 text-sm font-medium text-slate-200'>
			<span>{label}</span>
			{children}
		</label>
	);
}

export default Field;
