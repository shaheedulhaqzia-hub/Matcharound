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

export type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  at: number;
};

export type CallMode = 'video' | 'voice';
