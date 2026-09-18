import pdfParse from "pdf-parse"

try {
  console.log("Calling pdfParse with an empty buffer...")
  const result = await pdfParse(Buffer.from([]))
  console.log("Result:", result)
} catch (e) {
  console.error("Error calling pdfParse:", e)
}
