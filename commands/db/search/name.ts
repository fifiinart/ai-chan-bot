import { AutocompleteInteraction, BaseInteraction, CommandInteraction, SlashCommandSubcommandBuilder, bold } from "discord.js";
import type { CustomClient } from "../../.."
import type { SongData } from "../../../util/database";
import { stitchMessages } from "../../../util/stitch-messages";
import { createErrorEmbed } from "../../../util/embed";

let _songdata: SongData[] | null = null;

export const data = new SlashCommandSubcommandBuilder()
  .setName('name')
  .setDescription('Search the database by name.')
  .addStringOption(opt => opt
    .setName("name")
    .setDescription("The name of the song to search for.")
    .setAutocomplete(true)
    .setRequired(true))

export async function execute(interaction: CommandInteraction) {
  const query = interaction.options.get('name', true).value as string

  const fuse = await initializeFuse(interaction.client as CustomClient);

  const results = fuse.search(query, {
    limit: 10
  })

  if (results.length === 0) {
    return createErrorEmbed("No Matches Found", interaction)
  }

  return stitchMessages(
    results.map((result, i) =>
      ({ content: `${bold(`${result.item.difficulties[0].name} (${i + 1}/${results.length})`)}\nScore: ${result.score}` })
    ),
    interaction, 'reply')
}

async function initializeFuse(client: CustomClient) {
  const Fuse = (await import('fuse.js')).default;

  _songdata ??= client.db.getCollection<SongData>("songdata")!.getAll();
  return new Fuse<SongData>(_songdata, {
    includeScore: true,
    threshold: 0.2,
    keys: [
      {
        name: "id", weight: .7
      },
      { name: ["difficulties", "name"], weight: .3 }
    ]
  });

}

export async function autocomplete(interaction: AutocompleteInteraction) {
  const query = interaction.options.getFocused();
  const result = (await initializeFuse(interaction.client as CustomClient)).search(query, { limit: 25 })
  const names = Array.from(new Set(result.flatMap(x => x.item.difficulties.map(x => x.name))))
  if (names.length > 25) names.splice(25)
  interaction.respond(names.map(name => ({ name, value: name })))
}