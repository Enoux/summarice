# 🖼️ Figure Interpreter (`src/lib/server/figures/`)

The Figure Interpreter module is responsible for analyzing visual elements within documents. It extracts specific figure regions from PDFs and leverages multimodal AI to generate descriptions and interpretations.

## 🎯 How it Works

When a user highlights an area of a document (like a chart, graph, or image), this module steps in to make sense of the visual data:

1. **Extraction:** It interfaces with the PDF tools to capture the specific highlighted region as an image.
2. **Multimodal Analysis:** It sends the captured image through the `server/ai/` port (currently utilizing Gemini 3 Flash via OpenRouter) to generate a textual description of the figure.
3. **User Interaction:** It allows users to request re-explanations or manually edit the AI-generated interpretations for better accuracy.

## 🚥 Status

**🟢 Operational**. 
- Fully integrated with `area` (bounding box) highlights in the PDF viewer.
- Successfully making multimodal vision calls.
- Telemetry (cost, tokens, latency) is automatically recorded to the `llm_calls` table via the AI port.
