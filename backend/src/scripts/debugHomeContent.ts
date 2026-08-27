import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { getHomeContent } from "../modules/customer/controllers/customerHomeController";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const req: any = {
    query: {
      latitude: "22.717641164041215",
      longitude: "75.87191175481233",
    },
  };

  const res: any = {
    status: (code: number) => {
      console.log(`Response status: ${code}`);
      return {
        json: (data: any) => {
          console.log("Response JSON:", JSON.stringify(data, null, 2).slice(0, 500));
        },
      };
    },
  };

  try {
    await getHomeContent(req, res);
  } catch (err) {
    console.error("Caught error in debug script:", err);
  }

  await mongoose.disconnect();
}
run();
