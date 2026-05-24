import type { User } from '@supabase/supabase-js';
import type { Profile } from '../utils/types.ts';
import supabase from './supabase.ts';

function normalizeProfile(record: Record<string, unknown>): Profile {
	return {
		id: String(record.id),
		email: String(record.email ?? ''),
		full_name: record.full_name ? String(record.full_name) : null,
		role: record.role === 'admin' ? 'admin' : 'user',
		created_at: String(record.created_at ?? new Date().toISOString()),
	};
}

export async function fetchProfileById(userId: string) {
	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return data ? normalizeProfile(data as Record<string, unknown>) : null;
}

// Ensures every authenticated user has a profile row before the rest of the app loads.
export async function ensureProfileFromUser(user: User) {
	const existingProfile = await fetchProfileById(user.id);

	if (existingProfile) {
		return existingProfile;
	}

	const fullName =
		typeof user.user_metadata.full_name === 'string'
			? user.user_metadata.full_name
			: typeof user.user_metadata.name === 'string'
				? user.user_metadata.name
				: null;

	const payload = {
		id: user.id,
		email: user.email ?? '',
		full_name: fullName,
	};

	const { data, error } = await supabase
		.from('profiles')
		.insert(payload)
		.select('*')
		.single();

	if (error) {
		throw error;
	}

	return normalizeProfile(data as Record<string, unknown>);
}
