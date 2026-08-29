import "dotenv/config";

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client, { schema });

const albums = [
  {
    name: "Algorithm's Blossom",
    slug: "algorithm-blossom",
    imgUrl: "https://assets.oioibawige.com/images/albums/algorithm-blossom.webp",
    color: "#7c3aed",
    releaseDate: "2024-04-01T00:00:00.000Z",
  },
  {
    name: "Harmony from Discord",
    slug: "harmony-from-discord",
    imgUrl: "https://assets.oioibawige.com/images/albums/harmony-from-discord.webp",
    color: "#f59e0b",
    releaseDate: "2024-09-23T00:00:00.000Z",
  },
] as const;

for (const albumInput of albums) {
  await db
    .insert(schema.album)
    .values(albumInput)
    .onConflictDoUpdate({
      target: schema.album.slug,
      set: {
        name: albumInput.name,
        imgUrl: albumInput.imgUrl,
        color: albumInput.color,
        releaseDate: albumInput.releaseDate,
        isVisible: true,
      },
    });
}

const seededAlbums = await db.query.album.findMany({
  where: inArray(
    schema.album.slug,
    albums.map((albumInput) => albumInput.slug),
  ),
});

const albumBySlug = new Map(seededAlbums.map((albumRow) => [albumRow.slug, albumRow.id]));

const songs = [
  {
    albumSlug: "algorithm-blossom",
    title: "고민중독",
    slug: "gomin-jungdok",
    youtubeId: "",
    lyrics: [],
    isTitle: true,
  },
  {
    albumSlug: "harmony-from-discord",
    title: "Discord",
    slug: "discord",
    youtubeId: "",
    lyrics: [],
    isTitle: true,
  },
] as const;

for (const [order, songInput] of songs.entries()) {
  const albumId = albumBySlug.get(songInput.albumSlug);

  if (!albumId) {
    throw new Error(`Seed album not found: ${songInput.albumSlug}`);
  }

  const existing = await db.query.song.findFirst({
    where: eq(schema.song.slug, songInput.slug),
  });
  const songValues = {
    albumId,
    title: songInput.title,
    youtubeId: songInput.youtubeId,
    lyrics: songInput.lyrics,
    isTitle: songInput.isTitle,
    isVisible: true,
    order,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    await db.update(schema.song).set(songValues).where(eq(schema.song.id, existing.id));
  } else {
    await db.insert(schema.song).values({ ...songValues, slug: songInput.slug });
  }
}

await client.end();
console.log("Local development seed completed");
