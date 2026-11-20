import { drizzle } from "drizzle-orm/node-postgres";
import { openDatabase } from "./connection";
import { relations } from "./schema";

export const db = drizzle({ client: openDatabase(), relations });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
