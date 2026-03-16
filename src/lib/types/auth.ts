import type { Snakify } from './utils';

interface User {
  id: string;
  username: string;
  role: string;
  passwordHash: string;
  createdAt: string;
}

export type DBUser = Snakify<User>;
export type PublicUser = Omit<User, 'passwordHash'>;
export type LoginInput = Pick<User, 'username'> & {
  password: string;
};

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}

export type UserSession = Omit<PublicUser & Session, 'id' | 'createdAt'> & {
  sessionId: string;
};
