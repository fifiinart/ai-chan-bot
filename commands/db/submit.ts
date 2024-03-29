import { CommandInteraction, AttachmentBuilder, CommandInteractionOptionResolver, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandSubcommandBuilder, CollectorFilter, ButtonInteraction, ComponentType } from "discord.js";
import { CustomClient } from "../.."

import { Difficulty, JACKET_RESOLUTION } from "../../util/process-image";
import { getAttachmentsFromInteraction } from "../../util/get-attachments";
import { processScorecard } from "../../util/process-scorecard";
import { SongData, SongDifficultyData, SongExtraData } from "../../util/database";
import { createErrorEmbed, createUpdateDatabaseEmbed, interactionMemberToMemberOrUser } from "../../util/embed";

import fs from "fs/promises"
import path from "path";
import sharp from "sharp";
import SimplDB from "simpl.db";

type UndoMethod = (songdata: SongData, col: SimplDB.Collection<SimplDB.Readable<SongData>>) => void;
const deleteIndexOnCall = (i: number, oldExtra: SongExtraData): UndoMethod => (songdata, col) => {
  col.update(() => {
    songdata.extra = oldExtra
    songdata.difficulties.splice(i, 1)
  }, target => songdata.id === target.id)
  console.log("Index deleted: ", i)
}

const restoreOldDifficultyOnCall = (i: number, oldDiff: SongDifficultyData, oldExtra: SongExtraData): UndoMethod => (songdata, col) => {
  col.update(() => {
    songdata.extra = oldExtra
    songdata.difficulties[i] = oldDiff
  }, target => songdata.id === target.id
  )
  console.log("Difficulty restored: ", i)
}

const deleteEntryOnCall: UndoMethod = (songdata, col) => {
  col.remove(target => songdata.id === target.id)
  console.log("Entry deleted: ", songdata.id)
}

export const data = new SlashCommandSubcommandBuilder()
  .setName('submit')
  .setDescription('Submits an Arcaea jacket with information to the database.')
  .addStringOption(opt => opt
    .setName("id")
    .setDescription("The id of the song to add/overwrite the record.")
    .setRequired(true))

  .addStringOption(opt => opt
    .setName('pack').setDescription('The pack name. (e.g. World Extend, Eternal Core, Lanota Collaboration)').setRequired(true))
  .addStringOption(opt => opt
    .setName('difficulty')
    .setDescription('The difficulty of the submitted score.')
    .addChoices(
      { name: "Past", value: "0" },
      { name: "Present", value: "1" },
      { name: "Future", value: "2" },
      { name: "Beyond", value: "3" },
      { name: 'Eternal', value: "4" }).setRequired(true))
  .addStringOption(opt => opt
    .setName('song').setDescription('The song name.').setRequired(true))
  .addStringOption(opt => opt
    .setName('artist').setDescription('The artist name.').setRequired(true))
  .addNumberOption(opt => opt
    .setName('cc').setDescription('The chart constant.').setMinValue(0).setRequired(true))
  .addIntegerOption(opt => opt
    .setName('notes').setDescription('The number of notes for that chart.').setMinValue(0).setRequired(true))

  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))

  .addStringOption(opt => opt
    .setName("subid")
    .setDescription("The subid of the jacket to add/overwrite the record. For songs with special jacket variants only.").setRequired(false))
  .addStringOption(opt => opt
    .setName('subpack')
    .setDescription('The sub-pack name. (e.g. "Shifting Veil", (Collaboration) "Chapter 2") Leave blank if doesn\'t apply.')
    .setRequired(false))

  .addStringOption(opt => opt
    .setName('level').setDescription('The custom display level (dropdead FTR 8 - CC 9.1, etc.). Leave blank if consistent with CC.').setRequired(false)
    .setChoices(...['1', '2', '3', '4', '5', '6', '7', '7+', '8', '8+', '9', '9+', '10', '10+', '11', '11+', '12'].map(x => ({ name: x, value: x }))))
  .addStringOption(opt => opt
    .setName('charter').setDescription('The charter name as listed, for that difficulty.').setRequired(false))

