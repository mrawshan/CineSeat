import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import supabase from './supabase.ts';

// Gets the current session
export async function getCurrentSession() {
	const { data, error } = await supabase.auth.getSession();

	if (error) {
		throw error;
	}

	return data.session;
}

// Subscribes to auth changes
export function subscribeToAuthChanges(
	callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
	return supabase.auth.onAuthStateChange(callback);
}

// Starts the Google OAuth flow and returns the user to the current app after sign-in.
export async function signInWithGoogle() {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: window.location.origin,
		},
	});

	if (error) {
		throw error;
	}
}

// Signs in with email and password and returns the user to the current app after sign-in.
export async function signInWithPassword(credentials: {
	email: string;
	password: string;
}) {
	const { error } = await supabase.auth.signInWithPassword(credentials);

	if (error) {
		throw error;
	}
}

export async function signOutUser() {
	const { error } = await supabase.auth.signOut();

	if (error) {
		throw error;
	}
}
