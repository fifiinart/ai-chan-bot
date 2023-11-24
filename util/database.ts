import { Database } from "simpl.db";
import { Difficulty } from "./img-format-constants";

export interface SongDifficultyData {
  name: string,
  artist: string,
  charter: string,
  cc: number,
  difficulty: Difficulty,
  notes: number
}

export interface SongData {
  id: string,
  past?: SongDifficultyData
  present?: SongDifficultyData
  future?: SongDifficultyData
  beyond?: SongDifficultyData
}

export function setupDB(db: Database) {
  db.createCollection<SongData>("songdata")
  return db
}