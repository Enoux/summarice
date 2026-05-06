# 📥 Document Upload (`src/lib/server/document-upload/`)

The upload module is responsible for the **PDF upload pipeline**. It acts as the gateway for new documents, transforming a raw PDF file into structured database rows that the rest of the application can query and use.

## 🎯 What it Does

When a user uploads a PDF, the upload logic (located in `./upload-document.ts`) coordinates several critical steps:

1. **Storage:** Securely uploads the raw file to Supabase Storage.
2. **Text Extraction:** Uses `pdfjs-dist` to extract readable text from each page.
3. **Outline Generation:** Extracts the document's table of contents/outline for navigation.
4. **Quality Control (Text-Density Scan):** Analyzes the text-to-image ratio and rejects scanned PDFs that are essentially just images, ensuring the app only processes readable documents.
5. **Persistence:** Saves the processed document metadata and text to the database using the `upload_document` RPC.

## 🚥 Status

**🟢 Operational**. The upload pipeline is fully active and serves as the entry point for all document-based workflows in the application.
