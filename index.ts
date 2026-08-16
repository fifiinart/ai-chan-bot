
// Require the necessary discord.js classes
import { Client, GatewayIntentBits, Collection, SlashCommandBuilder, type RESTPostAPIChatInputApplicationCommandsJSONBody, REST, Routes, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, AutocompleteInteraction, Partials, RESTPostAPIApplicationGuildCommandsJSONBody, DMChannel, inlineCode, ChatInputCommandInteraction, APIApplicationCommand } from "discord.js";
import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { Database } from "simpl.db";
import { setupDB } from "./util/database";
import { createErrorEmbed } from "./util/embed";

export interface CommandLike<C extends SlashCommandBuilder | SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder = SlashCommandBuilder> {
  data: C
  execute(interaction: ChatInputCommandInteraction): Promise<void>
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>
  isGuildOnly?: boolean
}

export interface CustomClient extends Client {
  commands: Collection<string, CommandLike>,
  db: Database
}

interface Event<N extends string = string> {
  name: N
  once: boolean
  execute(...args: unknown[]): void
}

// Create a new client instance
const client: CustomClient = Object.assign<Client, Omit<CustomClient, keyof Client>>(
  new Client({
    intents: [
      GatewayIntentBits.MessageContent,

      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,

      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions
    ],
    partials: [
      Partials.Channel
    ]
  }),
  {
    commands: new Collection(),
    db: setupDB(new Database({ tabSize: 2 }))
  });

// Log in to Discord with your client's token
client.login(process.env.TOKEN);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
const registerData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const guildRegisterData: RESTPostAPIApplicationGuildCommandsJSONBody[] = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const command: CommandLike = require(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    (command.isGuildOnly ? guildRegisterData : registerData).push(command.data.toJSON())
    console.log(`Command ${command.data.name} registered!`)
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

function executeEventWithLogging(event: Event) {
  return async function (...args: unknown[]) {

    try {
      event.execute(...args)
    } catch (e) {
      if (!process.env.OWNER_DM) {
        throw new Error("No owner DM set in environment!", { cause: e });
      }

      const time = Date.now()
      console.error(e, (e instanceof Error ? e.stack : null))
      const channel = await client.channels.fetch(process.env.OWNER_DM) as DMChannel
      channel.send({
        embeds: [createErrorEmbed(inlineCode(String(e)))
          .setTimestamp(time)
          .setDescription(inlineCode(e instanceof Error ? e.stack ?? "" : ""))]
      })
    }
  }
}

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const event: Event = require(filePath);
  if (event.once) {
    client.once(event.name, executeEventWithLogging(event));
  } else {
    client.on(event.name, executeEventWithLogging(event));
  }
}

if (!process.env.TOKEN) {
  throw new Error("No token set in environment!")
}

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
  if (!process.env.CLIENT_ID) {
    throw new Error("No client ID set in environment!")
  }

  if (registerData.length > 0) {
    try {
      console.log(`Started refreshing ${registerData.length} application (/) commands.`);

      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: registerData },
      ) as APIApplicationCommand[];

      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      // And of course, make sure you catch and log any errors!
      console.error(error);
    }
  }
})();

(async () => {
  if (!process.env.GUILD_IDS) {
    throw new Error("No trusted guild IDs set in environment!")
  }

  if (guildRegisterData.length > 0) {
    try {
      console.log(`Started refreshing ${guildRegisterData.length} application guild (/) commands.`);

      const commandGuilds = process.env.GUILD_IDS.split(',')
      await Promise.all(commandGuilds.map(async id => {
        if (!process.env.CLIENT_ID) {
          throw new Error("No client ID set in environment!")
        }

        console.log(`Refreshing for guild ${id}...`)
        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, id),
          { body: guildRegisterData },
        ) as APIApplicationCommand[];
        console.log(`Successfully reloaded ${data.length} application guild (/) commands for guild ${id}.`);
      }));

    } catch (error) {
      // And of course, make sure you catch and log any errors!
      console.error(error);
    }
  }
})();