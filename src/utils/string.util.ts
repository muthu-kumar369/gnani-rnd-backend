// src/utils/string.util.ts
class StringUtil {
    static capitalize(str: string): string {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    static truncate(str: string, maxLength: number): string {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    }

    static toKebabCase(str: string): string {
        if (!str) return '';
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }
}

export default StringUtil;