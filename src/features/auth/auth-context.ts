import { createContext } from 'react';
import type { AuthContextValue } from '../../utils/types.ts';

export const AuthContext = createContext<AuthContextValue | null>(null);
