export type Person = {
  id: string;
  name: string;
  age: number;
  distanceKm: number;
  city: string;
  bio: string;
  job: string;
  interests: string[];
  photo: string;
  online: boolean;
};

export type Profile = {
  id: string;
  name: string;
  age: number;
  dob: string | null;
  city: string;
  bio: string;
  job: string;
  photo: string;
  coverUrl: string | null;
  banned: boolean;
};

export type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  at: number;
  imageUrl?: string;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  imageUrl: string;
  caption: string;
  createdAt: number;
};

export type CallMode = 'video' | 'voice';

export type AuthStatus =
  | 'loading'
  | 'signedOut'
  | 'needsProfile'
  | 'banned'
  | 'ready'
  | 'demo';
