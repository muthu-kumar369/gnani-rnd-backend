import { ITool, ToolParameter } from '../tool.interface.js';

export class CalculatorTool implements ITool {
    name = 'calculator';
    description = 'Perform basic mathematical calculations.';
    parameters: ToolParameter[] = [
        {
            name: 'expression',
            type: 'string',
            description: 'The mathematical expression to evaluate (e.g., "2 + 2", "10 * 5").',
            required: true
        }
    ];

    async execute(params: any): Promise<any> {
        let expression = params.expression;
        if (!expression) {
            return { error: 'Expression is required' };
        }

        console.log(`[CalculatorTool] Received expression: "${expression}"`);

        // Normalize: replace 'x' or 'X' with '*'
        expression = expression.replace(/x/gi, '*');
        
        // Remove any non-math characters (e.g., "calculate", "what is")
        // We keep digits, operators, dots, parentheses, and spaces
        // But we need to be careful not to strip valid parts if the input is totally wrong.
        // Let's try to strip letters.
        expression = expression.replace(/[a-zA-Z]/g, '');

        try {
            // Safety check: only allow numbers and basic operators
            if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(expression)) {
                console.warn(`[CalculatorTool] Invalid characters in expression: "${expression}"`);
                return { error: `Invalid characters in expression: "${expression}". Only numbers and +, -, *, /, (, ) are allowed.` };
            }

            // Evaluate safely using Function
            // eslint-disable-next-line no-new-func
            const result = new Function(`return ${expression}`)();
            
            console.log(`[CalculatorTool] Result: ${result}`);
            
            return {
                original_expression: params.expression,
                evaluated_expression: expression,
                result
            };
        } catch (error: any) {
            console.error(`[CalculatorTool] Calculation error: ${error.message}`);
            return { error: `Calculation error: ${error.message}` };
        }
    }
}
