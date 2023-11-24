import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, CommandInteractionOptionResolver, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Difficulty, JACKET_RESOLUTION } from "../util/img-format-constants";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { SongData, SongDifficultyData } from "../util/database";
import fs from "fs/promises"
import path from "path";
import { CustomClient } from "..";
import sharp from "sharp";
import { createErrorEmbed, createSuccessEmbed, createUpdateDatabaseEmbed } from "../util/embed";
import SimplDB from "simpl.db";

const deleteIndexOnCall = (i: number) => (x: SongData, col: SimplDB.Collection<SimplDB.Readable<SongData>>) => {
  col.update(() => x.difficulties.splice(i, 1), y => x.id === y.id)
  console.log("Index deleted: ", i)
}

const restoreOldDifficultyOnCall = (i: number, d: SongDifficultyData) => (x: SongData, col: SimplDB.Collection<SimplDB.Readable<SongData>>) => {
  col.update(() => x.difficulties[i] = d, y => x.id === y.id)
  console.log("Difficulty restored: ", i)
}

const deleteEntryOnCall = (x: SongData, col: SimplDB.Collection<SimplDB.Readable<SongData>>) => {
  col.remove(y => x.id === y.id)
  console.log("Entry deleted: ", x.id)
}

export const data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submits an Arcaea jacket with information to the database.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))
  .addStringOption(opt => opt
    .setName("id")
    .setDescription("The id of the song to add/overwrite the record."))
  .addStringOption(opt => opt
    .setName("subid")
    .setDescription("The subid of the jacket to add/overwrite the record. For songs with special jacket variants only."))
  .addStringOption(opt => opt
    .setName('difficulty')
    .setDescription('The difficulty of the submitted score.')
    .addChoices(
      { name: "Past", value: "0" },
      { name: "Present", value: "1" },
      { name: "Future", value: "2" },
      { name: "Beyond", value: "3" }))
  .addStringOption(opt => opt
    .setName('song').setDescription('The song name.'))
  .addStringOption(opt => opt
    .setName('artist').setDescription('The artist name.'))
  .addStringOption(opt => opt
    .setName('charter').setDescription('The charter name as listed, for that difficulty.'))
  .addNumberOption(opt => opt
    .setName('cc').setDescription('The chart constant.').setMinValue(0))
  .addIntegerOption(opt => opt
    .setName('notes').setDescription('The number of notes for that chart.').setMinValue(0))

export async function execute(interaction: CommandInteraction) {

  let now = Date.now();

  const result = await getAttachmentsFromMessage(interaction);
  if (!result.success) {
    return await interaction.reply(result.error);
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)
  await interaction.deferReply();

  const attachments = result.data;

  if (attachments.length > 1) {
    return await interaction.followUp({ embeds: [createErrorEmbed("Multiple images received", interaction)] })
  }

  const [attachment] = attachments;

  const processResult = await processScorecard(attachment);

  if (!processResult.success) {
    return await interaction.followUp({ embeds: [createErrorEmbed(processResult.error, interaction)] });
  }

  const { data } = processResult

  const { jacket } = data.files

  const options = interaction.options as CommandInteractionOptionResolver

  const id = options.getString('id')!.trim()
  const subid = options.getString('subid')?.trim()
  const name = options.getString('song')!.trim()
  const artist = options.getString('artist')!.trim()
  const charter = options.getString('charter')!.trim()
  const cc = options.getNumber('cc')!
  const notes = options.getInteger('notes')!
  const difficulty = +options.getString('difficulty')! as Difficulty

  const difficultyData: SongDifficultyData = { name, artist, charter, cc, notes, difficulty, subid: subid ?? undefined }

  const SongData = (interaction.client as CustomClient).db.getCollection<SongData>("songdata")!

  let undoMethod: ((x: SongData, col: typeof SongData) => void) | undefined = undefined;
  let songdata: SongData | undefined = undefined;

  if (SongData.has(target => target.id === id)) {
    SongData.update(x => {
      songdata = x;
      const i = x.difficulties.findIndex(d => (d.difficulty === difficulty) && ((d.subid ?? "") === (subid ?? "")))
      if (i !== -1) {
        console.log(i, x.difficulties[i])
        const old = Object.assign({}, x.difficulties[i])
        x.difficulties[i] = difficultyData;
        undoMethod = restoreOldDifficultyOnCall(i, old)
      } else {
        undoMethod = deleteIndexOnCall(x.difficulties.push(difficultyData) - 1)
      }
    }, target => target.id === id)
    if (!undoMethod || !songdata) return await interaction.followUp({ embeds: [createErrorEmbed("Something went wrong!", interaction)] });
  } else {
    songdata = SongData.create({ id: id, difficulties: [difficultyData] })
    undoMethod = deleteEntryOnCall
  }

  const jacketPath = path.join(__dirname, '..', 'jackets', id + (subid ? "-" + subid : "") + '.png')
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
    embeds: [createUpdateDatabaseEmbed(id, difficultyData, Date.now() - now, interaction)],
    components: [row]
  })

  const collectorFilter = (i: { user: { id: string; }; }) => i.user.id === interaction.user.id;

  try {
    const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 60000 });

    if (confirmation.customId = "undo") {
      undoMethod(songdata, SongData)
      if (oldJacket) {
        await fs.writeFile(jacketPath, oldJacket)
      } else {
        await fs.rm(jacketPath)
      }
      confirmation.update({
        embeds: [createErrorEmbed("Database Restored", interaction)],
        files: [],
        components: []
      })
    }
  } catch (e) {
    undoBtnComp.setDisabled(true);
  }

}
