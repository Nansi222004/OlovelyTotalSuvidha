import io from "socket.io-client";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Delivery from "../models/Delivery";
import jwt from "jsonwebtoken";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "");
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const runListener = async () => {
  await connectDB();

  try {
    let deliveryBoy = await Delivery.findOne();
    let isTemp = false;
    if (!deliveryBoy) {
      deliveryBoy = await Delivery.create({
        name: 'Socket Test Driver',
        mobile: `7${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `driver_socket_${Date.now()}@test.com`,
        password: 'Password123!',
        address: 'Indore',
        city: 'Indore',
        status: 'Active',
      });
      isTemp = true;
    }

    console.log(`Found Delivery Boy: ${deliveryBoy.name} (${deliveryBoy._id})`);

    // Generate Token
    const token = jwt.sign(
      { userId: deliveryBoy._id, userType: "Delivery" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1h" },
    );

    console.log("Generated Token, connecting to socket...");

    const socket = io("http://localhost:5000", {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("✅ Socket Connected! ID:", socket.id);
      console.log(
        `Joining delivery notification room for ${deliveryBoy._id}...`,
      );
      socket.emit("join-delivery-notifications", deliveryBoy._id.toString());
    });

    socket.on("joined-notifications-room", (data: any) => {
      console.log("✅ Joined Room Success:", data);
    });

    socket.on("new-order", (data: any) => {
      console.log("\n🎉 RECEIVED NEW ORDER NOTIFICATION! 🎉");
      console.log(JSON.stringify(data, null, 2));
    });

    socket.on("disconnect", (reason: string) => {
      console.log("❌ Disconnected:", reason);
    });

    socket.on("connect_error", (err: Error) => {
      console.error("❌ Connection Error:", err.message);
    });
  } catch (error) {
    console.error("Error:", error);
  }
};

runListener();
