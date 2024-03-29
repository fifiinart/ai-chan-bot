import SimplDB from "simpl.db";
import { CustomClient } from ".."
import { SongData } from "./database";
import { disconnect } from "process";

let index: any = undefined

export async function updateIndex(db: SimplDB.Database) {
  const Fuse = (await import('fuse.js')).default;
  let _songdata = db.getCollection<SongData>("songdata")!.getAll();
  return index = Fuse.createIndex(["id", ["difficulties", "name"]], _songdata);
}

export type SongDataSearchType = 'name'

export async function searchSongdata(client: CustomClient, type: SongDataSearchType, query: string) {
  const Fuse = (await import('fuse.js')).default;
  let _songdata = client.db.getCollection<SongData>("songdata")!.getAll();
  if (!index) updateIndex(client.db)

  if (type === 'name') {
    const result = new Fuse<SongData>(_songdata, {
      includeScore: true,
      threshold: 0.2,
      keys: [
        {
          name: "id", weight: 0.4
        },
        { name: ["difficulties", "name"], weight: 0.6 }
      ]
    }, index).search(query, { limit: 25 });
    const newResult = result.map(item => {
      const distinctNames = Array.from(new Set(item.item.difficulties.map(d => d.name))) // some ids have more than one name, Fuse doesnt differentiate them by default
      if (distinctNames.length > 1) {
        const diffResult = new Fuse(distinctNames).search(query)
        const filtered = item.item.difficulties.filter(v => diffResult.some(x => x.item === v.name))
        const sorted = filtered.sort((a, b) => diffResult.findIndex(v => v.item === a.name) - diffResult.findIndex(v => v.item === b.name))
        return { ...item, item: { ...item.item, difficulties: sorted } };
      }
      return item
    })
    return newResult
  } else {
    throw new Error(`Invalid search type! ${type}`);
  }
}