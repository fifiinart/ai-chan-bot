import SimplDB from "simpl.db";
import { CustomClient } from "..";
import { SongData } from "./database";

let index: any = undefined

export async function updateIndex(db: SimplDB.Database) {
  const Fuse = (await import('fuse.js')).default;
  let _songdata = db.getCollection<SongData>("songdata")!.getAll();
  return index = Fuse.createIndex(["id", ["difficulties", "name"]], _songdata);
}

export type SongDataSearchType = 'name'

export async function initializeFuse(client: CustomClient, type: SongDataSearchType) {
  const Fuse = (await import('fuse.js')).default;
  let _songdata = client.db.getCollection<SongData>("songdata")!.getAll();
  if (!index) updateIndex(client.db)

  let keys: any
  if (type === 'name') {
    keys = [
      {
        name: "id", weight: 0.7
      },
      { name: ["difficulties", "name"], weight: 0.3 }
    ]
  } else {
    throw new Error(`Invalid search type! ${type}`);
  }


  return new Fuse<SongData>(_songdata, {
    includeScore: true,
    threshold: 0.2,
    keys
  }, index);
}

export async function searchSongdata(client: CustomClient, type: SongDataSearchType, query: string) {
  const fuse = await initializeFuse(client, type);
  return fuse.search(query, { limit: 25 })
}