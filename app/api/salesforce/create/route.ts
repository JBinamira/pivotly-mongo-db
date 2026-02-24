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
    return new Response(JSON.stringify({ success: false }), { status: 401 });
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();

    const db = client.db("pivotly");
    const collection = db.collection("salesforce");

    const body = await req.json();

    // If last_changed_at exists → treat as filtered read
    if (body.last_changed_at) {
      const products = await collection
        .find({
          last_changed_at: {
            $gt: new Date(body.last_changed_at)
          }
        })
        .sort({ last_changed_at: 1 })
        .toArray();

      await client.close();

      return Response.json({
        success: true,
        count: products.length,
        data: products
      });
    }

    // Otherwise insert
    const result = await collection.insertOne(body);

    await client.close();

    return Response.json({
      success: true,
      insertedId: result.insertedId
    });

  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const lastChangedAt = searchParams.get("last_changed_at");

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    const db = client.db("pivotly");
    const collection = db.collection("salesforce");

    let filter: any = {};

    if (lastChangedAt) {
      filter.last_changed_at = {
        $gt: new Date(lastChangedAt)
      };
    }

    const products = await collection
      .find(filter)
      .sort({ last_changed_at: 1 })
      .toArray();

    await client.close();

    return Response.json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

