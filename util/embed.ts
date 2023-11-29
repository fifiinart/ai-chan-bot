import { APIEmbed, CommandInteraction, EmbedBuilder, GuildMember, bold } from "discord.js";
import { Difficulty, getDifficultyName } from "./img-format-constants";
import { SongDifficultyData, SongExtraData } from "./database";
import { ScoreAnalysis } from "./analyze-score";

export const SUCCESS_COLOR = 0x4BB543
export const ERROR_COLOR = 0xF44336

export function ccToLevel(songdata: SongDifficultyData) {
  if (songdata.level) return songdata.level;
  const { cc } = songdata
  if (cc === 0) return '?'
  if (cc < 9) {
    return Math.floor(cc).toString()
  } else {
    return cc % 1 > .6 ? Math.floor(cc).toString() + "+" : Math.floor(cc).toString()
  }
}

export function createGenericEmbed(interaction: CommandInteraction): EmbedBuilder {
  return new EmbedBuilder({
    "author": {
      "name": interaction.client.user.username,
      "icon_url": interaction.client.user.displayAvatarURL()
    },
    "footer": {
      "text": `Requested by ${interaction.member?.user.username}`,
      "icon_url": interaction.member instanceof GuildMember ? interaction.member.displayAvatarURL() : undefined
    },
    "timestamp": new Date().toISOString()
  })
}

export function createErrorEmbed(error: string, interaction: CommandInteraction) {
  return createGenericEmbed(interaction)
    .setTitle("Error")
    .setDescription(error)
    .setColor(ERROR_COLOR)
}
export function createSuccessEmbed(title: string, interval: number | null, interaction: CommandInteraction) {
  return createGenericEmbed(interaction)
    .setTitle(title + (interval === null ? "" : ` (${interval / 1000}s)`))
    .setColor(SUCCESS_COLOR)
}

export function createProcessEmbed(interval: number, score: number, difficulty: Difficulty, combo: number, interaction: CommandInteraction) {
  return createSuccessEmbed("Scorecard Processing Result", interval, interaction)
    .addFields({
      "name": `Score`,
      "value": `${score.toString().padStart(8, '0')}`,
      "inline": true
    }, {
      "name": `Difficulty`,
      "value": `${getDifficultyName(difficulty)}`,
      "inline": true
    }, {
      "name": `Combo`,
      "value": `${combo}`,
      "inline": true
    })
    .setImage("attachment://scorecard.png")
}

export function createSongDataEmbed(songdata: SongDifficultyData, extra: SongExtraData, interval: number, interaction: CommandInteraction) {
  return createSuccessEmbed("Song Data", interval, interaction)
    .addFields({
      "name": `Song`,
      "value": `${songdata.name}
${bold('Pack:')} ${extra.pack.base} ${extra.pack.subpack ? "| " + extra.pack.subpack : ""}`,
      "inline": false
    }, {
      "name": `Difficulty`,
      "value": `${bold('Level:')} ${getDifficultyName(songdata.difficulty)} ${ccToLevel(songdata)}
${bold('CC:')} ${songdata.cc.toFixed(1)}`,
      "inline": false
    }, {
      "name": `Extra Info`,
      "value": `${bold('Artist:')} ${songdata.artist}${songdata.charter ? '\n' + bold('Charter: ') + songdata.charter : ""}
${bold('# Notes:')} ${songdata.notes}`,
      "inline": false
    }).setThumbnail("attachment://jacket.png")
}

export function createUpdateDatabaseEmbed(id: string, songdata: SongDifficultyData, extra: SongExtraData, interval: number, interaction: CommandInteraction) {
  return createSuccessEmbed("Update Database", interval, interaction)
    .addFields({
      "name": `Song`,
      "value": `${songdata.name} (\`${id}\`)
${bold('Pack:')} ${extra.pack.base} ${extra.pack.subpack ? "| " + extra.pack.subpack : ""}`,
      "inline": false
    }, {
      "name": `Difficulty`,
      "value": `${bold('Level:')} ${getDifficultyName(songdata.difficulty)} ${ccToLevel(songdata)}
${bold('CC:')} ${songdata.cc.toFixed(1)}`,
      "inline": false
    }, {
      "name": `Extra Info`,
      "value": `${bold('Artist:')} ${songdata.artist}${songdata.charter ? '\n' + bold('Charter: ') + songdata.charter : ""}
${bold('# Notes:')} ${songdata.notes}`,
      "inline": false
    }).setThumbnail("attachment://jacket.png")
}

export function createSongAnalysisEmbed(analysis: ScoreAnalysis, interaction: CommandInteraction) {
  const embed = createSuccessEmbed("Score Analysis", null, interaction)
    .addFields({
      "name": "Grade",
      "value": analysis.grade,
      "inline": true
    }, {
      "name": "Longest Combo Percent",
      "value": (analysis.percentLongestCombo * 100).toFixed(2) + "%" + (analysis.isFullRecall ? " (FR)" : ""),
      "inline": true
    })

  if (analysis.isPureMemory) {
    embed.addFields({
      "name": "Pure Memory",
      "value": "MAX-" + analysis.nonShinies,
      "inline": true
    })
  }
  return embed
}