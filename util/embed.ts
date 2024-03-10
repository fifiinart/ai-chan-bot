import { APIEmbed, APIGuildMember, AttachmentBuilder, CommandInteraction, EmbedBuilder, EmbedData, GuildMember, InteractionReplyOptions, JSONEncodable, User, bold, inlineCode } from "discord.js";
import { Difficulty, getDifficultyName } from "./process-image";
import { SongData, SongDifficultyData, SongExtraData } from "./database";
import { ScoreAnalysis } from "./analyze-score";
import { groupBy } from "./array-group";

import fs from 'fs/promises'
import path from "path";
import { ScoreEntry, UpdateResult, UpdateResultType } from "./personal-scores";

export const SUCCESS_COLOR = 0x4BB543
export const ERROR_COLOR = 0xF44336

export function ccToLevel(songdata: SongDifficultyData) {
  if (songdata.level) return songdata.level;
  const { cc } = songdata
  if (cc === 0) return '?'
  if (cc < 7) {
    return Math.floor(cc).toString()
  } else {
    return cc % 1 > .6 ? Math.floor(cc).toString() + "+" : Math.floor(cc).toString()
  }
}

export function interactionMemberToMemberOrUser(interactionMember: CommandInteraction["member"]) {
  return interactionMember instanceof GuildMember ? interactionMember : undefined
}

export function createGenericEmbed(user?: User | GuildMember): EmbedBuilder {
  if (!user) return new EmbedBuilder({ 'timestamp': new Date().toISOString() })
  return new EmbedBuilder({
    "author": {
      "name": user.client.user.username,
      "icon_url": user.client.user.displayAvatarURL()
    },
    "footer": {
      "text": `Requested by ${(user instanceof GuildMember && user.nickname) || user.displayName}`,
      "icon_url": user.displayAvatarURL()
    },
    "timestamp": new Date().toISOString()
  })
}

export function replaceUser(embed: EmbedBuilder, user: User | GuildMember | undefined) {
  return embed.setFooter(user ? {
    text: `Requested by ${(user instanceof GuildMember && user.nickname) || user.displayName}`,
    iconURL: user.displayAvatarURL()
  } : null)
}

export function createErrorEmbed(error: string, user?: User | GuildMember) {
  return createGenericEmbed(user)
    .setTitle("Error")
    .setDescription(error)
    .setColor(ERROR_COLOR)
}
export function createSuccessEmbed(title: string | null, interval: number | null, user?: User | GuildMember) {
  return createGenericEmbed(user)
    .setTitle(title ? title + (interval === null ? "" : ` (${interval / 1000}s)`) : null)
    .setColor(SUCCESS_COLOR)
}

export function createProcessEmbed(interval: number, score: number, difficulty: Difficulty, combo: number, user?: User | GuildMember) {
  return createSuccessEmbed("Scorecard Processing Result", interval, user)
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
  // .setImage("attachment://scorecard.png")
}

export function createSongDataEmbed(songdata: SongDifficultyData, extra: SongExtraData, interval: number | null, user?: User | GuildMember) {
  return createSuccessEmbed("Song Data", interval, user)
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

export async function createDatabaseGetEmbedList(songs: SongData[], user?: User | GuildMember) {
  const results: InteractionReplyOptions[] = []
  for (const song of songs) {
    const { difficulties, extra, id } = song
    results.push(...await Promise.all(Object.entries(groupBy(difficulties, "name")).map(async ([name, sharedName]) => {
      const embeds = [
        createSuccessEmbed("Database Search Result", null, user)
          .addFields({
            "name": `Song`,
            "value": `${name}
        ${bold('Pack:')} ${extra.pack.base} ${extra.pack.subpack ? "| " + extra.pack.subpack : ""}`
          }),
        ...sharedName.toSorted((a, b) => a.difficulty - b.difficulty).map(difficulty => {
          return createSuccessEmbed(null, null, user)
            .addFields({
              "name": `Difficulty`,
              "value": `${bold('Level:')} ${getDifficultyName(difficulty.difficulty)} ${ccToLevel(difficulty)}
        ${bold('CC:')} ${difficulty.cc.toFixed(1)}`,
              "inline": false
            }, {
              "name": `Extra Info`,
              "value": `${bold('Artist:')} ${difficulty.artist}${difficulty.charter ? '\n' + bold('Charter: ') + difficulty.charter : ""}
        ${bold('# Notes:')} ${difficulty.notes}`,
              "inline": false
            }).setThumbnail(`attachment://${id + (difficulty.subid ? '-' + difficulty.subid : '')}.png`)
        })]

      console.log(id)
      const fileNames = Array.from(new Set(sharedName.map(difficulty => id + (difficulty.subid ? '-' + difficulty.subid : '') + '.png')))
      const files = await Promise.all(fileNames.map(
        async file => new AttachmentBuilder(
          await fs.readFile(path.join(process.cwd(), 'jackets', file)),
          { name: file }
        )
      ))
      return { embeds, files }
    })))
  }

  results.forEach((element, i) => {
    const firstEmbed = element.embeds![0] as EmbedBuilder
    firstEmbed.setTitle(firstEmbed.data.title! + ` (${i + 1}/${results.length}):`)
  });

  return results;
}

export function createUpdateDatabaseEmbed(id: string, songdata: SongDifficultyData, extra: SongExtraData, interval: number | null, user?: User | GuildMember) {
  return createSuccessEmbed("Update Database", interval, user)
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

export function createSongAnalysisEmbed(analysis: ScoreAnalysis, user?: User | GuildMember) {
  const embed = createSuccessEmbed("Score Analysis", null, user)
    .addFields({
      "name": "Grade",
      "value": analysis.grade,
      "inline": false
    }, {
      "name": "Play Rating",
      "value": analysis.playRating.toFixed(4),
      "inline": false
    }, {
      "name": "Longest Combo %",
      "value": (analysis.percentLongestCombo * 100).toFixed(2) + "%" + (analysis.isFullRecall ? " (FR)" : ""),
      "inline": false
    })

  if (analysis.isPureMemory) {
    embed.addFields({
      "name": "Pure Memory",
      "value": "MAX-" + analysis.nonShinies,
      "inline": false
    })
  }
  return embed
}
export function createAddScoreEmbed(entry: ScoreEntry, result: UpdateResult, user?: User | GuildMember | undefined): EmbedBuilder {

  switch (result.type) {
    case UpdateResultType.NewScore:
      return createSuccessEmbed("New Score", null, user)
        .setDescription(`Rank: ${inlineCode("#" + (result.newIdx + 1))}`)
    case UpdateResultType.NoChange:
      return createSuccessEmbed("No Change", null, user)
        .setDescription(`Personal Best: [${inlineCode("#" + (result.oldIdx + 1))}] ${inlineCode(result.oldScore.toString())} (${scoreDiff(result.oldScore, entry.score)})`)
    case UpdateResultType.ReplaceScore:
      return createSuccessEmbed("Replace Score", null, user)
        .setDescription(`Rank: ${inlineCode("#" + (result.oldIdx + 1))} → ${inlineCode("#" + (result.newIdx + 1))}
Score: ${inlineCode(result.oldScore.toString())} → ${inlineCode(entry.score.toString())} (${scoreDiff(result.oldScore, entry.score)})`)
  }
}
function scoreDiff(oldScore: number, newScore: number) {
  if (newScore < oldScore) {
    return inlineCode("-" + (oldScore - newScore));
  }
  return inlineCode("+" + (newScore - oldScore));
}

