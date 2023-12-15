const oneMinute = 60;
const oneHour = 60 * oneMinute;
const oneDay = 24 * oneHour;
const oneMonth = 30 * oneDay;
const oneYear = 12 * oneMonth;

export const getDate = (date: string): string | null => {
    try {
        const timeDifference = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        if (timeDifference < 0) throw new Error();

        switch (true) {
            case timeDifference >= 0 && timeDifference < oneMinute:
                return "방금 전";
            case timeDifference >= oneMinute && timeDifference < oneHour:
                const minutes = Math.floor(timeDifference / oneMinute);
                return `${minutes}분 전`;
            case timeDifference >= oneHour && timeDifference < oneDay:
                const hours = Math.floor(timeDifference / oneHour);
                return `${hours}시간 전`;
            case timeDifference >= oneDay && timeDifference < oneMonth:
                const days = Math.floor(timeDifference / oneDay);
                return `${days}일 전`;
            case timeDifference >= oneMonth && timeDifference < oneYear:
                const months = Math.floor(timeDifference / oneMonth);
                return `${months}개월 전`;
            case timeDifference > oneYear:
                const years = Math.floor(timeDifference / oneYear);
                return `${years}년 전`;
        }
    } catch {
        return null;
    }
};