/**
 * Stoat / DawnChat MongoDB Direct Service
 * Connects to MongoDB to manage platform-wide bans, platform reports, and audit logs.
 */
import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

let currentMongoUri: string = process.env.MONGODB_URI || '';
let currentDbName: string = process.env.MONGODB_DB || 'revolt';

export async function getMongoDb(): Promise<{ db: Db; client: MongoClient } | null> {
  if (!currentMongoUri) {
    return null;
  }

  if (db && client) {
    return { db, client };
  }

  try {
    client = new MongoClient(currentMongoUri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db(currentDbName);
    return { db, client };
  } catch (err) {
    console.error('MongoDB connection error:', err);
    client = null;
    db = null;
    throw err;
  }
}

export function setMongoConnectionConfig(uri: string, databaseName?: string) {
  if (client) {
    client.close().catch(() => {});
  }
  client = null;
  db = null;
  currentMongoUri = uri;
  if (databaseName) {
    currentDbName = databaseName;
  }
}

export function getMongoConfig() {
  return {
    uri: currentMongoUri,
    dbName: currentDbName,
  };
}

export async function checkMongoStatus() {
  if (!currentMongoUri) {
    return {
      connected: false,
      dbName: currentDbName,
      message: 'MONGODB_URI not configured. Operating in fallback / hybrid mode.',
    };
  }

  try {
    const conn = await getMongoDb();
    if (!conn) {
      return { connected: false, dbName: currentDbName, message: 'Not connected' };
    }
    const admin = conn.client.db().admin();
    const ping = await admin.ping();
    const collections = await conn.db.listCollections().toArray();
    
    // Get doc counts for relevant collections
    const counts = await Promise.all(
      collections.slice(0, 10).map(async (c) => ({
        name: c.name,
        count: await conn.db.collection(c.name).estimatedDocumentCount().catch(() => 0),
      }))
    );

    return {
      connected: true,
      dbName: currentDbName,
      ping,
      collections: counts,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      dbName: currentDbName,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
