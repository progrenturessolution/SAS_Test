import mongoose from "mongoose";
import dns from "dns";

try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

const pass = "Q5uppTMf25e5xVL";
const uris = [
  `mongodb+srv://progenturestestrolab_db_user:${pass}@testrolab.fli4pdj.mongodb.net/progrentures?retryWrites=true&w=majority`,
  `mongodb+srv://progrenturestestrolab_db_user:${pass}@testrolab.fli4pdj.mongodb.net/progrentures?retryWrites=true&w=majority`,
  `mongodb+srv://progenturestestrolab:${pass}@testrolab.fli4pdj.mongodb.net/progrentures?retryWrites=true&w=majority`,
  `mongodb+srv://progrentures:${pass}@testrolab.fli4pdj.mongodb.net/progrentures?retryWrites=true&w=majority`,
];

async function test() {
  for (const uri of uris) {
    const redacted = uri.replace(pass, "****");
    console.log(`Testing: ${redacted}`);
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`\n✅ SUCCESS WITH: ${redacted}`);
      await mongoose.disconnect();
      return uri;
    } catch (e) {
      console.log(`❌ Failed: ${e.message}`);
    }
  }
}
test();
