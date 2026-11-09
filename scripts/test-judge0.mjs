// Test self-hosted Judge0 on AWS EC2
import 'dotenv/config'

const JUDGE0_URL = process.env.JUDGE0_URL || "http://16.192.215.199:2358"

console.log("=== Judge0 Self-Hosted Test ===")
console.log("URL:", JUDGE0_URL)

const javaCode = `
import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
    }
}
`

const stdin = "5 10"

async function run() {
  console.log("\n--- Step 1: Submit to Judge0 ---")
  const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language_id: 62, // Java (OpenJDK 13.0.1)
      source_code: Buffer.from(javaCode).toString("base64"),
      stdin: Buffer.from(stdin).toString("base64"),
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  })

  console.log("Submit status:", submitRes.status)
  const submitData = await submitRes.json()
  console.log("Submit response:", JSON.stringify(submitData, null, 2))

  if (!submitRes.ok) {
    console.error("? Submit failed!")
    return
  }

  const token = submitData.token
  if (!token) {
    console.error("? No token returned!")
    return
  }
  console.log("? Token:", token)

  console.log("\n--- Step 2: Poll for result ---")
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1500))
    console.log(`  Poll attempt ${i + 1}...`)

    const pollRes = await fetch(
      `${JUDGE0_URL}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,status,exit_code,time,memory`,
      { headers: { "Content-Type": "application/json" } }
    )

    const data = await pollRes.json()
    if (data.status?.id <= 2) {
      console.log("  ? Still processing...")
      continue
    }

    const stdout = data.stdout ? Buffer.from(data.stdout, "base64").toString("utf-8") : ""
    const stderr = data.stderr ? Buffer.from(data.stderr, "base64").toString("utf-8") : ""
    const compileOutput = data.compile_output ? Buffer.from(data.compile_output, "base64").toString("utf-8") : ""

    console.log("\n=== RESULT ===")
    console.log("Status:", data.status?.description, `(id: ${data.status?.id})`)
    console.log("stdout:", JSON.stringify(stdout))
    console.log("stderr:", JSON.stringify(stderr))
    console.log("compile_output:", JSON.stringify(compileOutput))
    console.log("time:", data.time, "s")
    console.log("memory:", data.memory, "KB")

    if (stdout.trim() === "15") {
      console.log("\n?? SUCCESS: Output matches expected '15'! AWS Judge0 is 100% operational!")
    } else {
      console.log("\n? MISMATCH: Expected '15', got", JSON.stringify(stdout.trim()))
    }
    return
  }
  console.error("? Timed out waiting for result")
}

run().catch(console.error)
