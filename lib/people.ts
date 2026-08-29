import type { Person } from './types';

export const me = {
  id: 'me',
  name: 'Alex',
  age: 28,
  city: 'Lahore',
  bio: 'Weekend walks, late coffee, and people who actually reply.',
  job: 'Product designer',
  photo: 'https://i.pravatar.cc/600?img=12',
};

export const people: Person[] = [
  {
    id: 'p1',
    name: 'Ava',
    age: 26,
    distanceKm: 0.4,
    city: 'Gulberg',
    bio: 'Looking for someone nearby who can keep a conversation going — voice notes welcome.',
    job: 'Photographer',
    interests: ['Film', 'Cafes', 'Travel'],
    photo: 'https://i.pravatar.cc/700?img=47',
    online: true,
  },
  {
    id: 'p2',
    name: 'Noah',
    age: 29,
    distanceKm: 1.1,
    city: 'DHA Phase 5',
    bio: 'Gym in the morning, rooftop sunsets after. Let’s do a voice call if the chat clicks.',
    job: 'Software engineer',
    interests: ['Fitness', 'Cooking', 'Jazz'],
    photo: 'https://i.pravatar.cc/700?img=15',
    online: true,
  },
  {
    id: 'p3',
    name: 'Maya',
    age: 27,
    distanceKm: 2.3,
    city: 'Johar Town',
    bio: 'Books, brunch, and no more “hey”. Tell me what you are listening to.',
    job: 'Architect',
    interests: ['Design', 'Hiking', 'Poetry'],
    photo: 'https://i.pravatar.cc/700?img=32',
    online: false,
  },
  {
    id: 'p4',
    name: 'Leo',
    age: 31,
    distanceKm: 3.6,
    city: 'Model Town',
    bio: 'New in the area. Prefer meeting people who live close enough for a real date.',
    job: 'Chef',
    interests: ['Food', 'Football', 'Vinyl'],
    photo: 'https://i.pravatar.cc/700?img=13',
    online: true,
  },
  {
    id: 'p5',
    name: 'Zara',
    age: 25,
    distanceKm: 4.8,
    city: 'Bahria Town',
    bio: 'Night owl, dog person, terrible at small talk until the second coffee.',
    job: 'Marketing',
    interests: ['Dogs', 'Art', 'K-dramas'],
    photo: 'https://i.pravatar.cc/700?img=45',
    online: true,
  },
  {
    id: 'p6',
    name: 'Omar',
    age: 30,
    distanceKm: 6.2,
    city: 'Cantt',
    bio: 'If you are within 10 km, we can actually meet this week.',
    job: 'Doctor',
    interests: ['Running', 'Travel', 'Board games'],
    photo: 'https://i.pravatar.cc/700?img=11',
    online: false,
  },
  {
    id: 'p7',
    name: 'Hana',
    age: 24,
    distanceKm: 8.9,
    city: 'Township',
    bio: 'Soft playlists and long walks. Video call first if that feels safer.',
    job: 'Student',
    interests: ['Music', 'Skincare', 'Markets'],
    photo: 'https://i.pravatar.cc/700?img=20',
    online: true,
  },
  {
    id: 'p8',
    name: 'Ryan',
    age: 33,
    distanceKm: 12.4,
    city: 'Raiwind Road',
    bio: 'A bit farther out, but I drive. Looking for something easy and local.',
    job: 'Pilot',
    interests: ['Flying', 'Coffee', 'Cinema'],
    photo: 'https://i.pravatar.cc/700?img=33',
    online: false,
  },
];

export function personById(id: string) {
  return people.find((p) => p.id === id);
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}
