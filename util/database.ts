import { Database } from "simpl.db";
import { Difficulty } from "./img-format-constants";

export interface SongDifficultyData {
  subid?: string,
  name: string,
  artist: string,
  charter: string,
  cc: number,
  difficulty: Difficulty,
  notes: number,
  level?: string
}

export interface SongData {
  id: string,
  difficulties: SongDifficultyData[]
}

export function setupDB(db: Database) {
  db.createCollection<SongData>("songdata")
  return db
}