import toolRegistry from './tool.registry.js';
import { TimeTool } from './definitions/time.tool.js';
import { DateTool } from './definitions/date.tool.js';
import { CalculatorTool } from './definitions/calculator.tool.js';
import { WeatherTool } from './definitions/weather.tool.js';
import { SearchTool } from './definitions/search.tool.js';

// Initialize and register tools
const registerTools = () => {
    toolRegistry.registerTool(new TimeTool());
    toolRegistry.registerTool(new DateTool());
    toolRegistry.registerTool(new CalculatorTool());
    toolRegistry.registerTool(new WeatherTool());
    toolRegistry.registerTool(new SearchTool());
};

// Run registration immediately
registerTools();

export default toolRegistry;