export async function execute(interaction: CommandInteraction): Promise<void> {

  const user = interactionMemberToMemberOrUser(interaction.member)

  if ((![process.env.GUILD_ID, process.env.GUILD_ID_2].includes(interaction.guild?.id)) && (user?.id !== process.env.OWNER_ID)) {
    await interaction.reply("Only the owner or members of trusted guilds can submit information!");
    return;
  }

  let now = Date.now();

  const options = interaction.options as CommandInteractionOptionResolver


  const id = options.getString('id', true).trim()
  const name = options.getString('song', true).trim()
  const artist = options.getString('artist', true).trim()
  const charter = options.getString('charter')?.trim() ?? undefined
  const cc = options.getNumber('cc', true)
  const notes = options.getInteger('notes', true)
  const difficulty = +options.getString('difficulty', true) as Difficulty
  const pack = options.getString('pack', true).trim()

  const subid = options.getString('subid')?.trim() ?? undefined
  const level = options.getString('level') ?? undefined
  const subpack = options.getString('subpack')?.trim() ?? undefined

  await interaction.deferReply();

  const result = await getAttachmentsFromInteraction(interaction);
  if (!result.success) {
    await interaction.followUp(result.error);
    return;
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)

  const attachments = result.data;

  if (attachments.length > 1) {
    await interaction.followUp({ embeds: [createErrorEmbed("Multiple images received", user)] })
    return;
  }

  const [attachment] = attachments;

  const processResult = await processScorecard(attachment);

  if (!processResult.success) {
    await interaction.followUp({ embeds: [createErrorEmbed(processResult.error, user)] });
    return;
  }

  const { data: resultDat } = processResult

  const { jacket } = resultDat.files

  const difficultyData: SongDifficultyData = { name, artist, charter, level, cc, notes, difficulty, subid }
  const extraData: SongExtraData = { pack: { base: pack, subpack } }

  const SongData = (interaction.client as CustomClient).db.getCollection<SongData>("songdata")!



  let undoMethod: UndoMethod | undefined = undefined;
  let songdata: SongData | undefined = undefined;

  if (SongData.has(target => target.id === id)) {
    SongData.update(x => {
      songdata = x;
      const oldExtra = Object.assign({}, x.extra)
      x.extra = extraData

      const i = x.difficulties.findIndex(d => (d.difficulty === difficulty) && ((d.subid ?? "") === (subid ?? "")))
      if (i !== -1) {
        const oldDiff = Object.assign({}, x.difficulties[i])
        x.difficulties[i] = difficultyData;

        undoMethod = restoreOldDifficultyOnCall(i, oldDiff, oldExtra)
      } else {
        undoMethod = deleteIndexOnCall(x.difficulties.push(difficultyData) - 1, oldExtra)
      }

    }, target => target.id === id)

    if (!undoMethod || !songdata) {
      await interaction.followUp({ embeds: [createErrorEmbed("Something went wrong!", user)] });
      return;
    }

  } else {
    songdata = SongData.create({ id: id, difficulties: [difficultyData], extra: extraData })
    undoMethod = deleteEntryOnCall
  }

  const jacketPath = path.join(process.cwd(), 'jackets', id + (subid ? "-" + subid : "") + '.png')
  let oldJacket: Buffer | undefined = undefined;
  try {
    oldJacket = await fs.readFile(jacketPath)
  } catch (e) {
  }

  await fs.writeFile(jacketPath, await sharp(jacket).resize(JACKET_RESOLUTION).ensureAlpha().png().toBuffer())

  console.log(undoMethod, songdata)

  const undoBtnComp = new ButtonBuilder()
    .setCustomId("undo")
    .setLabel("Undo")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("✖")

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents([undoBtnComp])

  const response = await interaction.followUp({
    files: [new AttachmentBuilder(jacket, { name: "jacket.png" })],
    embeds: [createUpdateDatabaseEmbed(id, difficultyData, extraData, Date.now() - now, user)],
    components: [row]
  })

  const collectorFilter: CollectorFilter<[ButtonInteraction]> = i => i.user.id === interaction.user.id;

  try {
    const confirmation = await response.awaitMessageComponent<ComponentType.Button>({ filter: collectorFilter, time: 60000 });

    if (confirmation.customId = "undo") {
      undoMethod(songdata, SongData)
      if (oldJacket) {
        await fs.writeFile(jacketPath, oldJacket)
      } else {
        await fs.rm(jacketPath)
      }
      confirmation.update({
        embeds: [createErrorEmbed("Database Restored", user)],
        files: [],
        components: []
      })
    }
  } catch (e) {
    undoBtnComp.setDisabled(true);
  }

}

