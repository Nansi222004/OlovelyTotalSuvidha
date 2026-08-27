import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { getHomeContent } from "../modules/customer/controllers/customerHomeController";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const slugs = [
    undefined, // 'all'
    "all",
    "grocery",
    "fruits-vegetables",
    "dairy-milk",
    "bakery-biscuits",
    "snacks-drinks",
    "beauty",
    "fashion",
    "electronics",
    "home-furniture",
    "toys-sports"
  ];

  for (const slug of slugs) {
    let statusCode = 0;
    const req: any = {
      query: {
        headerCategorySlug: slug,
        latitude: "22.717641164041215",
        longitude: "75.87191175481233",
      },
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            console.log(`[TEST SLUG: '${slug}'] Status: ${code} | Success: ${data.success}`);
          },
        };
      },
    };

    await getHomeContent(req, res);
  }

  await mongoose.disconnect();
}
run();
