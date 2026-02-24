import { MongoClient } from "mongodb";

function authorize(req: Request) {
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey || apiKey !== process.env.API_SECRET) {
    return false;
  }

  return true;
}

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

    const db = client.db("pivotly");
    const collection = db.collection("sap");

    const body = await req.json();

    if (!body.sku) {
      throw new Error("sku is required for upsert");
    }

    const now = new Date();

    const result = await collection.updateOne(
      { sku: body.sku }, 
      {
        $set: {
          product_id: body.product_id,
          sku: body.sku,
          name: body.name,
          price: body.price,
          is_active: body.is_active,
          last_changed_at: now
        }
      },
      { upsert: true }
    );

    await client.close();

    return Response.json({
      success: true,
      upsertedId: result.upsertedId ?? null,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });

  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

