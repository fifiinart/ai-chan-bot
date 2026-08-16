import SimplDB from "simpl.db";
import { CustomClient } from ".."
import { SongData } from "./database";
// import type { FuseIndex } from "fuse.js" with { "resolution-mode": "import" };
type FuseIndex<T> = import("fuse.js", { with: {"resolution-mode": "import"} }).FuseIndex<T>

let index: FuseIndex<SimplDB.Readable<SongData>> | undefined = undefined

export async function updateIndex(db: SimplDB.Database, _songdata: SimplDB.Readable<SongData>[]) {
  const Fuse = (await import('fuse.js')).default;
  return index = Fuse.createIndex(["id", ["difficulties", "name"]], _songdata);
}

export type SongDataSearchType = 'name'

export async function searchSongdata(client: CustomClient, type: SongDataSearchType, query: string) {
  const Fuse = (await import('fuse.js')).default;
  const _songdata = client.db.getCollection<SongData>("songdata")?.getAll();
  if (!_songdata) {
    throw new Error("No song data collection!")
  }
  if (!index) updateIndex(client.db, _songdata)

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