import SimplDB, { Database } from "simpl.db"
import { ScoreAnalysis } from "./analyze-score"
import { TotalDifficultyData } from "./pixelmatch"
import { Difficulty } from "./process-image"
import { Score } from "./process-scorecard"
import { User } from "discord.js"

export enum ClearType {
  Clear, FullRecall, PureMemory
}
export interface ScoreEntry {
  id: string
  subid: string
  name: string
  difficulty: Difficulty

  score: number
  combo: number

  clear: ClearType
  maxMinus: number
  playRating: number
}

export function scoreAnalysisToDBEntry(song: TotalDifficultyData, score: Omit<Score, "version">, analysis: ScoreAnalysis): ScoreEntry {
  return {
    id: song.song.id,
    subid: song.difficulty.subid ?? "",
    name: song.difficulty.name,
    difficulty: song.difficulty.difficulty,

    score: score.score,
    combo: score.combo,
    clear: analysis.isFullRecall ? analysis.isPureMemory ? ClearType.PureMemory : ClearType.FullRecall : ClearType.Clear,
    maxMinus: 10000000 + song.difficulty.notes - score.score,
    playRating: analysis.playRating
  }
}

export enum UpdateResultType {
  NoChange,
  ReplaceScore,
  NewScore
}

interface NoChange {
  type: UpdateResultType.NoChange
  oldIdx: number,
  oldScore: number,
  oldClearType: ClearType
}

interface NewScore {
  type: UpdateResultType.NewScore,
  newIdx: number
}

interface ReplaceScore {
  type: UpdateResultType.ReplaceScore,
  oldIdx: number,
  oldScore: number,
  oldClearType: ClearType
  newIdx: number
}

export type UpdateResult = NoChange | NewScore | ReplaceScore

export function addScore(db: Database, id: string, entry: ScoreEntry): UpdateResult {
  const collection = db.getCollection<ScoreEntry>(id) ?? db.createCollection<ScoreEntry>(id);

  const scores: ScoreEntry[] = collection.getAll()
  console.log(scores)
  const oldIdx = scores.findIndex(e => e.id === entry.id && e.name === entry.name)

  if (oldIdx === -1) {
    scores.push(entry)
    const newScores = [...scores].sort((a, b) => b.playRating - a.playRating)
    const newIdx = newScores.findIndex(e => e === entry)
    collection.remove()
    collection.createBulk(newScores)

    return {
      type: UpdateResultType.NewScore,
      newIdx
    }

  } else if (scores[oldIdx].score < entry.score) {
    const newScores = [...scores]
    newScores[oldIdx] = entry

    newScores.sort((a, b) => b.playRating - a.playRating)
    const newIdx = newScores.findIndex(e => e === entry)
    collection.remove()
    collection.createBulk(newScores)

    return {
      type: UpdateResultType.ReplaceScore,
      newIdx,
      oldIdx,
      oldScore: scores[oldIdx].score,
      oldClearType: scores[oldIdx].clear,
    }

  } else {
    return {
      type: UpdateResultType.NoChange,
      oldIdx,
      oldScore: scores[oldIdx].score,
      oldClearType: scores[oldIdx].clear,
    }
  }

}