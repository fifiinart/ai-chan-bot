import { TotalDifficultyData } from "./pixelmatch";
import { Score } from "./process-scorecard";

export enum Grade {
  D = "D",
  C = "C",
  B = "B",
  A = "A",
  AA = "AA",
  EX = "EX",
  EXPlus = "EX+"
}

export interface ScoreAnalysisBase {
  playRating: number
  percentLongestCombo: number
  grade: Grade
}
export interface PMScore {
  isPureMemory: true
  nonShinies: number
}
export interface NonPMScore {
  isPureMemory: false
}
export type FRScore = { isFullRecall: true } & (PMScore | NonPMScore)
export type NonFRScore = { isFullRecall: false } & NonPMScore

export type ScoreAnalysis = ScoreAnalysisBase & (FRScore | NonFRScore)


export function analyzeScore(score: Score, song: TotalDifficultyData): ScoreAnalysis {
  // Find play rating
  const playRating = calculatePlayRating(score.score, song.difficulty.cc)
  const percentLongestCombo = score.combo / song.difficulty.notes

  let grade;
  if (score.score >= 9_900_000) grade = Grade.EXPlus;
  else if (score.score >= 9_800_000) grade = Grade.EX;
  else if (score.score >= 9_500_000) grade = Grade.AA;
  else if (score.score >= 9_200_000) grade = Grade.A;
  else if (score.score >= 8_900_000) grade = Grade.B;
  else if (score.score >= 8_600_000) grade = Grade.C;
  else grade = Grade.D

  // Figure out if score is FR
  if (score.combo === song.difficulty.notes) {
    // Figure out if score is PM
    if (score.score < 10_000_000)
      return {
        playRating,
        percentLongestCombo,
        grade,
        isFullRecall: true,
        isPureMemory: false
      }
    else {
      return {
        playRating,
        percentLongestCombo,
        grade,
        isFullRecall: true,
        isPureMemory: true,
        nonShinies: 10_000_000 + song.difficulty.notes - score.score
      }
    }
  } else {
    return {
      playRating,
      percentLongestCombo,
      grade,
      isFullRecall: false,
      isPureMemory: false
    }
  }
}

export function calculatePlayRating(score: number, cc: number) {
  let scoreModifier;
  if (score >= 10_000_000) {
    scoreModifier = 2;
  } else if (score >= 9_800_000) {
    scoreModifier = 1 + (score - 9_800_000) / 200_000;
  } else {
    scoreModifier = (score - 9_500_000) / 300_000;
  }

  return Math.max(0, cc + scoreModifier);
}