import { MongoClient } from "mongodb";

function authorize(req: Request) {
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey || apiKey !== process.env.API_SECRET) {
    return false;
  }

  return true;
}

const ROUTING_KEYS = ["collection", "table", "collectionName"];

export async function POST(req: Request) {
  if (!authorize(req)) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401 }
    );
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    const body = await req.json();

    const rawCollection =
      body.collection ?? body.table ?? body.collectionName ?? "outlook";
    const collectionName =
      typeof rawCollection === "string" ? rawCollection.trim() : "outlook";
    const finalCollectionName = collectionName || "outlook";

    if (!/^\w{1,64}$/.test(finalCollectionName)) {
      return Response.json(
        {
          success: false,
          error:
            "collection must be a non-empty string of letters, numbers, and underscores (max 64 characters)",
        },
        { status: 400 }
      );
    }

    const db = client.db("pivotly");
    const collection = db.collection(finalCollectionName);

    const now = new Date();
    const doc: Record<string, unknown> = {
      ...body,
      last_changed_at: now,
    };
    ROUTING_KEYS.forEach((key) => delete doc[key]);

    const result = await collection.insertOne(doc);

    await client.close();

    return Response.json({
      success: true,
      collection: finalCollectionName,
      insertedId: result.insertedId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
