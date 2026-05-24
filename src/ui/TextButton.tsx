import type { ButtonHTMLAttributes } from 'react';

function TextButton({
	children,
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type='button'
			className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
			{...props}
		>
			{children}
		</button>
	);
}

export default TextButton;
