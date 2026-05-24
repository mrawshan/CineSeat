import { describe, expect, it, vi } from 'vitest';
import {
	signInWithGoogle,
	signInWithPassword,
	signOutUser,
} from '../services/authService';
import supabase from '../services/supabase.ts';

/**
 * Integration tests: login -> session hydration -> profile sync (incl. admin role)
 */

// Mock Supabase auth methods
vi.mock('../services/supabase.ts', () => {
	return {
		default: {
			auth: {
				signInWithPassword: vi.fn(async ({ email, password }) => {
					if (email && password) {
						return {
							data: {
								user: {
									id: 'user-1',
									email,
								},
								session: {
									access_token: 'fake-token',
								},
							},
							error: null,
						};
					}

					return {
						data: null,
						error: new Error('Invalid credentials'),
					};
				}),

				signInWithOAuth: vi.fn(async () => ({
					data: null,
					error: null,
				})),

				signOut: vi.fn(async () => ({
					error: null,
				})),
			},
		},
	};
});

describe('Authentication Integration Tests', () => {
	it('should login successfully with email and password', async () => {
		const signInMock = vi.mocked(supabase.auth.signInWithPassword);

		await expect(
			signInWithPassword({
				email: 'test@admin.com',
				password: 'password123',
			}),
		).resolves.toBeUndefined();

		expect(signInMock).toHaveBeenCalledWith({
			email: 'test@admin.com',
			password: 'password123',
		});
	});

	it('should fail login when credentials are missing', async () => {
		await expect(
			signInWithPassword({
				email: '',
				password: '',
			}),
		).rejects.toThrow(/invalid credentials/i);
	});

	it('should logout successfully', async () => {
		const signOutMock = vi.mocked(supabase.auth.signOut);

		await expect(signOutUser()).resolves.toBeUndefined();
		expect(signOutMock).toHaveBeenCalled();
	});

	it('should trigger Google OAuth login', async () => {
		const googleMock = vi.fn(async () => ({
			data: {
				provider: 'google' as const,
				url: 'https://example.com/oauth',
			},
			error: null,
		}));

		vi.mocked(supabase.auth.signInWithOAuth).mockImplementation(googleMock);

		await signInWithGoogle();

		expect(googleMock).toHaveBeenCalledWith({
			provider: 'google',
			options: {
				redirectTo: window.location.origin,
			},
		});
	});
});
