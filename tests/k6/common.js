// tests/k6/common.js

export const SONG_SLUGS = [
  "be-happy",
  "blue-whale",
  "d-day",
  "dear",
  "discord",
  "fake-idol",
  "ferris-wheel",
  "free-dumb",
  "g9jb",
  "goodbye-my-sadness",
  "harmony-of-stars",
  "lets-love",
  "make-our-highlight",
  "manito",
  "my-name-is-malguem",
  "overdrive",
  "qwer-hashtag",
  "rebound",
  "run-run-run",
  "secret-diary",
  "soda",
  "t-b-h",
  "yours-sincerely",
  "youth-promise",
];

export function getRandomSlug() {
  return SONG_SLUGS[Math.floor(Math.random() * SONG_SLUGS.length)];
}
