import { APIEmbed, CommandInteraction, EmbedBuilder, GuildMember, bold } from "discord.js";
import { Difficulty, getDifficultyName } from "./img-format-constants";
import { SongDifficultyData } from "./database";

export const SUCCESS_COLOR = 0x4BB543
export const ERROR_COLOR = 0xF44336

export function ccToLevel(cc: number) {
  if (cc < 9) {
    return Math.floor(cc).toString()
  } else {
    return cc % 1 >= .7 ? Math.floor(cc).toString() + "+" : Math.floor(cc).toString()
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
    .setColor(ERROR_COLOR)
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

export function createSongDataEmbed(songdata: SongDifficultyData, interval: number, interaction: CommandInteraction) {
  return createSuccessEmbed("Song Data", interval, interaction)
    .addFields({
      "name": `Song`,
      "value": songdata.name,
      "inline": false
    }, {
      "name": `Difficulty`,
      "value": `${bold('Level:')} ${getDifficultyName(songdata.difficulty)} ${ccToLevel(songdata.cc)}
${bold('CC:')} ${songdata.cc}`,
      "inline": false
    }, {
      "name": `Extra Info`,
      "value": `${bold('Artist:')} ${songdata.artist}
${bold('Charter:')} ${songdata.charter}
${bold('# Notes:')} ${songdata.notes}`,
      "inline": false
    }).setThumbnail("attachment://jacket.png")
}