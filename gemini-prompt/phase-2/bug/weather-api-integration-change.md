You are an expert senior backend engineer specializing in:
• LLM-integrated tool systems (agent → tool → model pipelines)
• Node.js + Express + TypeScript architectures
• Safe API migrations without breaking existing functionality
• Weather API integrations and data normalization
• Production-grade backend refactoring

Your job:
Analyze the ENTIRE existing Gnani backend and UPGRADE ONLY the weather tool,
replacing OpenWeatherMap with **Open-Meteo**.

⚠️ VERY IMPORTANT:
You must NOT rely on any manual parameters or predefined example URLs I give.  
You must instead:

👉 Access and analyze the **official Open-Meteo documentation**  
👉 Determine the correct endpoints, parameters, and response structures yourself  
👉 Choose the correct weather API (current weather) based on our tool needs  
👉 Choose the correct geocoding API if city → lat/lon is needed  
👉 Implement ONLY the correct integration flows from the documentation

----------------------------------------------------------------------------------------------------
PART 1 — FULL SYSTEM ANALYSIS
----------------------------------------------------------------------------------------------------

You must analyze the entire backend project structure:

✔ Current weather tool (OpenWeatherMap)
✔ Tool registry, dispatcher, tool schema
✔ Model → tool → model loop
✔ Weather prompt builder or tool-preprocessing logic
✔ Frontend expectations (weather fields used today)
✔ Error handling
✔ Any utilities wrapping weather requests

Identify:
• Every location where OpenWeatherMap is referenced
• All data fields the system expects (temperature, humidity, text description, etc.)
• Where the weather tool output is sent back to the model
• Any OWM-specific behaviors or assumptions
• Any constraints defined in tool schema

Do NOT break the agent → tool → LLM → FE response loop.

----------------------------------------------------------------------------------------------------
PART 2 — OPEN-METEO AUTO-INTEGRATION REQUIREMENTS
----------------------------------------------------------------------------------------------------

Instead of following predefined instructions, you MUST:

1. Open and analyze the official Open-Meteo API documentation.
2. Determine:
   • The correct endpoint(s)
   • Required parameters
   • Optional parameters beneficial for our system
   • Response structure used for current weather
3. Determine how to convert city → latitude/longitude:
   • If Open-Meteo provides a geocoding API → use it
   • Else fallback to existing geocoder (if present)
4. Determine how to represent:
   • Current conditions
   • Temperature
   • Wind
   • Humidity
   • Precipitation / rain probability
   • Weather condition text (if mapping required → create mapping)
5. Convert Open-Meteo fields into our existing weather tool output schema.

You must ensure:
• FE compatibility
• Tool contract compatibility
• Streaming output compatibility
• No breaking changes

----------------------------------------------------------------------------------------------------
PART 3 — IMPLEMENTATION RULES
----------------------------------------------------------------------------------------------------

You must:

1. REMOVE every OpenWeatherMap API call.
2. Implement a NEW Open-Meteo-based weather service.
3. Keep:
   • Same tool name
   • Same tool schema interface
   • Same JSON output keys
   • Same model interaction behavior
4. Add fallback and error states:
   • City not found
   • No weather data available
   • Network error
5. Normalize Open-Meteo response so the model receives exactly the same shape as before.

If during analysis you find missing pieces:
• Missing geocoder → implement one using Open-Meteo geocoding docs  
• Missing weather-code-to-text mapping → build it using Open-Meteo docs  
• Missing unit conversion → add where needed

NO CHANGES to:
• VAD system
• Whisper ASR pipeline
• Tool planning agent
• Context memory system
• LLM streaming layer
• Conversation system

Weather tool ONLY.

----------------------------------------------------------------------------------------------------
PART 4 — OUTPUT REQUIREMENTS
----------------------------------------------------------------------------------------------------

Your output must include:

1. **System Analysis Report**
   - What existed
   - What was missing
   - All OWM dependencies found

2. **Weather Tool Migration Plan**
   - Which Open-Meteo endpoints are used
   - Why they were chosen (based on documentation)

3. **Refactored Code**
   - Open-Meteo API client module
   - Optional geocoder module
   - Weather tool function
   - Normalization logic
   - Weather-code → readable-text mapping

4. **Integration Updates**
   - Tool registry changes (if needed)
   - Any adjustments to tool result handling

5. **End-to-End Example Output**
   - Example weather result JSON

6. **Guarantee**
   - Zero breaking changes to any other Gnani feature

----------------------------------------------------------------------------------------------------

You must follow your own analysis of the Open-Meteo API documentation and implement the integration with perfect correctness.

Do NOT use guesses.
Do NOT use hardcoded placeholder URLs.
Do NOT use sample parameters unless they come directly from the documentation.

Your implementation must reflect the real Open-Meteo API exactly.
