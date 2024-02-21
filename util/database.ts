import { Database } from "simpl.db";
import { Difficulty } from "./process-image";

export interface SongDifficultyData {
  subid?: string,
  name: string,
  artist: string,
  charter?: string,
  cc: number,
  difficulty: Difficulty,
  notes: number,
  level?: string
}

export interface SongExtraData {
  pack: { base: string, subpack?: string }
}

export interface SongData {
  id: string,
  extra: SongExtraData
  difficulties: SongDifficultyData[]
}

export function setupDB(db: Database) {
  db.createCollection<SongData>("songdata")
  return db
}