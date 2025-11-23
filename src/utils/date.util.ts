// src/utils/date.util.ts
import moment from 'moment';

class DateUtil {
    static format(date: Date, formatString: string = 'YYYY-MM-DD HH:mm:ss'): string {
        return moment(date).format(formatString);
    }

    static addDays(date: Date, days: number): Date {
        return moment(date).add(days, 'days').toDate();
    }

    static isFuture(date: Date): boolean {
        return moment(date).isAfter(moment());
    }
}

export default DateUtil;