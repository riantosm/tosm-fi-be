import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI as string;

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected");

    // --- Tambahan: cek ukuran database ---
    const db = mongoose.connection.db;
    const stats = await db?.stats();

    const dataSizeMB = (stats?.dataSize / 1024 / 1024).toFixed(2);
    const storageSizeMB = (stats?.storageSize / 1024 / 1024).toFixed(2);
    const indexSizeMB = (stats?.indexSize / 1024 / 1024).toFixed(2);
    const totalSizeMB = (
      (stats?.storageSize + stats?.indexSize) /
      1024 /
      1024
    ).toFixed(2);

    console.log("📊 Database Stats:");
    // console.log(`- Collections: ${stats?.collections}`);
    // console.log(`- Objects: ${stats?.objects}`);
    // console.log(`- Data Size: ${dataSizeMB} MB`);
    // console.log(`- Storage Size: ${storageSizeMB} MB`);
    // console.log(`- Index Size: ${indexSizeMB} MB`);
    // console.log(`- Total (Storage + Index): ${totalSizeMB} MB`);

    const limitMB = 512;
    const usedPercent = ((Number(totalSizeMB) / limitMB) * 100).toFixed(1);
    console.log(`📦 Used: ${totalSizeMB} MB / ${limitMB} MB (${usedPercent}%)`);

    if (Number(totalSizeMB) > limitMB * 0.8) {
      console.warn("⚠️  Warning: You’re above 80% of the free-tier limit!");
    }
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};
