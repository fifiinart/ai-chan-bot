import { ApplicationCommandOptionBase, CommandInteractionOptionResolver } from "discord.js";

export function hasUnfulfilledOptions(options: CommandInteractionOptionResolver, data: { options: ApplicationCommandOptionBase[] }) {
  const requiredOptions = data.options.filter(opt => opt.required === true).map(opt => opt.name).map(x => [x, options.get(x) != null] as [string, boolean]);
  const unfulfilledOptions = requiredOptions.filter(([, x]) => !x);
  const predicate = unfulfilledOptions.length > 0;
  return { predicate: predicate, unfulfilledOptions };
}
